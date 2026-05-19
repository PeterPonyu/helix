import { describe, expect, test } from "vitest";
import { inspectFastaLines } from "../src/core/extensions/builtin/helix-seq/fasta.js";
import { inspectFastqLines } from "../src/core/extensions/builtin/helix-seq/fastq.js";
import { linesOfString } from "../src/core/extensions/builtin/helix-seq/stream.js";
import { inspectVcfLines } from "../src/core/extensions/builtin/helix-seq/vcf.js";

describe("helix-seq / fasta", () => {
	const FIXTURE = [
		">chr1 first contig",
		"ACGTACGT",
		"ACGT",
		">chr2",
		"GGGG",
		">chr3 third contig with longer description",
		"TTTTTTTTTT",
		"",
	].join("\n");

	test("counts records and aggregates lengths", async () => {
		const s = await inspectFastaLines(linesOfString(FIXTURE));
		expect(s.recordCount).toBe(3);
		expect(s.totalLength).toBe(12 + 4 + 10);
		expect(s.minLength).toBe(4);
		expect(s.maxLength).toBe(12);
		expect(s.meanLength).toBe(Math.round(26 / 3));
	});

	test("captures header id and description, ignoring sequence continuation", async () => {
		const s = await inspectFastaLines(linesOfString(FIXTURE));
		expect(s.firstRecords[0]).toEqual({ id: "chr1", description: "first contig", length: 12 });
		expect(s.firstRecords[1]).toEqual({ id: "chr2", description: "", length: 4 });
	});

	test("sampleHeaders bounds firstRecords without affecting totals", async () => {
		const s = await inspectFastaLines(linesOfString(FIXTURE), { sampleHeaders: 1 });
		expect(s.firstRecords).toHaveLength(1);
		expect(s.recordCount).toBe(3);
	});

	test("empty input is handled cleanly", async () => {
		const s = await inspectFastaLines(linesOfString(""));
		expect(s).toMatchObject({ recordCount: 0, totalLength: 0, minLength: 0, maxLength: 0, meanLength: 0 });
		expect(s.firstRecords).toEqual([]);
	});
});

describe("helix-seq / fastq", () => {
	const FIXTURE = [
		"@read-1 lane-a",
		"ACGTACGTAC",
		"+",
		"IIIIIIIIII", // phred33 'I' = 73 → Q40
		"@read-2",
		"ACGT",
		"+",
		"!!!!", // phred33 '!' = 33 → Q0
		"@read-3 lane-b",
		"GGGGGG",
		"+",
		"5555556", // phred33 '5' = 53 → Q20; '6' = 54 → Q21
		"",
	].join("\n");

	test("counts reads and computes length stats", async () => {
		const s = await inspectFastqLines(linesOfString(FIXTURE));
		expect(s.recordCount).toBe(3);
		expect(s.minReadLength).toBe(4);
		expect(s.maxReadLength).toBe(10);
		expect(s.meanReadLength).toBe(Math.round(20 / 3));
	});

	test("detects phred33 from chars below '@'", async () => {
		const s = await inspectFastqLines(linesOfString(FIXTURE));
		expect(s.qualityEncoding).toBe("phred33");
	});

	test("mean quality is an average over sampled reads", async () => {
		const s = await inspectFastqLines(linesOfString(FIXTURE));
		// Mean per read: Q40, Q0, ~Q20.14 -> overall mean ~Q20.05
		expect(s.meanQuality).toBeGreaterThan(19);
		expect(s.meanQuality).toBeLessThan(21);
	});

	test("sampleSize truncates and reports truncated=true", async () => {
		const s = await inspectFastqLines(linesOfString(FIXTURE), { sampleSize: 2 });
		expect(s.recordCount).toBe(2);
		expect(s.truncated).toBe(true);
	});

	test("captures first record IDs without lane suffix", async () => {
		const s = await inspectFastqLines(linesOfString(FIXTURE));
		expect(s.firstRecords[0].id).toBe("read-1");
		expect(s.firstRecords[1].id).toBe("read-2");
	});
});

describe("helix-seq / vcf", () => {
	const FIXTURE = [
		"##fileformat=VCFv4.2",
		"##contig=<ID=chr1,length=249000000>",
		"##contig=<ID=chr2,length=242000000>",
		"##INFO=<ID=DP,Number=1,Type=Integer>",
		"#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tsampleA\tsampleB",
		"chr1\t100\t.\tA\tG\t40\tPASS\tDP=20\tGT\t0/1\t1/1",
		"chr1\t200\t.\tA\tAGT\t40\tPASS\tDP=15\tGT\t0/1\t0/0",
		"chr1\t300\t.\tACGT\tA\t40\tPASS\tDP=10\tGT\t1/1\t0/1",
		"chr2\t100\t.\tACG\tTGA\t40\tPASS\tDP=8\tGT\t0/1\t0/0",
		"chr2\t200\t.\tA\tG,T\t40\tPASS\tDP=12\tGT\t0/1\t1/2",
		"",
	].join("\n");

	test("extracts fileformat, contigs, samples", async () => {
		const s = await inspectVcfLines(linesOfString(FIXTURE));
		expect(s.fileformat).toBe("VCFv4.2");
		expect(s.contigs).toEqual(["chr1", "chr2"]);
		expect(s.samples).toEqual(["sampleA", "sampleB"]);
	});

	test("counts variants per chromosome and overall", async () => {
		const s = await inspectVcfLines(linesOfString(FIXTURE));
		expect(s.variantCount).toBe(5);
		expect(s.byChromosome).toEqual({ chr1: 3, chr2: 2 });
	});

	test("classifies REF/ALT length patterns into SNV/INS/DEL/MNV/OTHER", async () => {
		const s = await inspectVcfLines(linesOfString(FIXTURE));
		expect(s.byType).toEqual({ SNV: 1, INS: 1, DEL: 1, MNV: 1, OTHER: 1 });
	});

	test("captures first variants with type", async () => {
		const s = await inspectVcfLines(linesOfString(FIXTURE), { sampleVariants: 3 });
		expect(s.firstVariants).toHaveLength(3);
		expect(s.firstVariants[0]).toMatchObject({ chrom: "chr1", pos: 100, ref: "A", alt: "G", type: "SNV" });
		expect(s.firstVariants[1].type).toBe("INS");
		expect(s.firstVariants[2].type).toBe("DEL");
	});

	test("sampleSize truncates and reports truncated=true", async () => {
		const s = await inspectVcfLines(linesOfString(FIXTURE), { sampleSize: 2 });
		expect(s.variantCount).toBe(2);
		expect(s.truncated).toBe(true);
	});
});
