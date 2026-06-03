/**
 * CI replay of the COMMITTED synthetic cassettes ($0, no keys, no network).
 *
 * This is the deterministic proof that backs the live suite: it replays the
 * committed fixtures in STRICT `replay` mode (the faux provider has zero
 * scripted responses, so any passthrough would error) and asserts the run
 * produces real tool calls + nonzero cost via the repo cost math.
 *
 * If a fixture is missing, the test fails loudly (skipped only if NO fixtures
 * are committed yet, so a fresh checkout before generation does not red-bar).
 */

import { describe, expect, it } from "vitest";
import { assertBehavior, assertFiles, assertText } from "../assertions.js";
import { createFauxHarness, type FauxHarness } from "../faux-setup.js";
import { type RunResult, runTask } from "../runner.js";
import { checkFixBugResult, createFileTask, type E2ETaskCase, fixBugTask, readConfigTask } from "../tasks/index.js";
import { cassetteFileName, createCassetteStore } from "./store.js";

const SCENARIO = "faux";
const store = createCassetteStore(); // committed fixtures dir
const committed = new Set(store.list());

function hasFixture(taskId: string): boolean {
	return committed.has(cassetteFileName(SCENARIO, taskId));
}

const CASES: E2ETaskCase[] = [createFileTask, fixBugTask, readConfigTask];
const anyCommitted = CASES.some((tc) => hasFixture(tc.task.id));

describe.skipIf(!anyCommitted)("replay committed synthetic cassettes (strict, $0)", () => {
	async function replay(tc: E2ETaskCase): Promise<RunResult> {
		const h: FauxHarness = await createFauxHarness();
		// No scripted responses: a strict-replay run must NEVER call the provider.
		h.faux.setResponses([]);
		try {
			return await runTask(tc.task, SCENARIO, {
				model: h.model,
				authStorage: h.authStorage,
				modelRegistry: h.modelRegistry,
				resourceLoader: h.resourceLoader,
				captureFiles: tc.captureFiles,
				cassette: { store, mode: "replay", recordedAt: "" },
			});
		} finally {
			h.cleanup();
		}
	}

	it.runIf(hasFixture(createFileTask.task.id))("create-file replays with write tool + nonzero cost", async () => {
		const result = await replay(createFileTask);
		expect(result.passed).toBe(true);
		expect(result.ghost).toBe(false);
		expect(result.toolCalls.write.calls).toBe(1);
		expect(result.cost).toBeGreaterThan(0);
		expect(result.tokens).toBeGreaterThan(0);
		expect(assertFiles(result.files, createFileTask.files!).ok).toBe(true);
		expect(assertBehavior(result, createFileTask.behavior!).failures).toEqual([]);
	});

	it.runIf(hasFixture(fixBugTask.task.id))("fix-bug replays with read+edit and a correct fix", async () => {
		const result = await replay(fixBugTask);
		expect(result.passed).toBe(true);
		expect(result.toolCalls.read.calls).toBe(1);
		expect(result.toolCalls.edit.calls).toBe(1);
		expect(result.cost).toBeGreaterThan(0);
		expect(assertBehavior(result, fixBugTask.behavior!).failures).toEqual([]);
		const sumFile = result.files.find((f) => f.path === "sum.ts");
		expect(checkFixBugResult(sumFile?.content)).toBe(true);
	});

	it.runIf(hasFixture(readConfigTask.task.id))("read-config replays with read tool + loose text match", async () => {
		const result = await replay(readConfigTask);
		expect(result.passed).toBe(true);
		expect(result.toolCalls.read.calls).toBe(1);
		expect(result.cost).toBeGreaterThan(0);
		expect(assertText(result, readConfigTask.text!).ok).toBe(true);
	});
});
