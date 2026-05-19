/**
 * Registry of bio task-class presets activated via the HELIX_BIO_PRESET env var.
 *
 * Adding a fourth preset: drop a sibling .ts that exports a const addendum,
 * import it here, add an entry to BIO_PRESETS. Add an L1 unit-test describe
 * block under test/helix-bio-presets.test.ts asserting the addendum shape.
 */

import { NGS_REVIEW_ADDENDUM } from "./ngs-review.js";
import { SCRNA_TRIAGE_ADDENDUM } from "./scrna-triage.js";
import { VARIANT_QC_ADDENDUM } from "./variant-qc.js";

export interface BioPreset {
	id: string;
	name: string;
	description: string;
	systemPromptAddendum: string;
}

export const BIO_PRESETS: Record<string, BioPreset> = {
	"variant-qc": {
		id: "variant-qc",
		name: "Variant QC",
		description:
			"VCF inspection, type distribution, sample-level integrity checks. No pathogenicity claims without external evidence.",
		systemPromptAddendum: VARIANT_QC_ADDENDUM,
	},
	"ngs-review": {
		id: "ngs-review",
		name: "NGS Read Review",
		description:
			"FASTQ-level read count + length + quality assessment, before alignment / variant-calling decisions.",
		systemPromptAddendum: NGS_REVIEW_ADDENDUM,
	},
	"scrna-triage": {
		id: "scrna-triage",
		name: "scRNA-seq Metadata Triage",
		description:
			"Single-cell study selection by metadata: CL / UBERON / MONDO ontology normalization, modality / organism awareness.",
		systemPromptAddendum: SCRNA_TRIAGE_ADDENDUM,
	},
};

export function listBioPresets(): BioPreset[] {
	return Object.values(BIO_PRESETS);
}

export function resolveBioPreset(name: string | undefined): BioPreset | undefined {
	if (!name) return undefined;
	return BIO_PRESETS[name.trim()];
}
