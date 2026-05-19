import { describe, expect, test } from "vitest";
import { GRCH38_CHROMS, lookupChrom } from "../src/core/extensions/builtin/helix-coords/chrom-aliases.js";
import { convertCoord, regionOverlap } from "../src/core/extensions/builtin/helix-coords/coords.js";

describe("helix-coords / chrom-aliases", () => {
	test("table has exactly 25 canonical GRCh38 chromosomes (1-22 + X + Y + MT)", () => {
		expect(GRCH38_CHROMS).toHaveLength(25);
		const ensemblNames = GRCH38_CHROMS.map((c) => c.ensembl).sort();
		expect(ensemblNames).toEqual([...Array.from({ length: 22 }, (_, i) => `${i + 1}`), "MT", "X", "Y"].sort());
	});

	test("lookup resolves UCSC names", () => {
		const r = lookupChrom("chr1");
		expect(r).toMatchObject({ ucsc: "chr1", ensembl: "1", refseq: "NC_000001.11" });
	});

	test("lookup resolves Ensembl names including bare numbers", () => {
		expect(lookupChrom("1")?.ucsc).toBe("chr1");
		expect(lookupChrom("X")?.ucsc).toBe("chrX");
	});

	test("lookup resolves RefSeq accessions", () => {
		expect(lookupChrom("NC_012920.1")?.ucsc).toBe("chrM");
		expect(lookupChrom("NC_000023.11")?.ensembl).toBe("X");
	});

	test("mitochondria: chrM (UCSC) <-> MT (Ensembl) -- the canonical silent trap", () => {
		const fromUcsc = lookupChrom("chrM");
		const fromEnsembl = lookupChrom("MT");
		expect(fromUcsc).toEqual(fromEnsembl);
		expect(fromUcsc?.refseq).toBe("NC_012920.1");
	});

	test("lookup is case-insensitive and trims whitespace", () => {
		expect(lookupChrom("  CHR1 ")?.ensembl).toBe("1");
		expect(lookupChrom("nc_012920.1")?.ucsc).toBe("chrM");
	});

	test("lookup returns undefined for unknown contigs (alt / patch / random)", () => {
		expect(lookupChrom("chr1_KI270706v1_random")).toBeUndefined();
		expect(lookupChrom("HSCHR1_CTG3")).toBeUndefined();
		expect(lookupChrom("chr99")).toBeUndefined();
	});
});

describe("helix-coords / coord conversion (BED <-> GFF)", () => {
	test("bed -> gff increments start, leaves end alone", () => {
		expect(convertCoord(100, 200, "bed", "gff")).toEqual({ start: 101, end: 200 });
	});

	test("gff -> bed decrements start, leaves end alone", () => {
		expect(convertCoord(101, 200, "gff", "bed")).toEqual({ start: 100, end: 200 });
	});

	test("bed <-> gff round-trip preserves coordinates", () => {
		const start = 1000;
		const end = 2000;
		const togff = convertCoord(start, end, "bed", "gff");
		const back = convertCoord(togff.start, togff.end, "gff", "bed");
		expect(back).toEqual({ start, end });
	});

	test("identity conversion (same system in/out)", () => {
		expect(convertCoord(100, 200, "bed", "bed")).toEqual({ start: 100, end: 200 });
		expect(convertCoord(100, 200, "gff", "gff")).toEqual({ start: 100, end: 200 });
	});

	test("preserves equivalent length across the round-trip", () => {
		// 100 bp in BED [100, 200) == 100 bp in GFF [101, 200]
		const bedLen = 200 - 100;
		const gff = convertCoord(100, 200, "bed", "gff");
		const gffLen = gff.end - gff.start + 1;
		expect(bedLen).toBe(gffLen);
	});
});

describe("helix-coords / region overlap", () => {
	test("overlapping BED regions report half-open length", () => {
		// [100, 200) and [150, 250) overlap is [150, 200), length 50
		const r = regionOverlap({ chrom: "chr1", start: 100, end: 200 }, { chrom: "chr1", start: 150, end: 250 }, "bed");
		expect(r).toEqual({ chrom: "chr1", start: 150, end: 200, length: 50 });
	});

	test("overlapping GFF regions report inclusive length", () => {
		// [100, 200] and [150, 250] overlap is [150, 200], length 51 (inclusive)
		const r = regionOverlap({ chrom: "chr1", start: 100, end: 200 }, { chrom: "chr1", start: 150, end: 250 }, "gff");
		expect(r).toEqual({ chrom: "chr1", start: 150, end: 200, length: 51 });
	});

	test("different chromosomes -> null", () => {
		const r = regionOverlap({ chrom: "chr1", start: 100, end: 200 }, { chrom: "chr2", start: 100, end: 200 }, "bed");
		expect(r).toBeNull();
	});

	test("disjoint regions -> null", () => {
		const r = regionOverlap({ chrom: "chr1", start: 100, end: 200 }, { chrom: "chr1", start: 300, end: 400 }, "bed");
		expect(r).toBeNull();
	});

	test("BED regions touching at boundary do NOT overlap (half-open)", () => {
		// [100, 200) and [200, 300) share boundary 200 but BED end is exclusive
		const r = regionOverlap({ chrom: "chr1", start: 100, end: 200 }, { chrom: "chr1", start: 200, end: 300 }, "bed");
		expect(r).toBeNull();
	});

	test("GFF regions touching at boundary DO overlap (inclusive)", () => {
		// [100, 200] and [200, 300] share position 200 in inclusive semantics
		const r = regionOverlap({ chrom: "chr1", start: 100, end: 200 }, { chrom: "chr1", start: 200, end: 300 }, "gff");
		expect(r).toEqual({ chrom: "chr1", start: 200, end: 200, length: 1 });
	});

	test("identical regions -> full self-overlap", () => {
		const a = { chrom: "chr1", start: 100, end: 200 };
		const bed = regionOverlap(a, { ...a }, "bed");
		expect(bed?.length).toBe(100);
		const gff = regionOverlap(a, { ...a }, "gff");
		expect(gff?.length).toBe(101);
	});
});
