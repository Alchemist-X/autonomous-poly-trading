import type { OverviewResponse, PublicPosition, RunMode, TradeDecisionSet } from "@autopoly/contracts";
import type { ProgressReporter } from "../lib/terminal-progress.js";
import type { PulseSnapshot } from "../pulse/market-pulse.js";
import type { PositionResearchSnapshot, PositionReviewResult, PulseEntryPlan } from "./decision-metadata.js";

export interface RuntimeExecutionContext {
  runId: string;
  mode: RunMode;
  overview: OverviewResponse;
  positions: PublicPosition[];
  pulse: PulseSnapshot;
  positionResearch?: PositionResearchSnapshot[];
  reviewPositionsOnly?: boolean;
  progress?: ProgressReporter;
}

export interface RuntimeExecutionResult {
  decisionSet: TradeDecisionSet;
  promptSummary: string;
  reasoningMd: string;
  logsMd: string;
  positionReviews?: PositionReviewResult[];
  entryPlans?: PulseEntryPlan[];
}

export interface AgentRuntime {
  name: string;
  run(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult>;
}
