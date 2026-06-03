// Core Agent
<<<<<<< HEAD
export * from "./agent.js";
// Loop functions
export * from "./agent-loop.js";
export * from "./harness/agent-harness.js";
=======
export * from "./agent.ts";
// Loop functions
export * from "./agent-loop.ts";
export * from "./harness/agent-harness.ts";
>>>>>>> upstream/main
export {
	type BranchPreparation,
	type BranchSummaryDetails,
	type CollectEntriesResult,
	collectEntriesForBranchSummary,
	generateBranchSummary,
	prepareBranchEntries,
<<<<<<< HEAD
} from "./harness/compaction/branch-summarization.js";
=======
} from "./harness/compaction/branch-summarization.ts";
>>>>>>> upstream/main
export {
	calculateContextTokens,
	compact,
	DEFAULT_COMPACTION_SETTINGS,
	estimateContextTokens,
	estimateTokens,
	findCutPoint,
	findTurnStartIndex,
	generateSummary,
	getLastAssistantUsage,
	prepareCompaction,
	serializeConversation,
	shouldCompact,
<<<<<<< HEAD
} from "./harness/compaction/compaction.js";
export * from "./harness/messages.js";
export * from "./harness/prompt-templates.js";
export * from "./harness/session/jsonl-repo.js";
export * from "./harness/session/memory-repo.js";
export * from "./harness/session/repo-utils.js";
export * from "./harness/session/session.js";
export { uuidv7 } from "./harness/session/uuid.js";
export * from "./harness/skills.js";
export * from "./harness/system-prompt.js";
// Harness
export * from "./harness/types.js";
export * from "./harness/utils/shell-output.js";
export * from "./harness/utils/truncate.js";
// Proxy utilities
export * from "./proxy.js";
// Types
export * from "./types.js";
=======
} from "./harness/compaction/compaction.ts";
export * from "./harness/messages.ts";
export * from "./harness/prompt-templates.ts";
export * from "./harness/session/jsonl-repo.ts";
export * from "./harness/session/memory-repo.ts";
export * from "./harness/session/repo-utils.ts";
export * from "./harness/session/session.ts";
export { uuidv7 } from "./harness/session/uuid.ts";
export * from "./harness/skills.ts";
export * from "./harness/system-prompt.ts";
// Harness
export * from "./harness/types.ts";
export * from "./harness/utils/shell-output.ts";
export * from "./harness/utils/truncate.ts";
// Proxy utilities
export * from "./proxy.ts";
// Types
export * from "./types.ts";
>>>>>>> upstream/main
