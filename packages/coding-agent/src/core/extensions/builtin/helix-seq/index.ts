/**
 * helix-seq -- sequence and variant file inspectors for bioinformatics agents.
 *
 * v0 scope: text-and-BGZF formats only.
 *   - seq_fasta_info       FASTA / FASTA.gz
 *   - seq_fastq_info       FASTQ / FASTQ.gz
 *   - seq_vcf_summary      VCF   / VCF.gz / .bgz / .bgzf
 *
 * BAM and CRAM are deliberately out of v0: they need a real BGZF block
 * reader and binary header walker; they belong in a follow-up
 * `helix-seq-bam` extension so this one can stay pure-text + streaming.
 *
 * All tools take a file path and return a summary the LLM can quote
 * directly. Heavy reads are bounded by sampleSize so multi-GB FASTQ
 * files don't hang the agent loop.
 */

import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { ExtensionAPI } from "../../types.js";
import { type FastaSummary, inspectFasta } from "./fasta.js";
import { type FastqSummary, inspectFastq } from "./fastq.js";
import { inspectVcf, type VcfSummary } from "./vcf.js";

const FastaParams = Type.Object({
	path: Type.String({ description: "Absolute path to a FASTA file (.fa, .fasta, .fna, optionally .gz)" }),
	sampleHeaders: Type.Optional(
		Type.Number({ description: "How many headers to include in the summary (default 5)", minimum: 0, maximum: 100 }),
	),
});

const FastqParams = Type.Object({
	path: Type.String({ description: "Absolute path to a FASTQ file (.fq, .fastq, optionally .gz)" }),
	sampleSize: Type.Optional(
		Type.Number({
			description:
				"Max records to scan (default 10000). Use a large value for exhaustive stats; small for quick QC.",
			minimum: 1,
		}),
	),
});

const VcfParams = Type.Object({
	path: Type.String({ description: "Absolute path to a VCF file (.vcf, .vcf.gz, .vcf.bgz)" }),
	sampleSize: Type.Optional(Type.Number({ description: "Max variant rows to scan (default 100000)", minimum: 1 })),
});

function formatFastaText(s: FastaSummary): string {
	if (s.recordCount === 0) return "Empty FASTA: no records found.";
	const head = s.firstRecords.map((r) => `  ${r.id}\t${r.length} bp\t${r.description || ""}`.trimEnd()).join("\n");
	return (
		`records: ${s.recordCount}\n` +
		`length: total=${s.totalLength} bp, min=${s.minLength}, max=${s.maxLength}, mean=${s.meanLength}\n` +
		`first records:\n${head}`
	);
}

function formatFastqText(s: FastqSummary): string {
	if (s.recordCount === 0) return "Empty FASTQ: no records found.";
	const head = s.firstRecords.map((r) => `  ${r.id}\t${r.sequenceLength} bp\tQ${r.meanQuality ?? "?"}`).join("\n");
	const note = s.truncated ? ` (scan capped at ${s.recordCount} records; pass sampleSize for more)` : "";
	return (
		`reads: ${s.recordCount}${note}\n` +
		`length: min=${s.minReadLength}, max=${s.maxReadLength}, mean=${s.meanReadLength}\n` +
		`quality: encoding=${s.qualityEncoding}, mean=Q${s.meanQuality ?? "?"}\n` +
		`first reads:\n${head}`
	);
}

function formatVcfText(s: VcfSummary): string {
	if (s.variantCount === 0) return `Empty VCF (fileformat=${s.fileformat ?? "?"}): no data rows.`;
	const top = Object.entries(s.byChromosome)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([c, n]) => `  ${c}: ${n}`)
		.join("\n");
	const head = s.firstVariants.map((v) => `  ${v.chrom}\t${v.pos}\t${v.ref}>${v.alt}\t${v.type}`).join("\n");
	const samples = s.samples.length === 0 ? "(none)" : s.samples.join(", ");
	const note = s.truncated ? ` (scan capped at ${s.variantCount} variants; pass sampleSize for more)` : "";
	return (
		`fileformat: ${s.fileformat ?? "unknown"}\n` +
		`samples: ${samples}\n` +
		`contigs declared in header: ${s.contigs.length}\n` +
		`variants: ${s.variantCount}${note}\n` +
		`by type: SNV=${s.byType.SNV}, INS=${s.byType.INS}, DEL=${s.byType.DEL}, MNV=${s.byType.MNV}, OTHER=${s.byType.OTHER}\n` +
		`top chromosomes:\n${top}\n` +
		`first variants:\n${head}`
	);
}

