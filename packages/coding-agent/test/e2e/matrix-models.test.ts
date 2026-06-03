/**
 * CI guard (no keys): assert every matrix model ID actually exists in the
 * generated model table. This fails loudly if a model-table regeneration drops
 * one of the cheap-tier IDs the live matrix depends on, instead of silently
 * skipping that provider live.
 */

import { getModel } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { MATRIX } from "./matrix.js";

describe("E2E matrix — model IDs resolve in models.generated.ts", () => {
	for (const scenario of MATRIX) {
		it(`${scenario.id}: getModel(${scenario.provider}, ${scenario.model}) resolves`, () => {
			const model = getModel(scenario.provider as never, scenario.model as never);
			expect(model, `model ${scenario.provider}/${scenario.model} not found in model table`).toBeTruthy();
			expect(model.provider).toBe(scenario.provider);
			expect(model.id).toBe(scenario.model);
		});
	}
});
