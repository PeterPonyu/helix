/**
 * helix-bio-presets -- task-class characterization (companion to helix-bio-persona).
 *
 * bio-persona ships six always-on bioinformatics defaults. This extension adds
 * an OPT-IN task-class layer on top: if the user sets HELIX_BIO_PRESET, the
 * matching preset's addendum is appended after the persona on every session
 * start.
 *
 * Composition order: <senpi base prompt> + <bio-persona> + <bio-preset, if any>.
 * Registration order in builtin/index.ts is load-bearing for this.
 */

import type { ExtensionAPI } from "../../types.js";
import { resolveBioPreset } from "./presets.js";

export { BIO_PRESETS, type BioPreset, listBioPresets, resolveBioPreset } from "./presets.js";

const ENV_VAR = "HELIX_BIO_PRESET";

let warnedAbout: Set<string> | undefined;

function readPresetName(): string | undefined {
	const env = typeof process !== "undefined" ? process.env : {};
	return env[ENV_VAR]?.trim() || undefined;
}

export default function helixBioPresetsExtension(pi: ExtensionAPI): void {
	pi.on("before_agent_start", async (event) => {
		const name = readPresetName();
		if (!name) return;
		const preset = resolveBioPreset(name);
		if (!preset) {
			// Warn once per session for unknown preset names; do not fail.
			if (!warnedAbout) warnedAbout = new Set();
			if (!warnedAbout.has(name)) {
				warnedAbout.add(name);
				const known = Object.keys((await import("./presets.js")).BIO_PRESETS).join(", ");
				console.warn(
					`[helix-bio-presets] unknown HELIX_BIO_PRESET="${name}" (known: ${known}). Continuing without preset.`,
				);
			}
			return;
		}
		return { systemPrompt: `${event.systemPrompt}${preset.systemPromptAddendum}` };
	});
}
