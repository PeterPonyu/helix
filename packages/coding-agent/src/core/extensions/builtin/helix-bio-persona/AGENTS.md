# packages/coding-agent/src/core/extensions/builtin/helix-bio-persona

Fifth bioinformatics helix builtin. **Characterization** layer: makes the agent know it is helix, a bioinformatics agent, rather than treating its bio extensions as a heterogeneous tool dump.

## ROLE

Listens for `before_agent_start` and appends a bioinformatics-domain addendum to the session's system prompt. The addendum encodes six workflow defaults that distinguish helix from a generic coding agent:

1. **Inspect before claim** — never quote counts / IDs / lengths without calling the matching inspector tool
2. **Normalize before join** — `coord_chrom_normalize` before cross-source chromosome joins
3. **Convention explicit** — state coord system (0-based half-open vs 1-based inclusive) in answers
4. **Ontology grounded** — `ontology_normalize` before quoting OBO IDs; never fabricate
5. **Sample-bounded by default** — re-call with larger `sampleSize` on truncation, don't extrapolate
6. **Format identity** — trust the actual path's bytes, not the user's prose claim about format

## WHY THIS IS A SEPARATE EXTENSION

This is the answer to "rebrand should not be only plugin-level." A plugin (tool) adds capability. A persona changes default behavior. The two are orthogonal:

- Without bio-persona: the LLM has tools but no policy about when to use them. It may invent gene IDs, may misquote VCF counts from filename inference, may join `chr1` and `1` silently.
- With bio-persona but no bio tools: the agent has the right defaults but no way to act on them.

Both are required for a domain-native agent. This extension is the policy layer; the other helix-* extensions are the capability layer.

## RELATED, NOT YET BUILT

Future characterization layers that go further than this addendum:

- **Bio-flavored `prompt-preset`** — extend the existing `prompt-preset` builtin with per-task-class presets (variant QC, NGS alignment review, scRNA-seq metadata triage), each tuned with model-specific phrasing.
- **Bio-flavored intent gate** — the existing dynamic-prompt intent gate categorizes tools (read / write / network); add a `bio-inspection` / `bio-join` / `bio-ontology` axis so the agent's intent gate warns before tool calls that skip the inspect-before-claim default.
- **Bio sub-agent templates** — preset `task(prompt=...)` workflows: "QC this FASTQ", "compare two VCFs", "annotate this BED against this GFF". Each template is a multi-step inspect-then-decide chain the agent can dispatch with one tool call.
- **Bio-aware `todotools` continuations** — when a todo says "analyze sample X", auto-suggest the inspect-before-claim follow-up.
- **Bio skill bundles** — markdown skill files (`bioinformatics-conventions.md`, `ngs-fastq-qc-workflow.md`, `variant-analysis-workflow.md`) shipped via the senpi skill system and loaded by the LLM on demand.

Each future layer should land as its own extension or its own preset entry, keeping bio-persona itself minimal and rebase-clean.

## TESTING

- Layer 1: `test/helix-bio-persona.test.ts` asserts the addendum exports, that it is appended by the event handler, and that it contains each of the six default keywords (inspect, normalize, convention, ontology, sample-bounded, format).
- No Layer 2: no file I/O.
- No Layer 3 yet: a harness-level test that confirms the addendum reaches the system prompt of a faux-provider session is a useful future addition.

## NON-GOALS

- No tool registration. This extension is policy, not capability.
- No model-specific prompt tuning — that's `prompt-preset`'s territory.
- No tool execution policy enforcement — that would be a sibling extension that intercepts `tool_call` and refuses uninspected claims. Considered intentional friction we don't yet want to bake in.
