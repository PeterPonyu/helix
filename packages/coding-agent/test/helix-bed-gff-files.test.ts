/**
 * Layer-2 integration tests for helix-bed-gff: write real BED / GFF / GTF
 * files (including .gz) to a temp dir and exercise the path-based public API.
 *
 * Verifies the bits Layer-1 unit tests cannot:
 *   - file open + read via node:fs createReadStream
 *   - gzip auto-detect + decompression
 *   - end-to-end path-in -> summary-out for the same content that the LLM
 *     will see when these tools are called against real bioinformatics files
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { inspectBed } from "../src/core/extensions/builtin/helix-bed-gff/bed.js";
import { inspectGff } from "../src/core/extensions/builtin/helix-bed-gff/gff.js";

const BED_CONTENT = [
	"# track header is ignored",
	"track name=ucsc-export",
	"chr1\t100\t200\tregion-A\t500\t+",
	"chr1\t300\t450\tregion-B\t800\t-",
	"chr2\t5000\t5500\tregion-C\t1\t+",
	"",
].join("\n");

const GFF3_CONTENT = [
	"##gff-version 3",
	"##sequence-region chr1 1 249000000",
	"chr1\tENSEMBL\tgene\t11873\t14409\t.\t+\t.\tID=ENSG00000223972;Name=DDX11L1",
	"chr1\tENSEMBL\ttranscript\t11873\t14409\t.\t+\t.\tID=ENST1;Parent=ENSG00000223972",
	"chr1\tENSEMBL\texon\t11873\t12227\t.\t+\t.\tParent=ENST1",
	"",
].join("\n");

let dir: string;

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), "helix-bed-gff-files-"));
	writeFileSync(join(dir, "regions.bed"), BED_CONTENT);
	writeFileSync(join(dir, "regions.bed.gz"), gzipSync(BED_CONTENT));
	writeFileSync(join(dir, "anno.gff3"), GFF3_CONTENT);
	writeFileSync(join(dir, "anno.gff3.gz"), gzipSync(GFF3_CONTENT));
});

afterAll(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("helix-bed-gff / bed (layer 2: real files)", () => {
	test("inspectBed reads a real .bed file from disk", async () => {
		const s = await inspectBed(join(dir, "regions.bed"));
		expect(s.featureCount).toBe(3);
		expect(s.byChromosome).toEqual({ chr1: 2, chr2: 1 });
		expect(s.byStrand).toEqual({ "+": 2, "-": 1 });
		expect(s.firstFeatures[0]).toMatchObject({ chrom: "chr1", start: 100, end: 200, name: "region-A", strand: "+" });
	});

	test("inspectBed auto-decompresses .bed.gz with identical results", async () => {
		const plain = await inspectBed(join(dir, "regions.bed"));
		const gz = await inspectBed(join(dir, "regions.bed.gz"));
		expect(gz).toEqual(plain);
	});
});

describe("helix-bed-gff / gff (layer 2: real files)", () => {
	test("inspectGff reads a real .gff3 file from disk", async () => {
		const s = await inspectGff(join(dir, "anno.gff3"));
		expect(s.dialect).toBe("gff3");
		expect(s.featureCount).toBe(3);
		expect(s.byType).toEqual({ gene: 1, transcript: 1, exon: 1 });
		expect(s.firstFeatures[0].attributesPreview.startsWith("ID=ENSG00000223972")).toBe(true);
	});

	test("inspectGff auto-decompresses .gff3.gz with identical results", async () => {
		const plain = await inspectGff(join(dir, "anno.gff3"));
		const gz = await inspectGff(join(dir, "anno.gff3.gz"));
		expect(gz).toEqual(plain);
	});
});
