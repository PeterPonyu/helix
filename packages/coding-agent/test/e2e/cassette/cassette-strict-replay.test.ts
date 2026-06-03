/**
 * Strict-replay semantics ($0, CI-safe).
 *
 * In `replay` mode:
 *   - a MISSING cassette must ERROR (no silent passthrough to the real
 *     provider). We assert at the seam (the wrapped provider throws
 *     CassetteReplayError) AND end-to-end (the run never calls the faux
 *     provider, so it cannot have passed through to a real network).
 *   - a PRESENT cassette must serve with NO provider call (the faux provider
 *     has zero scripted responses, so any passthrough would surface as a
 *     provider error / mismatch).
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Context, Model } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { createFauxHarness, type FauxHarness, scriptedAssistant, text, toolCall } from "../faux-setup.js";
import { runTask } from "../runner.js";
import { createFileTask } from "../tasks/index.js";
import { CassetteReplayError, wrapApiProviderForRecording } from "./recorder.js";
import { createCassetteStore } from "./store.js";

describe("cassette strict replay ($0)", () => {
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

	it("missing cassette + replay mode: the wrapped provider throws (no passthrough)", async () => {
		const store = createCassetteStore(newStoreDir());
		const h = await newHarness();
		// A real provider whose stream MUST NOT be called in replay mode.
		let realCalled = false;
		const real = {
			api: "faux-strict",
			stream: ((_m: Model<string>, _c: Context) => {
				realCalled = true;
				throw new Error("real provider must not be called in replay mode");
			}) as never,
			streamSimple: (() => {
				realCalled = true;
				throw new Error("real provider must not be called in replay mode");
			}) as never,
		};

		const wrapped = wrapApiProviderForRecording(real, store, "replay", {
			metadata: { provider: "faux", model: "faux-1", scenarioId: "missing", taskId: "task", recordedAt: "" },
		});

		const ctx: Context = { messages: [{ role: "user", content: "hi", timestamp: 0 }] };
		const model = h.model;
		expect(() => wrapped.stream(model as never, ctx)).toThrow(CassetteReplayError);
		expect(realCalled).toBe(false);
	});

	it("missing cassette + replay mode end-to-end: run fails and the faux provider is never called", async () => {
		const store = createCassetteStore(newStoreDir());
		const h = await newHarness();
		// Script a response that WOULD make the run pass — if replay passed through.
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
			cassette: { store, mode: "replay", recordedAt: "" },
		});

		// No passthrough: the replay miss aborts the turn, so the run did NOT pass.
		expect(result.passed).toBe(false);
		// The faux provider was never consulted (its scripted responses untouched).
		expect(h.faux.getPendingResponseCount()).toBe(2);
		// Nothing was written to the workspace.
		const greeting = result.files.find((f) => f.path === "greeting.txt");
		expect(greeting?.exists ?? false).toBe(false);
	});

	it("present cassette + replay mode: serves with no provider call", async () => {
		const store = createCassetteStore(newStoreDir());

		// Record first.
		const recH = await newHarness();
		recH.faux.setResponses([
			scriptedAssistant([toolCall("write", { path: "greeting.txt", content: "Hello" })]),
			scriptedAssistant([text("done")]),
		]);
		await runTask(createFileTask.task, "faux", {
			model: recH.model,
			authStorage: recH.authStorage,
			modelRegistry: recH.modelRegistry,
			resourceLoader: recH.resourceLoader,
			captureFiles: createFileTask.captureFiles,
			cassette: { store, mode: "record", recordedAt: "" },
		});
		expect(store.hasCassette("faux", createFileTask.task.id)).toBe(true);

		// Replay with a faux provider that has NO scripted responses: any
		// passthrough would error, so a passing run proves replay served locally.
		const repH = await newHarness();
		repH.faux.setResponses([]);
		const replayed = await runTask(createFileTask.task, "faux", {
			model: repH.model,
			authStorage: repH.authStorage,
			modelRegistry: repH.modelRegistry,
			resourceLoader: repH.resourceLoader,
			captureFiles: createFileTask.captureFiles,
			cassette: { store, mode: "replay", recordedAt: "" },
		});

		expect(replayed.passed).toBe(true);
		expect(repH.faux.getPendingResponseCount()).toBe(0); // never set/consumed
		expect(replayed.toolCalls.write.calls).toBe(1);
	});
});
