/**
 * Assertions for the E2E UX harness (Phase 1).
 *
 * These are plain predicate helpers returning a structured {ok, failures}
 * result so both the deterministic faux test and the live suite can assert on
 * them without coupling to vitest's matchers.
 *
 *   - assertFiles    — format-EQUIVALENT file comparison.
 *   - assertBehavior — required / forbidden tool calls, counts, maxTurns.
 *   - assertText     — loose regex over the final assistant message.
 */

import type { RunResult, TrackedToolName, WorkspaceFile } from "./runner.js";

export interface AssertionResult {
	ok: boolean;
	failures: string[];
}

function combine(failures: string[]): AssertionResult {
	return { ok: failures.length === 0, failures };
}

/**
 * Normalize text for format-equivalent comparison.
 *
 * TODO(phase2): run both expected and actual through the repo formatter (biome)
 * so language-aware formatting differences (quote style, semicolons, trailing
 * commas) are ignored. Invoking biome in-process per-assertion is impractical
 * for Phase 1, so we apply a deterministic whitespace normalization here:
 *   - normalize CRLF/CR to LF
 *   - strip trailing whitespace on each line
 *   - collapse runs of blank lines to a single blank line
 *   - trim leading/trailing blank lines
 * This makes whitespace-only differences non-fatal while keeping the comparison
 * deterministic and dependency-free in CI.
 */
export function normalizeForCompare(text: string): string {
	return text
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/g, ""))
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/^\n+/, "")
		.replace(/\n+$/, "");
}

/** Expected file content for assertFiles. `content: null` asserts the file is absent. */
export interface ExpectedFile {
	path: string;
	content: string | null;
}

/**
 * Assert that captured workspace files match expectations, comparing content
 * format-equivalently (whitespace-normalized — see normalizeForCompare).
 */
export function assertFiles(actual: WorkspaceFile[], expected: ExpectedFile[]): AssertionResult {
	const failures: string[] = [];
	const byPath = new Map<string, WorkspaceFile>();
	for (const f of actual) byPath.set(f.path, f);

	for (const exp of expected) {
		const got = byPath.get(exp.path);
		if (exp.content === null) {
			if (got?.exists) failures.push(`expected file "${exp.path}" to be absent, but it exists`);
			continue;
		}
		if (!got || !got.exists || got.content === undefined) {
			failures.push(`expected file "${exp.path}" to exist, but it was not found`);
			continue;
		}
		const a = normalizeForCompare(got.content);
		const e = normalizeForCompare(exp.content);
		if (a !== e) {
			failures.push(
				`file "${exp.path}" content mismatch (format-equivalent):\n--- expected ---\n${e}\n--- actual ---\n${a}`,
			);
		}
	}
	return combine(failures);
}

/** Behavioral expectations over tool usage and turn count. */
export interface BehaviorExpectation {
	/** Tool names that MUST have been called (at least once, successfully unless requireSuccess=false). */
	requiredTools?: TrackedToolName[] | string[];
	/** Tool names that MUST NOT have been called at all. */
	forbiddenTools?: TrackedToolName[] | string[];
	/** Exact / minimum call counts per tool. */
	counts?: Partial<Record<string, { min?: number; max?: number; exact?: number }>>;
	/** Maximum allowed turns. */
	maxTurns?: number;
	/** When true (default), required tools must have at least one successful call. */
	requireSuccess?: boolean;
}

/** Assert behavioral expectations against a RunResult. */
export function assertBehavior(result: RunResult, expect: BehaviorExpectation): AssertionResult {
	const failures: string[] = [];
	const requireSuccess = expect.requireSuccess ?? true;

	for (const name of expect.requiredTools ?? []) {
		const tally = result.toolCalls[name];
		if (!tally || tally.calls === 0) {
			failures.push(`required tool "${name}" was never called`);
		} else if (requireSuccess && tally.success === 0) {
			failures.push(`required tool "${name}" was called ${tally.calls}x but never succeeded`);
		}
	}

	for (const name of expect.forbiddenTools ?? []) {
		const tally = result.toolCalls[name];
		if (tally && tally.calls > 0) {
			failures.push(`forbidden tool "${name}" was called ${tally.calls}x`);
		}
	}

	for (const [name, bound] of Object.entries(expect.counts ?? {})) {
		if (!bound) continue;
		const calls = result.toolCalls[name]?.calls ?? 0;
		if (bound.exact !== undefined && calls !== bound.exact) {
			failures.push(`tool "${name}" expected exactly ${bound.exact} calls, got ${calls}`);
		}
		if (bound.min !== undefined && calls < bound.min) {
			failures.push(`tool "${name}" expected at least ${bound.min} calls, got ${calls}`);
		}
		if (bound.max !== undefined && calls > bound.max) {
			failures.push(`tool "${name}" expected at most ${bound.max} calls, got ${calls}`);
		}
	}

	if (expect.maxTurns !== undefined && result.turns > expect.maxTurns) {
		failures.push(`expected at most ${expect.maxTurns} turns, got ${result.turns}`);
	}

	return combine(failures);
}

/** Assert a loose regex matches the final assistant message text. */
export function assertText(result: RunResult, pattern: RegExp): AssertionResult {
	const text = result.finalText ?? "";
	if (!pattern.test(text)) {
		return combine([`final assistant text did not match ${pattern}:\n${text}`]);
	}
	return combine([]);
}
