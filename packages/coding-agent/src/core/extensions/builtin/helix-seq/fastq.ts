/**
 * Minimal FASTQ inspector.
 *
 * - Counts reads (every 4 lines is one record).
 * - Mean read length over sampled records.
 * - Always reports quality with the phred33 offset (the modern default; Illumina
 *   switched off phred64 in v1.8, 2011). `qualityEncoding` reports "phred33"
 *   once we see any char with ASCII < 64 (definitive proof of phred33), and
 *   "unknown" otherwise (ambiguous but treated as phred33 for the score math).
 *   A `helix-seq-phred64` opt-in is the right place for legacy support if it
 *   ever becomes necessary.
 * - Mean quality score over sampled records.
 *
 * Defaults to sampling 10_000 records (~2-5 MB of sequence) to bound time
 * on multi-GB FASTQ files. Set sampleSize: Infinity for an exhaustive scan.
 */

import { linesOf, openSequenceStream } from "./stream.js";

export type QualityEncoding = "phred33" | "phred64" | "unknown";

export interface FastqRecordSummary {
	id: string;
	sequenceLength: number;
	meanQuality: number | undefined;
}

export interface FastqSummary {
	recordCount: number;
	truncated: boolean;
	minReadLength: number;
	maxReadLength: number;
	meanReadLength: number;
	qualityEncoding: QualityEncoding;
	meanQuality: number | undefined;
	firstRecords: FastqRecordSummary[];
}

export interface FastqOptions {
	/** Max records to inspect. Default 10000. Pass Infinity for full scan. */
	sampleSize?: number;
	/** How many records to capture in firstRecords. Default 5. */
	sampleRecords?: number;
}

function detectEncoding(qual: string, current: QualityEncoding): QualityEncoding {
	if (current === "phred33") return current;
	for (let i = 0; i < qual.length; i++) {
		if (qual.charCodeAt(i) < 64) return "phred33";
	}
	return current; // stays "unknown" -- ambiguous but treated as phred33 below
}

function meanQualityOf(qual: string): number {
	if (qual.length === 0) return 0;
	let sum = 0;
	for (let i = 0; i < qual.length; i++) sum += qual.charCodeAt(i) - 33;
	return sum / qual.length;
}

export async function inspectFastqLines(lines: AsyncIterable<string>, opts: FastqOptions = {}): Promise<FastqSummary> {
	const sampleSize = opts.sampleSize ?? 10_000;
	const sampleRecords = opts.sampleRecords ?? 5;

	const firstRecords: FastqRecordSummary[] = [];
	let encoding: QualityEncoding = "unknown";
	let recordCount = 0;
	let totalLength = 0;
	let minLength = Number.POSITIVE_INFINITY;
	let maxLength = 0;
	let qualSum = 0;
	let qualCount = 0;
	let truncated = false;

	const buf: string[] = [];
	for await (const rawLine of lines) {
		buf.push(rawLine.trimEnd());
		if (buf.length < 4) continue;
		const [header, seq, _plus, qual] = buf;
		buf.length = 0;
		if (!header.startsWith("@")) continue; // malformed; skip

		if (recordCount >= sampleSize) {
			truncated = true;
			break;
		}

		encoding = detectEncoding(qual, encoding);
		const len = seq.length;
		totalLength += len;
		if (len < minLength) minLength = len;
		if (len > maxLength) maxLength = len;
		recordCount += 1;

		const mq = meanQualityOf(qual);
		qualSum += mq;
		qualCount += 1;

		if (firstRecords.length < sampleRecords) {
			const idEnd = header.indexOf(" ");
			const id = header.slice(1, idEnd === -1 ? undefined : idEnd);
			firstRecords.push({ id, sequenceLength: len, meanQuality: Math.round(mq * 10) / 10 });
		}
	}

	return {
		recordCount,
		truncated,
		minReadLength: recordCount === 0 ? 0 : minLength,
		maxReadLength: maxLength,
		meanReadLength: recordCount === 0 ? 0 : Math.round(totalLength / recordCount),
		qualityEncoding: encoding,
		meanQuality: qualCount === 0 ? undefined : Math.round((qualSum / qualCount) * 10) / 10,
		firstRecords,
	};
}

export async function inspectFastq(path: string, opts: FastqOptions = {}): Promise<FastqSummary> {
	return inspectFastqLines(linesOf(openSequenceStream(path)), opts);
}
