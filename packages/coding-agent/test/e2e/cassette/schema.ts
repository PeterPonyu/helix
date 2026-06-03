/**
 * Cassette JSON shape for the record/replay layer (Phase 2).
 *
 * A cassette captures the provider-level event stream of an E2E run so CI can
 * replay it deterministically at $0 — without any network or provider keys.
 *
 * Design notes:
 *   - We record at the `ApiProvider` seam (see recorder.ts): the WHOLE agent /
 *     tool loop stays real, only the provider's `stream` is recorded/replayed.
 *     Each call to `stream` becomes one `interaction`.
 *   - `events` is the verbatim `AssistantMessageEvent[]` the provider emitted,
 *     including the terminal `done` / `error` event. On replay we re-emit them
 *     in order, so the SDK's normalization, tool execution, and the cost
 *     extension all run exactly as they did live.
 *   - `final` is a denormalized view of the terminal message's stopReason +
 *     usage. It is redundant with the terminal event (which carries the full
 *     `AssistantMessage`) but is kept for cheap inspection / assertions and as
 *     a guard that the recorded stream actually terminated.
 *   - `recordedAt` is PASSED IN to the recorder (never read from `Date.now()`
 *     inside the recorder core) so cassette CONTENT is deterministic and tests
 *     can pin it to "". Any timestamp baked into recorded event/message content
 *     is ignored by the request matcher (see recorder.ts canonicalization).
 */

import type { AssistantMessageEvent, StopReason, Usage } from "@earendil-works/pi-ai";

/** Bump when the on-disk shape changes incompatibly. */
export const CASSETTE_VERSION = 1 as const;

/** Provenance for a recorded cassette (not used for matching). */
export interface CassetteMetadata {
	/** Logical provider name (e.g. "faux", "anthropic"). */
	provider: string;
	/** Model id the run targeted. */
	model: string;
	/** Phase 1 scenario id (matrix id or "faux"). */
	scenarioId: string;
	/** Phase 1 task id. */
	taskId: string;
	/**
	 * Timestamp the cassette was recorded. PASSED IN by the caller; the recorder
	 * core never calls Date.now(). Empty string in deterministic tests.
	 */
	recordedAt: string;
}

/**
 * The matchable shape of a provider request. We deliberately store only a
 * canonical model id plus a digest of the messages (not the raw messages) so
 * the fixture stays small and volatile fields (timestamps) cannot leak in.
 */
export interface CassetteRequest {
	/** Canonical model id (model.id). */
	model: string;
	/** Stable digest of the canonicalized request context (see recorder.ts). */
	messagesDigest: string;
}

/** Denormalized terminal state of one interaction. */
export interface CassetteFinal {
	stopReason: StopReason;
	usage: Usage;
}

/** One provider `stream` call: its request, emitted events, and terminal state. */
export interface CassetteInteraction {
	request: CassetteRequest;
	events: AssistantMessageEvent[];
	final: CassetteFinal;
}

/** A full cassette: metadata + an ordered list of interactions. */
export interface Cassette {
	version: typeof CASSETTE_VERSION;
	metadata: CassetteMetadata;
	interactions: CassetteInteraction[];
}

/** Build an empty cassette skeleton for a recording session. */
export function emptyCassette(metadata: CassetteMetadata): Cassette {
	return { version: CASSETTE_VERSION, metadata, interactions: [] };
}
