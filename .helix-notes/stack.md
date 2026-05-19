# helix Tech-Stack Composition Report

_Branch: `rebrand/helix` — generated 2026-05-19_

---

## 1. Languages and Directories

helix is an 8-package pnpm monorepo. TypeScript covers every package except one: `packages/neo-tui` is pure Rust (a terminal-UI renderer). Within TypeScript, `packages/coding-agent` is the primary CLI application (`@helix-bio/helix`), `packages/ai` is the multi-provider LLM client layer, `packages/tui` is the Node-side TUI bridge, `packages/agent` is a thin agent-loop library, and `packages/web-ui` is the browser-based session viewer. Two further packages, `packages/mom` and `packages/pods`, contain no TypeScript source (they ship only pre-built dist stubs or Rust-compiled artefacts). Shell scripts appear in `packages/neo-tui/scripts/` (two screenshot-capture helpers) and `packages/coding-agent/examples/extensions/doom-overlay/doom/build.sh`; these are non-trivial only in the sense that they automate screenshot capture and a native build respectively. No Python exists in the packages tree.

---

## 2. LOC Fractions

Measured with `find packages -type f \( -name '*.ts' -o -name '*.rs' -o -name '*.js' -o -name '*.mjs' -o -name '*.json' \)` excluding `node_modules/`, `dist/`, `target/`, and `*.generated.ts` files:

| Language   | Lines   | Share  | Dominant package              |
|------------|---------|--------|-------------------------------|
| TypeScript | 224,144 | 92.3 % | `coding-agent` (127,137 LOC)  |
| Rust       | 12,567  |  5.2 % | `neo-tui` (only Rust package) |
| JavaScript | 3,301   |  1.4 % | scattered build/release scripts |
| JSON       | 2,736   |  1.1 % | workspace package manifests   |
| **Total**  | **242,748** | 100 % | |

Within TypeScript, `coding-agent` alone is 57 % of the entire codebase; `ai` (44,552), `tui` (23,556), `web-ui` (15,285), and `agent` (13,614) are secondary. The `ai` package contains the one excluded generated file (`src/models.generated.ts`); its omission does not materially shift the fractions.

---

## 3. Work Surface vs Vendored Upstream

**(a) helix's work surface** is concentrated in two zones of `packages/coding-agent`:

- `src/core/extensions/builtin/` — the canonical landing zone for all new helix features (permission system, compaction policy, prompt presets, todo tools, gpt-apply-patch). AGENTS.md mandates "always reach for the extension API before touching anything in `src/core/`".
- `packages/coding-agent/examples/extensions/` — reference implementations for user-facing external extensions (sandbox, custom providers).
- Any upstream file that has been legitimately modified carries a neighbouring `changes.md` entry; there are 20 such files across the repo (e.g. `src/core/changes.md`, `src/core/dynamic-prompt/changes.md`, `src/modes/interactive/changes.md`).

**(b) Vendored upstream surface** — everything else in `packages/coding-agent/src/core/` (agent-session.ts, tools/, slash-commands.ts, model-registry.ts, auth-*, sdk.ts, etc.), the entire `packages/ai/` provider library, `packages/tui/`, `packages/agent/`, and `packages/neo-tui/` are treated as upstream pi-mono/senpi code. Contributors are explicitly told not to touch these unless no extension hook can do the job.

**(c) `changes.md` contract** — every modification to an upstream-tracked file must add a dated section to the nearest `changes.md` documenting what changed, why, why an extension could not handle it, and expected merge-conflict zones. These files are the single source of truth for conflict resolution during upstream rebases.

**(d) Rebase cadence** — a GitHub Actions workflow (`sync-upstream.yml`) syncs from `badlogic/pi-mono` automatically every 6 hours. Clean merges land directly on `main`; conflict cases open a `sync-conflict` PR from a `sync/upstream-<sha>` branch. helix uses CalVer (`YYYY.M.D`) distinct from upstream's semver line. Contributors do not manually trigger upstream merges.

---

**helix is a TypeScript-dominant fork (92 % of LOC) with a small Rust TUI package (`neo-tui`, 5 %); helix's work surface is `packages/coding-agent/src/core/extensions/builtin/` plus `changes.md`-documented core edits, while the upstream-vendored surface is the remainder of `src/core/`, all of `packages/ai/`, `packages/tui/`, `packages/agent/`, and `packages/neo-tui/`.**
