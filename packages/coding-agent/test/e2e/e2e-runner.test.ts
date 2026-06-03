/**
 * Deterministic ($0, no-keys) validation of the E2E harness.
 *
 * Runs in CI with NO provider keys: drives runner.ts with the faux provider and
 * scripted streams that emit real tool calls + usage, proving the runner
 * collects tool-calls/cost/turns, enforces the budget cap, detects ghost runs,
 * and that assertions.ts (file/behavior/text) work. This is the deterministic
 * cost-free proof that backs the gated live suite.
 *
 * Cost note: the faux stream zeroes usage.cost and re-estimates token counts
 * from content length. The faux harness reapplies calculateCost(model, usage)
 * via a message_end extension (exactly as real providers do), so cost is a real
 * function of the (faux) per-token price × emitted tokens. Tests therefore drive
 * cost via content size, not by hardcoding a dollar amount.
 */

import { afterEach, describe, expect, it } from "vitest";
import { assertBehavior, assertFiles, assertText, normalizeForCompare } from "./assertions.js";
import { buildCostReport, formatCostReport } from "./cost-report.js";
import { createFauxHarness, type FauxHarness, scriptedAssistant, text, toolCall } from "./faux-setup.js";
import { defaultMaxCostUSD, runTask, type Task } from "./runner.js";
import { checkFixBugResult, createFileTask, fixBugTask, readConfigTask } from "./tasks/index.js";

