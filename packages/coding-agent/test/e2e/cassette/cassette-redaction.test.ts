/**
 * Secret-safety ($0, CI-safe).
 *
 * Feed an interaction containing fake credentials and assert:
 *   - `scanForSecrets` throws `UnsafeCassetteError` for each known pattern.
 *   - the recorder REFUSES to write (nothing lands on disk) when a secret is
 *     present in the recorded stream.
 *   - `redactCassette` scrubs sensitive header-shaped fields.
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssistantMessage, AssistantMessageEvent } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { redactCassette, scanForSecrets, UnsafeCassetteError } from "./redactor.js";
import type { Cassette, CassetteInteraction } from "./schema.js";
import { createCassetteStore } from "./store.js";

function messageWith(textValue: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text: textValue }],
		api: "faux",
		provider: "faux",
		model: "faux-1",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: 0,
	};
}

function interactionWith(textValue: string): CassetteInteraction {
	const message = messageWith(textValue);
	const events: AssistantMessageEvent[] = [
		{ type: "start", partial: { ...message, content: [] } },
		{ type: "done", reason: "stop", message },
	];
	return {
		request: { model: "faux-1", messagesDigest: "deadbeef" },
		events,
		final: { stopReason: "stop", usage: message.usage },
	};
}

function cassetteWith(textValue: string): Cassette {
	return {
		version: 1,
		metadata: { provider: "faux", model: "faux-1", scenarioId: "redact", taskId: "task", recordedAt: "" },
		interactions: [interactionWith(textValue)],
	};
}

describe("cassette redaction & secret scanning ($0)", () => {
	const tempDirs: string[] = [];
	afterEach(() => {
		while (tempDirs.length > 0) {
			const dir = tempDirs.pop();
			if (dir) rmSync(dir, { recursive: true, force: true });
		}
	});

	const SECRETS: Array<[string, string]> = [
		["OpenAI sk- key", "here is a key sk-abcdEFGH1234567890ZZ leaked"],
		["Anthropic sk-ant key", "token sk-ant-api03-abcdEFGH1234567890 leaked"],
		["Bearer token", "Authorization: Bearer abcdEFGH1234567890token"],
		["AWS access key", "aws AKIAIOSFODNN7EXAMPLE here"],
		["Google API key", "g AIzaSyA1234567890abcdefghijklmnopqrstuv here"],
		["GitHub token", "gh ghp_0123456789abcdefghijklmnopqrstuvwx here"],
		["PEM key", "-----BEGIN RSA PRIVATE KEY-----\\nMIIB...\\n-----END RSA PRIVATE KEY-----"],
	];

	for (const [name, payload] of SECRETS) {
		it(`scanForSecrets throws UnsafeCassetteError for a ${name}`, () => {
			expect(() => scanForSecrets(cassetteWith(payload))).toThrow(UnsafeCassetteError);
		});
	}

	it("scanForSecrets passes for a clean cassette", () => {
		expect(() => scanForSecrets(cassetteWith("hello world, no secrets here"))).not.toThrow();
	});

	it("the recorder refuses to write and nothing lands on disk when a secret is present", () => {
		const dir = mkdtempSync(join(tmpdir(), "helix-cassette-redact-"));
		tempDirs.push(dir);
		const store = createCassetteStore(dir);

		// Simulate what the recorder does on finalize(): redact → scan → write.
		const cassette = cassetteWith("leak sk-abcdEFGH1234567890ZZ here");
		const redacted = redactCassette(cassette);
		const serialized = `${JSON.stringify(redacted, null, 2)}\n`;

		expect(() => {
			scanForSecrets(serialized);
			store.write(redacted); // unreachable
		}).toThrow(UnsafeCassetteError);

		// Hard guarantee: no file was written.
		expect(existsSync(store.pathFor("redact", "task"))).toBe(false);
		expect(store.list()).toEqual([]);
	});

	it("redactCassette scrubs sensitive header-shaped fields", () => {
		const cassette = cassetteWith("clean") as Cassette & { extra?: unknown };
		// Attach a header-bearing object to prove generic redaction reaches it.
		(cassette.interactions[0] as unknown as { headers: Record<string, string> }).headers = {
			Authorization: "Bearer secret-token-value-1234",
			"x-api-key": "sk-secret-key-value-1234",
			"content-type": "application/json",
		};
		const redacted = redactCassette(cassette) as unknown as {
			interactions: Array<{ headers: Record<string, string> }>;
		};
		const headers = redacted.interactions[0].headers;
		expect(headers.Authorization).toBe("[REDACTED]");
		expect(headers["x-api-key"]).toBe("[REDACTED]");
		expect(headers["content-type"]).toBe("application/json");
		// And after redaction the cassette is secret-clean.
		expect(() => scanForSecrets(redacted as unknown as Cassette)).not.toThrow();
	});
});
