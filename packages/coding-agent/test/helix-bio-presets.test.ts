import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
	BIO_PRESETS,
	default as helixBioPresetsExtension,
	listBioPresets,
	resolveBioPreset,
} from "../src/core/extensions/builtin/helix-bio-presets/index.js";

describe("helix-bio-presets / registry", () => {
	test("ships exactly the v0 three presets", () => {
		expect(Object.keys(BIO_PRESETS).sort()).toEqual(["ngs-review", "scrna-triage", "variant-qc"]);
	});

	test("listBioPresets returns all entries", () => {
		expect(listBioPresets()).toHaveLength(3);
	});

	test("resolveBioPreset trims whitespace and matches by id", () => {
		expect(resolveBioPreset("variant-qc")?.id).toBe("variant-qc");
		expect(resolveBioPreset("  ngs-review  ")?.id).toBe("ngs-review");
	});

	test("resolveBioPreset returns undefined for unknown / empty", () => {
		expect(resolveBioPreset(undefined)).toBeUndefined();
		expect(resolveBioPreset("")).toBeUndefined();
		expect(resolveBioPreset("nope")).toBeUndefined();
	});
});

describe.each([
	{ id: "variant-qc", roleKeyword: "variant-qc", tool: "seq_vcf_summary" },
	{ id: "ngs-review", roleKeyword: "ngs-review", tool: "seq_fastq_info" },
	{ id: "scrna-triage", roleKeyword: "scrna-triage", tool: "ontology_normalize" },
])("helix-bio-presets / $id addendum shape", ({ id, roleKeyword, tool }) => {
	const addendum = BIO_PRESETS[id].systemPromptAddendum;

	test("addendum is non-trivial", () => {
		expect(addendum.length).toBeGreaterThan(300);
	});

	test("contains 'You are now in <preset> mode' role statement", () => {
		expect(addendum).toMatch(new RegExp(`You are now in \\*\\*${roleKeyword}\\*\\* mode`));
	});

	test("has the four expected sections: role / Workflow / Watch for / First tools", () => {
		expect(addendum).toMatch(/Workflow:/);
		expect(addendum).toMatch(/Watch for:/);
		expect(addendum).toMatch(/First tools to reach for/);
	});

	test("references the task's primary bio tool", () => {
		expect(addendum).toContain(tool);
	});
});

describe("helix-bio-presets / factory env-var activation", () => {
	type Event = { systemPrompt: string };
	type Handler = (event: Event) => Promise<{ systemPrompt: string } | undefined>;

	let savedEnv: string | undefined;
	let handlers: Map<string, Handler>;

	beforeEach(() => {
		savedEnv = process.env.HELIX_BIO_PRESET;
		handlers = new Map();
		const pi = {
			on(event: string, handler: Handler) {
				handlers.set(event, handler);
			},
		};
		helixBioPresetsExtension(pi as unknown as Parameters<typeof helixBioPresetsExtension>[0]);
	});

	afterEach(() => {
		if (savedEnv === undefined) delete process.env.HELIX_BIO_PRESET;
		else process.env.HELIX_BIO_PRESET = savedEnv;
	});

	test("env unset -> no addendum, system prompt unchanged", async () => {
		delete process.env.HELIX_BIO_PRESET;
		const result = await handlers.get("before_agent_start")?.({ systemPrompt: "base prompt" });
		expect(result).toBeUndefined();
	});

	test("env empty string -> no addendum", async () => {
		process.env.HELIX_BIO_PRESET = "";
		const result = await handlers.get("before_agent_start")?.({ systemPrompt: "base prompt" });
		expect(result).toBeUndefined();
	});

	test("env set to a known preset -> appends the preset addendum", async () => {
		process.env.HELIX_BIO_PRESET = "variant-qc";
		const result = await handlers.get("before_agent_start")?.({ systemPrompt: "base prompt" });
		expect(result?.systemPrompt.startsWith("base prompt")).toBe(true);
		expect(result?.systemPrompt).toContain("variant-qc");
		expect(result?.systemPrompt).toContain("seq_vcf_summary");
	});

	test("env set to unknown preset -> no append, single warn", async () => {
		const warnings: string[] = [];
		const origWarn = console.warn;
		console.warn = (msg: unknown) => warnings.push(String(msg));
		try {
			process.env.HELIX_BIO_PRESET = "totally-not-a-preset";
			const r1 = await handlers.get("before_agent_start")?.({ systemPrompt: "base" });
			const r2 = await handlers.get("before_agent_start")?.({ systemPrompt: "base" });
			expect(r1).toBeUndefined();
			expect(r2).toBeUndefined();
			// First call warned; second call did not duplicate.
			expect(warnings.filter((w) => w.includes("totally-not-a-preset"))).toHaveLength(1);
		} finally {
			console.warn = origWarn;
		}
	});
});
