import { describe, expect, test, vi } from "vitest";
<<<<<<< HEAD
import { printHelp } from "../src/cli/args.js";
import { APP_NAME, CONFIG_DIR_NAME, ENV_AGENT_DIR } from "../src/config.js";

describe("helix branding", () => {
	test("uses helix as the runtime app identity", () => {
=======
import { printHelp } from "../src/cli/args.ts";
import { APP_NAME, CONFIG_DIR_NAME, ENV_AGENT_DIR } from "../src/config.ts";

describe("senpi branding", () => {
	test("uses senpi as the runtime app identity", () => {
>>>>>>> upstream/main
		// given

		// when
		const branding = {
			appName: APP_NAME,
			configDirName: CONFIG_DIR_NAME,
			envAgentDir: ENV_AGENT_DIR,
		};

		// then
		expect(branding).toEqual({
<<<<<<< HEAD
			appName: "helix",
			configDirName: ".helix",
			envAgentDir: "HELIX_CODING_AGENT_DIR",
		});
	});

	test("prints helix in the top-level help output", () => {
=======
			appName: "senpi",
			configDirName: ".senpi",
			envAgentDir: "SENPI_CODING_AGENT_DIR",
		});
	});

	test("prints senpi in the top-level help output", () => {
>>>>>>> upstream/main
		// given
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			// when
			printHelp();
			const output = logSpy.mock.calls.map(([message]) => String(message)).join("\n");

			// then
<<<<<<< HEAD
			expect(output).toContain("helix - AI coding assistant");
			expect(output).toContain("helix [options] [@files...] [messages...]");
			expect(output).toContain("helix install <source> [-l]");
			expect(output).toContain("~/.helix/agent");
=======
			expect(output).toContain("senpi - AI coding assistant");
			expect(output).toContain("senpi [options] [@files...] [messages...]");
			expect(output).toContain("senpi install <source> [-l]");
			expect(output).toContain("~/.senpi/agent");
>>>>>>> upstream/main
		} finally {
			logSpy.mockRestore();
		}
	});
});
