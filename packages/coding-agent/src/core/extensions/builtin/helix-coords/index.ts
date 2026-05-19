/**
 * helix-coords -- chromosome-name normalization and coordinate-system
 * conversion for the human GRCh38 assembly.
 *
 * Purpose: silently bridge the three incompatible naming conventions
 * (UCSC chr1, Ensembl 1, RefSeq NC_000001.11) and the two coordinate
 * systems (BED 0-based half-open vs GFF/VCF/SAM 1-based inclusive) so
 * the agent stops introducing off-by-ones across file formats.
 *
 * Tools:
 *   - coord_chrom_normalize(name, target?)  any-style chrom name -> target style
 *   - coord_convert(start, end, from, to)    BED <-> GFF coordinate translation
 *   - coord_overlap(a, b, system)            region overlap in a single coord system
 *
 * Scope limits: GRCh38 canonical chroms only (1-22, X, Y, MT). Alt /
 * patch / random contigs are out of v0 -- a future helix-coords-grch37
 * or helix-coords-alt extension is the right place.
 */

import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { ExtensionAPI } from "../../types.js";
import { type ChromNamingStyle, lookupChrom } from "./chrom-aliases.js";
import { type CoordSystem, convertCoord, type Region, regionOverlap } from "./coords.js";

const ChromNormalizeParams = Type.Object({
	name: Type.String({ description: "Chromosome name in any style (e.g. 'chr1', '1', 'NC_000001.11', 'chrM', 'MT')" }),
	target: Type.Optional(
		Type.Union([Type.Literal("ucsc"), Type.Literal("ensembl"), Type.Literal("refseq")], {
			description: "Output style. Default 'ensembl'.",
		}),
	),
});

const CoordSystemSchema = Type.Union([Type.Literal("bed"), Type.Literal("gff")]);

const ConvertParams = Type.Object({
	start: Type.Number({ description: "Start coordinate in `from` system" }),
	end: Type.Number({ description: "End coordinate in `from` system" }),
	from: CoordSystemSchema,
	to: CoordSystemSchema,
});

const OverlapParams = Type.Object({
	a: Type.Object({ chrom: Type.String(), start: Type.Number(), end: Type.Number() }),
	b: Type.Object({ chrom: Type.String(), start: Type.Number(), end: Type.Number() }),
	system: CoordSystemSchema,
});

interface ChromNormalizeDetails {
	input: string;
	target: ChromNamingStyle;
	resolved: { ucsc: string; ensembl: string; refseq: string } | undefined;
	output: string | undefined;
}

