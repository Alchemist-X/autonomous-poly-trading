import { z } from "zod";

export const runModeSchema = z.enum(["review", "scan", "full"]);
export type RunMode = z.infer<typeof runModeSchema>;

export const actionSchema = z.enum(["open", "close", "reduce", "hold", "skip"]);
export const sideSchema = z.enum(["BUY", "SELL"]);
export const orderTypeSchema = z.literal("FOK");
export const confidenceSchema = z.enum(["low", "medium", "medium-high", "high"]);

export const sourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  retrieved_at_utc: z.string(),
  note: z.string().optional()
});

export const artifactSchema = z.object({
  kind: z.enum(["pulse-report", "review-report", "resolution-report", "backtest-report", "runtime-log"]),
  title: z.string(),
  path: z.string(),
  content: z.string().optional(),
  published_at_utc: z.string()
});

export const decisionSchema = z.object({
  action: actionSchema,
  event_slug: z.string().min(1),
  market_slug: z.string().min(1),
  token_id: z.string().min(1),
  side: sideSchema,
  notional_usd: z.number().positive(),
  order_type: orderTypeSchema,
  ai_prob: z.number().min(0).max(1),
  market_prob: z.number().min(0).max(1),
  edge: z.number(),
  confidence: confidenceSchema,
  thesis_md: z.string().min(1),
  sources: z.array(sourceSchema).min(1),
  stop_loss_pct: z.number().min(0).max(1).default(0.3),
  resolution_track_required: z.boolean().default(true)
});

export const tradeDecisionSetSchema = z.object({
  run_id: z.string().uuid(),
  runtime: z.string().min(1),
  generated_at_utc: z.string(),
  bankroll_usd: z.number().nonnegative(),
  mode: runModeSchema,
  decisions: z.array(decisionSchema),
  artifacts: z.array(artifactSchema)
});

export type TradeDecisionSet = z.infer<typeof tradeDecisionSetSchema>;
export type TradeDecision = z.infer<typeof decisionSchema>;
export type Artifact = z.infer<typeof artifactSchema>;

export const adminActionSchema = z.enum([
  "pause",
  "resume",
  "run-now",
  "cancel-open-orders",
  "flatten"
]);
export type AdminAction = z.infer<typeof adminActionSchema>;

export const systemStatusSchema = z.enum(["running", "paused", "halted"]);
export type SystemStatus = z.infer<typeof systemStatusSchema>;

export interface OverviewPoint {
  timestamp: string;
  total_equity_usd: number;
  drawdown_pct: number;
}

export interface OverviewResponse {
  status: SystemStatus;
  cash_balance_usd: number;
  total_equity_usd: number;
  high_water_mark_usd: number;
  drawdown_pct: number;
  open_positions: number;
  last_run_at: string | null;
  latest_risk_event: string | null;
  equity_curve: OverviewPoint[];
}

export interface PublicPosition {
  id: string;
  event_slug: string;
  market_slug: string;
  token_id: string;
  side: "BUY" | "SELL";
  outcome_label: string;
  size: number;
  avg_cost: number;
  current_price: number;
  current_value_usd: number;
  unrealized_pnl_pct: number;
  stop_loss_pct: number;
  opened_at: string;
  updated_at: string;
}

export interface PublicTrade {
  id: string;
  market_slug: string;
  token_id: string;
  status: string;
  side: "BUY" | "SELL";
  requested_notional_usd: number;
  filled_notional_usd: number;
  avg_price: number | null;
  order_id: string | null;
  timestamp_utc: string;
}

export interface PublicArtifactListItem {
  id: string;
  title: string;
  kind: z.infer<typeof artifactSchema>["kind"];
  path: string;
  published_at_utc: string;
}

export interface PublicRunSummary {
  id: string;
  mode: RunMode;
  runtime: string;
  status: string;
  bankroll_usd: number;
  decision_count: number;
  generated_at_utc: string;
}

export interface PublicRunDetail extends PublicRunSummary {
  prompt_summary: string;
  reasoning_md: string;
  logs_md: string;
  decisions: TradeDecision[];
  artifacts: Artifact[];
}

export const QUEUES = {
  execution: "execution-jobs"
} as const;

export const JOBS = {
  executeTrade: "execute-trade",
  syncPortfolio: "sync-portfolio",
  flattenPortfolio: "flatten-portfolio",
  cancelOpenOrders: "cancel-open-orders"
} as const;
