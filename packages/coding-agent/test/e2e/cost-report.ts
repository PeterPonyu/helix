/**
 * Cost report aggregation for the E2E UX harness (Phase 1).
 *
 * Aggregates an array of RunResult into a JSON report plus a human-readable
 * summary: total $ spent, per-provider and per-task breakdowns, tokens, turns,
 * and ghost/aborted counts. Rate-limit headers, when surfaced on a result, are
 * carried through.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RunResult } from "./runner.js";

export interface BreakdownEntry {
	runs: number;
	passed: number;
	failed: number;
	ghost: number;
	abortedOverBudget: number;
	abortedMaxTurns: number;
	cost: number;
	tokens: number;
	turns: number;
}

export interface CostReport {
	generatedAt: string;
	totals: BreakdownEntry;
	byProvider: Record<string, BreakdownEntry>;
	byTask: Record<string, BreakdownEntry>;
	rateLimits: Array<{ scenarioId: string; taskId: string; headers: Record<string, string> }>;
	runs: RunResult[];
}

function emptyEntry(): BreakdownEntry {
	return {
		runs: 0,
		passed: 0,
		failed: 0,
		ghost: 0,
		abortedOverBudget: 0,
		abortedMaxTurns: 0,
		cost: 0,
		tokens: 0,
		turns: 0,
	};
}

function accumulate(entry: BreakdownEntry, r: RunResult): void {
	entry.runs += 1;
	if (r.passed) entry.passed += 1;
	else entry.failed += 1;
	if (r.ghost) entry.ghost += 1;
	if (r.abortedOverBudget) entry.abortedOverBudget += 1;
	if (r.abortedMaxTurns) entry.abortedMaxTurns += 1;
	entry.cost += r.cost;
	entry.tokens += r.tokens;
	entry.turns += r.turns;
}

/** Build a structured cost report from run results. */
export function buildCostReport(results: RunResult[]): CostReport {
	const totals = emptyEntry();
	const byProvider: Record<string, BreakdownEntry> = {};
	const byTask: Record<string, BreakdownEntry> = {};
	const rateLimits: CostReport["rateLimits"] = [];

	for (const r of results) {
		accumulate(totals, r);
		byProvider[r.scenarioId] ??= emptyEntry();
		accumulate(byProvider[r.scenarioId], r);
		byTask[r.taskId] ??= emptyEntry();
		accumulate(byTask[r.taskId], r);
		if (r.rateLimit && Object.keys(r.rateLimit).length > 0) {
			rateLimits.push({ scenarioId: r.scenarioId, taskId: r.taskId, headers: r.rateLimit });
		}
	}

	return {
		generatedAt: new Date().toISOString(),
		totals,
		byProvider,
		byTask,
		rateLimits,
		runs: results,
	};
}

function fmtUSD(n: number): string {
	return `$${n.toFixed(4)}`;
}

/** Render a human-readable summary string from a report. */
export function formatCostReport(report: CostReport): string {
	const lines: string[] = [];
	const t = report.totals;
	lines.push("=== Helix E2E Cost Report ===");
	lines.push(`generated: ${report.generatedAt}`);
	lines.push(
		`total: ${t.runs} runs, ${t.passed} passed, ${t.failed} failed, ` +
			`${t.ghost} ghost, ${t.abortedOverBudget} over-budget, ${t.abortedMaxTurns} max-turns`,
	);
	lines.push(`spend: ${fmtUSD(t.cost)} | tokens: ${t.tokens} | turns: ${t.turns}`);

	lines.push("");
	lines.push("-- per provider/scenario --");
	for (const [id, e] of Object.entries(report.byProvider)) {
		lines.push(`  ${id}: ${fmtUSD(e.cost)} | ${e.tokens} tok | ${e.passed}/${e.runs} passed | ghost ${e.ghost}`);
	}

	lines.push("");
	lines.push("-- per task --");
	for (const [id, e] of Object.entries(report.byTask)) {
		lines.push(`  ${id}: ${fmtUSD(e.cost)} | ${e.tokens} tok | ${e.passed}/${e.runs} passed`);
	}

	if (report.rateLimits.length > 0) {
		lines.push("");
		lines.push("-- rate-limit headers --");
		for (const rl of report.rateLimits) {
			lines.push(`  ${rl.scenarioId}/${rl.taskId}: ${JSON.stringify(rl.headers)}`);
		}
	}

	return lines.join("\n");
}

/**
 * Write the JSON report to `HELIX_E2E_REPORT` (or a provided path / default
 * "e2e-report.json") and return the resolved path.
 */
export function writeCostReport(report: CostReport, path?: string): string {
	const target = path ?? process.env.HELIX_E2E_REPORT ?? "e2e-report.json";
	mkdirSync(dirname(target) === "" ? "." : dirname(target), { recursive: true });
	writeFileSync(target, JSON.stringify(report, null, 2), "utf-8");
	return target;
}
