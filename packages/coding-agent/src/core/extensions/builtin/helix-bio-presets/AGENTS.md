# packages/coding-agent/src/core/extensions/builtin/helix-bio-presets

Sixth bioinformatics helix builtin. Task-class characterization layer, companion to `helix-bio-persona`.

## ROLE

`helix-bio-persona` ships six always-on bioinformatics defaults. This extension adds an opt-in task-class layer: when `HELIX_BIO_PRESET` is set, the matching preset's addendum appends to the system prompt on every session start.

Composition order: `<senpi base> + <bio-persona> + <bio-preset, if any>`. Registration order in `builtin/index.ts` is load-bearing.

## FILES

- `variant-qc.ts` — VCF inspection + type distribution + sample integrity workflow.
- `ngs-review.ts` — FASTQ read count / length / quality assessment workflow.
- `scrna-triage.ts` — scRNA-seq study triage with CL / UBERON / MONDO normalization workflow.
- `presets.ts` — `BIO_PRESETS` registry, `BioPreset` type, `resolveBioPreset()` / `listBioPresets()` helpers.
- `index.ts` — extension factory + env-var read + conditional append + unknown-preset warning.

## ADDING A FOURTH PRESET

1. Create `<preset-id>.ts` with a const addendum (the existing three are templates — copy the four-section structure: role / workflow / watch-for / first-tools).
2. Import + add entry in `presets.ts`.
3. Add an L1 unit-test describe block in `test/helix-bio-presets.test.ts` asserting the four-section shape.

## V0 SCOPE BOUNDS

- Env-var activation only. No CLI flag, no settings.json key. Defer until env var proves clunky.
- Single preset per session. No `HELIX_BIO_PRESET=variant-qc,ngs-review` combining yet.
- Static catalog. No dynamic / LLM-generated presets.
- No interaction with the existing `prompt-preset` extension. They're orthogonal axes (this = task class, that = model). A future unification is roadmapped in [.helix-notes/specs/helix-bio-presets.md](../../../../../../.helix-notes/specs/helix-bio-presets.md) "open questions".

## TESTING

`test/helix-bio-presets.test.ts` covers:
- Each preset's addendum content (length, role keyword, workflow imperatives, tool references).
- Factory behavior: env unset / valid env / invalid env (silent + warn).
- env-var leakage guard: tests save and restore `process.env.HELIX_BIO_PRESET`.

No Layer 2 (no file I/O). Layer 3 (harness-driven preset activation through a faux provider) is a useful future addition once a real LLM session is exercising presets.

## NON-GOALS

- No bio sub-agent templates. Roadmapped as a sibling extension (`helix-bio-subagents`).
- No bio intent gate. Roadmapped as a sibling extension (`helix-bio-intent-gate`).
- No skill bundles. Roadmapped as a sibling extension (`helix-bio-skills`).
