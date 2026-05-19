# Spec: helix-bio-presets

**Status:** draft → implemented in this commit
**Author:** helix
**Date:** 2026-05-19
**Tracks:** characterization layer (companion to helix-bio-persona)

## Problem

`helix-bio-persona` (builtin #17) ships six always-on bioinformatics defaults. But a *specific* task class — variant QC, NGS read review, single-cell metadata triage — wants additional task-shaped phrasing the always-on persona is too generic to provide. Users currently have to spell out the QC checklist in every prompt.

`prompt-preset` (existing builtin) tunes prompts per **model** (claude-opus-4-7, gpt-5.5, etc.). What we need is orthogonal: per **task class**.

## Goals

1. Provide opt-in task-class presets that append a focused workflow addendum to the system prompt.
2. Start with three: `variant-qc`, `ngs-review`, `scrna-triage`. These cover the three highest-volume bioinformatics agent tasks.
3. Activation surface is dead-simple: one env var (`HELIX_BIO_PRESET`), no CLI flag wiring, no settings.json schema change.
4. Compose cleanly with helix-bio-persona — preset addendum lands AFTER persona, so the always-on defaults still apply.
5. Unknown preset name = silent fallback (no addendum, no failure). Wrong is better than blocking.

## Non-goals

- Per-model tuning. That's `prompt-preset`'s job.
- A CLI flag for preset selection. Defer until we have user feedback that env var is too clunky.
- Settings.json key. Same reason.
- Dynamic preset generation from the LLM. Static catalog only.
- More than three presets in v0. Adding a fourth is one TS file + a `BIO_PRESETS` entry; defer until a real use case asks for it.

## Design

### Module layout
```
packages/coding-agent/src/core/extensions/builtin/helix-bio-presets/
  AGENTS.md           extension conventions and rationale
  index.ts            factory + env-var read + conditional append
  presets.ts          BIO_PRESETS registry + types
  variant-qc.ts       addendum content (kept in own file for readability)
  ngs-review.ts
  scrna-triage.ts
```

### Data model
```ts
export interface BioPreset {
  id: string;
  name: string;
  description: string;
  systemPromptAddendum: string;
}
```

### Activation
- Read `process.env.HELIX_BIO_PRESET` at every `before_agent_start` event (not at extension init), so users can flip presets between sessions in the same shell.
- If the env var is unset or empty: no-op.
- If it names a preset: append `preset.systemPromptAddendum` to the system prompt.
- If it names an unknown preset: log to `console.warn` once per session, no-op.

### Composition with helix-bio-persona
- bio-persona registers `before_agent_start` first (extension #17), bio-presets second (#18). Registration order determines append order.
- Final prompt: `<senpi/pi base> + <bio-persona always-on> + <bio-preset task-specific, if any>`.

### Preset content shape
Each preset addendum follows the same template:
1. One-line role statement ("You are now in <task-class> mode.").
2. Three to five workflow steps phrased as imperative bullets.
3. Two to four "watch for" pitfalls specific to the task class.
4. One line linking to the relevant bio tools the LLM should reach for first.

This consistency lets the LLM recognize "preset is active" and follow a predictable structure.

## API

User surface:
```bash
HELIX_BIO_PRESET=variant-qc helix "Analyze /data/sample.vcf"
HELIX_BIO_PRESET=ngs-review helix "QC these FASTQs in /data/reads/"
HELIX_BIO_PRESET=scrna-triage helix "Find me studies of human kidney scRNA-seq"
```

Developer surface (adding a fourth preset):
1. Create `<preset-id>.ts` in `helix-bio-presets/`.
2. Add entry to `BIO_PRESETS` in `presets.ts`.
3. Add a describe block in `test/helix-bio-presets.test.ts`.

## Testing

### Layer 1 (unit)
- For each of the three presets: addendum is non-trivial (>200 chars), contains the role keyword, contains expected workflow imperatives.
- Factory: env unset → no append; valid env → appends correct addendum; invalid env → no append, warns once.
- env-var leakage guard: tests save/restore `process.env.HELIX_BIO_PRESET`.

No Layer 2 (no file I/O). No Layer 3 yet (consider adding harness coverage once a real LLM session is exercising presets).

## Open questions

- Should presets ever be combined (e.g. `HELIX_BIO_PRESET=variant-qc,ngs-review`)? Defer until a real workflow needs both.
- Should `prompt-preset` and `helix-bio-presets` ever share a registration mechanism? Probably yes long-term — they're both "context-conditional prompt tuning". Defer the unification until we have 2+ task-class presets and 1+ model preset that want to compose.

## Future work

- Bio sub-agent templates that wrap a preset + a `task(prompt=...)` invocation (e.g. `helix qc-fastq /data/r1.fq.gz` calls a sub-agent with `HELIX_BIO_PRESET=ngs-review` automatically).
- Bio intent gate categories (a sibling extension that listens to `tool_call` and warns if `seq_vcf_summary` isn't called before quoting variant counts).
- Skill bundles (markdown skills for variant-qc / ngs-review / scrna-triage workflows, loaded on demand via the senpi skill system).

These are sibling extensions, not extensions of this one.
