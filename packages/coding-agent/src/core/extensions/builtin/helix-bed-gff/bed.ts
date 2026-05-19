/**
 * Minimal BED inspector (BED3..BED12).
 *
 * BED is 0-based half-open, tab-separated, 3-12 cols:
 *   chrom  chromStart  chromEnd  [name  score  strand  thickStart  thickEnd
 *    itemRgb  blockCount  blockSizes  blockStarts]
 *
 * Header lines (`track ...`, `browser ...`) and `#` comments are ignored.
 * `.bed.gz` is handled automatically by the shared stream helper.
 */

import { linesOf, openSequenceStream } from "../helix-seq/stream.js";

export interface BedFeatureSummary {
	chrom: string;
	start: number;
	end: number;
	name?: string;
	strand?: string;
}

export interface BedSummary {
	featureCount: number;
	truncated: boolean;
	detectedColumns: number;
	minLength: number;
	maxLength: number;
	meanLength: number;
	totalLength: number;
	byChromosome: Record<string, number>;
	byStrand: Record<string, number>;
	firstFeatures: BedFeatureSummary[];
}

export interface BedOptions {
	/** Max feature rows to scan (default 200000). Pass Infinity for full scan. */
	sampleSize?: number;
	/** How many features to capture in firstFeatures. Default 5. */
	sampleFeatures?: number;
}

const HEADER_PREFIXES = ["track ", "browser ", "track\t", "browser\t"];

export async function inspectBedLines(lines: AsyncIterable<string>, opts: BedOptions = {}): Promise<BedSummary> {
	const sampleSize = opts.sampleSize ?? 200_000;
	const sampleFeatures = opts.sampleFeatures ?? 5;

	let featureCount = 0;
	let truncated = false;
	let detectedColumns = 0;
	let totalLength = 0;
	let minLength = Number.POSITIVE_INFINITY;
	let maxLength = 0;
	const byChromosome: Record<string, number> = {};
	const byStrand: Record<string, number> = {};
	const firstFeatures: BedFeatureSummary[] = [];

	for await (const rawLine of lines) {
		const line = rawLine.trimEnd();
		if (line === "") continue;
		if (line.startsWith("#")) continue;
		if (HEADER_PREFIXES.some((p) => line.startsWith(p))) continue;

		if (featureCount >= sampleSize) {
			truncated = true;
			break;
		}

		const cols = line.split("\t");
		if (cols.length < 3) continue;
		const chrom = cols[0];
		const start = Number.parseInt(cols[1], 10);
		const end = Number.parseInt(cols[2], 10);
		if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

		detectedColumns = Math.max(detectedColumns, cols.length);
		const length = end - start;
		totalLength += length;
		if (length < minLength) minLength = length;
		if (length > maxLength) maxLength = length;
		byChromosome[chrom] = (byChromosome[chrom] ?? 0) + 1;
		if (cols.length >= 6) {
			const strand = cols[5] || ".";
			byStrand[strand] = (byStrand[strand] ?? 0) + 1;
		}
		featureCount += 1;

		if (firstFeatures.length < sampleFeatures) {
			firstFeatures.push({
				chrom,
				start,
				end,
				name: cols.length >= 4 ? cols[3] : undefined,
				strand: cols.length >= 6 ? cols[5] : undefined,
			});
		}
	}

	return {
		featureCount,
		truncated,
		detectedColumns,
		minLength: featureCount === 0 ? 0 : minLength,
		maxLength,
		meanLength: featureCount === 0 ? 0 : Math.round(totalLength / featureCount),
		totalLength,
		byChromosome,
		byStrand,
		firstFeatures,
	};
}

export async function inspectBed(path: string, opts: BedOptions = {}): Promise<BedSummary> {
	return inspectBedLines(linesOf(openSequenceStream(path)), opts);
}
