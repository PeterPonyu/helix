/**
 * Coordinate-system conversion and region utilities.
 *
 * Two coordinate conventions dominate genomic file formats and they are NOT
 * the same, which is a recurring silent source of off-by-one bugs:
 *
 *   - "bed":  0-based, half-open [start, end). BED, BAM POS-1, samtools view -r.
 *   - "gff":  1-based, inclusive [start, end]. GFF / GTF / VCF / SAM POS.
 *
 * To go bed -> gff:  start += 1, end stays the same
 * To go gff -> bed:  start -= 1, end stays the same
 */

export type CoordSystem = "bed" | "gff";

export interface Region {
	chrom: string;
	start: number;
	end: number;
}

export function convertCoord(
	start: number,
	end: number,
	from: CoordSystem,
	to: CoordSystem,
): { start: number; end: number } {
	if (from === to) return { start, end };
	if (from === "bed" && to === "gff") return { start: start + 1, end };
	// from "gff" to "bed"
	return { start: start - 1, end };
}

/**
 * Overlap between two regions. Both regions must be in the same coordinate
 * system; the system also controls how the overlap length is computed:
 *
 *   - bed (half-open):  overlap = max(0, min(aEnd, bEnd) - max(aStart, bStart))
 *   - gff (inclusive):  overlap = max(0, min(aEnd, bEnd) - max(aStart, bStart) + 1)
 *
 * Returns null on different chromosomes, or when the overlap is empty.
 */
export function regionOverlap(
	a: Region,
	b: Region,
	system: CoordSystem,
): { chrom: string; start: number; end: number; length: number } | null {
	if (a.chrom !== b.chrom) return null;
	const start = Math.max(a.start, b.start);
	const end = Math.min(a.end, b.end);
	const length = system === "gff" ? end - start + 1 : end - start;
	if (length <= 0) return null;
	return { chrom: a.chrom, start, end, length };
}
