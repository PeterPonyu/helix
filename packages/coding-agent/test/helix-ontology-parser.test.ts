import { describe, expect, test } from "vitest";
import { parseObo } from "../src/core/extensions/builtin/helix-ontology/obo-parser.js";
import { OntologyRegistry } from "../src/core/extensions/builtin/helix-ontology/registry.js";

const SAMPLE = `
format-version: 1.2
ontology: cl

[Term]
id: CL:0000624
name: CD4-positive, alpha-beta T cell
synonym: "CD4+ T cell" EXACT []
synonym: "CD4 T cell" RELATED []

[Term]
id: CL:0000625
name: CD8-positive, alpha-beta T cell
synonym: "CD8+ T cell" EXACT []

[Term]
id: CL:0000999
name: ancient obsolete term
is_obsolete: true

[Typedef]
id: part_of
name: part_of
`;

describe("helix-ontology / parseObo", () => {
	test("extracts id + name + synonyms from [Term] blocks", () => {
		const terms = parseObo(SAMPLE);
		expect(terms).toHaveLength(2);
		expect(terms[0]).toEqual({
			id: "CL:0000624",
			name: "CD4-positive, alpha-beta T cell",
			synonyms: ["CD4+ T cell", "CD4 T cell"],
		});
		expect(terms[1].id).toBe("CL:0000625");
	});

	test("drops obsolete terms", () => {
		const terms = parseObo(SAMPLE);
		expect(terms.find((t) => t.id === "CL:0000999")).toBeUndefined();
	});

	test("ignores non-Term stanzas", () => {
		const terms = parseObo(SAMPLE);
		expect(terms.every((t) => t.id.startsWith("CL:"))).toBe(true);
	});
});

describe("helix-ontology / OntologyRegistry", () => {
	test("lookup by exact name returns the term, marked as 'name' match", () => {
		const registry = new OntologyRegistry();
		registry.loadTerms("CL", parseObo(SAMPLE));
		const hits = registry.lookup("CD4-positive, alpha-beta T cell");
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ id: "CL:0000624", source: "CL", matchType: "name" });
	});

	test("lookup by synonym matches and is reported as 'synonym'", () => {
		const registry = new OntologyRegistry();
		registry.loadTerms("CL", parseObo(SAMPLE));
		const hits = registry.lookup("CD4+ T cell");
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ id: "CL:0000624", matchType: "synonym" });
	});

	test("lookup is case-insensitive", () => {
		const registry = new OntologyRegistry();
		registry.loadTerms("CL", parseObo(SAMPLE));
		expect(registry.lookup("cd4+ t cell")[0]?.id).toBe("CL:0000624");
		expect(registry.lookup("CD8+ T CELL")[0]?.id).toBe("CL:0000625");
	});

	test("ontology filter constrains by source", () => {
		const registry = new OntologyRegistry();
		registry.loadTerms("CL", parseObo(SAMPLE));
		registry.loadTerms("UBERON", [{ id: "UBERON:0002107", name: "liver", synonyms: [] }]);
		expect(registry.lookup("liver")).toHaveLength(1);
		expect(registry.lookup("liver", "CL")).toHaveLength(0);
		expect(registry.lookup("liver", "UBERON")[0]?.id).toBe("UBERON:0002107");
	});

	test("name matches are sorted before synonym matches", () => {
		const registry = new OntologyRegistry();
		// A term whose synonym collides with another term's exact name.
		registry.loadTerms("X", [
			{ id: "X:1", name: "alpha", synonyms: [] },
			{ id: "X:2", name: "beta", synonyms: ["alpha"] },
		]);
		const hits = registry.lookup("alpha");
		expect(hits.map((h) => h.id)).toEqual(["X:1", "X:2"]);
		expect(hits[0].matchType).toBe("name");
		expect(hits[1].matchType).toBe("synonym");
	});

	test("loadedSources reports per-source counts", () => {
		const registry = new OntologyRegistry();
		registry.loadTerms("CL", parseObo(SAMPLE));
		const sources = registry.loadedSources();
		expect(sources).toEqual([{ source: "CL", termCount: 2 }]);
	});
});
