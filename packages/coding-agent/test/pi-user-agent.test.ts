import { describe, expect, it } from "vitest";
<<<<<<< HEAD
import { getPiUserAgent } from "../src/utils/pi-user-agent.js";
=======
import { getPiUserAgent } from "../src/utils/pi-user-agent.ts";
>>>>>>> upstream/main

describe("getPiUserAgent", () => {
	it("formats the user agent with the runtime app name", () => {
		const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
		const userAgent = getPiUserAgent("1.2.3");

<<<<<<< HEAD
		expect(userAgent).toBe(`helix/1.2.3 (${process.platform}; ${runtime}; ${process.arch})`);
		expect(userAgent).toMatch(/^helix\/[^\s()]+ \([^;()]+;\s*[^;()]+;\s*[^()]+\)$/);
=======
		expect(userAgent).toBe(`senpi/1.2.3 (${process.platform}; ${runtime}; ${process.arch})`);
		expect(userAgent).toMatch(/^senpi\/[^\s()]+ \([^;()]+;\s*[^;()]+;\s*[^()]+\)$/);
>>>>>>> upstream/main
	});
});
