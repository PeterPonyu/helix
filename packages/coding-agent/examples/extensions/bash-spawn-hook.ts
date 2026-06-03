/**
 * Bash Spawn Hook Example
 *
 * Adjusts command, cwd, and env before execution.
 *
 * Usage:
<<<<<<< HEAD
 *   helix -e ./bash-spawn-hook.ts
 */

import type { ExtensionAPI } from "@helix-bio/helix";
import { createBashTool } from "@helix-bio/helix";
=======
 *   senpi -e ./bash-spawn-hook.ts
 */

import type { ExtensionAPI } from "@code-yeongyu/senpi";
import { createBashTool } from "@code-yeongyu/senpi";
>>>>>>> upstream/main

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();

	const bashTool = createBashTool(cwd, {
		spawnHook: ({ command, cwd, env }) => ({
			command: `source ~/.profile\n${command}`,
			cwd,
			env: { ...env, PI_SPAWN_HOOK: "1" },
		}),
	});

	pi.registerTool({
		...bashTool,
		execute: async (id, params, signal, onUpdate, _ctx) => {
			return bashTool.execute(id, params, signal, onUpdate);
		},
	});
}
