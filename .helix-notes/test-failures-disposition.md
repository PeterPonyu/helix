# Test Failures Disposition Report

**Date**: 2026-05-19
**Branch**: rebrand/helix
**Workspace totals**: helix 84 failed / 2368 total | senpi upstream 80 failed / 2359 total

---

## Verdict

`mixed`

80 of the 84 failures are **inherited from senpi upstream** and pre-date all helix work.
4 failures are **helix-introduced**, split across two root causes: one incomplete test rebrand and one regression from the new `helix-ontology` builtin.

---

## Evidence

### Senpi upstream vs helix — same 5 failing test files

Both repos were tested at commit depth-5 HEAD against the same 5 files
(`extensions-discovery`, `extensions-runner`, `extensions-loader`,
`extensions-input-event`, `default-global-extension-fast-path`):

| Repo | Tests run | Failed | Passed |
|------|-----------|--------|--------|
| senpi upstream (`/tmp/senpi-upstream-check`) | 69 | 53 | 16 |
| helix (`rebrand/helix`) | 69 | 53 | 16 |

Failure lists are **byte-for-byte identical** across those 5 files.

### Full workspace comparison

| Repo | Failed | Passed | Skipped | Total |
|------|--------|--------|---------|-------|
| senpi upstream | 80 | 2234 | 45 | 2359 |
| helix | 84 | 2239 | 45 | 2368 |

Helix has 9 more tests (helix-ontology additions) and 4 more failures.

### Root cause of the 80 inherited failures

Every failure in `extensions-discovery.test.ts` and related files reduces to:

```
Failed to load extension: __vite_ssr_import_meta__.resolve is not a function
```

The tests write temporary `.ts` extension fixtures to disk and then call
`discoverAndLoadExtensions`, which uses `jiti` (a raw TypeScript loader) to
dynamically import them. Under vitest, the module graph runs through Vite's
SSR loader (`__vite_ssr_import_meta__`), which wraps `import.meta` in a proxy
object that does not implement `.resolve`. When the jiti importer is created
with `createJiti(import.meta.url, ...)`, that `import.meta.url` is the
vitest-wrapped version, and jiti calls `import.meta.resolve` internally (or
exposes it to the loaded module), which then throws.

The consequence is that **every test that actually loads a .ts fixture fails**
because the error is caught by `loadExtension`'s try/catch and pushed into
`result.errors`, while the test asserts `result.errors.toHaveLength(0)`.

Tests that do **not** dynamically load .ts fixtures pass fine (e.g., "loads
nothing with no paths", "does not recurse beyond one level", plus the mock-based
`extensions-loader` batch-reuse test and several harness tests).

This is not a jiti version issue or a helix code issue. It is a
vitest-vs-jiti architectural mismatch that exists identically in senpi upstream.
The `extensions-upstream-package-alias.test.ts` 2 helix-specific tests that
check `@helix-bio/helix` aliases also fail for this same underlying reason
(the alias wiring is correct; the jiti loader itself cannot run under vitest SSR).

### The 4 helix-specific failures

#### 1. `version-check.test.ts > uses the helix npm package metadata with a helix user agent`

**Category**: incomplete test rebrand.

The test asserts the npm registry URL contains `@code-yeongyu/helix` (the
senpi package name). But helix's `package.json` sets `"name": "@helix-bio/helix"`,
so `PACKAGE_NAME` resolves to `@helix-bio/helix` and the fetch goes to
`https://registry.npmjs.org/%40helix-bio%2Fhelix/latest`. The production code
is correct; the test expectation was not updated during the rebrand.

```
Expected URL: https://registry.npmjs.org/%40code-yeongyu%2Fhelix/latest
Actual URL:   https://registry.npmjs.org/%40helix-bio%2Fhelix/latest
```

#### 2. `extensions-upstream-package-alias.test.ts` — 2 tests (`@helix-bio/helix` alias tests)

**Category**: inherited SSR/jiti root cause, helix-specific test surface.

These 2 tests were added by helix to verify the `@helix-bio/helix` alias works
in the jiti loader (analogous to senpi's `@code-yeongyu/senpi` alias tests,
which also fail in senpi for the same reason). The alias wiring in `loader.ts`
is correct — these fail only because jiti cannot load `.ts` fixtures under
vitest SSR. Senpi's equivalent 2 tests (`@code-yeongyu/senpi`) also fail.

#### 3. `3592-no-builtin-tools-keeps-extension-tools.test.ts` — 2 tests

**Category**: helix-introduced regression (new builtin changes tool counts).

This test file exists in both repos but **passes in senpi (3/3) and fails in
helix (1/3)**. The two failing tests assert exact ordered tool-name arrays:

```
expected [ 'apply_patch', 'bash', …(10) ]
  to deeply equal [ 'apply_patch', 'bash', …(9) ]
```

Helix's `feat(helix-ontology)` commit registers `helixOntologyExtension` as a
builtin (in `src/core/extensions/builtin/index.ts`). That extension adds the
`ontology_normalize` tool. The test's hardcoded expected arrays are one tool
short — they were written against senpi's builtin count and not updated when
`helix-ontology` was added.

---

## Disposition

### Inherited 80 failures: `treat-as-known-failing`

These are pre-existing in senpi's own test suite. They reflect a known
architectural gap (jiti dynamic `.ts` loading is incompatible with vitest's SSR
transform layer) that would need to be fixed upstream or require vitest config
changes (`server.deps.external`, `poolOptions.singleThread`, or a custom
`transformMode`). Fixing them in helix only without an upstream path would
create a maintenance burden on every sync. Leave them as known-failing.

### 4 helix-introduced failures: `fix-here`

These are small, contained, and entirely within helix-authored code:

- `version-check.test.ts`: one-line fix — update the expected URL string from
  `@code-yeongyu/helix` to `@helix-bio/helix`.
- `3592` test: update the two hardcoded expected tool arrays to include
  `ontology_normalize` in the correct sorted position.
- The 2 `@helix-bio/helix` alias tests: these are blocked by the inherited
  jiti/SSR issue and cannot be fixed locally without resolving the upstream
  root cause. They should be marked as known-failing alongside the 80 inherited
  failures, or be given a `// TODO: unblock after jiti/vitest fix` annotation.

---

## What I Would Do If Asked to Fix

- **`version-check.test.ts`**: Change the single expected URL string
  `@code-yeongyu%2Fhelix` → `@helix-bio%2Fhelix`. One-line change, no logic
  impact.

- **`3592` regression tests**: Run the session with `noTools: "builtin"` and
  print `getActiveToolNames()` to get the actual list helix produces. Update
  the two `toEqual([...])` arrays to include `ontology_normalize` (and confirm
  ordering). This is a data update, not a logic fix.

- **Inherited 80 + the 2 alias tests**: Add a `// known-failing: jiti/vitest
  SSR incompatibility — see .helix-notes/test-failures-disposition.md` comment
  to the top of each affected test file, or configure vitest to
  `exclude: [...]` them under a separate CI target so the green/red signal
  stays meaningful for newly added tests.

---

## Cleanup / Reuse

The senpi upstream clone is at `/tmp/senpi-upstream-check` with `npm install`
already complete. Re-run the same test commands without reinstalling:

```bash
cd /tmp/senpi-upstream-check/packages/coding-agent
npx tsx ../../node_modules/vitest/dist/cli.js --run \
  test/extensions-discovery.test.ts \
  test/extensions-runner.test.ts \
  test/extensions-loader.test.ts \
  test/extensions-input-event.test.ts \
  test/default-global-extension-fast-path.test.ts
```
