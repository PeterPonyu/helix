<<<<<<< HEAD
import { getToolPath } from "../../utils/tools-manager.js";
=======
import { getToolPath } from "../../utils/tools-manager.ts";
>>>>>>> upstream/main

type StartupTool = "fd" | "rg";

export interface StartupToolPaths {
	fdPath?: string;
}

export type StartupToolPathResolver = (tool: StartupTool) => string | null;

export function resolveStartupToolPaths(getPath: StartupToolPathResolver = getToolPath): StartupToolPaths {
	const fdPath = getPath("fd") ?? undefined;
	return { fdPath };
}
