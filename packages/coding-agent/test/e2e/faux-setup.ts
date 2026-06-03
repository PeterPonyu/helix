/**
 * Faux-provider wiring for the deterministic ($0, no-keys) E2E test.
 *
 * Registers a faux API provider and builds an AuthStorage + ModelRegistry pair
 * that `createAgentSession` (and its internal streamSimple auth resolution) will
 * accept — mirroring the registration done in test/suite/harness.ts. This lets
 * the SAME runner.ts code path exercised live also run with a scripted model
 * stream and zero network.
 */

import {
	type AssistantMessage,
	calculateCost,
	type FauxProviderRegistration,
	fauxToolCall,
	type Model,
	registerFauxProvider,
	type TextContent,
	type ToolCall,
} from "@earendil-works/pi-ai";
import { AuthStorage } from "../../src/core/auth-storage.js";
import type { ExtensionFactory } from "../../src/core/extensions/index.js";
import { ModelRegistry } from "../../src/core/model-registry.js";
import type { ResourceLoader } from "../../src/core/resource-loader.js";
import { createTestExtensionsResult, createTestResourceLoader } from "../utilities.js";

/**
 * Per-token cost (USD per 1M tokens) baked into the faux model so the faux test
 * exercises the real cost path. The faux stream itself zeroes usage.cost, so a
 * message_end extension reapplies calculateCost(model, usage) — exactly what
 * real providers do in their stream implementations.
 */
const FAUX_INPUT_COST_PER_MTOK = 3.0;
const FAUX_OUTPUT_COST_PER_MTOK = 15.0;

export interface FauxHarness {
	faux: FauxProviderRegistration;
	authStorage: AuthStorage;
	modelRegistry: ModelRegistry;
	model: Model<string>;
	/** Resource loader carrying the message_end cost extension. */
	resourceLoader: ResourceLoader;
	cleanup: () => void;
}

/**
 * Extension factory that reapplies real cost math to finalized assistant
 * messages, since the faux stream zeroes usage.cost. Mirrors how real provider
 * stream implementations call calculateCost(model, usage).
 */
function costExtensionFactory(model: Model<string>): ExtensionFactory {
	return (pi) => {
		pi.on("message_end", (event) => {
			if (event.message.role !== "assistant") return;
			const usage = { ...event.message.usage };
			usage.cost = calculateCost(model, {
				...usage,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			});
			return { message: { ...event.message, usage } };
		});
	};
}

/**
 * Register a faux provider and return a configured auth/registry pair, the faux
 * model, and a resource loader carrying the cost extension. Caller scripts
 * responses via `faux.setResponses(...)`.
 */
export async function createFauxHarness(): Promise<FauxHarness> {
	const faux = registerFauxProvider({
		models: [
			{
				id: "faux-1",
				name: "Faux Model",
				reasoning: false,
				input: ["text"],
				cost: {
					input: FAUX_INPUT_COST_PER_MTOK,
					output: FAUX_OUTPUT_COST_PER_MTOK,
					cacheRead: 0,
					cacheWrite: 0,
				},
				contextWindow: 128000,
				maxTokens: 16384,
			},
		],
	});
	faux.setResponses([]);
	const model = faux.getModel();

	const authStorage = AuthStorage.inMemory();
	authStorage.setRuntimeApiKey(model.provider, "faux-key");

	const modelRegistry = ModelRegistry.inMemory(authStorage);
	modelRegistry.registerProvider(model.provider, {
		baseUrl: model.baseUrl,
		apiKey: "faux-key",
		api: faux.api,
		models: faux.models.map((m) => ({
			id: m.id,
			name: m.name,
			api: m.api,
			reasoning: m.reasoning,
			input: m.input,
			cost: m.cost,
			contextWindow: m.contextWindow,
			maxTokens: m.maxTokens,
			baseUrl: m.baseUrl,
		})),
	});

	const extensionsResult = await createTestExtensionsResult([costExtensionFactory(model)]);
	const resourceLoader = createTestResourceLoader({ extensionsResult });

	return {
		faux,
		authStorage,
		modelRegistry,
		model,
		resourceLoader,
		cleanup: () => faux.unregister(),
	};
}

/**
 * Build a scripted assistant message for the faux stream.
 *
 * Note: the faux provider re-estimates usage (tokens) from content length and
 * zeroes usage.cost, so token/cost values cannot be set here — drive token
 * counts (and thus cost, via the message_end extension) through content size.
 */
export function scriptedAssistant(
	content: Array<TextContent | ToolCall>,
	options: { stopReason?: AssistantMessage["stopReason"] } = {},
): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "faux",
		provider: "faux",
		model: "faux-1",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: options.stopReason ?? "stop",
		timestamp: Date.now(),
	};
}

/** Convenience: a text block. */
export function text(value: string): TextContent {
	return { type: "text", text: value };
}

/** Convenience: a tool call block (delegates to fauxToolCall for id generation). */
export function toolCall(name: string, args: Record<string, unknown>): ToolCall {
	return fauxToolCall(name, args as ToolCall["arguments"]);
}
