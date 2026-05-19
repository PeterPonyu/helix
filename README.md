# helix

An AI agent harness for **bioinformatics** — sequence analysis, NGS pipeline orchestration, genomic database retrieval, and ontology-aware metadata search, driven from a single CLI.

helix is **not** a computational-biology harness. Modeling, simulation, structural prediction, and systems-biology work are out of scope and tracked in a separate sibling project.

> **Status:** scaffolding. The functional rebrand from upstream is complete; bioinformatics-specific extensions are being implemented as separate packages.

## What helix does

helix wraps your LLM provider of choice (Anthropic / OpenAI / OpenRouter / Together / Cloudflare AI Gateway / local Ollama / 30+ others) with a coding-agent loop that has:

- **Sub-agents** for parallel work (`task` / `background_output` / `background_cancel`)
- **Permission system** with JSONL persistence (necessary for controlled-access genomics data)
- **Speculative + restoration compaction with degradation monitoring** — large bioinformatics tool outputs (VCFs, sample manifests, h5ad summaries) won't blow your context
- **Dynamic system prompt** with intent gate, tool categorization, and policy enforcement
- **Per-model prompt presets** (gpt-5.x, claude-opus-4-{5,6,7}, kimi-k2-6)
- **Extension-first architecture** — bioinformatics tools ship as builtin or user packages, not core forks

## Bioinformatics extension surface

Each item is a separate package under `packages/coding-agent/src/core/extensions/builtin/` (in-tree) or installable via `helix install`. Core stays minimal.

**Data acquisition & databases**
- `helix-geo` — NCBI GEO / SRA lookup, GSE metadata retrieval, sample-level enrichment
- `helix-ncbi` — NCBI E-utilities client (PubMed, Gene, Taxonomy, ClinVar)
- `helix-ensembl` — Ensembl REST API client (variants, regulatory features, comparative genomics)
- `helix-uniprot` — UniProt API client (protein metadata, cross-references)

**Sequence & alignment**
- `helix-seq` — FASTA / FASTQ / BAM / CRAM / VCF parsing and manipulation
- `helix-blast` — BLAST wrappers (local blastn/blastp + NCBI remote)
- `helix-coords` — genome coordinate operations, liftover, UCSC track handling

**NGS pipeline integration**
- `helix-nextflow` — Nextflow workflow execution and tracking
- `helix-snakemake` — Snakemake workflow execution and tracking
- `helix-pipelines` — pipeline status, log inspection, resource estimation

**Single-cell & expression data (text/metadata layer)**
- `helix-h5ad` — scanpy / anndata inspection (metadata + summary stats, no matrix loading)
- `helix-loom` — loom file metadata inspection

**Retrieval & ontology**
- `helix-ontology` — CL / UBERON / MONDO / GO / MeSH normalization with synonym handling
- `helix-retrieve` — Qdrant hybrid (dense + sparse) + filter + rerank stack

**Agent infrastructure**
- `helix-router` — task-based model routing across providers
- `helix-ollama-local` — local-only Ollama for sensitive / controlled-access data
- `helix-team` — multi-agent tmux visualization
- `helix-boulder` — long-running task work-tracking
- `helix-session-diff` — git-backed session review

## Install

Not yet published. Local development:

```bash
git clone https://github.com/helix-bio/helix.git
cd helix
npm install
npm run build
node packages/coding-agent/dist/cli.js
```

## Configuration

- Config dir: `~/.helix/agent/`
- Env vars: `HELIX_CODING_AGENT_DIR`, `HELIX_CODING_AGENT_SESSION_DIR`, plus standard `PI_*` vars inherited from the underlying runtime (e.g. `PI_API_KEY`, `PI_OFFLINE`)
- Provider auth: `helix login <provider>`

## Built on

helix is built on top of [`code-yeongyu/senpi`](https://github.com/code-yeongyu/senpi), an opinionated coding-agent runtime by [@code-yeongyu](https://github.com/code-yeongyu), which itself is built on [`badlogic/pi-mono`](https://github.com/badlogic/pi-mono) (now [`earendil-works/pi-mono`](https://github.com/earendil-works/pi-mono)) by [@badlogic](https://github.com/badlogic). helix periodically rebases on senpi to inherit upstream improvements while keeping bioinformatics-specific work in extension packages so the rebase surface stays minimal.

## License

MIT.
