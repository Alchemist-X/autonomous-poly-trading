// Real-money trading decision contracts: the schemas that gate live orders,
// plus the queue/job names and admin/system enums. Split out of index.ts
// (Stage 2, 2026-07-03); re-exported verbatim from index.ts.
import { z } from "zod";

export const runModeSchema = z.enum(["review", "scan", "full"]);
export type RunMode = z.infer<typeof runModeSchema>;
export const publicRunStatusSchema = z.enum(["queued", "running", "completed", "failed", "awaiting-approval"]);
export type PublicRunStatus = z.infer<typeof publicRunStatusSchema>;

export const actionSchema = z.enum(["open", "close", "reduce", "hold", "skip"]);
export const sideSchema = z.enum(["BUY", "SELL"]);
export const orderTypeSchema = z.enum(["FOK", "GTC"]);
export const confidenceSchema = z.enum(["low", "medium", "medium-high", "high"]);
export const executionUnitSchema = z.enum(["usd", "shares"]);

export const sourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  retrieved_at_utc: z.string(),
  note: z.string().optional()
});

export const artifactSchema = z.object({
  kind: z.enum([
    "pulse-report",
    "review-report",
    "monitor-report",
    "rebalance-report",
    "resolution-report",
    "backtest-report",
    "runtime-log"
  ]),
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
  outcome_label: z.string().min(1).optional(),
  side: sideSchema,
  notional_usd: z.number().positive(),
  order_type: orderTypeSchema,
  ai_prob: z.number().min(0).max(1),
  market_prob: z.number().min(0).max(1),
  edge: z.number(),
  confidence: confidenceSchema,
  thesis_md: z.string().min(1),
  sources: z.array(sourceSchema).min(1),
  full_kelly_pct: z.number().min(0).max(1).optional(),
  quarter_kelly_pct: z.number().min(0).max(1).optional(),
  reported_suggested_pct: z.number().min(0).max(1).nullable().optional(),
  liquidity_cap_usd: z.number().positive().nullable().optional(),
  position_value_usd: z.number().nonnegative().optional(),
  execution_amount: z.number().positive().optional(),
  execution_unit: executionUnitSchema.optional(),
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

export const QUEUES = {
  execution: "execution-jobs"
} as const;

export const JOBS = {
  executeTrade: "execute-trade",
  syncPortfolio: "sync-portfolio",
  flattenPortfolio: "flatten-portfolio",
  cancelOpenOrders: "cancel-open-orders"
} as const;
