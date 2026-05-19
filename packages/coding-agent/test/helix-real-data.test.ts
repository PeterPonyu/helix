/**
 * Layer-2-real tests: opt-in, hit small REAL public bio files.
 *
 * Run with:
 *   HELIX_REAL_DATA=1 npx tsx ../../node_modules/vitest/dist/cli.js \
 *     --run test/helix-real-data.test.ts
 *
 * Without HELIX_REAL_DATA=1 these tests skip themselves so the default
 * suite stays fast and offline. See test/helpers/real-fixtures.ts for
 * the catalog and the SHA256 pinning policy.
 */

import { describe, expect, test } from "vitest";
import { inspectFasta } from "../src/core/extensions/builtin/helix-seq/fasta.js";
import { getRealFixture, realDataEnabled } from "./helpers/real-fixtures.js";

const itReal = realDataEnabled() ? test : test.skip;

describe("helix-seq / fasta -- real htslib ce.fa", () => {
	itReal("parses samtools/htslib test/ce.fa and yields at least one record with positive length", async () => {
		const path = await getRealFixture("htslib_ce_fa");
		const s = await inspectFasta(path);
		expect(s.recordCount).toBeGreaterThan(0);
		expect(s.totalLength).toBeGreaterThan(0);
		expect(s.firstRecords[0].id.length).toBeGreaterThan(0);
		expect(s.firstRecords[0].length).toBeGreaterThan(0);
	});
});
