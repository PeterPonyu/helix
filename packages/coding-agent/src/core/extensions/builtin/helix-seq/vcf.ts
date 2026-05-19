/**
 * Minimal VCF inspector.
 *
 * - Reads ##fileformat and ##contig headers, sample columns from #CHROM line.
 * - Classifies variants by simple REF/ALT length rules into SNV/INS/DEL/MNV/OTHER.
 * - Counts variants per chromosome and captures the first N data rows.
 *
 * Streams line-by-line; handles plain text VCF and .vcf.gz (BGZF gzipped)
 * via the shared stream helper.
 *
 * Multi-allelic ALT (comma-separated alleles) is classified OTHER in v0 --
 * proper per-allele typing is deferred until we add a real ALT splitter.
 */

import { linesOf, openSequenceStream } from "./stream.js";

export type VariantType = "SNV" | "INS" | "DEL" | "MNV" | "OTHER";

export interface VcfVariantSummary {
	chrom: string;
	pos: number;
	ref: string;
	alt: string;
	type: VariantType;
}

export interface VcfSummary {
	fileformat: string | undefined;
	contigs: string[];
	samples: string[];
	variantCount: number;
	truncated: boolean;
	byChromosome: Record<string, number>;
	byType: Record<VariantType, number>;
	firstVariants: VcfVariantSummary[];
}

export interface VcfOptions {
	/** Max data rows to scan. Default 100000. Pass Infinity for full scan. */
	sampleSize?: number;
	/** How many variants to capture in firstVariants. Default 5. */
	sampleVariants?: number;
}

function classifyVariant(ref: string, alt: string): VariantType {
	if (alt.includes(",") || alt === "." || alt === "*") return "OTHER";
	if (ref.length === 1 && alt.length === 1) return "SNV";
	if (ref.length < alt.length) return "INS";
	if (ref.length > alt.length) return "DEL";
	if (ref.length === alt.length) return "MNV";
	return "OTHER";
}

const CONTIG_RE = /^##contig=<.*?ID=([^,>]+)/;

export async function inspectVcfLines(lines: AsyncIterable<string>, opts: VcfOptions = {}): Promise<VcfSummary> {
	const sampleSize = opts.sampleSize ?? 100_000;
	const sampleVariants = opts.sampleVariants ?? 5;

	let fileformat: string | undefined;
	const contigs: string[] = [];
	let samples: string[] = [];
	const byChromosome: Record<string, number> = {};
	const byType: Record<VariantType, number> = { SNV: 0, INS: 0, DEL: 0, MNV: 0, OTHER: 0 };
	const firstVariants: VcfVariantSummary[] = [];
	let variantCount = 0;
	let truncated = false;

	for await (const rawLine of lines) {
		const line = rawLine.trimEnd();
		if (line === "") continue;

		if (line.startsWith("##fileformat=")) {
			fileformat = line.slice("##fileformat=".length);
			continue;
		}
		if (line.startsWith("##contig=")) {
			const m = CONTIG_RE.exec(line);
			if (m) contigs.push(m[1]);
			continue;
		}
		if (line.startsWith("##")) continue;
		if (line.startsWith("#CHROM")) {
			const cols = line.split("\t");
			samples = cols.slice(9);
			continue;
		}

		if (variantCount >= sampleSize) {
			truncated = true;
			break;
		}

		const cols = line.split("\t");
		if (cols.length < 5) continue;
		const chrom = cols[0];
		const pos = Number.parseInt(cols[1], 10);
		const ref = cols[3];
		const alt = cols[4];
		const type = classifyVariant(ref, alt);

		byChromosome[chrom] = (byChromosome[chrom] ?? 0) + 1;
		byType[type] += 1;
		variantCount += 1;
		if (firstVariants.length < sampleVariants) {
			firstVariants.push({ chrom, pos, ref, alt, type });
		}
	}

	return {
		fileformat,
		contigs,
		samples,
		variantCount,
		truncated,
		byChromosome,
		byType,
		firstVariants,
	};
}

export async function inspectVcf(path: string, opts: VcfOptions = {}): Promise<VcfSummary> {
	return inspectVcfLines(linesOf(openSequenceStream(path)), opts);
}
