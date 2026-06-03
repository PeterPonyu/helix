<<<<<<< HEAD
import type { ApplyPatchFailure, ApplyPatchResult } from "./types.js";
=======
import type { ApplyPatchFailure, ApplyPatchResult } from "./types.ts";
>>>>>>> upstream/main

export class ApplyPatchError extends Error {
	public readonly failures: ApplyPatchFailure[];
	public readonly result: ApplyPatchResult;

	constructor(message: string, result: ApplyPatchResult) {
		super(message);
		this.name = "ApplyPatchError";
		this.failures = result.failures;
		this.result = result;
	}

	hasPartialSuccess(): boolean {
		return this.result.hasPartialSuccess;
	}
}
