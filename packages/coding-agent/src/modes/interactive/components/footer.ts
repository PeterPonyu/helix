<<<<<<< HEAD
import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { AgentSession } from "../../../core/agent-session.js";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.js";
import { theme } from "../theme/theme.js";
=======
import { isAbsolute, relative, resolve, sep } from "node:path";
import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { AgentSession } from "../../../core/agent-session.ts";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.ts";
import { theme } from "../theme/theme.ts";
>>>>>>> upstream/main

/**
 * Sanitize text for display in a single-line status.
 * Removes newlines, tabs, carriage returns, and other control characters.
 */
function sanitizeStatusText(text: string): string {
	// Replace newlines, tabs, carriage returns with space, then collapse multiple spaces
	return text
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

function formatTokens(count: number): string {
	return count.toLocaleString("en-US");
}

<<<<<<< HEAD
=======
export function formatCwdForFooter(cwd: string, home: string | undefined): string {
	if (!home) return cwd;

	const resolvedCwd = resolve(cwd);
	const resolvedHome = resolve(home);
	const relativeToHome = relative(resolvedHome, resolvedCwd);
	const isInsideHome =
		relativeToHome === "" ||
		(relativeToHome !== ".." && !relativeToHome.startsWith(`..${sep}`) && !isAbsolute(relativeToHome));

	if (!isInsideHome) return cwd;
	return relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`;
}

/**
 * Color the right side of the footer: (provider) muted, model accent, :thinking dim.
 * The text is the plain (uncolored) right-aligned segment from the layout pass.
 */
function colorRightSide(text: string): string {
	if (!text) return "";
	const providerMatch = text.match(/^\(([^)]+)\) (.*)$/);
	const body = providerMatch ? providerMatch[2] : text;
	const providerPrefix = providerMatch ? theme.fg("muted", `(${providerMatch[1]}) `) : "";
	const thinkingMatch = body.match(/^(.+):([^:]+)$/);
	if (!thinkingMatch) return providerPrefix + theme.fg("accent", body);
	return `${providerPrefix}${theme.fg("accent", thinkingMatch[1])}${theme.fg("dim", `:${thinkingMatch[2]}`)}`;
}

>>>>>>> upstream/main
/**
 * Footer component that shows pwd, token stats, and context usage.
 * Computes token/context stats from session, gets git branch and extension statuses from provider.
 */
export class FooterComponent implements Component {
<<<<<<< HEAD
	private autoCompactEnabled = true;

	constructor(
		private session: AgentSession,
		private footerData: ReadonlyFooterDataProvider,
	) {}
=======
	private session: AgentSession;
	private footerData: ReadonlyFooterDataProvider;
	private autoCompactEnabled = true;

	constructor(session: AgentSession, footerData: ReadonlyFooterDataProvider) {
		this.session = session;
		this.footerData = footerData;
	}
>>>>>>> upstream/main

	setSession(session: AgentSession): void {
		this.session = session;
	}

	setAutoCompactEnabled(enabled: boolean): void {
		this.autoCompactEnabled = enabled;
	}

	/**
	 * No-op: git branch caching now handled by provider.
	 * Kept for compatibility with existing call sites in interactive-mode.
	 */
	invalidate(): void {
		// No-op: git branch is cached/invalidated by provider
	}

	/**
	 * Clean up resources.
	 * Git watcher cleanup now handled by provider.
	 */
	dispose(): void {
		// Git watcher cleanup handled by provider
	}

	render(width: number): string[] {
		const state = this.session.state;

		let totalInput = 0;
		let totalOutput = 0;
		let totalCacheRead = 0;
		let totalCacheWrite = 0;
		let totalCost = 0;

		for (const entry of this.session.sessionManager.getEntries()) {
			if (entry.type === "message" && entry.message.role === "assistant") {
				totalInput += entry.message.usage.input;
				totalOutput += entry.message.usage.output;
				totalCacheRead += entry.message.usage.cacheRead;
				totalCacheWrite += entry.message.usage.cacheWrite;
				totalCost += entry.message.usage.cost.total;
			}
		}

		// Calculate context usage from session (handles compaction correctly).
		// After compaction, tokens are unknown until the next LLM response.
		const contextUsage = this.session.getContextUsage();
		const contextWindow = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
		const contextPercentValue = contextUsage?.percent ?? 0;
		const contextPercent = contextUsage?.percent !== null ? contextPercentValue.toFixed(1) : "?";
		const contextTokens =
			typeof contextUsage?.tokens === "number"
				? formatTokens(contextUsage.tokens)
				: typeof contextUsage?.percent === "number"
					? formatTokens(Math.round((contextWindow * contextUsage.percent) / 100))
					: "?";

<<<<<<< HEAD
		// Replace home directory with ~
		let pwd = this.session.sessionManager.getCwd();
		const home = process.env.HOME || process.env.USERPROFILE;
		if (home && pwd.startsWith(home)) {
			pwd = `~${pwd.slice(home.length)}`;
		}

		// Add git branch if available
		const branch = this.footerData.getGitBranch();
		if (branch) {
			pwd = `${pwd} (${branch})`;
		}

		// Add session name if set
		const sessionName = this.session.sessionManager.getSessionName();
		if (sessionName) {
			pwd = `${pwd} • ${sessionName}`;
		}

		const statsParts: string[] = [];
		if (totalInput) statsParts.push(`↑${formatTokens(totalInput)}`);
		if (totalOutput) statsParts.push(`↓${formatTokens(totalOutput)}`);
		if (totalCacheRead || totalCacheWrite) {
			statsParts.push(`cache ${formatTokens(totalCacheRead)}/${formatTokens(totalCacheWrite)}`);
=======
		// Build colored segments. Each segment carries its own theme color
		// so the HUD stays readable at a glance instead of being one dim wash.
		const sep = theme.fg("borderMuted", " • ");
		const pwdRaw = formatCwdForFooter(
			this.session.sessionManager.getCwd(),
			process.env.HOME || process.env.USERPROFILE,
		);
		const branch = this.footerData.getGitBranch();
		const sessionName = this.session.sessionManager.getSessionName();

		const coloredSegments: string[] = [theme.fg("accent", pwdRaw)];
		const plainSegments: string[] = [pwdRaw];
		if (branch) {
			coloredSegments.push(theme.fg("warning", branch));
			plainSegments.push(branch);
		}
		if (sessionName) {
			coloredSegments.push(theme.fg("muted", sessionName));
			plainSegments.push(sessionName);
		}
		if (totalInput) {
			const text = `↑${formatTokens(totalInput)}`;
			coloredSegments.push(theme.fg("dim", text));
			plainSegments.push(text);
		}
		if (totalOutput) {
			const text = `↓${formatTokens(totalOutput)}`;
			coloredSegments.push(theme.fg("dim", text));
			plainSegments.push(text);
		}
		if (totalCacheRead || totalCacheWrite) {
			const text = `cache ${formatTokens(totalCacheRead)}/${formatTokens(totalCacheWrite)}`;
			coloredSegments.push(theme.fg("dim", text));
			plainSegments.push(text);
>>>>>>> upstream/main
		}

		// Show cost with "(sub)" indicator if using OAuth subscription
		const usingSubscription = state.model ? this.session.modelRegistry.isUsingOAuth(state.model) : false;
		if (totalCost || usingSubscription) {
			const costStr = `$${totalCost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`;
<<<<<<< HEAD
			statsParts.push(costStr);
		}

		let contextPercentStr: string;
		const autoIndicator = this.autoCompactEnabled ? " (auto)" : "";
		const contextPercentDisplay =
			contextPercent === "?"
				? `${contextTokens}/${formatTokens(contextWindow)} (?)${autoIndicator}`
				: `${contextTokens}/${formatTokens(contextWindow)} (${contextPercent}%)${autoIndicator}`;
		if (contextPercentValue > 90) {
			contextPercentStr = theme.fg("error", contextPercentDisplay);
		} else if (contextPercentValue > 70) {
			contextPercentStr = theme.fg("warning", contextPercentDisplay);
		} else {
			contextPercentStr = contextPercentDisplay;
		}
		statsParts.push(contextPercentStr);

		let statsLeft = statsParts.join(" ");

		// Add model name on the right side, plus thinking level if model supports it
		const modelName = state.model?.id || "no-model";

		let statsLeftWidth = visibleWidth(statsLeft);

		// If statsLeft is too wide, truncate it
		if (statsLeftWidth > width) {
			statsLeft = truncateToWidth(statsLeft, width, "...");
			statsLeftWidth = visibleWidth(statsLeft);
=======
			coloredSegments.push(theme.fg("success", costStr));
			plainSegments.push(costStr);
		}

		const autoIndicator = this.autoCompactEnabled ? " (auto)" : "";
		const ctxDisplay =
			contextPercent === "?"
				? `${contextTokens}/${formatTokens(contextWindow)} (?)${autoIndicator}`
				: `${contextTokens}/${formatTokens(contextWindow)} (${contextPercent}%)${autoIndicator}`;
		const ctxColored =
			contextPercentValue > 90
				? theme.fg("error", ctxDisplay)
				: contextPercentValue > 70
					? theme.fg("warning", ctxDisplay)
					: theme.fg("muted", ctxDisplay);
		coloredSegments.push(ctxColored);
		plainSegments.push(ctxDisplay);

		const statsLeftPlain = plainSegments.join(" • ");
		let statsLeft = coloredSegments.join(sep);
		let statsLeftWidth = visibleWidth(statsLeftPlain);

		// If statsLeft is too wide, truncate the plain version (color codes break truncation)
		if (statsLeftWidth > width) {
			const truncated = truncateToWidth(statsLeftPlain, width, "...");
			statsLeft = theme.fg("muted", truncated);
			statsLeftWidth = visibleWidth(truncated);
>>>>>>> upstream/main
		}

		// Calculate available space for padding (minimum 2 spaces between stats and model)
		const minPadding = 2;

		// Add thinking level indicator if model supports reasoning
<<<<<<< HEAD
		let rightSideWithoutProvider = modelName;
		if (state.model?.reasoning) {
			const thinkingLevel = state.thinkingLevel || "off";
			rightSideWithoutProvider =
				thinkingLevel === "off" ? `${modelName} • thinking off` : `${modelName} • ${thinkingLevel}`;
		}

		// Prepend the provider in parentheses if there are multiple providers and there's enough room
		let rightSide = rightSideWithoutProvider;
		if (this.footerData.getAvailableProviderCount() > 1 && state.model) {
			rightSide = `(${state.model!.provider}) ${rightSideWithoutProvider}`;
			if (statsLeftWidth + minPadding + visibleWidth(rightSide) > width) {
				// Too wide, fall back
				rightSide = rightSideWithoutProvider;
			}
		}

		const rightSideWidth = visibleWidth(rightSide);
		const totalNeeded = statsLeftWidth + minPadding + rightSideWidth;

		let statsLine: string;
		if (totalNeeded <= width) {
			// Both fit - add padding to right-align model
			const padding = " ".repeat(width - statsLeftWidth - rightSideWidth);
			statsLine = statsLeft + padding + rightSide;
		} else {
			// Need to truncate right side
			const availableForRight = width - statsLeftWidth - minPadding;
			if (availableForRight > 0) {
				const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
				const truncatedRightWidth = visibleWidth(truncatedRight);
				const padding = " ".repeat(Math.max(0, width - statsLeftWidth - truncatedRightWidth));
				statsLine = statsLeft + padding + truncatedRight;
			} else {
				// Not enough space for right side at all
				statsLine = statsLeft;
			}
		}

		// Apply dim to each part separately. statsLeft may contain color codes (for context %)
		// that end with a reset, which would clear an outer dim wrapper. So we dim the parts
		// before and after the colored section independently.
		const dimStatsLeft = theme.fg("dim", statsLeft);
		const remainder = statsLine.slice(statsLeft.length); // padding + rightSide
		const dimRemainder = theme.fg("dim", remainder);

		const pwdLine = truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."));
		const lines = [pwdLine, dimStatsLeft + dimRemainder];
=======
		const modelName = state.model?.id || "no-model";
		let rightSideWithoutProvider = modelName;
		if (state.model?.reasoning) {
			const thinkingLevel = state.thinkingLevel || "off";
			rightSideWithoutProvider = thinkingLevel === "off" ? `${modelName}:off` : `${modelName}:${thinkingLevel}`;
		}

		// Prepend the provider in parentheses if there are multiple providers and there's enough room
		let rightSidePlain = rightSideWithoutProvider;
		if (this.footerData.getAvailableProviderCount() > 1 && state.model) {
			const withProvider = `(${state.model.provider}) ${rightSideWithoutProvider}`;
			if (statsLeftWidth + minPadding + visibleWidth(withProvider) <= width) {
				rightSidePlain = withProvider;
			}
		}

		const rightSideWidth = visibleWidth(rightSidePlain);
		const totalNeeded = statsLeftWidth + minPadding + rightSideWidth;

		let rightSideRendered = rightSidePlain;
		let actualRightWidth = rightSideWidth;
		if (totalNeeded > width) {
			const availableForRight = width - statsLeftWidth - minPadding;
			if (availableForRight > 0) {
				rightSideRendered = truncateToWidth(rightSidePlain, availableForRight, "");
				actualRightWidth = visibleWidth(rightSideRendered);
			} else {
				rightSideRendered = "";
				actualRightWidth = 0;
			}
		}

		// Color the right side: provider muted, model accent, thinking dim
		const coloredRight = colorRightSide(rightSideRendered);
		const padding = " ".repeat(Math.max(0, width - statsLeftWidth - actualRightWidth));
		const lines = [statsLeft + padding + coloredRight];
>>>>>>> upstream/main

		// Add extension statuses on a single line, sorted by key alphabetically
		const extensionStatuses = this.footerData.getExtensionStatuses();
		if (extensionStatuses.size > 0) {
			const sortedStatuses = Array.from(extensionStatuses.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([, text]) => sanitizeStatusText(text));
			const statusLine = sortedStatuses.join(" ");
			// Truncate to terminal width with dim ellipsis for consistency with footer style
			lines.push(truncateToWidth(statusLine, width, theme.fg("dim", "...")));
		}

		return lines;
	}
}
