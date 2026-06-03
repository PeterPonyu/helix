/**
 * On-disk cassette store (Phase 2).
 *
 * Cassettes live under `test/e2e/cassette/fixtures/<scenarioId>__<taskId>.json`
 * and are committed to git so CI can replay them at $0. The store is a thin,
 * synchronous read/write layer; secret scanning and redaction are the
 * recorder's responsibility (it calls into redactor.ts before persisting).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Cassette } from "./schema.js";

/** Absolute path to the committed fixtures directory. */
export const FIXTURES_DIR = fileURLToPath(new URL("./fixtures", import.meta.url));

/** Sanitize an id segment so it is safe as a filename component. */
function safeSegment(value: string): string {
	return value.replace(/[^A-Za-z0-9._-]+/g, "-");
}

/** Build the cassette filename for a scenario × task pair. */
export function cassetteFileName(scenarioId: string, taskId: string): string {
	return `${safeSegment(scenarioId)}__${safeSegment(taskId)}.json`;
}

/** A store reads/writes cassettes for a fixtures directory. */
export interface CassetteStore {
	/** Absolute path a cassette would live at. */
	pathFor(scenarioId: string, taskId: string): string;
	/** True when a cassette exists on disk. */
	hasCassette(scenarioId: string, taskId: string): boolean;
	/** Read a cassette, or undefined when absent. */
	read(scenarioId: string, taskId: string): Cassette | undefined;
	/** Write a cassette (creates the directory if needed). */
	write(cassette: Cassette): void;
	/** List committed cassette filenames (sorted). */
	list(): string[];
}

/** Create a store rooted at `dir` (defaults to the committed fixtures dir). */
export function createCassetteStore(dir: string = FIXTURES_DIR): CassetteStore {
	function pathFor(scenarioId: string, taskId: string): string {
		return join(dir, cassetteFileName(scenarioId, taskId));
	}

	return {
		pathFor,
		hasCassette(scenarioId, taskId) {
			return existsSync(pathFor(scenarioId, taskId));
		},
		read(scenarioId, taskId) {
			const file = pathFor(scenarioId, taskId);
			if (!existsSync(file)) return undefined;
			return JSON.parse(readFileSync(file, "utf-8")) as Cassette;
		},
		write(cassette) {
			const { scenarioId, taskId } = cassette.metadata;
			const file = pathFor(scenarioId, taskId);
			mkdirSync(dirname(file), { recursive: true });
			// Trailing newline keeps git diffs clean.
			writeFileSync(file, `${JSON.stringify(cassette, null, 2)}\n`, "utf-8");
		},
		list() {
			if (!existsSync(dir)) return [];
			return readdirSync(dir)
				.filter((name) => name.endsWith(".json"))
				.sort();
		},
	};
}
