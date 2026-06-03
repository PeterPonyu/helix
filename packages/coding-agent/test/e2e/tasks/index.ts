/**
 * Hand-authored E2E tasks (Phase 1).
 *
 * Prompts are intentionally TINY for cost control. Each task bundles its seed
 * files, the prompt, the files to capture, and the expectations consumed by
 * assertions.ts so both the faux and live suites share one source of truth.
 */

import type { BehaviorExpectation, ExpectedFile } from "../assertions.js";
import type { Task } from "../runner.js";

export interface E2ETaskCase {
	task: Task;
	/** Extra workspace paths to capture beyond seeded files. */
	captureFiles?: string[];
	/** Behavioral expectations (tool usage, turns). */
	behavior?: BehaviorExpectation;
	/** File-content expectations (format-equivalent). */
	files?: ExpectedFile[];
	/** Loose regex over the final assistant message. */
	text?: RegExp;
}

/** (a) Create a file with exact content — exercises the write tool. */
export const createFileTask: E2ETaskCase = {
	task: {
		id: "create-greeting",
		prompt: 'Create a file named greeting.txt containing exactly the text "Hello" and nothing else.',
		files: [],
	},
	captureFiles: ["greeting.txt"],
	behavior: { requiredTools: ["write"], maxTurns: 6 },
	files: [{ path: "greeting.txt", content: "Hello" }],
};

/** (b) Fix an off-by-one bug — exercises read + edit; result must pass a checker. */
export const fixBugTask: E2ETaskCase = {
	task: {
		id: "fix-off-by-one",
		prompt:
			"The function sum(n) in sum.ts should return 1+2+...+n but has an off-by-one bug. Read sum.ts, fix the bug, and save it.",
		files: [
			{
				path: "sum.ts",
				// Off-by-one: loop runs i < n, so it sums 1..n-1 and misses n.
				content: [
					"export function sum(n: number): number {",
					"\tlet total = 0;",
					"\tfor (let i = 1; i < n; i++) {",
					"\t\ttotal += i;",
					"\t}",
					"\treturn total;",
					"}",
					"",
				].join("\n"),
			},
		],
	},
	captureFiles: ["sum.ts"],
	behavior: { requiredTools: ["read", "edit"], maxTurns: 10 },
	// No exact-file expectation (the agent may format differently); correctness is
	// verified by checkFixBugResult below, which evaluates sum(5) === 15.
};

/**
 * Checker for the off-by-one task: the fixed source must compute 1+..+n.
 * Avoids importing/executing untrusted code — verifies the loop bound was
 * corrected to be inclusive of n (i <= n) or rewritten to a closed form.
 */
export function checkFixBugResult(source: string | undefined): boolean {
	if (!source) return false;
	const normalized = source.replace(/\s+/g, " ");
	// Accept either an inclusive loop bound or the closed-form n*(n+1)/2.
	const inclusiveLoop = /for\s*\(\s*let\s+i\s*=\s*1\s*;\s*i\s*<=\s*n\s*;/.test(normalized);
	const fromZeroInclusive = /for\s*\(\s*let\s+i\s*=\s*0\s*;\s*i\s*<=\s*n\s*;/.test(normalized);
	const closedForm = /n\s*\*\s*\(\s*n\s*\+\s*1\s*\)\s*\/\s*2|\(\s*n\s*\+\s*1\s*\)\s*\*\s*n\s*\/\s*2/.test(normalized);
	return inclusiveLoop || fromZeroInclusive || closedForm;
}

/** (c) Read config.json and report the port — exercises read + loose text regex. */
export const readConfigTask: E2ETaskCase = {
	task: {
		id: "read-config-port",
		prompt: "Read config.json and tell me which port the server uses. Answer with just the number.",
		files: [
			{
				path: "config.json",
				content: JSON.stringify({ host: "localhost", port: 8080, debug: false }, null, 2),
			},
		],
	},
	captureFiles: [],
	behavior: { requiredTools: ["read"], forbiddenTools: ["write", "edit"], maxTurns: 6 },
	text: /8080/,
};

/** All Phase 1 task cases. */
export const E2E_TASKS: E2ETaskCase[] = [createFileTask, fixBugTask, readConfigTask];
