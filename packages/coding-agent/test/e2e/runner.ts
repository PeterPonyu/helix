/**
 * In-process E2E runner for the real-provider UX harness (Phase 1).
 *
 * `runTask` spins up a real `AgentSession` (via the SDK seam `createAgentSession`)
 * in a fresh temp workspace, drives a single prompt, and collects UX signals:
 * tool-call counts (read/edit/write/bash) with success/failure, turn count, the
 * transcript, and cumulative usage cost + tokens read straight from
 * `session.getSessionStats()` (which already runs the repo cost math).
 *
 * It enforces two safety caps and one health check:
 *   - Budget cap (`maxCostUSD`): when cumulative cost exceeds the cap mid-run we
 *     trip an AbortController and call `session.abort()`, marking
 *     `abortedOverBudget`.
 *   - Turn cap (`maxTurns`): aborts and marks `abortedMaxTurns`.
 *   - Ghost-run detection: zero OUTPUT tokens AND zero tool calls (or a
 *     transport error) ⇒ `ghost: true`. (Input tokens are billed even when the
 *     model returns nothing, so output tokens are the signal of real work.)
 *
 * Cost math, the SDK, and the model registry are REUSED, not rebuilt. The same
 * code path serves the deterministic faux ($0, CI) and live (gated) suites; the
 * caller supplies the model + a configured auth/registry pair.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Model } from "@earendil-works/pi-ai";
import type { AgentSessionEvent } from "../../src/core/agent-session.js";
import type { AuthStorage } from "../../src/core/auth-storage.js";
import type { ModelRegistry } from "../../src/core/model-registry.js";
import type { ResourceLoader } from "../../src/core/resource-loader.js";
import { createAgentSession } from "../../src/core/sdk.js";
import { SessionManager } from "../../src/core/session-manager.js";

/** Built-in coding tool names tracked by the harness. */
export type TrackedToolName = "read" | "edit" | "write" | "bash";
const TRACKED_TOOLS: TrackedToolName[] = ["read", "edit", "write", "bash"];

/** A seedable file for the task workspace. */
export interface TaskFile {
	path: string;
	content: string;
}

/** A hand-authored task: prompt + seed files + expectations consumed by assertions.ts. */
export interface Task {
	id: string;
	/** TINY prompt — keep it short for cost control. */
	prompt: string;
	/** Files seeded into the fresh workspace before the run. */
	files?: TaskFile[];
}

/** Per-tool-name tally of successful and failed executions. */
export interface ToolCallTally {
	calls: number;
	success: number;
	failure: number;
}

/** Snapshot of a file in the workspace after the run, for assertFiles. */
export interface WorkspaceFile {
	path: string;
	content: string | undefined;
	exists: boolean;
}

/** Structured result of a single task × scenario run. */
export interface RunResult {
	scenarioId: string;
	taskId: string;
	/** True when the run completed without aborting and without a ghost/transport error. */
	passed: boolean;
	/** Cumulative USD cost (from session.getSessionStats().cost). */
	cost: number;
	/** Cumulative total tokens. */
	tokens: number;
	/** Turn count (turn_end events). */
	turns: number;
	/** Per-tool tallies keyed by tool name. */
	toolCalls: Record<string, ToolCallTally>;
	/** Captured workspace files (those listed in `captureFiles`, else seeded paths). */
	files: WorkspaceFile[];
	/** Final assistant text (for assertText). */
	finalText: string | undefined;
	/** Zero output tokens AND zero tool calls, or a transport error. */
	ghost: boolean;
	abortedOverBudget: boolean;
	abortedMaxTurns: boolean;
	/** Any rate-limit / response headers surfaced by the provider (best-effort). */
	rateLimit?: Record<string, string>;
	error?: string;
}

