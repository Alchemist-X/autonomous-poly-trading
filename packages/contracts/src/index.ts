import { z } from "zod";

export const runModeSchema = z.enum(["review", "scan", "full"]);
export type RunMode = z.infer<typeof runModeSchema>;
export const publicRunStatusSchema = z.enum(["queued", "running", "completed", "failed", "awaiting-approval"]);
export type PublicRunStatus = z.infer<typeof publicRunStatusSchema>;

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
  status: PublicRunStatus;
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
  tracked_sources: PublicTrackedSource[];
  resolution_checks: PublicResolutionCheck[];
}

export interface PublicTrackedSource {
  id: string;
  run_id: string | null;
  decision_id: string | null;
  event_slug: string;
  market_slug: string;
  title: string;
  url: string;
  source_kind: string;
  role: string;
  status: string;
  retrieved_at_utc: string;
  last_checked_at: string | null;
  note: string | null;
  content_hash: string | null;
}

export interface PublicResolutionCheck {
  id: string;
  event_slug: string;
  market_slug: string;
  track_status: string;
  interval_minutes: number;
  next_check_at: string | null;
  last_checked_at: string | null;
  summary: string;
  trackability: string | null;
  source_url: string | null;
  source_type: string | null;
  report_path: string | null;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function roundPositionMetric(value: number): number {
  return Number(value.toFixed(6));
}

function calculatePaperPositionPnlPct(avgCost: number, currentPrice: number): number {
  if (avgCost <= 0) {
    return 0;
  }
  return roundPositionMetric((currentPrice - avgCost) / avgCost);
}

export function inferPaperSellAmount(
  position: PublicPosition | null | undefined,
  decision: Pick<TradeDecision, "action" | "notional_usd">
): number {
  if (!position) {
    return 0;
  }

  if (decision.action === "close") {
    return position.size;
  }

  if (decision.action === "reduce" && position.current_value_usd > 0) {
    return Math.min(position.size, position.size * (decision.notional_usd / position.current_value_usd));
  }

  return 0;
}

export interface PaperTradeResult {
  status: "filled" | "rejected";
  avgPrice: number;
  filledNotionalUsd: number;
  nextPosition: PublicPosition | null;
  rejectionReason?: string;
}

export function getPaperFillPrice(side: "BUY" | "SELL"): number {
  return side === "BUY" ? 0.52 : 0.48;
}

export function buildPaperOrderResult(input: { side: "BUY" | "SELL"; amount: number }) {
  const avgPrice = getPaperFillPrice(input.side);
  return {
    ok: true,
    avgPrice,
    filledNotionalUsd:
      input.side === "BUY"
        ? roundCurrency(input.amount)
        : roundCurrency(input.amount * avgPrice),
    rawResponse: {
      mock: true,
      paper: true
    }
  };
}

export function applyPaperTradeDecision(input: {
  position: PublicPosition | null | undefined;
  decision: TradeDecision;
  avgPrice: number;
  timestampUtc: string;
}): PaperTradeResult {
  const currentPosition = input.position ?? null;
  const executionAmount =
    input.decision.side === "BUY"
      ? input.decision.notional_usd
      : inferPaperSellAmount(currentPosition, input.decision);

  if (!(executionAmount > 0) || !(input.avgPrice > 0)) {
    return {
      status: "rejected",
      avgPrice: input.avgPrice,
      filledNotionalUsd: 0,
      nextPosition: currentPosition,
      rejectionReason: currentPosition ? "decision has no executable size" : "no open position is available"
    };
  }

  const previousSize = currentPosition?.size ?? 0;
  const sizeDelta = input.decision.side === "BUY" ? executionAmount / input.avgPrice : -executionAmount;
  const nextSize = Math.max(0, previousSize + sizeDelta);
  const nextAvgCost =
    input.decision.side === "BUY"
      ? currentPosition
        ? (previousSize * currentPosition.avg_cost + executionAmount) / Math.max(nextSize, Number.EPSILON)
        : input.avgPrice
      : currentPosition?.avg_cost ?? input.avgPrice;
  const currentPrice = roundPositionMetric(input.avgPrice);
  const currentValueUsd = roundCurrency(nextSize * currentPrice);

  return {
    status: "filled",
    avgPrice: currentPrice,
    filledNotionalUsd:
      input.decision.side === "BUY"
        ? roundCurrency(executionAmount)
        : roundCurrency(executionAmount * currentPrice),
    nextPosition: nextSize <= 0
      ? null
      : {
          id: currentPosition?.id ?? input.decision.token_id,
          event_slug: currentPosition?.event_slug ?? input.decision.event_slug,
          market_slug: currentPosition?.market_slug ?? input.decision.market_slug,
          token_id: input.decision.token_id,
          side: currentPosition?.side ?? input.decision.side,
          outcome_label: currentPosition?.outcome_label ?? (input.decision.side === "BUY" ? "Yes" : "No"),
          size: roundPositionMetric(nextSize),
          avg_cost: roundPositionMetric(nextAvgCost),
          current_price: currentPrice,
          current_value_usd: currentValueUsd,
          unrealized_pnl_pct: calculatePaperPositionPnlPct(nextAvgCost, currentPrice),
          stop_loss_pct: input.decision.stop_loss_pct,
          opened_at: currentPosition?.opened_at ?? input.timestampUtc,
          updated_at: input.timestampUtc
        }
  };
}

export const roughLoopTaskStatusSchema = z.enum(["todo", "running", "blocked", "done", "cancelled"]);
export type RoughLoopTaskStatus = z.infer<typeof roughLoopTaskStatusSchema>;

export const roughLoopPrioritySchema = z.enum(["P0", "P1", "P2"]);
export type RoughLoopPriority = z.infer<typeof roughLoopPrioritySchema>;

export const roughLoopProviderSchema = z.enum(["codex", "openclaw"]);
export type RoughLoopProvider = z.infer<typeof roughLoopProviderSchema>;

export const roughLoopDocumentSectionSchema = z.enum(["queue", "running", "blocked", "done"]);
export type RoughLoopDocumentSection = z.infer<typeof roughLoopDocumentSectionSchema>;

export const roughLoopTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: roughLoopTaskStatusSchema,
  priority: roughLoopPrioritySchema,
  dependsOn: z.array(z.string()).default([]),
  allowedPaths: z.array(z.string()).default([]),
  definitionOfDone: z.array(z.string()).default([]),
  verification: z.array(z.string()).default([]),
  context: z.array(z.string()).default([]),
  latestResult: z.array(z.string()).default([]),
  attempts: z.number().int().nonnegative().default(0),
  section: roughLoopDocumentSectionSchema,
  createdOrder: z.number().int().nonnegative()
});
export type RoughLoopTask = z.infer<typeof roughLoopTaskSchema>;

