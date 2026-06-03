<<<<<<< HEAD
import { registerImagesApiProvider } from "../../images-api-registry.js";
import type { AssistantImages, ImagesContext, ImagesFunction, ImagesModel, ImagesOptions } from "../../types.js";
import type { generateImagesOpenRouter as generateImagesOpenRouterFunction } from "./openrouter.js";
=======
import { registerImagesApiProvider } from "../../images-api-registry.ts";
import type { AssistantImages, ImagesContext, ImagesFunction, ImagesModel, ImagesOptions } from "../../types.ts";
import type { generateImagesOpenRouter as generateImagesOpenRouterFunction } from "./openrouter.ts";
>>>>>>> upstream/main

interface OpenRouterImagesProviderModule {
	generateImagesOpenRouter: typeof generateImagesOpenRouterFunction;
}

let openRouterImagesProviderModulePromise: Promise<OpenRouterImagesProviderModule> | undefined;

function createLazyLoadErrorImages(model: ImagesModel<"openrouter-images">, error: unknown): AssistantImages {
	return {
		api: model.api,
		provider: model.provider,
		model: model.id,
		output: [],
		stopReason: "error",
		errorMessage: error instanceof Error ? error.message : String(error),
		timestamp: Date.now(),
	};
}

function loadOpenRouterImagesProviderModule(): Promise<OpenRouterImagesProviderModule> {
<<<<<<< HEAD
	openRouterImagesProviderModulePromise ||= import("./openrouter.js").then(
=======
	openRouterImagesProviderModulePromise ||= import("./openrouter.ts").then(
>>>>>>> upstream/main
		(module) => module as OpenRouterImagesProviderModule,
	);
	return openRouterImagesProviderModulePromise;
}

export const generateImagesOpenRouter: ImagesFunction<"openrouter-images", ImagesOptions> = async (
	model: ImagesModel<"openrouter-images">,
	context: ImagesContext,
	options?: ImagesOptions,
) => {
	try {
		const module = await loadOpenRouterImagesProviderModule();
		return await module.generateImagesOpenRouter(model, context, options);
	} catch (error) {
		return createLazyLoadErrorImages(model, error);
	}
};

export function registerBuiltInImagesApiProviders(): void {
	registerImagesApiProvider({
		api: "openrouter-images",
		generateImages: generateImagesOpenRouter,
	});
}

registerBuiltInImagesApiProviders();