/** Options controlling a run. */
export interface RunOptions {
	/** Model to drive the session (faux model for CI, real model for live). */
	model: Model<any>;
	/** Auth storage with credentials configured for the model's provider. */
	authStorage: AuthStorage;
	/** Model registry that knows about the model's provider. */
	modelRegistry: ModelRegistry;
	/**
	 * Budget cap in USD. When cumulative cost exceeds it, the run is aborted and
	 * marked abortedOverBudget. Default: HELIX_E2E_MAX_COST_USD env, else 1.00.
	 */
	maxCostUSD?: number;
	/** Max turns before aborting (default 30). */
	maxTurns?: number;
	/** Tool allowlist passed to the session (default: read/bash/edit/write). */
	tools?: string[];
	/** Extra workspace-relative paths to capture in the result (added to seed paths). */
	captureFiles?: string[];
	/**
	 * Optional resource loader. Live runs leave this undefined (the SDK builds a
	 * DefaultResourceLoader). The faux test passes one carrying a message_end cost
	 * extension so cost flows the same way it does for real providers.
	 */
	resourceLoader?: ResourceLoader;
}

/** Default budget cap, resolved from env with a $1.00 fallback. */
export function defaultMaxCostUSD(): number {
	const raw = process.env.HELIX_E2E_MAX_COST_USD;
	if (raw) {
		const parsed = Number.parseFloat(raw);
		if (Number.isFinite(parsed) && parsed > 0) return parsed;
	}
	return 1.0;
}

function emptyTally(): ToolCallTally {
	return { calls: 0, success: 0, failure: 0 };
}

function seedWorkspace(dir: string, files: TaskFile[] | undefined): void {
	for (const file of files ?? []) {
		const abs = join(dir, file.path);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, file.content, "utf-8");
	}
}

function captureWorkspaceFiles(dir: string, paths: string[]): WorkspaceFile[] {
	const seen = new Set<string>();
	const out: WorkspaceFile[] = [];
	for (const p of paths) {
		if (seen.has(p)) continue;
		seen.add(p);
		const abs = join(dir, p);
		if (existsSync(abs)) {
			out.push({ path: p, content: readFileSync(abs, "utf-8"), exists: true });
		} else {
			out.push({ path: p, content: undefined, exists: false });
		}
	}
	return out;
}

/**
 * Run a single task under a single scenario. Always cleans up the temp dir.
 *
 * `scenarioId` is carried through purely for reporting; the caller decides which
 * model/credentials a scenario maps to and supplies them via `opts`.
 */
