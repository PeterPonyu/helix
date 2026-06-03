/**
 * Prompt Templates
 *
 * File-based templates that inject content when invoked with /templatename.
 */

import {
	createAgentSession,
	createSyntheticSourceInfo,
	DefaultResourceLoader,
	getAgentDir,
	type PromptTemplate,
	SessionManager,
<<<<<<< HEAD
} from "@helix-bio/helix";
=======
} from "@code-yeongyu/senpi";
>>>>>>> upstream/main

// Define custom templates
const deployTemplate: PromptTemplate = {
	name: "deploy",
	description: "Deploy the application",
	filePath: "/virtual/prompts/deploy.md",
	sourceInfo: createSyntheticSourceInfo("/virtual/prompts/deploy.md", { source: "sdk" }),
	content: `# Deploy Instructions

1. Build: npm run build
2. Test: npm test
3. Deploy: npm run deploy`,
};

const loader = new DefaultResourceLoader({
	cwd: process.cwd(),
	agentDir: getAgentDir(),
	promptsOverride: (current) => ({
		prompts: [...current.prompts, deployTemplate],
		diagnostics: current.diagnostics,
	}),
});
await loader.reload();

<<<<<<< HEAD
// Discover templates from cwd/.helix/prompts/ and ~/.helix/agent/prompts/
=======
// Discover templates from cwd/.senpi/prompts/ and ~/.senpi/agent/prompts/
>>>>>>> upstream/main
const discovered = loader.getPrompts().prompts;
console.log("Discovered prompt templates:");
for (const template of discovered) {
	console.log(`  /${template.name}: ${template.description}`);
}

const { session } = await createAgentSession({
	resourceLoader: loader,
	sessionManager: SessionManager.inMemory(),
});
console.log(`Session created with ${discovered.length + 1} prompt templates`);
session.dispose();
