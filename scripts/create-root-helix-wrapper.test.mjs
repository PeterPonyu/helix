#!/usr/bin/env node
import assert from "node:assert/strict";
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createRootHelixWrapper, shouldWriteGlobalShim } from "./create-root-helix-wrapper.mjs";

describe("create-root-helix-wrapper", () => {
	it("writes a launch-only wrapper when the root is a gitless snapshot", () => {
		// Given
		const root = mkdtempSync(join(tmpdir(), "helix-wrapper-snapshot-"));
		const globalPrefix = mkdtempSync(join(tmpdir(), "helix-wrapper-global-"));

		// When
		const result = createRootHelixWrapper({ root, globalPrefix });
		const wrapper = readFileSync(result.wrapperPath, "utf8");

		// Then
		assert.equal(shouldWriteGlobalShim(root, {}), false);
		assert.equal(result.globalShimWritten, false);
		assert.equal(wrapper.includes("packages/coding-agent/dist/helix"), true);
		assert.equal(wrapper.includes("scripts/build-all.mjs"), false);
		assert.equal(wrapper.includes("packages/ai/src"), false);
		assert.equal(wrapper.includes(".helix-build-head"), false);
		assert.equal(wrapper.includes("linkedBuildIsStale"), false);
	});

	it("does NOT write a global shim by default in a git checkout (opt-in only)", () => {
		// Given
		const root = mkdtempSync(join(tmpdir(), "helix-wrapper-git-default-"));
		mkdirSync(join(root, ".git"));

		// When
		const defaultDecision = shouldWriteGlobalShim(root, {});
		const ciDecision = shouldWriteGlobalShim(root, { CI: "true", HELIX_WRITE_GLOBAL_SHIM: "1" });

		// Then
		assert.equal(defaultDecision, false);
		assert.equal(ciDecision, false);
	});

	it("writes a global shim only when HELIX_WRITE_GLOBAL_SHIM=1 in a non-CI git checkout", () => {
		// Given
		const root = mkdtempSync(join(tmpdir(), "helix-wrapper-git-optin-"));
		mkdirSync(join(root, ".git"));

		// When
		const optInDecision = shouldWriteGlobalShim(root, { HELIX_WRITE_GLOBAL_SHIM: "1" });

		// Then
		assert.equal(optInDecision, true);
	});

	it("replaces an existing global symlink instead of following it", () => {
		// Given
		const root = mkdtempSync(join(tmpdir(), "helix-wrapper-root-"));
		const globalPrefix = mkdtempSync(join(tmpdir(), "helix-wrapper-global-"));
		const globalBin = join(globalPrefix, "bin");
		const linkedTarget = join(root, "linked-cli.js");
		mkdirSync(join(root, ".git"));
		mkdirSync(globalBin);
		writeFileSync(linkedTarget, "original", "utf8");
		symlinkSync(linkedTarget, join(globalBin, "helix"));

		// When
		const result = createRootHelixWrapper({ root, globalPrefix, writeGlobalShim: true });

		// Then
		assert.equal(readFileSync(linkedTarget, "utf8"), "original");
		assert.equal(lstatSync(result.globalShimPath).isSymbolicLink(), false);
		assert.equal(readFileSync(result.globalShimPath, "utf8").includes(result.wrapperPath), true);
	});
});
