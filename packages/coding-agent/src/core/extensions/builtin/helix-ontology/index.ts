/**
 * helix-ontology -- ontology name/ID normalization for bioinformatics agents.
 *
 * Loads OBO files (CL, UBERON, MONDO, GO, MeSH, etc.) from a configured
 * directory and exposes an `ontology_normalize` tool that maps free-text
 * terms to canonical ontology IDs.
 *
 * Discovery order for the OBO directory:
 *   1. env HELIX_ONTOLOGY_DIR
 *   2. default ~/.helix/ontology/
 *
 * settings.json key support is intentionally deferred until helix has a
 * settled extension-settings contract that does not require extending
 * the core Settings interface.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { ExtensionAPI } from "../../types.js";
import { type OntologyMatch, OntologyRegistry } from "./registry.js";

const OntologyNormalizeParams = Type.Object({
	term: Type.String({ description: "Free-text term to normalize (e.g. 'CD4+ T cell', 'liver', 'colorectal cancer')" }),
	ontology: Type.Optional(
		Type.String({
			description:
				"Optional ontology code to constrain lookup (e.g. CL, UBERON, MONDO, GO, MeSH). Matches the .obo filename uppercased.",
		}),
	),
	max: Type.Optional(Type.Number({ description: "Max matches to return (default 5)", minimum: 1, maximum: 50 })),
});

interface NormalizeDetails {
	term: string;
	ontology?: string;
	matches: OntologyMatch[];
	oboDir: string;
	loadedSources: { source: string; termCount: number }[];
}

function resolveOboDir(): string {
	const env = typeof process !== "undefined" ? process.env : {};
	const fromEnv = env.HELIX_ONTOLOGY_DIR?.trim();
	if (fromEnv) return fromEnv;
	return join(homedir(), ".helix", "ontology");
}

export default function helixOntologyExtension(pi: ExtensionAPI): void {
	let registry: OntologyRegistry | undefined;
	let oboDir = "";

	pi.on("session_start", async () => {
		oboDir = resolveOboDir();
		registry = new OntologyRegistry();
		registry.loadDirectory(oboDir);
	});

	pi.registerTool({
		name: "ontology_normalize",
		label: "OntologyNormalize",
		description:
			"Normalize a free-text biological term to one or more ontology IDs (CL cell, UBERON anatomy, MONDO disease, GO function, MeSH headings, etc.). Returns the best name/synonym matches from locally loaded OBO files.",
		promptSnippet:
			"Resolve free-text biological terms (cell type, tissue, disease, etc.) to canonical OBO ontology IDs.",
		promptGuidelines: [
			"Call ontology_normalize before quoting a cell type / tissue / disease ID; do not invent OBO IDs.",
			"If no matches are returned, report the loaded ontology sources so the user knows what's available.",
		],
		parameters: OntologyNormalizeParams,
		async execute(_toolCallId, params) {
			if (!registry) {
				registry = new OntologyRegistry();
				oboDir = resolveOboDir();
				registry.loadDirectory(oboDir);
			}
			const matches = registry.lookup(params.term, params.ontology, params.max ?? 5);
			const loadedSources = registry.loadedSources();
			const details: NormalizeDetails = {
				term: params.term,
				ontology: params.ontology,
				matches,
				oboDir,
				loadedSources,
			};
			const text =
				matches.length > 0
					? matches.map((m) => `- ${m.id}\t${m.name}\t[${m.source}, ${m.matchType}]`).join("\n")
					: loadedSources.length === 0
						? `No OBO files loaded from ${oboDir}. Place .obo files there or set helix.ontology.oboDir / HELIX_ONTOLOGY_DIR.`
						: `No matches for "${params.term}" in ${loadedSources.map((s) => s.source).join(", ")}.`;
			return {
				content: [{ type: "text", text }],
				details,
			};
		},
		renderCall(args, theme) {
			const target = args.ontology ? `${args.ontology}: ` : "";
			return new Text(`${theme.fg("toolTitle", theme.bold("ontology_normalize"))} ${target}${args.term}`, 0, 0);
		},
		renderResult(result, _options, theme) {
			const details = result.details as NormalizeDetails | undefined;
			const matches = details?.matches ?? [];
			if (matches.length === 0) {
				return new Text(theme.fg("muted", "no matches"), 0, 0);
			}
			const lines = matches.map(
				(m) => `${theme.fg("muted", m.id)}  ${m.name}  ${theme.fg("muted", `[${m.source}]`)}`,
			);
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
