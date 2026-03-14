import type { OverviewResponse, PublicPosition, RunMode, TradeDecisionSet } from "@autopoly/contracts";
import type { PulseSnapshot } from "../pulse/market-pulse.js";

export interface RuntimeExecutionContext {
  runId: string;
  mode: RunMode;
  overview: OverviewResponse;
  positions: PublicPosition[];
  pulse: PulseSnapshot;
}

export interface RuntimeExecutionResult {
  decisionSet: TradeDecisionSet;
  promptSummary: string;
  reasoningMd: string;
  logsMd: string;
}

export interface AgentRuntime {
  name: string;
  run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult>;
}
