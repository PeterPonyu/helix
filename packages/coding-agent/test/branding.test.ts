import { describe, expect, test, vi } from "vitest";
import { printHelp } from "../src/cli/args.ts";
import { APP_NAME, CONFIG_DIR_NAME, ENV_AGENT_DIR } from "../src/config.ts";

describe("helix branding", () => {
	test("uses helix as the runtime app identity", () => {
		// given

		// when
		const branding = {
			appName: APP_NAME,
			configDirName: CONFIG_DIR_NAME,
			envAgentDir: ENV_AGENT_DIR,
		};

		// then
		expect(branding).toEqual({
			appName: "helix",
			configDirName: ".helix",
			envAgentDir: "HELIX_CODING_AGENT_DIR",
		});
	});

	test("prints helix in the top-level help output", () => {
		// given
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			// when
			printHelp();
			const output = logSpy.mock.calls.map(([message]) => String(message)).join("\n");

			// then
			expect(output).toContain("helix - AI coding assistant");
			expect(output).toContain("helix [options] [@files...] [messages...]");
			expect(output).toContain("helix install <source> [-l]");
			expect(output).toContain("~/.helix/agent");
		} finally {
			logSpy.mockRestore();
		}
	});
});
