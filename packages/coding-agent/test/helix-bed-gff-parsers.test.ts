import { describe, expect, test } from "vitest";
import { inspectBedLines } from "../src/core/extensions/builtin/helix-bed-gff/bed.js";
import { inspectGffLines } from "../src/core/extensions/builtin/helix-bed-gff/gff.js";
import { linesOfString } from "../src/core/extensions/builtin/helix-seq/stream.js";

describe("helix-bed-gff / bed (layer 1: in-memory fixture)", () => {
	const FIXTURE = [
		'track name=test description="Test track"',
		"# comment",
		"chr1\t100\t200\tfeat1\t500\t+",
		"chr1\t300\t450\tfeat2\t800\t-",
		"chr2\t1000\t2000\tfeat3\t100\t.",
		"chr2\t5000\t5500", // BED3 line
		"",
	].join("\n");

	test("counts features and skips track/comment lines", async () => {
		const s = await inspectBedLines(linesOfString(FIXTURE));
		expect(s.featureCount).toBe(4);
		expect(s.detectedColumns).toBe(6);
	});

	test("computes length stats (end - start, 0-based half-open)", async () => {
		const s = await inspectBedLines(linesOfString(FIXTURE));
		// Lengths: 100, 150, 1000, 500. Total 1750. Min 100, max 1000.
		expect(s.totalLength).toBe(1750);
		expect(s.minLength).toBe(100);
		expect(s.maxLength).toBe(1000);
	});

	test("strand and chromosome distributions", async () => {
		const s = await inspectBedLines(linesOfString(FIXTURE));
		expect(s.byChromosome).toEqual({ chr1: 2, chr2: 2 });
		expect(s.byStrand).toEqual({ "+": 1, "-": 1, ".": 1 });
	});

	test("captures first features with name + strand", async () => {
		const s = await inspectBedLines(linesOfString(FIXTURE));
		expect(s.firstFeatures[0]).toMatchObject({ chrom: "chr1", start: 100, end: 200, name: "feat1", strand: "+" });
	});
});

describe("helix-bed-gff / gff (layer 1: in-memory fixture)", () => {
	const GFF3_FIXTURE = [
		"##gff-version 3",
		"##sequence-region chr1 1 249000000",
		"chr1\tENSEMBL\tgene\t1000\t5000\t.\t+\t.\tID=gene1;Name=BRCA1",
		"chr1\tENSEMBL\texon\t1000\t1100\t.\t+\t0\tParent=gene1",
		"chr1\tENSEMBL\texon\t2000\t2100\t.\t+\t0\tParent=gene1",
		"chr2\tHAVANA\tgene\t8000\t9000\t.\t-\t.\tID=gene2;Name=TP53",
		"",
	].join("\n");

	const GTF_FIXTURE = [
		"##gff-version 2",
		'chr1\tENSEMBL\tgene\t1000\t5000\t.\t+\t.\tgene_id "ENSG001"; gene_name "BRCA1";',
		'chr1\tENSEMBL\texon\t1000\t1100\t.\t+\t0\tgene_id "ENSG001"; exon_number "1";',
		"",
	].join("\n");

	test("detects gff3 dialect from pragma", async () => {
		const s = await inspectGffLines(linesOfString(GFF3_FIXTURE));
		expect(s.dialect).toBe("gff3");
		expect(s.gffVersion).toBe("3");
	});

	test("detects gtf dialect from pragma", async () => {
		const s = await inspectGffLines(linesOfString(GTF_FIXTURE));
		expect(s.dialect).toBe("gtf");
		expect(s.gffVersion).toBe("2");
	});

	test("infers gtf dialect from attribute style when no pragma present", async () => {
		const noPragma = GTF_FIXTURE.split("\n").slice(1).join("\n");
		const s = await inspectGffLines(linesOfString(noPragma));
		expect(s.dialect).toBe("gtf");
	});

	test("counts features per chromosome / source / type / strand", async () => {
		const s = await inspectGffLines(linesOfString(GFF3_FIXTURE));
		expect(s.featureCount).toBe(4);
		expect(s.byChromosome).toEqual({ chr1: 3, chr2: 1 });
		expect(s.bySource).toEqual({ ENSEMBL: 3, HAVANA: 1 });
		expect(s.byType).toEqual({ gene: 2, exon: 2 });
		expect(s.byStrand).toEqual({ "+": 3, "-": 1 });
	});

	test("captures first feature with attribute preview", async () => {
		const s = await inspectGffLines(linesOfString(GFF3_FIXTURE));
		expect(s.firstFeatures[0]).toMatchObject({
			seqid: "chr1",
			type: "gene",
			start: 1000,
			end: 5000,
			strand: "+",
			attributesPreview: "ID=gene1;Name=BRCA1",
		});
	});

	test("attribute preview truncates at configured length", async () => {
		const longAttrs = `chr1\tX\tCDS\t1\t100\t.\t+\t0\t${"x".repeat(200)}`;
		const s = await inspectGffLines(linesOfString(`##gff-version 3\n${longAttrs}\n`), { attributePreviewChars: 50 });
		expect(s.firstFeatures[0].attributesPreview.length).toBe(53); // 50 + "..."
		expect(s.firstFeatures[0].attributesPreview.endsWith("...")).toBe(true);
	});
});
