/**
 * Minimal FASTQ inspector.
 *
 * - Counts reads (every 4 lines is one record).
 * - Mean read length over sampled records.
 * - Detects the quality encoding and scores with the matching offset.
 *   `qualityEncoding` is "phred33" once we see any char with ASCII < 64
 *   (impossible under phred64), "phred64" once we see a char > 'J' (74) before
 *   any sub-64 char (impossible under modern phred33), and "unknown" when every
 *   sampled char sits in the ambiguous [64, 74] overlap (scored as phred33, the
 *   modern default). This keeps legacy phred64 (pre-Illumina-1.8 / some SRA
 *   archives) from being silently reported ~31 Q-units too high.
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
	if (current === "phred33" || current === "phred64") return current;
	for (let i = 0; i < qual.length; i++) {
		const code = qual.charCodeAt(i);
		// A char below '@' (64) cannot occur in phred64 -> definitive phred33.
		if (code < 64) return "phred33";
		// A char above 'J' (74) before any sub-64 char would require Q42+ under
		// phred33, which modern sequencers never emit -> definitive phred64.
		if (code > 74) return "phred64";
	}
	return current; // all chars in [64, 74]: ambiguous -- stays "unknown"
}

/**
 * Mean of the raw quality character codes. The phred offset is applied later,
 * once the whole sample has been scanned and the encoding is known, so phred64
 * reads are not mis-scored with the phred33 offset.
 */
function rawMeanCharCode(qual: string): number {
	if (qual.length === 0) return 0;
	let sum = 0;
	for (let i = 0; i < qual.length; i++) sum += qual.charCodeAt(i);
	return sum / qual.length;
}

function phredOffset(encoding: QualityEncoding): number {
	return encoding === "phred64" ? 64 : 33; // "unknown" is treated as phred33, the modern default
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

		// Accumulate raw character-code means; the offset is subtracted once at the
		// end, when the encoding (phred33/phred64) is settled.
		const rawMean = qual.length > 0 ? rawMeanCharCode(qual) : undefined;
		if (rawMean !== undefined) {
			qualSum += rawMean;
			qualCount += 1;
		}

		if (firstRecords.length < sampleRecords) {
			const idEnd = header.indexOf(" ");
			const id = header.slice(1, idEnd === -1 ? undefined : idEnd);
			firstRecords.push({ id, sequenceLength: len, meanQuality: rawMean });
		}
	}

	// Resolve the phred offset from the final encoding and apply it to every
	// accumulated raw mean (global and per-record).
	const offset = phredOffset(encoding);
	for (const r of firstRecords) {
		if (r.meanQuality !== undefined) r.meanQuality = Math.round((r.meanQuality - offset) * 10) / 10;
	}

	return {
		recordCount,
		truncated,
		minReadLength: recordCount === 0 ? 0 : minLength,
		maxReadLength: maxLength,
		meanReadLength: recordCount === 0 ? 0 : Math.round(totalLength / recordCount),
		qualityEncoding: encoding,
		meanQuality: qualCount === 0 ? undefined : Math.round((qualSum / qualCount - offset) * 10) / 10,
		firstRecords,
	};
}

export async function inspectFastq(path: string, opts: FastqOptions = {}): Promise<FastqSummary> {
	return inspectFastqLines(linesOf(await openSequenceStream(path)), opts);
}
