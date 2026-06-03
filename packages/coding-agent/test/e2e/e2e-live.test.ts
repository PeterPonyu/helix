/**
 * Live matrix × tasks suite (GATED on credentials).
 *
 * `describe.skipIf(!anyCreds())` so it SKIPS entirely with no keys (and thus in
 * default CI). When keys are present it runs the cheap-tier matrix against the
 * hand-authored tasks, applies the per-run budget cap, and writes the cost
 * report. Set PI_RUN_INTEGRATION=1 to opt in even when keys exist, matching the
 * repo's full-agent live-suite convention.
 *
 * Validated deterministically at $0 by e2e-runner.test.ts — this file shares the
 * exact runner/assertions/report code, only swapping the faux model for a real
 * one.
 */

import { getModel } from "@earendil-works/pi-ai";
import { afterAll, describe, expect, it } from "vitest";
import { AuthStorage } from "../../src/core/auth-storage.js";
import { ModelRegistry } from "../../src/core/model-registry.js";
import { assertBehavior } from "./assertions.js";
import { buildCostReport, formatCostReport, writeCostReport } from "./cost-report.js";
import { anyCreds, availableScenarios, credFromEnv, type MatrixScenario } from "./matrix.js";
import { type RunResult, runTask } from "./runner.js";
import { checkFixBugResult, E2E_TASKS } from "./tasks/index.js";

const RUN_LIVE = anyCreds() && (process.env.PI_RUN_INTEGRATION === undefined || process.env.PI_RUN_INTEGRATION === "1");

function buildRegistryForScenario(scenario: MatrixScenario): {
	authStorage: AuthStorage;
	modelRegistry: ModelRegistry;
} {
	// Prefer the real auth store (mirrors test/utilities.ts) so OAuth/api_key
	// credentials are picked up; layer an env key on top when present.
	const authStorage = AuthStorage.create();
	const envKey = credFromEnv(scenario);
	if (envKey) authStorage.setRuntimeApiKey(scenario.provider, envKey);
	const modelRegistry = ModelRegistry.create(authStorage);
	return { authStorage, modelRegistry };
}

describe.skipIf(!RUN_LIVE)("E2E live matrix × tasks (gated on creds)", () => {
	const results: RunResult[] = [];

	afterAll(() => {
		if (results.length === 0) return;
		const report = buildCostReport(results);
		const path = writeCostReport(report);
		// Surface the human summary in the test output for live runs.
		console.log(formatCostReport(report));
		console.log(`cost report written to ${path}`);
	});

	const scenarios = availableScenarios();
	for (const scenario of scenarios) {
		const model = getModel(scenario.provider as never, scenario.model as never);
		describe(scenario.id, () => {
			for (const taskCase of E2E_TASKS) {
				it(`${taskCase.task.id}`, async () => {
					const { authStorage, modelRegistry } = buildRegistryForScenario(scenario);
					const result = await runTask(taskCase.task, scenario.id, {
						model,
						authStorage,
						modelRegistry,
						captureFiles: taskCase.captureFiles,
					});
					results.push(result);

					// Budget cap and ghost detection are non-negotiable invariants.
					expect(result.abortedOverBudget, "run exceeded the budget cap").toBe(false);
					expect(result.ghost, `ghost run (no work produced): ${result.error ?? ""}`).toBe(false);

					if (taskCase.behavior) {
						const behavior = assertBehavior(result, taskCase.behavior);
						// Real models may vary; assert the required tools fired.
						expect(behavior.failures, behavior.failures.join("; ")).toEqual([]);
					}
					if (taskCase.task.id === "fix-off-by-one") {
						const sum = result.files.find((f) => f.path === "sum.ts");
						expect(checkFixBugResult(sum?.content), "off-by-one fix did not pass checker").toBe(true);
					}
				});
			}
		});
	}
});
