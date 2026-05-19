# packages/coding-agent/src/core/extensions/builtin/helix-ontology

First bioinformatics-specific helix builtin. Maps free-text biological terms to canonical OBO ontology IDs.

## ROLE

Registers the `ontology_normalize(term, ontology?, max?)` tool. The LLM calls it when it needs a canonical ID for a cell type (CL), tissue (UBERON), disease (MONDO), function/process (GO), or controlled vocabulary heading (MeSH) before quoting it in an answer or filter.

## FILES

- `obo-parser.ts` — minimal OBO 1.4 parser; extracts `id`, `name`, `synonym` from `[Term]` blocks; drops `is_obsolete: true`. Anything richer (def, xref, hierarchy) is intentionally out of scope.
- `registry.ts` — directory loader + name+synonym lookup index. Case-insensitive lookup, exact-name matches sorted before synonym matches.
- `index.ts` — extension factory + `pi.registerTool` registration.

## OBO DIRECTORY DISCOVERY

In order:
1. `helix.ontology.oboDir` in `settings.json` (project or global).
2. `HELIX_ONTOLOGY_DIR` env var.
3. Default `~/.helix/ontology/`.

The extension does not download OBO files. Provide them or fail gracefully — when no files load, the tool returns an instructional message naming the directory it searched.

## NON-GOALS

- No hierarchy traversal (parent/child, transitive closure). If needed, add a sibling `helix-ontology-hierarchy` extension that depends on this one's registry.
- No fuzzy / semantic matching. Lookup is exact name + exact synonym only. Fuzzy and embedding-based matching belong in `helix-retrieve` which already runs the bge-m3 / cross-encoder stack.
- No OBO writing / editing.

## TESTING

- Parser unit tests live in `test/helix-ontology-parser.test.ts` against synthetic OBO strings (no fixture files needed).
- Add a regression test under `test/suite/helix-ontology-extension.test.ts` when adding tool-call behavior that depends on the extension harness.
