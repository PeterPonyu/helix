/**
 * Layer-2 integration tests for helix-seq: write real FASTA / FASTQ / VCF
 * files (including .gz) to a temp dir and exercise the path-based public API.
 *
 * Backfill of "code-level only" coverage so the layer-1 unit tests are
 * complemented by end-to-end disk + gzip verification.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { inspectFasta } from "../src/core/extensions/builtin/helix-seq/fasta.js";
import { inspectFastq } from "../src/core/extensions/builtin/helix-seq/fastq.js";
import { inspectVcf } from "../src/core/extensions/builtin/helix-seq/vcf.js";

const FASTA = [">chr1 first contig", "ACGTACGTACGT", ">chr2 second", "GGGGAAAA", ">chr3", "TTTT", ""].join("\n");

const FASTQ = [
	"@read-1",
	"ACGTACGTAC",
	"+",
	"IIIIIIIIII", // phred33 Q40 throughout
	"@read-2",
	"AAAA",
	"+",
	"!!!!", // phred33 Q0
	"",
].join("\n");

const VCF = [
	"##fileformat=VCFv4.2",
	"##contig=<ID=chr1,length=249000000>",
	"#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tsampleA",
	"chr1\t100\t.\tA\tG\t40\tPASS\t.\tGT\t0/1",
	"chr1\t200\t.\tA\tAGT\t40\tPASS\t.\tGT\t0/1",
	"",
].join("\n");

let dir: string;

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), "helix-seq-files-"));
	writeFileSync(join(dir, "ref.fa"), FASTA);
	writeFileSync(join(dir, "ref.fa.gz"), gzipSync(FASTA));
	writeFileSync(join(dir, "reads.fastq"), FASTQ);
	writeFileSync(join(dir, "reads.fastq.gz"), gzipSync(FASTQ));
	writeFileSync(join(dir, "variants.vcf"), VCF);
	writeFileSync(join(dir, "variants.vcf.gz"), gzipSync(VCF));
});

afterAll(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("helix-seq / fasta (layer 2: real files)", () => {
	test("inspectFasta reads a real .fa", async () => {
		const s = await inspectFasta(join(dir, "ref.fa"));
		expect(s.recordCount).toBe(3);
		expect(s.totalLength).toBe(12 + 8 + 4);
		expect(s.firstRecords[0].id).toBe("chr1");
	});

	test(".fa and .fa.gz produce identical summaries", async () => {
		expect(await inspectFasta(join(dir, "ref.fa.gz"))).toEqual(await inspectFasta(join(dir, "ref.fa")));
	});
});

describe("helix-seq / fastq (layer 2: real files)", () => {
	test("inspectFastq reads a real .fastq", async () => {
		const s = await inspectFastq(join(dir, "reads.fastq"));
		expect(s.recordCount).toBe(2);
		expect(s.qualityEncoding).toBe("phred33");
		// mean Q40, Q0 -> 20
		expect(s.meanQuality).toBe(20);
	});

	test(".fastq and .fastq.gz produce identical summaries", async () => {
		expect(await inspectFastq(join(dir, "reads.fastq.gz"))).toEqual(await inspectFastq(join(dir, "reads.fastq")));
	});
});

describe("helix-seq / vcf (layer 2: real files)", () => {
	test("inspectVcf reads a real .vcf", async () => {
		const s = await inspectVcf(join(dir, "variants.vcf"));
		expect(s.fileformat).toBe("VCFv4.2");
		expect(s.samples).toEqual(["sampleA"]);
		expect(s.variantCount).toBe(2);
		expect(s.byType).toMatchObject({ SNV: 1, INS: 1 });
	});

	test(".vcf and .vcf.gz produce identical summaries", async () => {
		expect(await inspectVcf(join(dir, "variants.vcf.gz"))).toEqual(await inspectVcf(join(dir, "variants.vcf")));
	});
});
