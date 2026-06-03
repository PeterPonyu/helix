/**
 * Generator for the COMMITTED synthetic cassettes ($0, no keys).
 *
 * Gated behind `HELIX_CASSETTE_GENERATE=1` so a normal CI/test run never
 * rewrites the committed fixtures. Run it deliberately to (re)generate:
 *
 *   HELIX_CASSETTE_GENERATE=1 npx vitest --run \
 *     test/e2e/cassette/generate-cassettes.test.ts
 *
 * It drives the 3 Phase-1 tasks through the deterministic FAUX provider in
 * record mode and writes the cassettes to the committed fixtures dir. Because
 * faux is deterministic, these fixtures let CI replay the whole
 * replay+assert+cost pipeline at $0. Real cassettes are recorded later by the
 * user with provider keys (HELIX_CASSETTE_MODE=record).
 *
 * `recordedAt` is pinned to "" so the committed JSON is byte-stable.
 */

import type { FauxResponseStep } from "@earendil-works/pi-ai";
import { describe, it } from "vitest";
import { createFauxHarness, type FauxHarness, scriptedAssistant, text, toolCall } from "../faux-setup.js";
import { runTask } from "../runner.js";
import { createFileTask, fixBugTask, readConfigTask } from "../tasks/index.js";
import { createCassetteStore } from "./store.js";

const ENABLED = process.env.HELIX_CASSETTE_GENERATE === "1";

/** Deterministic scripted streams for each Phase-1 task. */
function scriptFor(taskId: string): FauxResponseStep[] {
	switch (taskId) {
		case createFileTask.task.id:
			return [
				scriptedAssistant([toolCall("write", { path: "greeting.txt", content: "Hello" })]),
				scriptedAssistant([text("Done — created greeting.txt.")]),
			];
		case fixBugTask.task.id:
			return [
				scriptedAssistant([toolCall("read", { path: "sum.ts" })]),
				scriptedAssistant([
					toolCall("edit", {
						path: "sum.ts",
						edits: [{ oldText: "for (let i = 1; i < n; i++) {", newText: "for (let i = 1; i <= n; i++) {" }],
					}),
				]),
				scriptedAssistant([text("Fixed the off-by-one bug.")]),
			];
		case readConfigTask.task.id:
			return [scriptedAssistant([toolCall("read", { path: "config.json" })]), scriptedAssistant([text("8080")])];
		default:
			throw new Error(`No script for task ${taskId}`);
	}
}

describe.skipIf(!ENABLED)("generate committed synthetic cassettes (faux, $0)", () => {
	const harnesses: FauxHarness[] = [];

	it("records the 3 Phase-1 tasks into committed fixtures", async () => {
		const store = createCassetteStore(); // committed fixtures dir
		for (const tc of [createFileTask, fixBugTask, readConfigTask]) {
			const h = await createFauxHarness();
			harnesses.push(h);
			h.faux.setResponses(scriptFor(tc.task.id));
			await runTask(tc.task, "faux", {
				model: h.model,
				authStorage: h.authStorage,
				modelRegistry: h.modelRegistry,
				resourceLoader: h.resourceLoader,
				captureFiles: tc.captureFiles,
				cassette: { store, mode: "record", recordedAt: "" },
			});
		}
		while (harnesses.length > 0) harnesses.pop()?.cleanup();
	});
});
