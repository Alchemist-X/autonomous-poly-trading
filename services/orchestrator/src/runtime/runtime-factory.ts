import type { OrchestratorConfig } from "../config.js";
import type { AgentRuntime } from "./agent-runtime.js";
import { PulseDirectRuntime } from "./pulse-direct-runtime.js";
import { ProviderRuntime } from "./provider-runtime.js";

export function createAgentRuntime(config: OrchestratorConfig): AgentRuntime {
  if (config.decisionStrategy === "pulse-direct") {
    return new PulseDirectRuntime(config);
  }
  return new ProviderRuntime(config, config.runtimeProvider);
}
