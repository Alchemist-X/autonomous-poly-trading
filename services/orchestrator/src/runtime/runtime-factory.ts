import type { OrchestratorConfig } from "../config.js";
import type { AgentRuntime } from "./agent-runtime.js";
import { ProviderRuntime } from "./provider-runtime.js";

export function createAgentRuntime(config: OrchestratorConfig): AgentRuntime {
  return new ProviderRuntime(config, config.runtimeProvider);
}
