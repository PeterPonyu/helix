/**
 * helix-bed-gff -- BED / GFF3 / GTF feature-file inspectors.
 *
 * Companion to helix-seq. Same shape: streaming, sample-bounded, .gz auto-
 * detect (re-uses helix-seq's stream.ts via relative import). Pure TS.
 *
 * Tools:
 *   - bed_info     BED3..BED12 (and .bed.gz)
 *   - gff_info     GFF3 / GTF (auto-detect by ##gff-version pragma or
 *                  attribute style), and .gz variants
 */

import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { ExtensionAPI } from "../../types.js";
import { type BedSummary, inspectBed } from "./bed.js";
import { type GffSummary, inspectGff } from "./gff.js";

const BedParams = Type.Object({
	path: Type.String({ description: "Absolute path to a BED file (.bed, .bed.gz)" }),
	sampleSize: Type.Optional(Type.Number({ description: "Max feature rows to scan (default 200000)", minimum: 1 })),
});

const GffParams = Type.Object({
	path: Type.String({ description: "Absolute path to a GFF3 / GTF file (.gff, .gff3, .gtf, optionally .gz)" }),
	sampleSize: Type.Optional(Type.Number({ description: "Max feature rows to scan (default 200000)", minimum: 1 })),
});

function formatBedText(s: BedSummary): string {
	if (s.featureCount === 0) return "Empty BED: no feature rows found.";
	const top = Object.entries(s.byChromosome)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([c, n]) => `  ${c}: ${n}`)
		.join("\n");
	const strandBits = Object.entries(s.byStrand)
		.map(([k, v]) => `${k}=${v}`)
		.join(", ");
	const head = s.firstFeatures
		.map((f) =>
			`  ${f.chrom}\t${f.start}-${f.end}\t${f.end - f.start} bp\t${f.name ?? ""}\t${f.strand ?? ""}`.trimEnd(),
		)
		.join("\n");
	const trunc = s.truncated ? ` (scan capped at ${s.featureCount}; pass sampleSize for more)` : "";
	return (
		`features: ${s.featureCount}${trunc}\n` +
		`bed columns detected: ${s.detectedColumns}\n` +
		`length: total=${s.totalLength} bp, min=${s.minLength}, max=${s.maxLength}, mean=${s.meanLength}\n` +
		`strand: ${strandBits || "(no strand column)"}\n` +
		`top chromosomes:\n${top}\n` +
		`first features:\n${head}`
	);
}

function formatGffText(s: GffSummary): string {
	if (s.featureCount === 0) return `Empty GFF (dialect=${s.dialect}): no feature rows.`;
	const topChrom = Object.entries(s.byChromosome)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([c, n]) => `${c}=${n}`)
		.join(", ");
	const topType = Object.entries(s.byType)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([t, n]) => `  ${t}: ${n}`)
		.join("\n");
	const topSource = Object.entries(s.bySource)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([s2, n]) => `${s2}=${n}`)
		.join(", ");
	const strandBits = Object.entries(s.byStrand)
		.map(([k, v]) => `${k}=${v}`)
		.join(", ");
	const head = s.firstFeatures
		.map((f) => `  ${f.seqid}\t${f.type}\t${f.start}-${f.end}\t${f.strand}\t${f.attributesPreview}`)
		.join("\n");
	const trunc = s.truncated ? ` (scan capped at ${s.featureCount}; pass sampleSize for more)` : "";
	return (
		`dialect: ${s.dialect}${s.gffVersion ? ` (##gff-version ${s.gffVersion})` : ""}\n` +
		`features: ${s.featureCount}${trunc}\n` +
		`top chromosomes: ${topChrom}\n` +
		`top sources: ${topSource}\n` +
		`strand: ${strandBits}\n` +
		`feature types:\n${topType}\n` +
		`first features:\n${head}`
	);
}

export default function helixBedGffExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "bed_info",
		label: "BedInfo",
		description:
			"Summarize a BED file: feature count, detected column count (BED3..BED12), feature length distribution, per-chromosome counts, strand distribution, and the first N features. Handles plain BED and .bed.gz. BED coordinates are 0-based half-open.",
		promptSnippet: "Inspect a BED file (features, length stats, strand, top chromosomes).",
		promptGuidelines: [
			"Call bed_info before quoting feature counts or coordinate ranges from a BED path.",
			"BED is 0-based half-open: feature length is end - start. State 0-based when reporting to the user.",
		],
		parameters: BedParams,
		async execute(_id, params) {
			const summary = await inspectBed(params.path, { sampleSize: params.sampleSize });
			return { content: [{ type: "text", text: formatBedText(summary) }], details: summary };
		},
		renderCall(args, theme) {
			return new Text(`${theme.fg("toolTitle", theme.bold("bed_info"))} ${args.path}`, 0, 0);
		},
		renderResult(result, _options, theme) {
			const s = result.details as BedSummary | undefined;
			if (!s) return new Text(theme.fg("muted", "no summary"), 0, 0);
			const trunc = s.truncated ? " (truncated)" : "";
			return new Text(
				`${theme.fg("muted", `${s.featureCount} features${trunc}`)}  BED${s.detectedColumns}  mean=${s.meanLength} bp`,
				0,
				0,
			);
		},
	});

	pi.registerTool({
		name: "gff_info",
		label: "GffInfo",
		description:
			"Summarize a GFF3 or GTF file: detected dialect, feature count, per-chromosome / per-type / per-source counts, strand distribution, first N features with attribute previews. Handles .gff / .gff3 / .gtf and .gz variants. GFF coordinates are 1-based inclusive.",
		promptSnippet: "Inspect a GFF3/GTF file (dialect, feature counts by type/source/chromosome).",
		promptGuidelines: [
			"Call gff_info before quoting feature counts or coordinate ranges from a GFF/GTF path.",
			"GFF coordinates are 1-based inclusive; do not confuse with BED's 0-based half-open. State the convention when reporting.",
		],
		parameters: GffParams,
		async execute(_id, params) {
			const summary = await inspectGff(params.path, { sampleSize: params.sampleSize });
			return { content: [{ type: "text", text: formatGffText(summary) }], details: summary };
		},
		renderCall(args, theme) {
			return new Text(`${theme.fg("toolTitle", theme.bold("gff_info"))} ${args.path}`, 0, 0);
		},
		renderResult(result, _options, theme) {
			const s = result.details as GffSummary | undefined;
			if (!s) return new Text(theme.fg("muted", "no summary"), 0, 0);
			const trunc = s.truncated ? " (truncated)" : "";
			return new Text(
				`${theme.fg("muted", `${s.featureCount} features${trunc}`)}  dialect=${s.dialect}  types=${Object.keys(s.byType).length}`,
				0,
				0,
			);
		},
	});
}
