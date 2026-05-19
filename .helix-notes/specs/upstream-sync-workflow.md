# Spec: upstream-sync-workflow

**Status:** draft → in implementation
**Author:** helix
**Date:** 2026-05-19
**Tracks:** infrastructure / CI

## Problem

The inherited `.github/workflows/sync-upstream.yml` + `scripts/sync-upstream.mjs` were written by senpi for senpi's relationship with `badlogic/pi-mono`. Pointed at helix, every scheduled run (every 6h) fails:

1. `git remote add upstream https://github.com/badlogic/pi-mono.git` — wrong remote. For helix, upstream should be `code-yeongyu/senpi` (senpi handles its own sync from pi-mono).
2. `.github/upstream.json` still says `repo: "badlogic/pi-mono"`, `tag: "v0.75.1"`, `sha: "c65177370..."` — stale and pointed at the wrong project.
3. Workflow runs `npm install --no-audit --no-fund` BEFORE the sync script. npm install dirties `package-lock.json`, the sync script then asserts a clean working tree, and aborts with `fatal: working tree must be clean before sync`. This is an ordering bug — the script doesn't need workspace deps to do git operations.

Observed failure: run 26098489280, scheduled at 12:54 UTC, exit 2 with the "working tree must be clean" message.

## Goals

1. helix's upstream is `code-yeongyu/senpi`. All sync infrastructure points there.
2. The scheduled sync run completes without crashing. On a clean fork point (our current state), the sync is a no-op or fast-forward; on a divergence with conflict, it opens a labeled PR.
3. Initial `upstream.json` pin matches our actual fork point so the next sync correctly computes the diff.
4. The 659-line sync script (senpi-inherited) is NOT touched in this PR. It is generic; the issue is config + workflow ordering.

## Non-goals

1. Rewriting the sync script.
2. Changing the 6-hour schedule.
3. Adding new conflict-resolution heuristics.
4. Syncing from `badlogic/pi-mono` directly. Senpi is our single upstream; senpi handles its own sync from pi-mono and we inherit transitively.

## Design

### `.github/upstream.json`
```json
{
  "repo": "code-yeongyu/senpi",
  "tag": "v2026.5.15-2",
  "sha": "dfeea6e829787ac014bab6a30cced7950f1dddb5",
  "synced_at": "2026-05-19T00:00:00Z"
}
```

- `repo`: senpi.
- `tag`: senpi's most recent CalVer release (`v2026.5.15-2`, 2026-05-15). Informational.
- `sha`: the commit helix's `main` branched from. Verified via `git merge-base main upstream/main` = `dfeea6e8`. This is `fix(coding-agent): apply provider idle timeout`, a 2026-05-19 senpi `main` commit.
- `synced_at`: the rebrand turn date.

### `.github/workflows/sync-upstream.yml`

Two surgical changes:

1. `git remote add upstream https://github.com/badlogic/pi-mono.git` → `git remote add upstream https://github.com/code-yeongyu/senpi.git` (also the `set-url` fallback).
2. Remove the `Install dependencies` step (`npm install --no-audit --no-fund`). The sync script is a plain Node script that uses `node:fs`, `node:child_process`, and `gh` CLI only — no workspace npm deps. Removing the step also eliminates the package-lock.json dirty-tree race.

The Bun setup step is retained on the chance the script invokes Bun (verifying with a quick grep that it doesn't — but the step is cheap and matches the script's environment).

### What we are NOT changing
- `scripts/sync-upstream.mjs` — the 659-line script. It reads `repo` from upstream.json generically; no helix-specific logic.
- The cron schedule (`0 */6 * * *`).
- `KNOWN_MODIFIED_UPSTREAM_FILES` set in the script — this is senpi's curated list of files where it intentionally diverges from pi-mono. For helix's diverges from senpi, the script's auto-resolver will widen the conflict zone, which is acceptable behavior on first run.

## API / surface

Operator surface:
```bash
# Trigger a sync manually:
gh workflow run sync-upstream.yml --repo PeterPonyu/helix

# Watch:
gh run list --repo PeterPonyu/helix --workflow=sync-upstream.yml --limit 5
```

Sync results:
- **clean merge:** committed directly to `main` with message `sync: merge upstream <short-sha> into main`, upstream.json updated, run is green.
- **conflicts:** a PR opens from `sync/upstream-<short-sha>` against `main`, labeled `sync-conflict`, with conflict markers intact. A new sync that fires while a conflict PR is open closes the old PR (`Superseded by upcoming sync from <new>`) and opens a fresh one.

## Testing

- Layer 3 (CI workflow): trigger `workflow_dispatch` after merge and confirm a green no-op run, since helix is currently fork-pointed at senpi HEAD.
- No unit tests added. The sync script is senpi-owned and tested in senpi's own repo.

## Open questions

- Eventually we may want a release/changelog automation that detects "upstream rebases that bring user-facing changes" and tags helix accordingly. Out of v0 scope.

## Future work

- `feat/upstream-sync-doctor` — local CLI that previews what the next sync would do, without pushing.
- `feat/upstream-sync-changelog` — auto-generate a helix release note from the merged upstream commits.
