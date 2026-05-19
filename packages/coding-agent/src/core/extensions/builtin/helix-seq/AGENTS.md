# packages/coding-agent/src/core/extensions/builtin/helix-seq

Second bioinformatics-specific helix builtin. Inspects sequence and variant files (FASTA / FASTQ / VCF) and returns summaries the LLM can quote.

## ROLE

Registers three tools — `seq_fasta_info`, `seq_fastq_info`, `seq_vcf_summary` — that map a file path to a structured summary. The LLM calls them before quoting record counts, length stats, sample names, or variant counts. Pure TS streaming parsers; no scientific-Python dependency.

## FILES

- `stream.ts` — shared file/path → line-iterator helper with .gz/.bgz/.bgzf auto-detection (Node's gunzip decodes BGZF, no custom block reader required for v0).
- `fasta.ts` — record count, length distribution (min/max/mean/total), first N headers. Streaming.
- `fastq.ts` — read count, length distribution, phred33/phred64 detection, mean quality. Streaming, sample-bounded (default 10k records).
- `vcf.ts` — header parsing (fileformat, contigs, samples), per-chromosome counts, SNV/INS/DEL/MNV/OTHER breakdown, first N variants. Streaming, sample-bounded (default 100k variants).
- `index.ts` — extension factory + three `pi.registerTool` calls + per-tool text formatters and TUI renderers.

## V0 SCOPE BOUNDS

- Pure-text-or-BGZF formats only. BAM and CRAM need a real BGZF block reader plus binary header walker — they belong in a follow-up `helix-seq-bam` extension so this one stays text-only.
- Single-allele heuristic for VCF type classification. Multi-allelic ALT (comma-separated) is bucketed as OTHER until a proper per-allele splitter lands.
- FASTQ stats are over a sample window (default 10k records). Use `sampleSize` to override; `Infinity` for exhaustive scan.

## TESTING

Parser unit tests live in `test/helix-seq-parsers.test.ts` and feed each parser an in-memory `AsyncIterable<string>` via `linesOfString()` — no temp files. When adding a parser, expose both `inspect*Lines(asyncIterable)` (testable) and `inspect*(path)` (which opens the stream then delegates).

## NON-GOALS

- No reference-aware operations (alignment, coverage, variant calling). Those belong in domain-specific extensions or are out of helix's scope entirely.
- No file editing / writing. helix-seq is read-only inspection.
- No automatic format detection beyond compression. The caller picks the tool that matches their file's format.
