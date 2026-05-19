/**
 * Minimal GFF inspector (GFF3 + GTF).
 *
 * Tab-separated, 9 cols:
 *   seqid  source  type  start  end  score  strand  phase  attributes
 *
 * Dialect detection:
 *   - GFF3: ##gff-version 3 pragma, attributes are key=value;key=value
 *   - GTF:  ##gff-version 2 pragma OR no version + attributes look like
 *           key "value"; key "value";
 *   - If neither pragma nor attribute style is conclusive, we report "unknown".
 *
 * v0 does not parse the attribute body -- it only previews the first 80 chars
 * so the LLM can quote it. A `helix-gff-attrs` extension is the right place
 * for full key/value parsing if needed.
 */

import { linesOf, openSequenceStream } from "../helix-seq/stream.js";

export type GffDialect = "gff3" | "gtf" | "unknown";

export interface GffFeatureSummary {
	seqid: string;
	source: string;
	type: string;
	start: number;
	end: number;
	strand: string;
	attributesPreview: string;
}

export interface GffSummary {
	dialect: GffDialect;
	gffVersion: string | undefined;
	featureCount: number;
	truncated: boolean;
	byChromosome: Record<string, number>;
	bySource: Record<string, number>;
	byType: Record<string, number>;
	byStrand: Record<string, number>;
	firstFeatures: GffFeatureSummary[];
}

export interface GffOptions {
	/** Max feature rows to scan (default 200000). */
	sampleSize?: number;
	/** How many features to capture in firstFeatures. Default 5. */
	sampleFeatures?: number;
	/** Max chars of the attributes column to preview. Default 80. */
	attributePreviewChars?: number;
}

const GTF_ATTR_RE = /\b[A-Za-z_][A-Za-z0-9_]*\s+"/;
const GFF3_ATTR_RE = /\b[A-Za-z_][A-Za-z0-9_]*=/;

function detectFromAttributes(attrs: string, current: GffDialect): GffDialect {
	if (current !== "unknown") return current;
	if (GFF3_ATTR_RE.test(attrs) && !GTF_ATTR_RE.test(attrs)) return "gff3";
	if (GTF_ATTR_RE.test(attrs) && !GFF3_ATTR_RE.test(attrs)) return "gtf";
	return current;
}

export async function inspectGffLines(lines: AsyncIterable<string>, opts: GffOptions = {}): Promise<GffSummary> {
	const sampleSize = opts.sampleSize ?? 200_000;
	const sampleFeatures = opts.sampleFeatures ?? 5;
	const previewChars = opts.attributePreviewChars ?? 80;

	let dialect: GffDialect = "unknown";
	let gffVersion: string | undefined;
	let featureCount = 0;
	let truncated = false;
	const byChromosome: Record<string, number> = {};
	const bySource: Record<string, number> = {};
	const byType: Record<string, number> = {};
	const byStrand: Record<string, number> = {};
	const firstFeatures: GffFeatureSummary[] = [];

	for await (const rawLine of lines) {
		const line = rawLine.trimEnd();
		if (line === "") continue;

		if (line.startsWith("##gff-version")) {
			const v = line.slice("##gff-version".length).trim();
			gffVersion = v;
			if (v.startsWith("3")) dialect = "gff3";
			else if (v.startsWith("2")) dialect = "gtf";
			continue;
		}
		if (line.startsWith("##") || line.startsWith("#")) continue;

		if (featureCount >= sampleSize) {
			truncated = true;
			break;
		}

		const cols = line.split("\t");
		if (cols.length < 9) continue;
		const [seqid, source, type, startStr, endStr, _score, strand, _phase, attributes] = cols;
		const start = Number.parseInt(startStr, 10);
		const end = Number.parseInt(endStr, 10);
		if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

		dialect = detectFromAttributes(attributes, dialect);
		byChromosome[seqid] = (byChromosome[seqid] ?? 0) + 1;
		bySource[source] = (bySource[source] ?? 0) + 1;
		byType[type] = (byType[type] ?? 0) + 1;
		byStrand[strand || "."] = (byStrand[strand || "."] ?? 0) + 1;
		featureCount += 1;

		if (firstFeatures.length < sampleFeatures) {
			firstFeatures.push({
				seqid,
				source,
				type,
				start,
				end,
				strand: strand || ".",
				attributesPreview:
					attributes.length > previewChars ? `${attributes.slice(0, previewChars)}...` : attributes,
			});
		}
	}

	return {
		dialect,
		gffVersion,
		featureCount,
		truncated,
		byChromosome,
		bySource,
		byType,
		byStrand,
		firstFeatures,
	};
}

export async function inspectGff(path: string, opts: GffOptions = {}): Promise<GffSummary> {
	return inspectGffLines(linesOf(openSequenceStream(path)), opts);
}
