/**
 * Minimal SDK Usage
 *
 * Uses all defaults: discovers skills, extensions, tools, context files
<<<<<<< HEAD
 * from cwd and ~/.helix/agent. Model chosen from settings or first available.
 */

import { createAgentSession } from "@helix-bio/helix";
=======
 * from cwd and ~/.senpi/agent. Model chosen from settings or first available.
 */

import { createAgentSession } from "@code-yeongyu/senpi";
>>>>>>> upstream/main

const { session } = await createAgentSession();

try {
	session.subscribe((event) => {
		if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
			process.stdout.write(event.assistantMessageEvent.delta);
		}
	});

	await session.prompt("What files are in the current directory?");
	session.state.messages.forEach((msg) => {
		console.log(msg);
	});
	console.log();
} finally {
	session.dispose();
}
