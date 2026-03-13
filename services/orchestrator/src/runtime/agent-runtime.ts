import type { OverviewResponse, PublicPosition, TradeDecisionSet } from "@autopoly/contracts";

export interface RuntimeExecutionContext {
  overview: OverviewResponse;
  positions: PublicPosition[];
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

