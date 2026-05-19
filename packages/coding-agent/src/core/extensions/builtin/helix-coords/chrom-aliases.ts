/**
 * Chromosome naming-convention alias table for the human GRCh38 assembly.
 *
 * Three name conventions are common and incompatible:
 *   - UCSC:    chr1, chr2, ..., chrX, chrY, chrM
 *   - Ensembl: 1,    2,    ..., X,    Y,    MT
 *   - RefSeq:  NC_000001.11, NC_000002.12, ..., NC_000023.11, NC_000024.10, NC_012920.1
 *
 * Notes:
 *   - UCSC uses 'chrM' for mitochondria; Ensembl uses 'MT'. This is the most
 *     common silent failure when joining BED-style and Ensembl-style data.
 *   - Alt / patch contigs (chrM_NC_012920v1, chr1_KI270706v1_random, etc.) are
 *     intentionally out of scope for v0 -- 24 canonical chroms cover ~99% of
 *     analysis pipelines.
 *
 * Source: NCBI assembly report for GCF_000001405.40 (GRCh38.p14).
 */

export interface ChromAlias {
	ucsc: string;
	ensembl: string;
	refseq: string;
}

export type ChromNamingStyle = "ucsc" | "ensembl" | "refseq";

const AUTOSOMES = Array.from({ length: 22 }, (_, i) => i + 1);
const REFSEQ_AUTOSOMES = [
	"NC_000001.11",
	"NC_000002.12",
	"NC_000003.12",
	"NC_000004.12",
	"NC_000005.10",
	"NC_000006.12",
	"NC_000007.14",
	"NC_000008.11",
	"NC_000009.12",
	"NC_000010.11",
	"NC_000011.10",
	"NC_000012.12",
	"NC_000013.11",
	"NC_000014.9",
	"NC_000015.10",
	"NC_000016.10",
	"NC_000017.11",
	"NC_000018.10",
	"NC_000019.10",
	"NC_000020.11",
	"NC_000021.9",
	"NC_000022.11",
];

export const GRCH38_CHROMS: ChromAlias[] = [
	...AUTOSOMES.map((n, i) => ({ ucsc: `chr${n}`, ensembl: `${n}`, refseq: REFSEQ_AUTOSOMES[i] })),
	{ ucsc: "chrX", ensembl: "X", refseq: "NC_000023.11" },
	{ ucsc: "chrY", ensembl: "Y", refseq: "NC_000024.10" },
	{ ucsc: "chrM", ensembl: "MT", refseq: "NC_012920.1" },
];

// Reverse index: any known name -> alias row, case-insensitive on UCSC/Ensembl.
const INDEX = new Map<string, ChromAlias>();
for (const row of GRCH38_CHROMS) {
	INDEX.set(row.ucsc.toLowerCase(), row);
	INDEX.set(row.ensembl.toLowerCase(), row);
	INDEX.set(row.refseq.toLowerCase(), row);
}

export function lookupChrom(name: string): ChromAlias | undefined {
	return INDEX.get(name.trim().toLowerCase());
}
