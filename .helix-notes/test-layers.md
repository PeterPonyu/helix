# Test Layers for helix — CI vs E2E vs UAT

helix uses a 4-tier test taxonomy that maps cleanly to the standard CI / E2E / UAT vocabulary. Tier names are stable across the codebase; this document is the single source of truth for which test runs where and why.

## The 4 tiers

| Tier | Domain | Network | Filesystem | LLM | Runs in default `npm test`? | Mapped to |
|---|---|---|---|---|---|---|
| **L1 unit** | Parser logic vs in-memory fixture strings | no | no | no | ✅ yes | **CI** |
| **L2 synthetic** | Path-based public API vs temp files written from in-test fixtures (incl. `gzipSync` round-trip) | no | yes (`mkdtemp`) | no | ✅ yes | **CI** |
| **L2-real** | Same path-based API but against real public bio files lazy-downloaded from stable URLs | yes (first use) | yes (cache) | no | ❌ no (opt-in via `HELIX_REAL_DATA=1`) | **E2E** for the parser layer |
| **L3 harness** | Tool registration + dispatch via `test/suite/harness.ts` + faux provider | no | maybe | scripted (faux) | when added — yes | **CI** (agent contract test) |
| **L4 UAT** (future, manual) | Real LLM, real dataset, real user / domain expert judges if the answer is useful | yes | yes | real | n/a — manual pre-release | **UAT** |

## What goes in CI (`npm test`)

- All **L1 unit** files. Fast, deterministic, hermetic.
- All **L2 synthetic** files. Filesystem touch only via `mkdtemp` + `gzipSync`; cleanup via `afterAll(rmSync)`. ~10s total.
- All **L3 harness** files when they exist. Hermetic via faux LLM provider; no network. Senpi runs many of these under `test/suite/`.

Combined budget: should run in well under 30s on a dev machine. Pre-commit hook is allowed to run this set.

## What goes in E2E (`HELIX_REAL_DATA=1 npm test`)

- All **L2-real** files (`test/helix-real-data.test.ts` today).
- Tests pull from `test/helpers/real-fixtures.ts` `CATALOG`, lazy-download to `~/.cache/helix/test-fixtures/` (override with `HELIX_TEST_FIXTURE_DIR`), SHA256-verify on each call.

**Why it's E2E and not CI:**
- Hits the network. Default CI must be hermetic; flaky on offline laptops, CI runners with no egress, or upstream outages.
- Domain-level guarantee: "the parser handles real samtools/bcftools/bedtools/biopython/gffutils test data" — closer to "does helix actually do bioinformatics" than "does our regex match."

**When to run:**
- Pre-release.
- After touching any parser in `helix-seq` / `helix-bed-gff` / `helix-ontology`.
- Before adding a new fixture to `CATALOG` (to capture the SHA256).
- In a separate CI lane that gets a longer timeout and accepts network occasionally hiccupping (retry helper now built-in).

## What's UAT (no automation today)

UAT means a human (the user or a domain reviewer on their behalf) runs the actual helix CLI against representative bioinformatics tasks with a real LLM and confirms the final answer is correct and useful. Examples:

- Point helix at a 1000 Genomes VCF and ask "how many INDELs are on chrX in samples HG00096 and HG00097?" — does it call `seq_vcf_summary` first? Does the answer match `bcftools stats`?
- Point helix at a directory of FASTQs and ask "which sample has the lowest mean quality?" — does it iterate? Does it stop at a sane sample size?
- Ask helix to "translate this BED file to GFF coordinates" — does it call `coord_convert`? Does it state the destination convention?

These exercises do not have automation today and probably do not benefit from cheap automation (real LLM cost + human judgment). They belong in a release checklist and accumulate over time as documented "release smoke" scenarios.

## Mapping cheat sheet

```
  L1 unit              ──┐
  L2 synthetic         ──┼──> CI  (npm test, pre-commit, default)
  L3 harness (future)  ──┘

  L2-real              ─────> E2E (HELIX_REAL_DATA=1 npm test, pre-release, after parser edits)

  L4 UAT (manual)      ─────> UAT (release checklist, no automation)
```

## Adding a new test — which tier?

| You want to test | Use tier | File pattern |
|---|---|---|
| A pure function with no I/O | L1 | `*-parsers.test.ts` / `*.test.ts` |
| A path-based API with synthetic content (incl. .gz) | L2 | `*-files.test.ts` |
| A path-based API against authoritative real data | L2-real | add fixture to `CATALOG`, append a describe block to `helix-real-data.test.ts` |
| A tool's wire behavior (prompt rendering, dispatch) | L3 harness | `test/suite/<extension-name>-extension.test.ts` |
| "Does the final answer satisfy a real user task?" | L4 UAT | release-checklist doc, manual run |

## Why explicit tiers matter

The 84 pre-existing failures inherited from senpi upstream are a `jiti` / `vitest` SSR-loader mismatch — a tier-confusion problem at root. The tests are L1-shaped (unit-style assertions) but L3-positioned (they dynamically load .ts extension code through a runtime that wraps `import.meta`). Knowing which tier a test lives in tells you which infra constraints apply and which constraints don't.
