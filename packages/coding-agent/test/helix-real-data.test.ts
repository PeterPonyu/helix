/**
 * Layer-2-real tests: opt-in, hit small REAL public bio files.
 *
 * Run with:
 *   HELIX_REAL_DATA=1 npx tsx ../../node_modules/vitest/dist/cli.js \
 *     --run test/helix-real-data.test.ts
 *
 * Without HELIX_REAL_DATA=1 these tests skip themselves so the default
 * suite stays fast and offline. See test/helpers/real-fixtures.ts for
 * the catalog and the SHA256 pinning policy.
 *
 * Each test asserts only the bare facts the parser MUST get right on real
 * data (record present, length positive, dialect detected). The point is
 * "parser handles real-world content"; we do not over-specify counts that
 * would couple the test to upstream fixture revisions.
 */

import { describe, expect, test } from "vitest";
import { inspectBed } from "../src/core/extensions/builtin/helix-bed-gff/bed.js";
import { inspectGff } from "../src/core/extensions/builtin/helix-bed-gff/gff.js";
import { inspectFasta } from "../src/core/extensions/builtin/helix-seq/fasta.js";
import { inspectFastq } from "../src/core/extensions/builtin/helix-seq/fastq.js";
import { inspectVcf } from "../src/core/extensions/builtin/helix-seq/vcf.js";
import { getRealFixture, realDataEnabled } from "./helpers/real-fixtures.js";

const itReal = realDataEnabled() ? test : test.skip;

describe("helix-seq / fasta -- real htslib ce.fa", () => {
	itReal("parses samtools/htslib test/ce.fa", async () => {
		const path = await getRealFixture("htslib_ce_fa");
		const s = await inspectFasta(path);
		expect(s.recordCount).toBeGreaterThan(0);
		expect(s.totalLength).toBeGreaterThan(0);
		expect(s.firstRecords[0].id.length).toBeGreaterThan(0);
		expect(s.firstRecords[0].length).toBeGreaterThan(0);
	});
});

describe("helix-seq / fastq -- real biopython example.fastq", () => {
	itReal("parses biopython Tests/Quality/example.fastq with real Sanger quality strings", async () => {
		const path = await getRealFixture("biopython_example_fastq");
		const s = await inspectFastq(path);
		expect(s.recordCount).toBeGreaterThan(0);
		expect(s.maxReadLength).toBeGreaterThan(0);
		// Real Sanger quality, encoding may stay "unknown" if all chars >= '@'
		// or upgrade to "phred33" if any low-quality char appears. Either is OK.
		expect(["phred33", "unknown"]).toContain(s.qualityEncoding);
		expect(s.meanQuality).toBeGreaterThan(0);
	});
});

describe("helix-seq / vcf -- real bcftools query.vcf", () => {
	itReal("parses samtools/bcftools test/query.vcf with real header and data rows", async () => {
		const path = await getRealFixture("bcftools_query_vcf");
		const s = await inspectVcf(path);
		expect(s.fileformat).toMatch(/^VCFv4/);
		expect(s.samples.length).toBeGreaterThan(0);
		expect(s.variantCount).toBeGreaterThan(0);
		const totalTypes = s.byType.SNV + s.byType.INS + s.byType.DEL + s.byType.MNV + s.byType.OTHER;
		expect(totalTypes).toBe(s.variantCount);
	});
});

describe("helix-bed-gff / bed -- real bedtools intersect a.bed", () => {
	itReal("parses bedtools2 test/intersect/a.bed", async () => {
		const path = await getRealFixture("bedtools_intersect_a_bed");
		const s = await inspectBed(path);
		expect(s.featureCount).toBeGreaterThan(0);
		expect(s.detectedColumns).toBeGreaterThanOrEqual(3);
		expect(Object.keys(s.byChromosome).length).toBeGreaterThan(0);
	});
});

describe("helix-bed-gff / gff -- real gffutils example.gff", () => {
	itReal("parses gffutils intro_docs_example.gff with dialect detection", async () => {
		const path = await getRealFixture("gffutils_intro_docs_example_gff");
		const s = await inspectGff(path);
		expect(s.featureCount).toBeGreaterThan(0);
		// Dialect should be auto-detected as one of the two known values.
		expect(["gff3", "gtf"]).toContain(s.dialect);
		expect(Object.keys(s.byType).length).toBeGreaterThan(0);
	});
});
