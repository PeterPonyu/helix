/**
 * Real-data fixture helper for Layer-2-real tests.
 *
 * The default test bundle runs against synthetic fixtures (Layer 1
 * in-memory + Layer 2 temp-file). This helper adds a third option: lazy-
 * fetch small REAL public bioinformatics files from stable URLs, cache
 * them under ~/.cache/helix/test-fixtures/, and let opt-in tests assert
 * against them.
 *
 * Activation:
 *   HELIX_REAL_DATA=1 npm test               # opt-in
 * Without the env var, real-data tests skip themselves cleanly so the
 * default CI / pre-commit signal stays fast and offline.
 *
 * Integrity:
 *   Each catalog entry SHOULD declare an SHA256 of its expected bytes.
 *   On first download with no SHA256 the helper logs the observed hash
 *   so a maintainer can paste it back into the catalog. Once an SHA256
 *   is present, mismatches fail the test rather than silently caching
 *   drifted content.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface RealFixtureSpec {
	url: string;
	bytes?: number;
	sha256?: string;
	description: string;
}

/**
 * Catalog of real-data fixtures. Add entries as new bio extensions need
 * real-world validation. Keep individual files <1 MB; the goal is
 * "exercise real-format quirks", not "stress test on a real genome".
 */
export const CATALOG: Record<string, RealFixtureSpec> = {
	htslib_ce_fa: {
		url: "https://raw.githubusercontent.com/samtools/htslib/develop/test/ce.fa",
		bytes: 1_060_702,
		sha256: "5eca163c91918ada9774080ee2274208155f4d1b2d00700ee950cdd7b269508c",
		description:
			"C. elegans genomic FASTA fragment from samtools/htslib test data. Stable raw.githubusercontent.com URL " +
			"on a tagged dev branch. Used by helix-seq fasta layer-2-real test.",
	},
};

const CACHE_DIR = process.env.HELIX_TEST_FIXTURE_DIR ?? join(homedir(), ".cache", "helix", "test-fixtures");

export function realDataEnabled(): boolean {
	return process.env.HELIX_REAL_DATA === "1";
}

/**
 * Extract the trailing file-extension chain from a URL's basename so the
 * cached file keeps its extension (e.g. `.fa.gz`). Without this, parsers
 * that decide compression from the path extension silently skip
 * decompression on cached fixtures.
 *
 * Matches up to two trailing dot-segments: `.fa.gz`, `.vcf.gz`, `.bed.gz`,
 * `.gff3`, `.tsv`, etc.
 */
function urlExtensions(url: string): string {
	const base = url.split("?")[0].split("#")[0].split("/").pop()?.toLowerCase() ?? "";
	const m = base.match(/\.[a-z0-9]+(\.[a-z0-9]+)?$/);
	return m ? m[0] : "";
}

function sha256Of(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Get the local path for a catalog fixture, downloading + caching on
 * first use. Throws if HELIX_REAL_DATA is not set; tests should gate
 * themselves on `realDataEnabled()` and skip otherwise.
 */
export async function getRealFixture(name: keyof typeof CATALOG): Promise<string> {
	if (!realDataEnabled()) {
		throw new Error(`Real-data fixture "${String(name)}" requested but HELIX_REAL_DATA != 1`);
	}
	const spec = CATALOG[name];
	if (!spec) throw new Error(`Unknown real-data fixture: ${String(name)}`);

	if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
	const cachePath = join(CACHE_DIR, `${String(name)}${urlExtensions(spec.url)}`);

	if (existsSync(cachePath)) {
		if (spec.sha256) {
			const observed = sha256Of(readFileSync(cachePath));
			if (observed !== spec.sha256) {
				throw new Error(
					`Cached fixture "${String(name)}" sha256 mismatch (cached=${observed}, expected=${spec.sha256}). ` +
						`Delete ${cachePath} to refresh.`,
				);
			}
		}
		return cachePath;
	}

	const res = await fetch(spec.url);
	if (!res.ok) throw new Error(`Fixture download failed: ${spec.url} -> HTTP ${res.status}`);
	const bytes = Buffer.from(await res.arrayBuffer());

	const observed = sha256Of(bytes);
	if (spec.sha256 && observed !== spec.sha256) {
		throw new Error(
			`Downloaded fixture "${String(name)}" sha256 mismatch (got=${observed}, expected=${spec.sha256}). ` +
				`Upstream content drifted -- update the catalog entry deliberately.`,
		);
	}
	if (!spec.sha256) {
		// First-time pin assist for maintainers.
		console.warn(
			`[helix real-fixture] "${String(name)}" downloaded with no pinned sha256. ` +
				`Observed sha256=${observed}, size=${bytes.length}. Pin it in CATALOG to lock fixture identity.`,
		);
	}

	writeFileSync(cachePath, bytes);
	return cachePath;
}
