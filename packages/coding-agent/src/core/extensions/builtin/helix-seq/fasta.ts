/**
 * Minimal FASTA inspector.
 *
 * Returns record count, length distribution (min/max/mean/total), and the
 * first N headers for context. Streams line-by-line; safe for multi-GB
 * FASTA files. Auto-handles .gz via the shared stream helper.
 */

import { linesOf, linesOfPath, openSequenceStream } from "./stream.js";

export interface FastaRecordSummary {
	id: string;
	description: string;
	length: number;
}

export interface FastaSummary {
	recordCount: number;
	totalLength: number;
	minLength: number;
	maxLength: number;
	meanLength: number;
	firstRecords: FastaRecordSummary[];
}

export interface FastaOptions {
	/** How many headers to capture in firstRecords. Default 5. */
	sampleHeaders?: number;
}

export async function inspectFastaLines(lines: AsyncIterable<string>, opts: FastaOptions = {}): Promise<FastaSummary> {
	const sampleHeaders = opts.sampleHeaders ?? 5;
	const firstRecords: FastaRecordSummary[] = [];

	let recordCount = 0;
	let totalLength = 0;
	let minLength = Number.POSITIVE_INFINITY;
	let maxLength = 0;
	let currentId: string | undefined;
	let currentDescription = "";
	let currentLength = 0;

	const closeRecord = (): void => {
		if (currentId === undefined) return;
		recordCount += 1;
		totalLength += currentLength;
		if (currentLength < minLength) minLength = currentLength;
		if (currentLength > maxLength) maxLength = currentLength;
		if (firstRecords.length < sampleHeaders) {
			firstRecords.push({ id: currentId, description: currentDescription, length: currentLength });
		}
		currentId = undefined;
		currentDescription = "";
		currentLength = 0;
	};

	for await (const rawLine of lines) {
		const line = rawLine.trimEnd();
		if (line === "") continue;
		if (line.startsWith(">")) {
			closeRecord();
			const header = line.slice(1);
			const spaceIdx = header.indexOf(" ");
			if (spaceIdx === -1) {
				currentId = header;
				currentDescription = "";
			} else {
				currentId = header.slice(0, spaceIdx);
				currentDescription = header.slice(spaceIdx + 1);
			}
		} else if (currentId !== undefined) {
			currentLength += line.length;
		}
	}
	closeRecord();

	return {
		recordCount,
		totalLength,
		minLength: recordCount === 0 ? 0 : minLength,
		maxLength,
		meanLength: recordCount === 0 ? 0 : Math.round(totalLength / recordCount),
		firstRecords,
	};
}

export async function inspectFasta(path: string, opts: FastaOptions = {}): Promise<FastaSummary> {
	return inspectFastaLines(linesOf(openSequenceStream(path)), opts);
}

// Re-export so callers don't need to also import from ./stream.
export { linesOfPath };
