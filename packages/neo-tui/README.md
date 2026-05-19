# `helix-neo-tui`

Native Rust + [ratatui](https://ratatui.rs) TUI for [helix](https://github.com/PeterPonyu/helix).

Launched via:

```bash
helix --neo
```

The Node-side helix CLI spawns the Rust binary, which owns the terminal directly and talks to the helix runtime over the existing `helix --mode rpc` JSONL protocol.

## Why a separate binary

A TUI needs exclusive ownership of the terminal: raw mode, alternate screen, Kitty keyboard protocol, mouse capture, panic-safe cleanup. Embedding a ratatui app inside the Node process through NAPI produces three classes of bug (ThreadsafeFunction event-loop leaks, libuv/tokio TTY races, panic-poisoned addon state). A standalone binary sidesteps all three. The pipe IPC cost is 50-200 µs per JSONL line: negligible against frame budgets.

## Run

The crate ships two bins (`helix-neo-tui`, the TUI itself; `helix-neo-faux`, the offline RPC backend used by the QA harness), so `cargo run` needs `--bin` to disambiguate.

```bash
# Dev: render the bundled demo scene
cargo run --release --package helix-neo-tui --bin helix-neo-tui -- \
    --demo --demo-seconds 5

# Through the Node CLI (resolves the binary out of target/release):
HELIX_NEO_TUI_DEV=1 node packages/coding-agent/dist/cli.js --neo

# Offline QA with the faux backend:
cargo run --release --package helix-neo-tui --bin helix-neo-tui -- \
    --backend-bin ./target/release/helix-neo-faux
```

## CLI flags

These belong to the `helix-neo-tui` binary. When you launch through `helix --neo`, forward them after a `--` sentinel so the helix CLI does not eat them (e.g. `helix --neo` shares the spelling `--theme` with the Node CLI, which means something different there).

```bash
helix --neo -- --theme opencode/dracula
helix --neo -- --list-themes
helix --neo -- --demo --demo-seconds 5
```

| Flag | Env | Description |
|------|-----|-------------|
| `--backend-bin <PATH>` | `HELIX_NEO_BACKEND_BIN` | Path to the helix backend binary. Spawned with `--mode rpc` on startup; if unset, the TUI runs offline (demo mode or empty session). |
| `--backend-args <JSON>` | `HELIX_NEO_BACKEND_ARGS` | JSON array of extra args forwarded to the backend, e.g. `'["--mode","rpc"]'`. |
| `--demo` | `HELIX_NEO_DEMO` | Render the canned demo scene used for screenshots. |
| `--demo-seconds <N>` | — | Exit after `N` seconds in demo mode. `0` = until Ctrl-C. |
| `--theme <ID\|PATH>` | `HELIX_NEO_THEME` | Override the theme by bundled id (`helix-neo-dark`, `opencode/dracula`, …) or by JSON file path. |
| `--list-themes` | — | Print bundled theme ids and exit. |

## Bundled themes

`helix-neo-dark` (default) plus 15 opencode-flavoured themes under `opencode/`: `ayu`, `catppuccin`, `catppuccin-frappe`, `catppuccin-macchiato`, `dracula`, `everforest`, `github`, `gruvbox`, `kanagawa`, `monokai`, `nord`, `opencode`, `rosepine`, `tokyonight`, `vesper`. Pass any of them to `--theme` or set `HELIX_NEO_THEME`. Custom themes follow the JSON schema in [`docs/theme-spec.md`](./docs/theme-spec.md).

## Default keybindings

Configurable in [`assets/keymaps/default.json`](./assets/keymaps/default.json). The non-obvious ones:

| Action | Default |
|--------|---------|
| Insert newline in the composer | `Shift+Enter` (works inside tmux via xterm modifyOtherKeys mode 2) |
| Submit the message | `Enter` |
| Recall previous / next prompt | `Up` / `Down` (when the composer is empty or on the first/last line) |
| Open slash command menu | `/` then type |
| Open `@path` autocomplete | type `@` |
| Cycle thinking level | `Shift+Tab` |
| Open model picker | `Ctrl+L` |
| Open theme picker | `Alt+T` |
| Open help overlay | `?` |
| Open command palette | `Alt+P` |
| Compact session | `Alt+C` |
| Toggle sidebar | `Alt+S` |
| Toggle animations | `Alt+A` |
| Mouse wheel | scrolls the chat viewport |
| Cancel current run | `Esc` |
| Quit | `Ctrl+D` |

Full registry lives under the `bindings` map in the keymap JSON — every key is reassignable.

## Architecture

Process tree at runtime:

```
shell
└── node helix --neo                  # transient parent
    └── helix-neo-tui                 # Rust binary (owns TTY)
        └── node helix --mode rpc     # backend
```

Module layout matches the `Layout` section below; per-module roles and the testing matrix live in [`AGENTS.md`](./AGENTS.md).

## Layout (modules)

- `app/`        - main loop, state, action channel, RPC bridge
- `rpc/`        - subprocess RPC client speaking helix `--mode rpc` (JSONL), with `Inbound::{Error, Disconnected, ParseError}` surfacing
- `theme/`      - JSON theme loader, semantic tokens, `ColorSupport` detection
- `keymap/`     - configurable bindings + leader-key sequences
- `layout/`     - pure layout computation
- `compositor/` - layered `Component` dispatch + focus stack
- `components/` - chat, input, header, footer, markdown, autocomplete, select_list, settings_list
- `overlay/`    - help, model picker, theme picker, command palette
- `anim/`       - spinners, scanners, pulses
- `term/`       - terminal capability detection (Kitty / modifyOtherKeys / OSC 52)
- `text/`       - ANSI-aware visible_width / truncate / wrap / slice

## Tests

```bash
cargo nextest run --package helix-neo-tui
cargo clippy --package helix-neo-tui --all-targets -- -D warnings
cargo fmt --package helix-neo-tui -- --check
```

Snapshot updates: `INSTA_UPDATE=always cargo nextest run --package helix-neo-tui`.

## License

MIT.
