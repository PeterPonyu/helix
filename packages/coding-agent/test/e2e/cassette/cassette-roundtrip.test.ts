/**
 * Cassette round-trip ($0, CI-safe): record (faux) → replay → assert the
 * replayed RunResult deep-equals the recorded one (cost, tokens, toolCalls,
 * files). Proves the whole replay+assert+cost pipeline without any network.
 *
 * Uses a temp fixtures dir so the test never touches the committed cassettes.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFauxHarness, type FauxHarness, scriptedAssistant, text, toolCall } from "../faux-setup.js";
import { type RunResult, runTask } from "../runner.js";
import { createFileTask, fixBugTask } from "../tasks/index.js";
import { createCassetteStore } from "./store.js";

/** Fields that must be identical between a recorded and replayed run. */
function comparable(result: RunResult) {
	return {
		scenarioId: result.scenarioId,
		taskId: result.taskId,
		passed: result.passed,
		cost: result.cost,
		tokens: result.tokens,
		turns: result.turns,
		toolCalls: result.toolCalls,
		files: result.files,
		finalText: result.finalText,
		ghost: result.ghost,
	};
}

describe("cassette round-trip (record → replay, $0)", () => {
	const harnesses: FauxHarness[] = [];
	const tempDirs: string[] = [];

	afterEach(() => {
		while (harnesses.length > 0) harnesses.pop()?.cleanup();
		while (tempDirs.length > 0) {
			const dir = tempDirs.pop();
			if (dir) rmSync(dir, { recursive: true, force: true });
		}
	});

	async function newHarness(): Promise<FauxHarness> {
		const h = await createFauxHarness();
		harnesses.push(h);
		return h;
	}

	function newStoreDir(): string {
		const dir = mkdtempSync(join(tmpdir(), "helix-cassette-"));
		tempDirs.push(dir);
		return dir;
	}

	it("create-file task: replayed RunResult deep-equals the recorded run", async () => {
		const storeDir = newStoreDir();
		const store = createCassetteStore(storeDir);

		// --- RECORD (faux through-call, teed into a cassette) ---
		const recH = await newHarness();
		recH.faux.setResponses([
			scriptedAssistant([toolCall("write", { path: "greeting.txt", content: "Hello" })]),
			scriptedAssistant([text("Done — created greeting.txt.")]),
		]);
		const recorded = await runTask(createFileTask.task, "faux", {
			model: recH.model,
			authStorage: recH.authStorage,
			modelRegistry: recH.modelRegistry,
			resourceLoader: recH.resourceLoader,
			captureFiles: createFileTask.captureFiles,
			cassette: { store, mode: "record", recordedAt: "" },
		});

		expect(recorded.passed).toBe(true);
		expect(recorded.cost).toBeGreaterThan(0);
		expect(store.hasCassette("faux", createFileTask.task.id)).toBe(true);

		// --- REPLAY (no network; faux has NO scripted responses) ---
		const repH = await newHarness();
		repH.faux.setResponses([]); // any provider call would error → proves no passthrough
		const replayed = await runTask(createFileTask.task, "faux", {
			model: repH.model,
			authStorage: repH.authStorage,
			modelRegistry: repH.modelRegistry,
			resourceLoader: repH.resourceLoader,
			captureFiles: createFileTask.captureFiles,
			cassette: { store, mode: "replay", recordedAt: "" },
		});

		expect(comparable(replayed)).toEqual(comparable(recorded));
		// Cost must be a real, nonzero function of replayed usage (cost math ran).
		expect(replayed.cost).toBe(recorded.cost);
		expect(replayed.cost).toBeGreaterThan(0);
		expect(replayed.toolCalls.write.calls).toBe(1);
	});

	it("fix-bug task: replayed read+edit tool calls and files match the recording", async () => {
		const storeDir = newStoreDir();
		const store = createCassetteStore(storeDir);
		const fixedNewText = "for (let i = 1; i <= n; i++) {";

		const recH = await newHarness();
		recH.faux.setResponses([
			scriptedAssistant([toolCall("read", { path: "sum.ts" })]),
			scriptedAssistant([
				toolCall("edit", {
					path: "sum.ts",
					edits: [{ oldText: "for (let i = 1; i < n; i++) {", newText: fixedNewText }],
				}),
			]),
			scriptedAssistant([text("Fixed the off-by-one bug.")]),
		]);
		const recorded = await runTask(fixBugTask.task, "faux", {
			model: recH.model,
			authStorage: recH.authStorage,
			modelRegistry: recH.modelRegistry,
			resourceLoader: recH.resourceLoader,
			captureFiles: fixBugTask.captureFiles,
			cassette: { store, mode: "record", recordedAt: "" },
		});

		const repH = await newHarness();
		repH.faux.setResponses([]);
		const replayed = await runTask(fixBugTask.task, "faux", {
			model: repH.model,
			authStorage: repH.authStorage,
			modelRegistry: repH.modelRegistry,
			resourceLoader: repH.resourceLoader,
			captureFiles: fixBugTask.captureFiles,
			cassette: { store, mode: "replay", recordedAt: "" },
		});

		expect(comparable(replayed)).toEqual(comparable(recorded));
		expect(replayed.toolCalls.read.calls).toBe(1);
		expect(replayed.toolCalls.edit.calls).toBe(1);
		const sumFile = replayed.files.find((f) => f.path === "sum.ts");
		const recSumFile = recorded.files.find((f) => f.path === "sum.ts");
		expect(sumFile?.content).toBe(recSumFile?.content);
	});
});