export default function helixCoordsExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "coord_chrom_normalize",
		label: "ChromNormalize",
		description:
			"Convert a chromosome name between UCSC (chr1, chrM), Ensembl (1, MT), and RefSeq (NC_000001.11) styles for human GRCh38. Returns the canonical name in the requested target style plus all three aliases. Use before joining data files with different naming conventions.",
		promptSnippet: "Translate a chromosome name between UCSC / Ensembl / RefSeq conventions (GRCh38).",
		promptGuidelines: [
			"Call coord_chrom_normalize before joining or comparing chrom-keyed data across files with different conventions (BED+UCSC vs Ensembl GFF is the canonical trap).",
			"GRCh38 canonical chromosomes only (1-22, X, Y, MT). Returns no match for alt / patch contigs.",
		],
		parameters: ChromNormalizeParams,
		async execute(_id, params) {
			const target = (params.target ?? "ensembl") as ChromNamingStyle;
			const resolved = lookupChrom(params.name);
			const output = resolved ? resolved[target] : undefined;
			const details: ChromNormalizeDetails = { input: params.name, target, resolved, output };
			const text = !resolved
				? `No GRCh38 canonical match for "${params.name}". Alt / patch contigs and non-human assemblies are out of v0 scope.`
				: `${params.name} (any) -> ${output} (${target})\nall aliases: UCSC=${resolved.ucsc}  Ensembl=${resolved.ensembl}  RefSeq=${resolved.refseq}`;
			return { content: [{ type: "text", text }], details };
		},
		renderCall(args, theme) {
			const t = args.target ?? "ensembl";
			return new Text(`${theme.fg("toolTitle", theme.bold("coord_chrom_normalize"))} ${args.name} -> ${t}`, 0, 0);
		},
		renderResult(result, _options, theme) {
			const d = result.details as ChromNormalizeDetails | undefined;
			if (!d) return new Text(theme.fg("muted", "no result"), 0, 0);
			if (!d.output) return new Text(theme.fg("muted", `no match: ${d.input}`), 0, 0);
			return new Text(`${theme.fg("muted", d.input)} -> ${d.output}`, 0, 0);
		},
	});

	pi.registerTool({
		name: "coord_convert",
		label: "CoordConvert",
		description:
			"Convert a (start, end) coordinate pair between BED (0-based half-open) and GFF (1-based inclusive). Use before reporting coordinates across file formats so the off-by-one is explicit, not silent.",
		promptSnippet: "Translate coordinates between BED (0-based half-open) and GFF (1-based inclusive).",
		promptGuidelines: [
			"Call coord_convert when copying coordinates from one file format to another. BED end = GFF end + 0, but BED start = GFF start - 1.",
			"State the destination coordinate system explicitly in your final answer to the user.",
		],
		parameters: ConvertParams,
		async execute(_id, params) {
			const converted = convertCoord(params.start, params.end, params.from as CoordSystem, params.to as CoordSystem);
			const text =
				`${params.from} [${params.start}, ${params.end}] -> ` +
				`${params.to} [${converted.start}, ${converted.end}]`;
			return {
				content: [{ type: "text", text }],
				details: {
					from: params.from,
					to: params.to,
					input: { start: params.start, end: params.end },
					output: converted,
				},
			};
		},
		renderCall(args, theme) {
			return new Text(
				`${theme.fg("toolTitle", theme.bold("coord_convert"))} ${args.from}:${args.start}-${args.end} -> ${args.to}`,
				0,
				0,
			);
		},
		renderResult(result, _options, _theme) {
			return new Text((result.content[0] as { text: string }).text, 0, 0);
		},
	});

	pi.registerTool({
		name: "coord_overlap",
		label: "CoordOverlap",
		description:
			"Compute the overlap of two regions on the same chromosome. Inputs are two regions {chrom, start, end} and the coordinate system they're stated in. Returns the overlap region and length, or null when the regions are on different chromosomes or disjoint.",
		promptSnippet: "Compute overlap of two regions (must be in the same coord system).",
		promptGuidelines: [
			"Both regions must be in the same coord system. Call coord_convert first if they aren't.",
			"Overlap length depends on the coord system: bed=end-start, gff=end-start+1. The tool handles this; don't hand-compute.",
		],
		parameters: OverlapParams,
		async execute(_id, params) {
			const overlap = regionOverlap(params.a as Region, params.b as Region, params.system as CoordSystem);
			const text = overlap
				? `overlap: ${overlap.chrom}:${overlap.start}-${overlap.end} (${overlap.length} bp, ${params.system})`
				: `no overlap (${params.a.chrom} vs ${params.b.chrom}, ${params.system})`;
			return {
				content: [{ type: "text", text }],
				details: { a: params.a, b: params.b, system: params.system, overlap },
			};
		},
		renderCall(args, theme) {
			return new Text(
				`${theme.fg("toolTitle", theme.bold("coord_overlap"))} ${args.a.chrom}:${args.a.start}-${args.a.end} vs ${args.b.chrom}:${args.b.start}-${args.b.end}`,
				0,
				0,
			);
		},
		renderResult(result, _options, _theme) {
			return new Text((result.content[0] as { text: string }).text, 0, 0);
		},
	});
}
