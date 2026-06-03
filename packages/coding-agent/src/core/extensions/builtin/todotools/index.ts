<<<<<<< HEAD
import type { ExtensionAPI, ExtensionContext } from "../../types.js";
import { installContinuation } from "./continuation/index.js";
import { TASK_MANAGEMENT_SECTION } from "./prompt.js";
import { getLatestTodosFromBranchEntries, getTodoWidgetLines, type TodoItem } from "./state.js";
import { registerTodoReadTool } from "./tools/todoread.js";
import { registerTodoWriteTool } from "./tools/todowrite.js";
=======
import type { ExtensionAPI, ExtensionContext } from "../../types.ts";
import { installContinuation } from "./continuation/index.ts";
import { TASK_MANAGEMENT_SECTION } from "./prompt.ts";
import { getLatestTodosFromBranchEntries, getTodoWidgetLines, type TodoItem } from "./state.ts";
import { registerTodoReadTool } from "./tools/todoread.ts";
import { registerTodoWriteTool } from "./tools/todowrite.ts";
>>>>>>> upstream/main

function getLatestTodos(ctx: ExtensionContext): TodoItem[] {
	return getLatestTodosFromBranchEntries(ctx.sessionManager.getBranch());
}

export default function todotoolsExtension(pi: ExtensionAPI): void {
	let currentTodos: TodoItem[] = [];

	const getCurrentTodos = (): TodoItem[] => currentTodos;

	const setCurrentTodos = (todos: TodoItem[]): void => {
		currentTodos = todos;
	};

	const syncWidget = (ctx: ExtensionContext): void => {
		ctx.ui.setWidget("todo-sidebar", getTodoWidgetLines(currentTodos));
	};

	const syncFromSession = (ctx: ExtensionContext): void => {
		currentTodos = getLatestTodos(ctx);
		syncWidget(ctx);
	};

	installContinuation(pi, { getCurrentTodos });

	pi.on("session_start", async (_event, ctx) => {
		syncFromSession(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		syncFromSession(ctx);
	});

	pi.on("before_agent_start", async (event) => {
		return {
			systemPrompt: `${event.systemPrompt}\n${TASK_MANAGEMENT_SECTION}`,
		};
	});

	registerTodoWriteTool(pi, { getCurrentTodos, setCurrentTodos, syncWidget });
	registerTodoReadTool(pi, getCurrentTodos);
}

<<<<<<< HEAD
export { TASK_MANAGEMENT_SECTION } from "./prompt.js";
=======
export { TASK_MANAGEMENT_SECTION } from "./prompt.ts";
>>>>>>> upstream/main
export {
	getLatestTodosFromBranchEntries,
	getTodoMarker,
	getTodoResultLines,
	getTodoWidgetLines,
	isIncompleteTodo,
	isTerminalTodoStatus,
	isTodoItem,
	isTodoItemArray,
	sanitizeTodoText,
	TODO_STATE_ENTRY_TYPE,
	type TodoItem,
<<<<<<< HEAD
} from "./state.js";
=======
} from "./state.ts";
>>>>>>> upstream/main