export default function helixSeqExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "seq_fasta_info",
		label: "FastaInfo",
		description:
			"Summarize a FASTA file: record count, sequence length distribution (min/max/mean/total), and the first N record headers. Handles plain FASTA and .gz. Use before quoting sequence counts or lengths.",
		promptSnippet: "Inspect a FASTA file (records, length stats, header sample).",
		promptGuidelines: [
			"Call seq_fasta_info before quoting record counts or length stats from a FASTA path.",
			"For multi-record reference FASTAs (genomes, transcriptomes), expect large totalLength and small recordCount.",
		],
		parameters: FastaParams,
		async execute(_id, params) {
			const summary = await inspectFasta(params.path, { sampleHeaders: params.sampleHeaders });
			return { content: [{ type: "text", text: formatFastaText(summary) }], details: summary };
		},
		renderCall(args, theme) {
			return new Text(`${theme.fg("toolTitle", theme.bold("seq_fasta_info"))} ${args.path}`, 0, 0);
		},
		renderResult(result, _options, theme) {
			const s = result.details as FastaSummary | undefined;
			if (!s) return new Text(theme.fg("muted", "no summary"), 0, 0);
			return new Text(
				`${theme.fg("muted", `${s.recordCount} records, ${s.totalLength} bp`)}  min=${s.minLength} max=${s.maxLength}`,
				0,
				0,
			);
		},
	});

	pi.registerTool({
		name: "seq_fastq_info",
		label: "FastqInfo",
		description:
			"Summarize a FASTQ file: read count, length distribution, quality encoding (phred33/phred64), mean quality, and the first N read IDs. Defaults to sampling 10000 reads for bounded runtime on multi-GB files. Handles plain FASTQ and .gz.",
		promptSnippet: "Inspect a FASTQ file (read count, length, quality stats).",
		promptGuidelines: [
			"Call seq_fastq_info before quoting read counts or quality stats from a FASTQ path.",
			"If the result is truncated=true, increase sampleSize for a more accurate count (or pass a large number for exhaustive scan).",
		],
		parameters: FastqParams,
		async execute(_id, params) {
			const summary = await inspectFastq(params.path, { sampleSize: params.sampleSize });
			return { content: [{ type: "text", text: formatFastqText(summary) }], details: summary };
		},
		renderCall(args, theme) {
			return new Text(`${theme.fg("toolTitle", theme.bold("seq_fastq_info"))} ${args.path}`, 0, 0);
		},
		renderResult(result, _options, theme) {
			const s = result.details as FastqSummary | undefined;
			if (!s) return new Text(theme.fg("muted", "no summary"), 0, 0);
			const trunc = s.truncated ? " (truncated)" : "";
			return new Text(
				`${theme.fg("muted", `${s.recordCount} reads${trunc}`)}  len~${s.meanReadLength}  ${s.qualityEncoding} Q${s.meanQuality ?? "?"}`,
				0,
				0,
			);
		},
	});

	pi.registerTool({
		name: "seq_vcf_summary",
		label: "VcfSummary",
		description:
			"Summarize a VCF file: fileformat header, declared contigs, sample names from #CHROM line, total variants, per-chromosome counts, and a SNV/INS/DEL/MNV/OTHER breakdown. Handles plain VCF and .vcf.gz / .bgz. Use before quoting variant counts.",
		promptSnippet: "Inspect a VCF file (variant counts by chromosome and by type, sample list).",
		promptGuidelines: [
			"Call seq_vcf_summary before quoting variant counts or sample names from a VCF path.",
			"Multi-allelic ALT sites (comma-separated) are classified OTHER in v0; consider this before quoting precise INS/DEL counts.",
		],
		parameters: VcfParams,
		async execute(_id, params) {
			const summary = await inspectVcf(params.path, { sampleSize: params.sampleSize });
			return { content: [{ type: "text", text: formatVcfText(summary) }], details: summary };
		},
		renderCall(args, theme) {
			return new Text(`${theme.fg("toolTitle", theme.bold("seq_vcf_summary"))} ${args.path}`, 0, 0);
		},
		renderResult(result, _options, theme) {
			const s = result.details as VcfSummary | undefined;
			if (!s) return new Text(theme.fg("muted", "no summary"), 0, 0);
			const trunc = s.truncated ? " (truncated)" : "";
			return new Text(
				`${theme.fg("muted", `${s.variantCount} variants${trunc}`)}  samples=${s.samples.length}  contigs=${s.contigs.length}`,
				0,
				0,
			);
		},
	});
}
