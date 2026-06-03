/**
 * Record/replay at the `ApiProvider` seam (Phase 2).
 *
 * `wrapApiProviderForRecording` returns an `ApiProvider` that transparently
 * replaces a real provider for the duration of an E2E run. The WHOLE agent /
 * tool loop stays real — only the provider's `stream` is recorded or replayed:
 *
 *   - record mode: call through to `real.stream`, tee every emitted
 *     `AssistantMessageEvent` into the in-memory cassette, and (on the run's
 *     completion) persist it via the store after secret scanning.
 *   - replay mode: serve recorded events as an async stream WITHOUT touching
 *     `real` (no network). The terminal `done`/`error` event carries the full
 *     `AssistantMessage` incl. `usage`, so the SDK's cost extension reapplies
 *     `calculateCost` exactly as it does live — replayed cost == recorded cost.
 *   - auto mode: replay-on-hit (a matching interaction exists), record-on-miss.
 *
 * Matching is STRICT and SEQUENTIAL: the Nth `stream` call maps to the Nth
 * recorded interaction. Request equality is checked on a canonical model id +
 * a digest of the canonicalized request context. Volatile fields (timestamps,
 * tool-call ids, usage/cost) are stripped before digesting so determinism holds.
 */

import { createHash } from "node:crypto";
import {
	type ApiProvider,
	type AssistantMessage,
	type AssistantMessageEvent,
	type AssistantMessageEventStream,
	type Context,
	createAssistantMessageEventStream,
	type Model,
	type StreamOptions,
} from "@earendil-works/pi-ai";
import { redactCassette, scanForSecrets } from "./redactor.js";
import { type Cassette, type CassetteInteraction, type CassetteMetadata, emptyCassette } from "./schema.js";
import type { CassetteStore } from "./store.js";

export type CassetteMode = "record" | "replay" | "auto";

/** Resolve the cassette mode from env, defaulting per CI rule. */
export function resolveCassetteMode(): CassetteMode {
	const raw = (process.env.HELIX_CASSETTE_MODE ?? "").toLowerCase();
	if (raw === "record" || raw === "replay" || raw === "auto") return raw;
	// CI=true ⇒ strict replay (deterministic, $0, fails on miss/mismatch).
	if (process.env.CI === "true") return "replay";
	// Local default: replay-on-hit, record-on-miss.
	return "auto";
}

/** Thrown in replay mode when no recorded interaction matches a request. */
export class CassetteReplayError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CassetteReplayError";
	}
}

/** Config carrying everything the recorder needs beyond the seam itself. */
export interface RecorderConfig {
	/** Cassette provenance + the PASSED-IN recordedAt timestamp. */
	metadata: CassetteMetadata;
}

/**
 * The wrapper exposes the standard `ApiProvider` plus a `finalize()` the runner
 * calls once the run completes to persist a freshly recorded cassette.
 */
export interface RecordingApiProvider extends ApiProvider {
	/**
	 * Persist the recorded cassette (record / auto-miss only). No-op on pure
	 * replay. Scans for secrets and refuses to write on detection.
	 */
	finalize(): void;
	/** The in-memory cassette (for assertions/tests). */
	readonly cassette: Cassette;
	/** True when at least one interaction was recorded (vs replayed). */
	readonly recordedAny: boolean;
}

/**
 * Strip volatile fields from a value tree so the digest is deterministic.
 * Removes timestamps, tool-call ids, usage, and cost — none affect which
 * response a deterministic provider returns, but all vary run to run.
 */
function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
			// Skip volatile fields: timestamps, usage/cost, and the per-run-random
			// tool-call identifiers (the faux + real providers mint fresh ids each
			// run, and tool-result messages reference them via toolCallId).
			if (
				key === "timestamp" ||
				key === "usage" ||
				key === "id" ||
				key === "responseId" ||
				key === "toolCallId" ||
				key === "thoughtSignature" ||
				// Provider-instance identifiers: the faux provider mints a random
				// `api`/`provider` per registration, so prior-turn assistant messages
				// in the context carry a per-run value that is irrelevant to which
				// response is returned. (Real providers keep these stable.)
				key === "api" ||
				key === "provider"
			) {
				continue;
			}
			out[key] = canonicalize(child);
		}
		return out;
	}
	return value;
}

/**
 * Mask volatile lines in the system prompt so the digest is stable across runs
 * and days. The coding-agent system prompt embeds the current date and the
 * (per-run, temp) working directory; neither changes which response a
 * deterministic provider returns, but both vary run to run. The spec requires
 * recorded timestamps to be ignored by the matcher — this is that rule applied
 * to the system prompt. Exported for testing.
 */
export function normalizeSystemPrompt(systemPrompt: string | undefined): string | undefined {
	if (systemPrompt === undefined) return undefined;
	return systemPrompt
		.replace(/^(\s*Current date:).*$/gim, "$1 <DATE>")
		.replace(/^(\s*Current working directory:).*$/gim, "$1 <CWD>");
}

/** Stable digest of a request context (systemPrompt + messages + tools). */
export function messagesDigest(context: Context): string {
	const canonical = canonicalize({
		systemPrompt: normalizeSystemPrompt(context.systemPrompt),
		messages: context.messages,
		tools: context.tools,
	});
	return createHash("sha256").update(stableStringify(canonical)).digest("hex");
}

