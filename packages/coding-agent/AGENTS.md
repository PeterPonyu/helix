# packages/coding-agent

`@helix-bio/helix` — primary fork target. The CLI app users actually run (`helix`). Highest merge-conflict surface against upstream `pi-mono`. **Always reach for the extension API before touching anything in `src/core/`**.

## STRUCTURE

```
src/
├── cli.ts                     # Bun/Node entry — sets process.title, disables undici timeouts, calls main()
├── main.ts                    # Arg parse → model resolution → mode dispatch
├── index.ts                   # Public API (AgentSession, AuthStorage, compaction, extension types, tools)
├── config.ts                  # APP_NAME, VERSION, configDir/cacheDir/sessionDir resolvers
├── migrations.ts              # Settings/session schema migrations (incl. `pi → helix` rename)
├── package-manager-cli.ts     # `helix update helix`, package commands (install/list/remove)
├── changes.md                 # Fork tracker (root-level src changes)
├── bun/                       # Bun binary entry (cli.ts, register-bedrock.ts, restore-sandbox-env.ts)
├── cli/                       # args.ts, file-processor.ts, initial-message.ts, list-models.ts, session-picker.ts, config-selector.ts
├── core/                      # 32 files — see below; PRIMARY FORK SURFACE
│   ├── agent-session.ts       # 3355-line session lifecycle, event emission, runtime
│   ├── extensions/            # Extension API: types.ts (1636 LOC), loader, runner, builtin/ — see AGENTS.md
│   ├── tools/                 # Built-in tools (bash/edit/grep/find/ls/read/write) — see AGENTS.md
│   ├── compaction/            # Plugsuit-style compaction policy — see changes.md
│   ├── dynamic-prompt/        # buildDynamicSystemPrompt() — see changes.md
│   ├── export-html/           # session → HTML transcript renderer
│   ├── auth-{guidance,storage}.ts, sdk.ts, model-{registry,resolver}.ts, settings-manager.ts, …
│   └── changes.md             # Core-level fork changes
├── modes/
│   ├── interactive/           # TUI mode — see AGENTS.md (35 components + interactive-mode.ts)
│   ├── rpc/                   # JSONL RPC server (rpc-mode.ts, rpc-client.ts, jsonl.ts, rpc-types.ts)
│   └── print-mode.ts          # One-shot non-interactive mode
├── utils/                     # git, mime, clipboard, image, photon, version-check, …
└── docs/                      # User-facing docs (extensions.md is 2262 lines of API ref)

test/
├── suite/
│   ├── harness.ts             # MODERN test harness — use this
│   └── regressions/           # `<issue-number>-<slug>.test.ts` for upstream issues
├── test-harness.ts            # Legacy harness
└── (~120 standalone .test.ts files)
```

## WHERE TO LOOK

| Task | First-choice path | Notes |
|------|-------------------|-------|
| Add tool | `src/core/extensions/builtin/<name>/` | Use `pi.registerTool()`. Core `tools/` only for upstream-parity edits. |
| Add slash command | builtin extension | `pi.registerCommand()`. Never edit `src/core/slash-commands.ts`. |
| Add CLI flag | builtin extension `pi.registerFlag()` | Or `src/cli/args.ts` if it must mirror upstream behavior |
| Modify session lifecycle | `src/core/agent-session.ts` | High-conflict; document any change in `core/changes.md` |
| Replace system prompt | extension `before_agent_start` | Or `src/core/dynamic-prompt/build.ts` (already modified — see `changes.md`) |
| Custom compaction logic | extension `on("session_before_compact")` | Or `src/core/compaction/` for policy constants |
| Add TUI component | `src/modes/interactive/components/` | 35 existing components — match local style |
| Add regression test | `test/suite/regressions/<issue>-<slug>.test.ts` | Use `test/suite/harness.ts`, never real APIs |

## EXTENSION LIFECYCLE (1-line each)

