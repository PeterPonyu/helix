import { describe, expect, test } from "vitest";
import {
	HELIX_BIO_ADDENDUM,
	default as helixBioPersonaExtension,
} from "../src/core/extensions/builtin/helix-bio-persona/index.js";

describe("helix-bio-persona / addendum content", () => {
	test("addendum is non-trivial and identifies helix as a bioinformatics agent", () => {
		expect(HELIX_BIO_ADDENDUM.length).toBeGreaterThan(500);
		expect(HELIX_BIO_ADDENDUM).toMatch(/You are helix/);
		expect(HELIX_BIO_ADDENDUM).toMatch(/bioinformatics/i);
	});

	test("addendum encodes the six workflow defaults", () => {
		// Each default has a distinctive keyword the LLM can lock onto.
		expect(HELIX_BIO_ADDENDUM).toMatch(/Inspect before claim/);
		expect(HELIX_BIO_ADDENDUM).toMatch(/Normalize before join/);
		expect(HELIX_BIO_ADDENDUM).toMatch(/Convention explicit/);
		expect(HELIX_BIO_ADDENDUM).toMatch(/Ontology grounded/);
		expect(HELIX_BIO_ADDENDUM).toMatch(/Sample-bounded by default/);
		expect(HELIX_BIO_ADDENDUM).toMatch(/Format identity/);
	});

	test("addendum references the helix bio inspector tools by name", () => {
		// If a tool name changes, the addendum must follow.
		expect(HELIX_BIO_ADDENDUM).toContain("seq_fasta_info");
		expect(HELIX_BIO_ADDENDUM).toContain("seq_fastq_info");
		expect(HELIX_BIO_ADDENDUM).toContain("seq_vcf_summary");
		expect(HELIX_BIO_ADDENDUM).toContain("bed_info");
		expect(HELIX_BIO_ADDENDUM).toContain("gff_info");
		expect(HELIX_BIO_ADDENDUM).toContain("coord_chrom_normalize");
		expect(HELIX_BIO_ADDENDUM).toContain("coord_convert");
		expect(HELIX_BIO_ADDENDUM).toContain("ontology_normalize");
	});

	test("addendum preserves generic coding-agent tools (no scope-shrinking by accident)", () => {
		expect(HELIX_BIO_ADDENDUM).toMatch(/read.*edit.*bash/i);
	});
});

describe("helix-bio-persona / extension factory", () => {
	test("factory registers a before_agent_start handler that appends the addendum", async () => {
		const handlers = new Map<
			string,
			(event: { systemPrompt: string }) => Promise<{ systemPrompt: string } | undefined>
		>();
		const pi = {
			on(event: string, handler: (e: { systemPrompt: string }) => Promise<{ systemPrompt: string } | undefined>) {
				handlers.set(event, handler);
			},
		};
		helixBioPersonaExtension(pi as unknown as Parameters<typeof helixBioPersonaExtension>[0]);

		const handler = handlers.get("before_agent_start");
		expect(handler).toBeDefined();

		const original = "You are a coding assistant. Use the tools you have.";
		const result = await handler?.({ systemPrompt: original });
		expect(result?.systemPrompt.startsWith(original)).toBe(true);
		expect(result?.systemPrompt.endsWith(HELIX_BIO_ADDENDUM)).toBe(true);
		expect(result?.systemPrompt.length).toBe(original.length + HELIX_BIO_ADDENDUM.length);
	});
});