describe("E2E harness — deterministic faux validation ($0, no keys)", () => {
	const harnesses: FauxHarness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) harnesses.pop()?.cleanup();
	});

	async function newHarness(): Promise<FauxHarness> {
		const h = await createFauxHarness();
		harnesses.push(h);
		return h;
	}

	it("runs the create-file task: collects write tool call, cost, tokens, turns", async () => {
		const h = await newHarness();
		h.faux.setResponses([
			scriptedAssistant([toolCall("write", { path: "greeting.txt", content: "Hello" })]),
			scriptedAssistant([text("Done — created greeting.txt.")]),
		]);

		const result = await runTask(createFileTask.task, "faux", {
			model: h.model,
			authStorage: h.authStorage,
			modelRegistry: h.modelRegistry,
			resourceLoader: h.resourceLoader,
			captureFiles: createFileTask.captureFiles,
		});

		expect(result.ghost).toBe(false);
		expect(result.abortedOverBudget).toBe(false);
		expect(result.passed).toBe(true);
		expect(result.toolCalls.write.calls).toBe(1);
		expect(result.toolCalls.write.success).toBe(1);
		expect(result.tokens).toBeGreaterThan(0);
		expect(result.cost).toBeGreaterThan(0);
		expect(result.turns).toBeGreaterThanOrEqual(1);

		// assertFiles (format-equivalent) + assertBehavior
		const files = assertFiles(result.files, createFileTask.files!);
		expect(files.failures).toEqual([]);
		expect(files.ok).toBe(true);
		const behavior = assertBehavior(result, createFileTask.behavior!);
		expect(behavior.failures).toEqual([]);
	});

	it("runs the fix-bug task: collects read+edit, and the fix passes the checker", async () => {
		const h = await newHarness();
		const fixedNewText = "for (let i = 1; i <= n; i++) {";
		h.faux.setResponses([
			scriptedAssistant([toolCall("read", { path: "sum.ts" })]),
			scriptedAssistant([
				toolCall("edit", {
					path: "sum.ts",
					edits: [{ oldText: "for (let i = 1; i < n; i++) {", newText: fixedNewText }],
				}),
			]),
			scriptedAssistant([text("Fixed the off-by-one bug.")]),
		]);

		const result = await runTask(fixBugTask.task, "faux", {
			model: h.model,
			authStorage: h.authStorage,
			modelRegistry: h.modelRegistry,
			resourceLoader: h.resourceLoader,
			captureFiles: fixBugTask.captureFiles,
		});

		expect(result.ghost).toBe(false);
		expect(result.toolCalls.read.calls).toBe(1);
		expect(result.toolCalls.edit.calls).toBe(1);
		const behavior = assertBehavior(result, fixBugTask.behavior!);
		expect(behavior.failures).toEqual([]);

		const sumFile = result.files.find((f) => f.path === "sum.ts");
		expect(checkFixBugResult(sumFile?.content)).toBe(true);
	});

	it("runs the read-config task: read tool + loose text regex on final message", async () => {
		const h = await newHarness();
		h.faux.setResponses([
			scriptedAssistant([toolCall("read", { path: "config.json" })]),
			scriptedAssistant([text("8080")]),
		]);

		const result = await runTask(readConfigTask.task, "faux", {
			model: h.model,
			authStorage: h.authStorage,
			modelRegistry: h.modelRegistry,
			resourceLoader: h.resourceLoader,
		});

		expect(result.toolCalls.read.calls).toBe(1);
		const behavior = assertBehavior(result, readConfigTask.behavior!);
		expect(behavior.failures).toEqual([]);
		const textResult = assertText(result, readConfigTask.text!);
		expect(textResult.ok).toBe(true);
	});

	it("enforces the budget cap: aborts when cumulative cost exceeds maxCostUSD", async () => {
		const h = await newHarness();
		// A large text payload drives output tokens (and therefore cost) high; the
		// run must abort on the first finalized message, before the follow-ups.
		const bigText = "x".repeat(40000);
		h.faux.setResponses([
			scriptedAssistant([text(bigText)], { stopReason: "stop" }),
			scriptedAssistant([toolCall("write", { path: "b.txt", content: "y" })]),
			scriptedAssistant([text("should not reach here")]),
		]);

		const task: Task = { id: "budget-probe", prompt: "Write a lot.", files: [] };
		const result = await runTask(task, "faux", {
			model: h.model,
			authStorage: h.authStorage,
			modelRegistry: h.modelRegistry,
			resourceLoader: h.resourceLoader,
			maxCostUSD: 0.01,
			captureFiles: ["b.txt"],
		});

		expect(result.cost).toBeGreaterThan(0.01);
		expect(result.abortedOverBudget).toBe(true);
		expect(result.passed).toBe(false);
		// The follow-up tool call / final text must not have been reached.
		expect(result.toolCalls.write.calls).toBe(0);
		expect(result.finalText ?? "").not.toContain("should not reach here");
	});

	it("detects a ghost run: zero output tokens AND zero tool calls", async () => {
		const h = await newHarness();
		// Empty assistant message: no tool calls, no output content/tokens.
		h.faux.setResponses([scriptedAssistant([])]);

		const task: Task = { id: "ghost-probe", prompt: "Do nothing.", files: [] };
		const result = await runTask(task, "faux", {
			model: h.model,
			authStorage: h.authStorage,
			modelRegistry: h.modelRegistry,
			resourceLoader: h.resourceLoader,
		});

		expect(result.ghost).toBe(true);
		expect(result.passed).toBe(false);
	});

	it("detects a ghost run on transport error (no responses scripted)", async () => {
		const h = await newHarness();
		// No scripted responses → faux emits an error → no usable assistant content.
		const task: Task = { id: "transport-error", prompt: "anything", files: [] };
		const result = await runTask(task, "faux", {
			model: h.model,
			authStorage: h.authStorage,
			modelRegistry: h.modelRegistry,
			resourceLoader: h.resourceLoader,
		});

		expect(result.ghost).toBe(true);
		expect(result.passed).toBe(false);
	});

	it("assertions.ts: normalizeForCompare ignores whitespace-only differences", () => {
		// Trailing whitespace + CRLF differences are erased; a single blank line is
		// preserved (only runs of 3+ newlines collapse).
		expect(normalizeForCompare("Hello   \r\nWorld\n")).toBe(normalizeForCompare("Hello\nWorld"));
		expect(normalizeForCompare("a\n\n\n\nb")).toBe(normalizeForCompare("a\n\nb"));
		const filesOk = assertFiles(
			[{ path: "x.txt", content: "Hello \n", exists: true }],
			[{ path: "x.txt", content: "Hello" }],
		);
		expect(filesOk.ok).toBe(true);
		const filesBad = assertFiles(
			[{ path: "x.txt", content: "Goodbye", exists: true }],
			[{ path: "x.txt", content: "Hello" }],
		);
		expect(filesBad.ok).toBe(false);
	});

	it("cost-report aggregates runs into totals + per-provider + per-task breakdowns", async () => {
		const h = await newHarness();
		h.faux.setResponses([
			scriptedAssistant([toolCall("write", { path: "greeting.txt", content: "Hello" })]),
			scriptedAssistant([text("done")]),
		]);
		const result = await runTask(createFileTask.task, "faux", {
			model: h.model,
			authStorage: h.authStorage,
			modelRegistry: h.modelRegistry,
			resourceLoader: h.resourceLoader,
			captureFiles: createFileTask.captureFiles,
		});

		const report = buildCostReport([result]);
		expect(report.totals.runs).toBe(1);
		expect(report.totals.cost).toBeGreaterThan(0);
		expect(report.byProvider.faux.runs).toBe(1);
		expect(report.byTask["create-greeting"].runs).toBe(1);
		expect(formatCostReport(report)).toContain("Helix E2E Cost Report");
	});

	it("defaultMaxCostUSD falls back to $1.00 when env is unset", () => {
		const prev = process.env.HELIX_E2E_MAX_COST_USD;
		delete process.env.HELIX_E2E_MAX_COST_USD;
		try {
			expect(defaultMaxCostUSD()).toBe(1.0);
		} finally {
			if (prev !== undefined) process.env.HELIX_E2E_MAX_COST_USD = prev;
		}
	});
});
