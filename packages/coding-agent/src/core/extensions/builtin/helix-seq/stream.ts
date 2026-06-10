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
import { open } from "node:fs/promises";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";

const GZIP_EXTS = new Set([".gz", ".bgz", ".bgzf"]);
// gzip (and BGZF) members start with the two magic bytes 0x1f 0x8b.
const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

async function hasGzipMagic(path: string): Promise<boolean> {
	const fh = await open(path, "r");
	try {
		const { buffer, bytesRead } = await fh.read(Buffer.alloc(2), 0, 2, 0);
		return bytesRead === 2 && buffer[0] === GZIP_MAGIC_0 && buffer[1] === GZIP_MAGIC_1;
	} finally {
		await fh.close();
	}
}

export async function openSequenceStream(path: string): Promise<NodeJS.ReadableStream> {
	const lower = path.toLowerCase();
	// Trust the bytes, not the extension: a .gz/.bgz name is a fast path, but a
	// gzipped file with a misleading extension (e.g. a BGZF `.vcf`) is detected
	// by sniffing the magic bytes so it still decodes instead of producing garbage.
	const isGz = [...GZIP_EXTS].some((ext) => lower.endsWith(ext)) || (await hasGzipMagic(path));
	const raw = createReadStream(path);
	return isGz ? raw.pipe(createGunzip()) : raw;
}

export function linesOf(stream: NodeJS.ReadableStream): AsyncIterable<string> {
	return createInterface({ input: stream as Readable, crlfDelay: Infinity });
}

export async function linesOfPath(path: string): Promise<AsyncIterable<string>> {
	return linesOf(await openSequenceStream(path));
}

/** For tests: turn a fixture string into the same line-iterator shape. */
export function linesOfString(text: string): AsyncIterable<string> {
	return linesOf(Readable.from(text));
}
