import { describe, expect, it } from "vitest";
<<<<<<< HEAD
import { createBashToolDefinition } from "../src/core/tools/bash.js";
=======
import { createBashToolDefinition } from "../src/core/tools/bash.ts";
>>>>>>> upstream/main

describe("bash tool promptSnippet", () => {
	// Codex-style guidance (see codex-rs/core/gpt_5_2_prompt.md): when example shell
	// commands are listed in the bash tool description, they should not include
<<<<<<< HEAD
	// `grep` because helix exposes a dedicated ripgrep-backed `grep` tool.
=======
	// `grep` because senpi exposes a dedicated ripgrep-backed `grep` tool.
>>>>>>> upstream/main
	// Listing `grep` as an example command teaches the model to invoke `grep`
	// through bash even when the tool exists. Use `rg` instead - it matches what
	// codex's GPT-5.2 prompt actually recommends as a search binary.
	it("lists rg (not bash-invoked grep) as an example command", () => {
		const tool = createBashToolDefinition("/tmp");

		expect(typeof tool.promptSnippet).toBe("string");
		expect(tool.promptSnippet ?? "").toContain("rg");
		expect(tool.promptSnippet ?? "").not.toMatch(/\bgrep\b/);
	});
});
