/**
 * Shared stream helper for helix-seq parsers.
 *
 * - Opens a path as a line-by-line async iterable.
 * - Auto-detects .gz / .bgz / .bgzf (and bare gzip magic 0x1f 0x8b) and
 *   pipes through zlib.createGunzip. BGZF is a sequence of concatenated
 *   gzip members; Node's gunzip decodes that correctly without a custom
 *   BGZF reader.
 *
 * Parsers consume an async line iterator so unit tests can feed them
 * Readable.from(fixtureString) instead of writing temp files.
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";

const GZIP_EXTS = new Set([".gz", ".bgz", ".bgzf"]);

export function openSequenceStream(path: string): NodeJS.ReadableStream {
	const raw = createReadStream(path);
	const lower = path.toLowerCase();
	const looksGz = [...GZIP_EXTS].some((ext) => lower.endsWith(ext));
	return looksGz ? raw.pipe(createGunzip()) : raw;
}

export function linesOf(stream: NodeJS.ReadableStream): AsyncIterable<string> {
	return createInterface({ input: stream as Readable, crlfDelay: Infinity });
}

export async function linesOfPath(path: string): Promise<AsyncIterable<string>> {
	return linesOf(openSequenceStream(path));
}

/** For tests: turn a fixture string into the same line-iterator shape. */
export function linesOfString(text: string): AsyncIterable<string> {
	return linesOf(Readable.from(text));
}
