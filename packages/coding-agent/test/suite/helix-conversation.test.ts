import { describe, expect, it, vi } from "vitest";
import {
	emitBuiltinSystemMessageFailure,
	HELIX_CONVERSATION_EVENT,
	HELIX_SYSTEM_PREFIX,
	sendBuiltinCustomMessage,
	sendBuiltinUserMessage,
<<<<<<< HEAD:packages/coding-agent/test/suite/helix-conversation.test.ts
} from "../../src/core/extensions/builtin/system-messages.js";
import { HELIX_SYSTEM_PREFIX as TODO_SYSTEM_PREFIX } from "../../src/core/extensions/builtin/todotools/system-messages.js";
=======
} from "../../src/core/extensions/builtin/system-messages.ts";
import { SENPI_SYSTEM_PREFIX as TODO_SYSTEM_PREFIX } from "../../src/core/extensions/builtin/todotools/system-messages.ts";
>>>>>>> upstream/main:packages/coding-agent/test/suite/senpi-conversation.test.ts

function createMockPi() {
	return {
		sendUserMessage: vi.fn(),
		sendMessage: vi.fn(),
		events: {
			emit: vi.fn(),
		},
	};
}

describe("helix conversation helpers", () => {
	it("uses the helix marker for injected system prefixes", () => {
		expect(HELIX_SYSTEM_PREFIX).toBe("[system:helix]");
		expect(TODO_SYSTEM_PREFIX).toBe("[system:helix]");
	});

	it("emits a unified injected event and prefixes builtin user messages", () => {
		const pi = createMockPi();

		sendBuiltinUserMessage(pi as never, "todotools.continuation", "Continue the task", {
			sessionId: "session-1",
		});

		expect(pi.sendUserMessage).toHaveBeenCalledWith(`${HELIX_SYSTEM_PREFIX}\nContinue the task`);
		expect(pi.events.emit).toHaveBeenCalledWith(
			HELIX_CONVERSATION_EVENT,
			expect.objectContaining({
				version: 1,
				source: "builtin",
				action: "injected",
				route: "todotools.continuation",
				sessionId: "session-1",
				conversation: expect.objectContaining({
					kind: "user_message",
					prefix: HELIX_SYSTEM_PREFIX,
				}),
				text: `${HELIX_SYSTEM_PREFIX}\nContinue the task`,
			}),
		);
	});

	it("emits a unified injected event and prefixes builtin custom messages", () => {
		const pi = createMockPi();

		sendBuiltinCustomMessage(
			pi as never,
			"todotools.continuation",
			{
				customType: "helix.test",
				display: true,
				content: [{ type: "text", text: "<system-reminder>\nDone\n</system-reminder>" }],
			},
			{ triggerTurn: true, deliverAs: "followUp", sessionId: "session-2" },
		);

		expect(pi.sendMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				customType: "helix.test",
				content: [
					expect.objectContaining({
						type: "text",
						text: `${HELIX_SYSTEM_PREFIX}\n<system-reminder>\nDone\n</system-reminder>`,
					}),
				],
			}),
			{ triggerTurn: true, deliverAs: "followUp" },
		);
		expect(pi.events.emit).toHaveBeenCalledWith(
			HELIX_CONVERSATION_EVENT,
			expect.objectContaining({
				version: 1,
				source: "builtin",
				action: "injected",
				route: "todotools.continuation",
				sessionId: "session-2",
				conversation: expect.objectContaining({
					kind: "custom_message",
					customType: "helix.test",
					prefix: HELIX_SYSTEM_PREFIX,
					triggerTurn: true,
					deliverAs: "followUp",
				}),
			}),
		);
	});

	it("emits a unified failed event for helix conversation injection failures", () => {
		const pi = createMockPi();

		emitBuiltinSystemMessageFailure(pi as never, {
			route: "todotools.continuation",
			sessionId: "session-3",
			kind: "user_message",
			content: "Continue after failure",
			errorMessage: "dispatch failed",
		});

		expect(pi.events.emit).toHaveBeenCalledWith(
			HELIX_CONVERSATION_EVENT,
			expect.objectContaining({
				version: 1,
				source: "builtin",
				action: "failed",
				route: "todotools.continuation",
				sessionId: "session-3",
				conversation: expect.objectContaining({
					kind: "user_message",
					prefix: HELIX_SYSTEM_PREFIX,
				}),
				text: `${HELIX_SYSTEM_PREFIX}\nContinue after failure`,
				errorMessage: "dispatch failed",
			}),
		);
	});
});