/** Deterministic JSON: object keys sorted recursively. */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	if (value && typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
		return `{${entries.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

/** Build a replay stream that re-emits recorded events, then terminates. */
function replayStream(interaction: CassetteInteraction): AssistantMessageEventStream {
	const stream = createAssistantMessageEventStream();
	// Emit asynchronously so consumers attach iterators/result() first — mirrors
	// how the faux provider schedules via queueMicrotask.
	queueMicrotask(() => {
		let terminal: AssistantMessage | undefined;
		for (const event of interaction.events) {
			stream.push(event as AssistantMessageEvent);
			if (event.type === "done") terminal = event.message;
			else if (event.type === "error") terminal = event.error;
		}
		// `push` of a done/error event already resolved the final result; `end`
		// flushes any waiting consumers. Pass the terminal message defensively in
		// case a cassette lacks an explicit terminal event.
		stream.end(terminal);
	});
	return stream;
}

/** Extract the terminal message from a recorded event list (or undefined). */
function terminalMessage(events: AssistantMessageEvent[]): AssistantMessage | undefined {
	for (let i = events.length - 1; i >= 0; i--) {
		const e = events[i];
		if (e.type === "done") return e.message;
		if (e.type === "error") return e.error;
	}
	return undefined;
}

/**
 * Wrap a real `ApiProvider` for record/replay against a cassette store.
 *
 * The returned provider keeps `real.api`; the caller (runner) is responsible for
 * swapping it into the registry under that api and restoring the original after
 * the run.
 */
export function wrapApiProviderForRecording(
	real: ApiProvider,
	cassetteStore: CassetteStore,
	mode: CassetteMode,
	config: RecorderConfig,
): RecordingApiProvider {
	const { scenarioId, taskId } = config.metadata;

	// In replay/auto, load any existing cassette to serve from.
	const existing = mode === "record" ? undefined : cassetteStore.read(scenarioId, taskId);
	const cassette: Cassette = existing ?? emptyCassette(config.metadata);

	let callIndex = 0;
	let recordedAny = false;

	function streamImpl(model: Model<string>, context: Context, options?: StreamOptions): AssistantMessageEventStream {
		const index = callIndex++;
		const digest = messagesDigest(context);
		const recorded = cassette.interactions[index];
		const hit = !!recorded && recorded.request.model === model.id && recorded.request.messagesDigest === digest;

		if (mode === "replay") {
			if (!recorded) {
				throw new CassetteReplayError(
					`No recorded interaction #${index} for cassette ${cassetteFor(scenarioId, taskId)} ` +
						`(have ${cassette.interactions.length}). Record it locally with HELIX_CASSETTE_MODE=record.`,
				);
			}
			if (!hit) {
				throw new CassetteReplayError(
					`Cassette mismatch at interaction #${index} for ${cassetteFor(scenarioId, taskId)}: ` +
						`expected model=${recorded.request.model} digest=${recorded.request.messagesDigest.slice(0, 12)} ` +
						`but got model=${model.id} digest=${digest.slice(0, 12)}.`,
				);
			}
			return replayStream(recorded);
		}

		if (mode === "auto" && hit && recorded) {
			return replayStream(recorded);
		}

		// record (or auto-miss): call through and tee events into the cassette.
		const inner = (real.stream as ApiProvider["stream"])(
			model as Parameters<ApiProvider["stream"]>[0],
			context,
			options,
		);
		return teeStream(inner, model, digest, index);
	}

	function teeStream(
		inner: AssistantMessageEventStream,
		model: Model<string>,
		digest: string,
		index: number,
	): AssistantMessageEventStream {
		const out = createAssistantMessageEventStream();
		const captured: AssistantMessageEvent[] = [];
		void (async () => {
			try {
				for await (const event of inner) {
					captured.push(event);
					out.push(event);
				}
			} catch (err) {
				// Surface as a terminal error event so downstream sees a clean stream.
				const message = errorMessage(model, err);
				const errEvent: AssistantMessageEvent = { type: "error", reason: "error", error: message };
				captured.push(errEvent);
				out.push(errEvent);
			}
			const terminal = terminalMessage(captured);
			// Record the interaction at its sequential slot.
			const interaction: CassetteInteraction = {
				request: { model: model.id, messagesDigest: digest },
				events: captured,
				final: {
					stopReason: terminal?.stopReason ?? "error",
					usage: terminal?.usage ?? emptyUsage(),
				},
			};
			cassette.interactions[index] = interaction;
			recordedAny = true;
			out.end(terminal);
		})();
		return out;
	}

	const provider: RecordingApiProvider = {
		api: real.api,
		stream: streamImpl as ApiProvider["stream"],
		streamSimple: streamImpl as ApiProvider["streamSimple"],
		finalize() {
			if (!recordedAny) return;
			const redacted = redactCassette(cassette);
			const serialized = `${JSON.stringify(redacted, null, 2)}\n`;
			// Hard gate: refuse to write if a credential pattern appears.
			scanForSecrets(serialized);
			cassetteStore.write(redacted);
		},
		get cassette() {
			return cassette;
		},
		get recordedAny() {
			return recordedAny;
		},
	};
	return provider;
}

function cassetteFor(scenarioId: string, taskId: string): string {
	return `${scenarioId}__${taskId}`;
}

function emptyUsage(): AssistantMessage["usage"] {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function errorMessage(model: Model<string>, err: unknown): AssistantMessage {
	return {
		role: "assistant",
		content: [],
		api: model.api,
		provider: model.provider,
		model: model.id,
		usage: emptyUsage(),
		stopReason: "error",
		errorMessage: err instanceof Error ? err.message : String(err),
		timestamp: 0,
	};
}
