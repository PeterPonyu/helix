# Real-provider E2E UX testing harness (Phase 1)

This harness exercises the **helix** coding agent end-to-end the way a user
would: it spins up a real `AgentSession` in a throwaway workspace, sends a tiny
prompt, lets the agent use its built-in tools (read / edit / write / bash), and
records the resulting UX signals — tool calls, turns, transcript, tokens, and
**dollar cost**.

It is designed to be **validated at $0 in CI** (via the deterministic `faux`
provider) while the same code path runs **live against real providers** when
credentials are present.

## What's in it

Everything lives under `packages/coding-agent/test/e2e/`:

| File | Purpose |
| --- | --- |
| `runner.ts` | In-process runner. `runTask(task, scenarioId, opts)` seeds a temp workspace, builds an `AgentSession` via the SDK seam `createAgentSession`, drives one prompt, accumulates tool-call/turn/cost/token signals, enforces the caps below, and returns a structured `RunResult`. |
| `matrix.ts` | The provider matrix as DATA: cheap-tier scenarios for anthropic (Haiku), openai (mini), google (flash), openrouter (cheap). Plus `hasCreds`, `anyCreds`, and the `HELIX_E2E_PROVIDERS` comma filter. |
| `assertions.ts` | `assertFiles` (format-equivalent file compare), `assertBehavior` (required/forbidden tools + counts + maxTurns), `assertText` (loose regex on the final assistant message). |
| `tasks/index.ts` | Three hand-authored tasks with seed files + expectations (create a file, fix an off-by-one bug, read config & report a port). |
| `cost-report.ts` | Aggregates `RunResult[]` into a JSON report + human summary (total $, per-provider, per-task, tokens, turns, ghost/aborted counts, rate-limit headers). |
| `faux-setup.ts` | Test-only wiring that registers the faux provider and a configured auth/registry pair so the runner can be driven with a scripted, network-free model stream. |
| `e2e-runner.test.ts` | **Runs in CI with NO keys.** Deterministic $0 validation of the runner, caps, ghost detection, and assertions using the faux provider. |
| `matrix-models.test.ts` | **Runs in CI with NO keys.** Asserts every matrix model ID resolves in `models.generated.ts`. |
| `e2e-live.test.ts` | The real matrix × tasks. `describe.skipIf(!anyCreds())` — SKIPS with no keys; runs live (with the budget cap + cost report) when keys exist. |

## How to run

### $0, no keys (always, including CI)

```bash
cd packages/coding-agent
npx vitest run test/e2e/e2e-runner.test.ts test/e2e/matrix-models.test.ts
```

These use the `faux` provider with scripted model streams — no network, no
credentials, no spend. This is the canonical proof that the harness works.

### Live, with keys

```bash
./scripts/e2e.sh
```

The entrypoint:

- exports `PI_NO_LOCAL_LLM=1` so a **local LLM is never hit** (online providers only),
- prints a summary of which provider credentials it detected,
- always runs the deterministic faux suite,
- runs the live matrix suite **only when credentials are present**,
- prints the cost report at the end.

Credentials are read from each provider's env var (`ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, plus
`ANTHROPIC_OAUTH_TOKEN`) or from the real `~/.helix/agent/auth.json` auth store.

## The budget cap

Every run accepts `maxCostUSD`. The default comes from the
`HELIX_E2E_MAX_COST_USD` env var, falling back to **$1.00 per run**.

The runner subscribes to the session's events and, on each finalized assistant
message (`message_end`), reads the SDK's own cumulative cost via
`session.getSessionStats().cost` (which already runs the repo cost math — we do
**not** re-implement pricing). When cumulative cost exceeds the cap, the runner
trips an abort (`session.abort()`) and marks the result `abortedOverBudget`. A
`maxTurns` cap (default 30) works the same way, marking `abortedMaxTurns`.

## Ghost-run detection

A run is flagged `ghost: true` when the agent produced **zero tokens AND zero
tool calls**, or when the prompt threw a transport-level error. This catches
silent misconfigurations (bad model id, missing key surfaced as an error,
provider returning nothing) that would otherwise look like a benign empty pass.

## The provider matrix

`matrix.ts` lists cheap-tier scenarios only. The model IDs are verified to exist
in `models.generated.ts` by `matrix-models.test.ts`, so a future model-table
regeneration that drops one fails loudly instead of silently skipping a provider.

Filter which scenarios run with `HELIX_E2E_PROVIDERS` (comma-separated scenario
ids or provider names), e.g. `HELIX_E2E_PROVIDERS=anthropic-haiku,openai-mini`.

## Phase 2 / 3 (not in this PR)

- **Phase 2:** record real provider responses as cassettes so the live behaviors
  can be replayed deterministically (and the format-equivalent file comparison
  can be wired through biome instead of the current whitespace normalization —
  see the TODO in `assertions.ts`).
- **Phase 3:** scheduled live runs (cron) against the matrix with a cost / UX
  dashboard built from the JSON cost reports.
