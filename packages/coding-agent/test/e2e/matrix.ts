/**
 * Provider matrix for the real-provider E2E UX harness (Phase 1).
 *
 * The matrix is plain DATA so the live suite can iterate it and so the cost
 * report can break results down per-provider. Every entry targets a CHEAP tier
 * (Haiku / mini / flash) to keep live runs inexpensive — Phase 1 enforces a
 * per-run budget cap on top of this (see runner.ts).
 *
 * Model IDs are taken from `packages/ai/src/models.generated.ts`. The presence
 * of each ID is verified by `matrix-models.test.ts` (runs in CI, no keys) so a
 * future model-table regeneration that drops one of these IDs fails loudly
 * instead of silently skipping a provider live.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "../../src/config.js";

/** A single provider × model scenario in the matrix. */
export interface MatrixScenario {
	/** Stable identifier used in reports and the HELIX_E2E_PROVIDERS filter. */
	id: string;
	/** Provider key as it appears in models.generated.ts (e.g. "anthropic"). */
	provider: string;
	/** Model ID as it appears in models.generated.ts. */
	model: string;
	/** Environment variable that supplies the API key for this provider. */
	authEnv: string;
	/** Free-form tags for filtering / documentation. */
	tags: string[];
}

/**
 * The Phase 1 cheap-tier matrix.
 *
 * All four model IDs below are asserted present in models.generated.ts by
 * matrix-models.test.ts. If that test ever fails, regenerate or update the ID
 * here to the cheapest matching entry for that provider.
 */
export const MATRIX: MatrixScenario[] = [
	{
		id: "anthropic-haiku",
		provider: "anthropic",
		// Cheapest current Anthropic Haiku tier present in models.generated.ts.
		model: "claude-haiku-4-5",
		authEnv: "ANTHROPIC_API_KEY",
		tags: ["cheap", "haiku", "anthropic"],
	},
	{
		id: "openai-mini",
		provider: "openai",
		// Cheap OpenAI "mini" tier present in models.generated.ts.
		model: "gpt-4o-mini",
		authEnv: "OPENAI_API_KEY",
		tags: ["cheap", "mini", "openai"],
	},
	{
		id: "google-flash",
		provider: "google",
		// Cheap Gemini "flash" tier present in models.generated.ts.
		model: "gemini-2.0-flash",
		authEnv: "GEMINI_API_KEY",
		tags: ["cheap", "flash", "google"],
	},
	{
		id: "openrouter-cheap",
		provider: "openrouter",
		// Cheap model routed via OpenRouter; present in models.generated.ts.
		model: "openai/gpt-4o-mini",
		authEnv: "OPENROUTER_API_KEY",
		tags: ["cheap", "openrouter"],
	},
];

/** Path to the real agent auth store, mirroring test/utilities.ts (honors HELIX_CODING_AGENT_DIR). */
const REAL_AUTH_PATH = join(getAgentDir(), "auth.json");

function authStoreHasProvider(provider: string): boolean {
	if (!existsSync(REAL_AUTH_PATH)) return false;
	try {
		const data = JSON.parse(readFileSync(REAL_AUTH_PATH, "utf-8")) as Record<string, unknown>;
		return provider in data;
	} catch {
		return false;
	}
}

/**
 * True when credentials for a scenario are available, either via the provider's
 * env var or via the real ~/.helix/agent/auth.json auth store.
 */
export function hasCreds(scenario: MatrixScenario): boolean {
	if (process.env[scenario.authEnv]) return true;
	// Anthropic also accepts an OAuth token env (mirrors env-api-keys.ts).
	if (scenario.provider === "anthropic" && process.env.ANTHROPIC_OAUTH_TOKEN) return true;
	return authStoreHasProvider(scenario.provider);
}

/** Resolve the API key for a scenario from env (auth store is consulted at runtime). */
export function credFromEnv(scenario: MatrixScenario): string | undefined {
	if (scenario.provider === "anthropic" && process.env.ANTHROPIC_OAUTH_TOKEN) {
		return process.env.ANTHROPIC_OAUTH_TOKEN;
	}
	return process.env[scenario.authEnv];
}

/**
 * Apply the HELIX_E2E_PROVIDERS comma filter (by scenario id or provider).
 * When unset, all scenarios are returned.
 */
export function filterMatrix(scenarios: MatrixScenario[] = MATRIX): MatrixScenario[] {
	const raw = process.env.HELIX_E2E_PROVIDERS;
	if (!raw) return scenarios;
	const wanted = new Set(
		raw
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean),
	);
	if (wanted.size === 0) return scenarios;
	return scenarios.filter((s) => wanted.has(s.id.toLowerCase()) || wanted.has(s.provider.toLowerCase()));
}

/** Scenarios in the (filtered) matrix that currently have credentials. */
export function availableScenarios(): MatrixScenario[] {
	return filterMatrix().filter(hasCreds);
}

/** True when at least one filtered scenario has credentials (gates the live suite). */
export function anyCreds(): boolean {
	return availableScenarios().length > 0;
}
