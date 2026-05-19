# packages/coding-agent/src/core/extensions/builtin/helix-bed-gff

Third bioinformatics helix builtin. Companion to helix-seq — same streaming + sample-bounded shape, applied to genomic-feature text formats.

## ROLE

Registers `bed_info` and `gff_info` tools. The LLM calls them before quoting feature counts, coordinate ranges, or per-type breakdowns from BED / GFF3 / GTF files.

Re-uses `helix-seq/stream.ts` for path → line-iterator with .gz/.bgz auto-detect. The two extensions form a "text bioinformatics file inspectors" cluster.

## FILES

- `bed.ts` — BED3..BED12, feature count, length distribution (end - start), strand and chromosome counts, first N features. Sample-bounded (default 200k features).
- `gff.ts` — GFF3 + GTF dialect detection (via `##gff-version` pragma or attribute-style heuristic), per-type / per-source / per-chromosome / per-strand counts, attribute previews. Sample-bounded (default 200k features).
- `index.ts` — extension factory + 2 `pi.registerTool` calls.

## V0 SCOPE BOUNDS

- No attribute parsing for GFF/GTF. The 9th column is previewed as raw text (first 80 chars). A `helix-gff-attrs` extension can add real key/value parsing if needed.
- Multi-block BED12 entries (blockCount > 1) are counted as one feature; per-block analysis is deferred.
- bigBed / bigWig (binary indexed formats) are out of scope — they require a dedicated reader.

## TESTING

Two layers in `test/`:

1. **Unit tests** in `test/helix-bed-gff-parsers.test.ts` against in-memory fixture strings via `linesOf(Readable.from(text))`. Fast, deterministic.

2. **File-integration tests** in `test/helix-bed-gff-files.test.ts` against real temp-file inputs (including .gz round-trip through `node:zlib.gzipSync`). Verifies the path-based public API + the gzip auto-detect path.

If a future change touches tool prompts or render output, a Layer 3 harness test under `test/suite/` becomes worthwhile.

## NON-GOALS

- No coordinate-system conversion (helix-coords territory).
- No editing / writing.
- No alignment, no overlap queries (those want a sorted-index structure helix doesn't ship).
