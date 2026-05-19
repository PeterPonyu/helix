# helix

A multi-agent harness for bioinformatics and computational biology, forked from [code-yeongyu/senpi](https://github.com/code-yeongyu/senpi) (which itself is a fork of [badlogic/pi-mono](https://github.com/badlogic/pi-mono)).

> **Status:** scaffolding. The functional rebrand from `senpi` is in place; bioinformatics-specific extensions are tracked in `ROADMAP.md`.

## Lineage

- **upstream**: [`code-yeongyu/senpi`](https://github.com/code-yeongyu/senpi) — opinionated coding-agent runtime with intent gate, dynamic prompt, sub-agents, opencode-style permission system, speculative compaction, GPT `apply_patch`, todo continuation
- **upstream-of-upstream**: [`badlogic/pi-mono`](https://github.com/badlogic/pi-mono) (now [`earendil-works/pi-mono`](https://github.com/earendil-works/pi-mono)) — the underlying coding-agent CLI

helix inherits everything from senpi and pi-mono and adds a curated set of builtin extensions for biomedical work. Core source modifications are minimised and tracked in `changes.md` files alongside every modified subdirectory so upstream rebases stay clean.

## What changed in the rebrand

- Package: `@code-yeongyu/senpi` → `@helix-bio/helix`
- Binary: `senpi` → `helix`
- Config dir: `~/.senpi/` → `~/.helix/`
- Env vars: `SENPI_*` → `HELIX_*` (PI_* vars from pi-mono are unchanged)
- Outbound identity (OpenAI Codex `originator`, User-Agent, OpenRouter `X-Title`): `senpi` → `helix`

## What's planned (bioinformatics surface)

Each item below is a separate extension package; helix core stays minimal.

- `helix-ontology` — CL / UBERON / MONDO normalization with synonyms
- `helix-retrieve` — Qdrant hybrid+filter+rerank (bge-m3 + ms-marco-MiniLM)
- `helix-geo` — GSE / SRA lookup, GEO-DataHub integration
- `helix-h5ad` — scanpy / anndata inspection tools
- `helix-router` — task-based model routing (haiku/sonnet/opus + local Ollama for sensitive data)
- `helix-bench` — wrappers around scMetaIntel-Hub benchmark scripts
- `helix-team` — port of oh-my-openagent Team Mode (tmux multi-pane visualization)
- `helix-boulder` — port of oh-my-openagent Boulder work tracker
- `helix-session-diff` — port of opencode's git-backed session review

## Install

Not yet published. Local dev:

```bash
git clone <repo-url> helix
cd helix
npm install
npm run build
node packages/coding-agent/dist/cli.js
```

## Upstream sync

```bash
git remote add upstream https://github.com/code-yeongyu/senpi.git
git fetch upstream
git rebase upstream/main
```

Conflicts should be confined to the files this fork rebrands (centralized via `piConfig` in `packages/coding-agent/package.json`); core source changes are minimised.

## License

MIT — same as senpi and pi-mono.
