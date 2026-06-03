/**
 * Secret-safety for cassettes (Phase 2).
 *
 * Two responsibilities:
 *   1. `redactCassette` strips obviously-sensitive fields (auth headers, api
 *      keys) from a cassette before it is serialized to disk. This is defense
 *      in depth — the record seam only stores provider EVENTS, not request
 *      options/headers, so credentials should never reach a cassette in the
 *      first place — but redaction guarantees it even if the shape grows.
 *   2. `scanForSecrets` is the hard gate: it scans the FULLY serialized cassette
 *      for known credential patterns and throws `UnsafeCassetteError` on any
 *      hit. The recorder MUST call this and refuse to write on detection.
 */

import type { Cassette } from "./schema.js";

/** Thrown when a cassette appears to contain a real credential. */
export class UnsafeCassetteError extends Error {
	/** The human-readable name of the pattern that matched. */
	readonly pattern: string;
	/** A short, redacted excerpt around the match (never the full secret). */
	readonly excerpt: string;

	constructor(pattern: string, excerpt: string) {
		super(
			`Refusing to write cassette: detected a possible ${pattern}. ` +
				`Cassettes are committed to git and must never contain credentials. ` +
				`Excerpt: ${excerpt}`,
		);
		this.name = "UnsafeCassetteError";
		this.pattern = pattern;
		this.excerpt = excerpt;
	}
}

/** Header keys that must never be persisted (case-insensitive). */
const SENSITIVE_HEADER_KEYS = new Set([
	"authorization",
	"x-api-key",
	"api-key",
	"x-goog-api-key",
	"proxy-authorization",
	"cookie",
	"set-cookie",
	"openai-api-key",
	"anthropic-api-key",
]);

/** Known credential patterns. Order matters only for which name is reported. */
const SECRET_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
	{ name: "OpenAI-style key (sk-...)", regex: /sk-[A-Za-z0-9._-]{8,}/ },
	{ name: "Anthropic key (sk-ant-...)", regex: /sk-ant-[A-Za-z0-9._-]{8,}/ },
	{ name: "Bearer token", regex: /Bearer\s+[A-Za-z0-9._\-+/=]{8,}/ },
	{ name: "AWS access key id (AKIA...)", regex: /AKIA[0-9A-Z]{16}/ },
	{ name: "Google API key (AIza...)", regex: /AIza[0-9A-Za-z._-]{20,}/ },
	{ name: "GitHub token (gho_/ghp_)", regex: /gh[op]_[0-9A-Za-z]{20,}/ },
	{ name: "PEM private key", regex: /-----BEGIN[A-Z ]*PRIVATE KEY-----/ },
];

/**
 * Return a deep copy of `cassette` with sensitive header-shaped fields removed.
 *
 * We walk the structure generically (rather than assuming a fixed shape) so any
 * `headers` / `authorization` / `apiKey` field anywhere in the recorded events
 * is scrubbed even as the event protocol evolves.
 */
export function redactCassette(cassette: Cassette): Cassette {
	return redactValue(cassette) as Cassette;
}

function redactValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(redactValue);
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
			const lower = key.toLowerCase();
			if (SENSITIVE_HEADER_KEYS.has(lower) || lower === "apikey" || lower === "api_key") {
				out[key] = "[REDACTED]";
				continue;
			}
			if (lower === "headers" && child && typeof child === "object" && !Array.isArray(child)) {
				out[key] = redactHeaders(child as Record<string, unknown>);
				continue;
			}
			out[key] = redactValue(child);
		}
		return out;
	}
	return value;
}

function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(headers)) {
		out[key] = SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redactValue(val);
	}
	return out;
}

/**
 * Throw `UnsafeCassetteError` if the serialized cassette contains any known
 * credential pattern. Accepts either a Cassette (serialized here) or a
 * pre-serialized string (so the recorder can scan the exact bytes it will
 * write).
 */
export function scanForSecrets(input: Cassette | string): void {
	const serialized = typeof input === "string" ? input : JSON.stringify(input);
	for (const { name, regex } of SECRET_PATTERNS) {
		const match = regex.exec(serialized);
		if (match) {
			throw new UnsafeCassetteError(name, redactExcerpt(serialized, match.index, match[0].length));
		}
	}
}

/** Build a short excerpt around a match, masking the matched span itself. */
function redactExcerpt(text: string, index: number, length: number): string {
	const start = Math.max(0, index - 12);
	const end = Math.min(text.length, index + length + 12);
	const before = text.slice(start, index);
	const after = text.slice(index + length, end);
	return `${before}***${after}`;
}
