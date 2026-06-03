import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
<<<<<<< HEAD
import type { ExtensionAPI } from "@helix-bio/helix";
=======
import type { ExtensionAPI } from "@code-yeongyu/senpi";
>>>>>>> upstream/main

const baseDir = dirname(fileURLToPath(import.meta.url));

export default function (pi: ExtensionAPI) {
	pi.on("resources_discover", () => {
		return {
			skillPaths: [join(baseDir, "SKILL.md")],
			promptPaths: [join(baseDir, "dynamic.md")],
			themePaths: [join(baseDir, "dynamic.json")],
		};
	});
}
