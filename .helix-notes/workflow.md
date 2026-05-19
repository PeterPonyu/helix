# helix feature workflow: spec → commits → PR

Starting with `helix-bio-presets` (2026-05-19), all new bio extensions / characterization layers follow this flow. The rebrand branch (`rebrand/helix`) used a leaner "implement directly" flow because every commit was scaffolding; from `main` onward we want each non-trivial change to carry a reviewable design intent.

## Steps

### 1. Spec

Write `.helix-notes/specs/<feature-id>.md` before touching code. Required sections:

- **Problem** — what's broken or missing today
- **Goals** — what success looks like (numbered)
- **Non-goals** — what we are NOT solving (numbered)
- **Design** — module layout, data model, activation, composition with existing systems
- **API** — user surface + developer surface (how to extend)
- **Testing** — which test tier (L1 / L2 / L2-real / L3) per artifact
- **Open questions** — anything that's intentionally deferred
- **Future work** — sibling extensions or next iterations

Length: 1-3 pages markdown. Specs that grow beyond that should be split.

### 2. Feature branch

```bash
git checkout main
git pull --ff-only
git checkout -b feat/<feature-id>
```

Branch name matches spec id. Example: `feat/helix-bio-presets`.

### 3. Commits

Each commit is a coherent, reviewable slice that compiles + tests-pass. Aim for 1 to ~5 commits per PR:

- `feat(<feature-id>): <what>` for the implementation slice
- `test(<feature-id>): <what>` if tests land separately (uncommon — usually fold into the feat commit)
- `docs(<feature-id>): <what>` for spec / README / AGENTS.md edits
- `chore(<feature-id>): <what>` for tooling / config / build

Commit body explains **why**, not what. The spec already says what.

`HELIX_SKIP_PM_VERIFY=1` is acceptable for local pre-commit; CI runs the full PM verify.

### 4. PR

```bash
git push -u origin feat/<feature-id>
gh pr create --base main --title "<feature-id>: <short summary>" --body "$(cat <<'EOF'
Implements [.helix-notes/specs/<feature-id>.md](.helix-notes/specs/<feature-id>.md).

## Summary
- <1-3 bullets of what changed>

## Test plan
- [x] L1 unit tests pass: `npm test`
- [ ] L2-real tests pass (if parser touched): `HELIX_REAL_DATA=1 npm test`
- [ ] `npm run check` clean

## Open questions resolved during implementation
- <if any>

🤖 Generated with helix
EOF
)"
```

### 5. Review

- Self-review the diff against the spec. Each goal addressed? Each non-goal honored?
- Run `HELIX_REAL_DATA=1 npm test` once before requesting review (or before merging if solo).
- Merge as `--squash` if the commit history is messy, `--merge` if it tells a clean story.

### 6. Post-merge

- Update `.helix-notes/specs/<feature-id>.md` status from `draft` to `shipped` with the merge SHA.
- Add an entry to the appropriate package CHANGELOG.md under `[Unreleased]`.
- Delete the branch (`gh pr merge --delete-branch` does both).

## When to skip the spec

Trivial changes (typo fixes, dependency bumps, single-line refactors) don't need a spec. Rule of thumb: if you can describe the change in one git commit subject line and it changes <30 lines, skip the spec. Anything larger gets a spec.

## What happens to in-flight `rebrand/helix` work

The current `rebrand/helix` branch (17+ commits as of 2026-05-19) ships as one historical squash: the rebrand itself. Land it as `main`'s initial state. All bio-* extensions on this branch get a retroactive spec stub under `.helix-notes/specs/` so future contributors see the same shape they'll be expected to produce.