1. **Discovery**: builtin (`builtin/index.ts`) + `.pi/extensions/`, `.helix/extensions/`, `~/.pi/agent/extensions/`, `settings.json` paths, `-e` CLI flag.
2. **Loading**: `extensions/loader.ts` — single shared `jiti` importer (`changes.md` 2026-05-08), aliases `@mariozechner/pi-*` → workspace packages.
3. **Factory**: `export default function(pi: ExtensionAPI) { … }` runs at load time.
4. **Binding**: `ExtensionRunner.bindCore()` connects `pi.*` stubs to real implementations.
5. **Events**: `session_start` → `resources_discover` → tool/command/UI events → `session_shutdown`.
6. **Reload**: `session_shutdown` → reload changed files → re-run factories → `session_start({ reason: "reload" })`.

## CONVENTIONS

- **Tool shape**: TypeBox schema + `execute(input, ctx)` + `renderCall` + `renderResult`. Match `core/tools/` patterns; see `core/tools/AGENTS.md`.
- **No built-in MCP / permission popups / plan mode / todos in core** — pi philosophy. The fork's `permission-system`, `compaction`, `prompt-preset`, and `todowrite` features live as **builtin extensions**, not core.
- **Keybindings always configurable** — `DEFAULT_EDITOR_KEYBINDINGS` / `DEFAULT_APP_KEYBINDINGS` are the source of truth.
- **Faux provider for tests** — never spend a real token in `npm test`. Use `harness.ts` + `pi-ai/faux`.
- **Inlined UUIDv7 in `core/session-manager.ts`** — do NOT re-add the `uuid` package. Documented in `changes.md` 2026-04-17.
- **Branding**: package name `@helix-bio/helix`, app name `helix`, configDir `.helix`. Self-update target is `PeterPonyu/helix`.

## ANTI-PATTERNS

- Touching `src/core/extensions/types.ts` without an `extensions/changes.md` entry — the public extension API is the fork's most-watched contract.
- Hardcoding key bindings.
- Real LLM API in tests.
- Adding "would-be-an-extension" features to `core/` — bloats merge surface and violates pi's philosophy.
- Re-running `prepublishOnly` to "fix" CI — it intentionally rebuilds dist + chmod's binaries; only run during release.
- Editing `dist/` checked-in stubs (none here, but see `packages/{mom,pods}/`).

## NOTES

- The MODERN test harness is `test/suite/harness.ts`. `test/test-harness.ts` is legacy and only kept for already-converted suites.
- Test docs: [`test/suite/README.md`](test/suite/README.md) (harness-based suite rules), [`test/integration/README.md`](test/integration/README.md) (API-key-gated live tests), [`test/fixtures/compaction/README.md`](test/fixtures/compaction/README.md) (per-feature compaction fixtures).
- `docs/extensions.md` is the 2262-line capability reference. Read it before claiming "no extension hook can do X".
- `examples/extensions/` ships canonical extension reference implementations (sandbox, custom-provider-anthropic, custom-provider-gitlab-duo, with-deps).
- The Bun binary build (`build:binary`) compiles `dist/bun/cli.js` into a single executable; `copy-binary-assets` copies fonts/themes/templates into `dist/`.

## PLATFORM SUPPORT — `--neo` TUI

The `--neo` mode dispatches to the native Rust `helix-neo-tui` binary
resolved by `src/modes/neo-mode.ts` from `dist/neo-tui-bin/`.

Published npm builds currently ship the `helix-neo-tui` binary **only for
linux-x64**, because `.github/workflows/publish-npm.yml` runs on
`ubuntu-latest` and `packages/neo-tui/scripts/build-binary.mjs` stages
just the current host's `process.platform` / `process.arch`.

Users on darwin (x64/arm64), linux-arm64, or windows (x64/arm64) running
`helix --neo` will hit `Error: --neo TUI binary not found` with a
platform-specific message pointing at issue #21. Until cross-platform
packaging lands they can either:

- run on linux-x64,
- build the crate from source with `cargo build --release --package
  helix-neo-tui` and point `HELIX_NEO_TUI_BIN` at the resulting binary
  (or set `HELIX_NEO_TUI_DEV=1` in a workspace checkout),
- or use the non-`--neo` interactive mode.

Cross-platform packaging (per-platform optional packages **or** a
multi-arch build matrix that fans out before `npm publish`) is tracked
in https://github.com/PeterPonyu/helix/issues/21.
