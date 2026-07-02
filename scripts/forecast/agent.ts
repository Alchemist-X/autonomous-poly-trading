// Provider dispatch — the single entry point for every model call.
//
// engine/framing/summary call runAgent(); which backend actually runs is chosen
// by env FORECAST_PROVIDER: "claude" (default — Claude Code CLI with real
// WebSearch) or "deepseek" (OpenAI-compatible HTTP, no web access — cheap
// testing and the Raven app's provider toggle). Prompt builders ask
// providerHasWebSearch() so a search-less provider is never told to WebSearch.

import { runAgentRaw } from "./claude-agent";
import type { AgentRunResult, RunAgentOptions } from "./claude-agent";
import { runDeepSeekRaw } from "./deepseek-agent";

export type ProviderName = "claude" | "deepseek";

export function providerName(): ProviderName {
  return process.env.FORECAST_PROVIDER === "deepseek" ? "deepseek" : "claude";
}

export function providerHasWebSearch(name: ProviderName = providerName()): boolean {
  return name === "claude";
}

export async function runAgent(prompt: string, opts: RunAgentOptions = {}): Promise<AgentRunResult> {
  return providerName() === "deepseek" ? runDeepSeekRaw(prompt, opts) : runAgentRaw(prompt, opts);
}
