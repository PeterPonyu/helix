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

## Cassettes (record / replay, $0 in CI)

Phase 2 adds a **record/replay cassette layer** so CI can replay real provider
behavior deterministically at **$0 — with no provider keys**. It lives in
`test/e2e/cassette/`:

- `schema.ts` — the on-disk cassette shape.
- `recorder.ts` — `wrapApiProviderForRecording(real, store, mode, config)`.
- `redactor.ts` — secret scanning + header redaction.
- `store.ts` — read/write fixtures under `cassette/fixtures/`.

### The seam: wrap the provider, keep the stack real

A cassette records at the **`ApiProvider` seam** (`packages/ai`'s
`registerApiProvider` / `getApiProvider`). The whole agent and tool loop stays
real — only the provider's `stream` is recorded or replayed. For a run, the
runner installs a recording/replaying `ApiProvider` over the model's `api`,
runs, then restores the original provider.

Each call the SDK makes to the provider's `stream` becomes one **interaction**:
its request (a canonical model id + a digest of the request context) and the
verbatim `AssistantMessageEvent[]` it emitted (including the terminal
`done`/`error` event).

### How replay drives cost

On replay we re-emit the recorded events through a fresh
`AssistantMessageEventStream`. The terminal `done`/`error` event carries the
full `AssistantMessage` **including `usage`**, so the SDK's normal pipeline runs
unchanged — including the `message_end` cost extension that calls the repo's
`calculateCost(model, usage)`. The result is that `session.getSessionStats().cost`
on replay equals the recorded run's cost: **we never re-implement pricing**, and
replayed `cost` / `tokens` / `toolCalls` / `files` deep-equal the recording.

### Modes and the `CI=true ⇒ replay` rule

Set `HELIX_CASSETTE_MODE` to one of:

- `record` — call the real provider, tee events into a cassette, persist it on a
  clean run (after secret scanning).
- `replay` — serve recorded events with **no provider call** (no network). A
  missing or mismatched cassette is a **hard error** (`CassetteReplayError`) — no
  silent passthrough.
- `auto` — replay-on-hit, record-on-miss (the local default).

When the env var is unset, **`CI=true` ⇒ strict `replay`** (deterministic, $0,
fails loudly on miss/mismatch); otherwise the default is `auto`.

Request matching is strict and sequential: the Nth `stream` call maps to the
Nth recorded interaction. The digest canonicalizes the context and **ignores
volatile fields** — timestamps, tool-call ids, `usage`, provider-instance
`api`/`provider`, and the `Current date:` / `Current working directory:` lines
in the system prompt — so a recorded timestamp never breaks a match.

### Secret-safety guarantees

Cassettes are committed to git, so they must never contain credentials:

- The record seam stores only provider **events**, not request options/headers,
  so credentials should never reach a cassette.
- Before writing, the recorder runs `redactCassette` (scrubs `Authorization`,
  `x-api-key`, `apiKey`, cookies, etc.) and then `scanForSecrets`, which throws
  `UnsafeCassetteError` if the serialized cassette contains any `sk-`,
  `sk-ant-`, `Bearer `, AWS `AKIA`, Google `AIza`, GitHub `gho_/ghp_`, or PEM
  pattern. **On detection the recorder refuses to write** — nothing lands on
  disk.

### Synthetic cassettes (committed)

The committed fixtures under `cassette/fixtures/<scenarioId>__<taskId>.json` are
generated by driving the three Phase-1 tasks through the deterministic **faux**
provider in record mode (`generate-cassettes.test.ts`, gated behind
`HELIX_CASSETTE_GENERATE=1`). Because faux is deterministic, these prove the
whole replay + assert + cost pipeline at $0. `cassette-fixtures-replay.test.ts`
replays them in strict mode in CI.

### Recording REAL cassettes later

Once provider keys exist, record real cassettes locally (never in CI):

```bash
# Per-provider keys, then record through the live path:
ANTHROPIC_API_KEY=... HELIX_CASSETTE_MODE=record \
  npx vitest --run test/e2e/cassette
```

Wire a live scenario's `runTask(..., { cassette: { store, mode: "record" } })`
and commit the resulting fixture JSON (the secret scanner guards the commit).
CI then replays it at $0.

### CI job

`.github/workflows/e2e-replay.yml` runs the cassette suite in **strict replay**
(`HELIX_CASSETTE_MODE=replay`, `CI=true`, no `secrets:`) — deterministic and $0.

## Phase 3 (not in this PR)

- **Phase 3:** scheduled live runs (cron) against the matrix with a cost / UX
  dashboard built from the JSON cost reports.