export const roughLoopSelectionResultSchema = z.object({
  selectedTaskId: z.string().min(1).nullable(),
  reason: z.string().min(1),
  blockedTaskIds: z.array(z.string()).default([])
});
export type RoughLoopSelectionResult = z.infer<typeof roughLoopSelectionResultSchema>;

export const roughLoopVerificationCommandResultSchema = z.object({
  command: z.string().min(1),
  exitCode: z.number().int(),
  passed: z.boolean(),
  stdout: z.string(),
  stderr: z.string()
});
export type RoughLoopVerificationCommandResult = z.infer<typeof roughLoopVerificationCommandResultSchema>;

export const roughLoopVerificationResultSchema = z.object({
  passed: z.boolean(),
  summary: z.string().min(1),
  commandResults: z.array(roughLoopVerificationCommandResultSchema)
});
export type RoughLoopVerificationResult = z.infer<typeof roughLoopVerificationResultSchema>;

export const roughLoopRunStatusSchema = z.enum(["done", "retry", "blocked", "skipped", "failed"]);
export type RoughLoopRunStatus = z.infer<typeof roughLoopRunStatusSchema>;

export const roughLoopRunRecordSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  provider: roughLoopProviderSchema,
  status: roughLoopRunStatusSchema,
  attempt: z.number().int().positive(),
  startedAtUtc: z.string(),
  finishedAtUtc: z.string(),
  summary: z.string().min(1),
  changedFiles: z.array(z.string()),
  artifactsDir: z.string().min(1),
  verification: roughLoopVerificationResultSchema.nullable()
});
export type RoughLoopRunRecord = z.infer<typeof roughLoopRunRecordSchema>;

export const QUEUES = {
  execution: "execution-jobs"
} as const;

export const JOBS = {
  executeTrade: "execute-trade",
  syncPortfolio: "sync-portfolio",
  flattenPortfolio: "flatten-portfolio",
  cancelOpenOrders: "cancel-open-orders"
} as const;