export async function runTask(task: Task, scenarioId: string, opts: RunOptions): Promise<RunResult> {
	const maxCostUSD = opts.maxCostUSD ?? defaultMaxCostUSD();
	const maxTurns = opts.maxTurns ?? 30;
	const tools = opts.tools ?? [...TRACKED_TOOLS];

	const tempDir = mkdtempSync(join(tmpdir(), "helix-e2e-"));
	seedWorkspace(tempDir, task.files);

	const toolCalls: Record<string, ToolCallTally> = {};
	for (const name of TRACKED_TOOLS) toolCalls[name] = emptyTally();

	let turns = 0;
	let abortedOverBudget = false;
	let abortedMaxTurns = false;
	let transportError = false;
	let errorMessage: string | undefined;
	let rateLimit: Record<string, string> | undefined;

	let dispose: (() => void) | undefined;

	try {
		const { session: created } = await createAgentSession({
			model: opts.model,
			authStorage: opts.authStorage,
			modelRegistry: opts.modelRegistry,
			sessionManager: SessionManager.inMemory(),
			cwd: tempDir,
			// The SDK builds the built-in coding tools (read/bash/edit/write) bound
			// to `cwd`, so passing the names here is equivalent to wiring
			// createCodingTools(tempDir) — and is the actual SDK seam (tools is a
			// string allowlist, not tool instances).
			tools,
			resourceLoader: opts.resourceLoader,
		} as Parameters<typeof createAgentSession>[0]);
		dispose = () => created.dispose();

		const abortBudget = async (kind: "budget" | "turns") => {
			if (kind === "budget") abortedOverBudget = true;
			else abortedMaxTurns = true;
			try {
				await created.abort();
			} catch {
				// abort is best-effort; the stats snapshot below is the source of truth.
			}
		};

		const listener = (event: AgentSessionEvent) => {
			switch (event.type) {
				case "turn_end": {
					turns += 1;
					if (turns >= maxTurns && !abortedMaxTurns) {
						void abortBudget("turns");
					}
					break;
				}
				case "tool_execution_end": {
					const name = event.toolName;
					if (!toolCalls[name]) toolCalls[name] = emptyTally();
					toolCalls[name].calls += 1;
					if (event.isError) toolCalls[name].failure += 1;
					else toolCalls[name].success += 1;
					break;
				}
				case "message_end": {
					// Budget enforcement: cost accrues on finalized assistant messages.
					// Read the SDK's own cumulative cost so we never duplicate cost math.
					const stats = created.getSessionStats();
					if (stats.cost > maxCostUSD && !abortedOverBudget) {
						void abortBudget("budget");
					}
					break;
				}
				default:
					break;
			}
		};

		const unsubscribe = created.subscribe(listener);
		try {
			await created.prompt(task.prompt);
		} catch (err) {
			// A thrown error from prompt() (e.g. transport failure, no creds) is a
			// ghost-class signal — the agent never produced usable work.
			transportError = true;
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			unsubscribe();
		}

		const stats = created.getSessionStats();
		const cost = stats.cost;
		const tokens = stats.tokens.total;
		const outputTokens = stats.tokens.output;
		const finalText = created.getLastAssistantText();

		// Detect a provider-level failure surfaced as an assistant message with an
		// error/aborted stop reason and no usable content (transport-class ghost).
		const lastAssistant = created.messages
			.slice()
			.reverse()
			.find((m) => m.role === "assistant") as
			| { role: "assistant"; stopReason?: string; errorMessage?: string; content: unknown[] }
			| undefined;
		const totalToolCalls = Object.values(toolCalls).reduce((sum, t) => sum + t.calls, 0);
		const failedTurn =
			!!lastAssistant &&
			(lastAssistant.stopReason === "error" || lastAssistant.stopReason === "aborted") &&
			lastAssistant.content.length === 0 &&
			totalToolCalls === 0;
		if (failedTurn && !errorMessage) {
			transportError = true;
			errorMessage = lastAssistant?.errorMessage ?? "agent produced no usable assistant content";
		}

		// Best-effort rate-limit headers: surfaced via lastResponseHeaders if present.
		const maybeHeaders = (created as unknown as { lastResponseHeaders?: Record<string, string> }).lastResponseHeaders;
		if (maybeHeaders) {
			const picked: Record<string, string> = {};
			for (const [k, v] of Object.entries(maybeHeaders)) {
				if (/ratelimit|retry-after/i.test(k)) picked[k] = v;
			}
			if (Object.keys(picked).length > 0) rateLimit = picked;
		}

		// Ghost run: the agent produced no usable work. A transport error always
		// qualifies; otherwise it is zero OUTPUT tokens AND zero tool calls (input
		// tokens are billed even when the model returns nothing, so output tokens
		// are the signal that real work was emitted).
		const ghost = transportError || (outputTokens === 0 && totalToolCalls === 0);

		const capturePaths = [...(task.files?.map((f) => f.path) ?? []), ...(opts.captureFiles ?? [])];
		const files = captureWorkspaceFiles(tempDir, capturePaths);

		const passed = !ghost && !abortedOverBudget && !abortedMaxTurns && !transportError;

		return {
			scenarioId,
			taskId: task.id,
			passed,
			cost,
			tokens,
			turns,
			toolCalls,
			files,
			finalText,
			ghost,
			abortedOverBudget,
			abortedMaxTurns,
			rateLimit,
			error: errorMessage,
		};
	} catch (err) {
		// Failure before/around session construction is itself a ghost run.
		const capturePaths = [...(task.files?.map((f) => f.path) ?? []), ...(opts.captureFiles ?? [])];
		return {
			scenarioId,
			taskId: task.id,
			passed: false,
			cost: 0,
			tokens: 0,
			turns,
			toolCalls,
			files: captureWorkspaceFiles(tempDir, capturePaths),
			finalText: undefined,
			ghost: true,
			abortedOverBudget,
			abortedMaxTurns,
			error: err instanceof Error ? err.message : String(err),
		};
	} finally {
		try {
			dispose?.();
		} catch {
			// ignore dispose errors
		}
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	}
}
