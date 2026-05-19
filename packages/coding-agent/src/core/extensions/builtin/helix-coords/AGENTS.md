# packages/coding-agent/src/core/extensions/builtin/helix-coords

Fourth bioinformatics helix builtin. Pure function library (no file I/O) for the two recurring off-by-one traps in bio file analysis: chromosome naming conventions, and 0/1-based coordinate systems.

## ROLE

Registers three tools:

- `coord_chrom_normalize(name, target?)` -- translate chromosome name between UCSC (chr1, chrM), Ensembl (1, MT), and RefSeq (NC_000001.11) for human GRCh38.
- `coord_convert(start, end, from, to)` -- convert coordinates between BED (0-based half-open) and GFF/VCF/SAM (1-based inclusive).
- `coord_overlap(a, b, system)` -- region overlap with system-aware length math.

The LLM calls these BEFORE joining cross-format data (BED + Ensembl GFF is the canonical silent failure: chr1 vs 1, 0-based vs 1-based).

## FILES

- `chrom-aliases.ts` -- 25-row table for GRCh38 canonical chroms (1-22, X, Y, MT) with all three naming conventions plus a case-insensitive reverse index.
- `coords.ts` -- pure functions: `convertCoord`, `regionOverlap`. No external state.
- `index.ts` -- 3 `pi.registerTool` calls + text formatters + TUI renderers.

## V0 SCOPE BOUNDS

- **GRCh38 only.** No GRCh37/hg19, no mouse (GRCm38/GRCm39), no other assemblies. A follow-up `helix-coords-grch37` or generalized `helix-coords-assembly` extension is the right place.
- **No alt / patch / random / fix contigs.** 25 canonical names cover ~99% of analysis pipelines; the long tail is per-pipeline / per-tool noise.
- **No liftover.** Liftover is a separate problem (needs chain files and UCSC liftOver semantics); belongs in a `helix-coords-liftover` extension.

## TESTING

- Layer 1 (unit) in `test/helix-coords.test.ts`: pure-function tests for chrom resolution, coord conversion identity, overlap edge cases (disjoint, touching at boundary, identical, gff-vs-bed length math).
- No Layer 2 file-integration tests: this extension has no file I/O.
- Real-data validation: the chrom alias table itself is sourced from NCBI's GCF_000001405.40 assembly report -- it IS real data, embedded as a constant. A `HELIX_REAL_DATA=1`-gated test cross-checks the table against the live assembly report to detect drift.

## NON-GOALS

- No graph genome / pangenome support.
- No T2T (CHM13) -- different assembly, different RefSeq IDs.
- No spliced coordinate operations (intron-aware transformations).
