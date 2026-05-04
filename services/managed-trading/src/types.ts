// Shared types for the managed-trading service.
//
// `ManagedUser` mirrors the row shape from `@autopoly/db` `managedUsers`
// table — re-exported here so callers don't have to know about Drizzle.
// Phase 3 will fill in the real trading flow that consumes these types.

import type { InferSelectModel } from "drizzle-orm";
import type { managedUsers } from "@autopoly/db";

export type ManagedUser = InferSelectModel<typeof managedUsers>;

export type RiskTier = "conservative" | "balanced" | "aggressive";

// Per-user risk envelope — derived from RiskTier + bankroll. Mirrors
// services/executor caps but scaled per user.
export type RiskParams = {
  maxSinglePositionPct: number;
  maxTotalExposurePct: number;
  maxPerEventPct: number;
  maxOpenPositions: number;
  minOrderUsd: number;
};

export type TradingDecisionAction = "open" | "increase" | "reduce" | "close" | "hold";

export type TradingDecision = {
  userId: string;
  action: TradingDecisionAction;
  marketSlug: string;
  tokenId: string;
  side: "yes" | "no";
  notionalUsd: string;
  aiProb: number;
  marketProb: number;
  edge: number;
  thesisMd: string;
};

export type ExecutionStatus = "filled" | "partial" | "rejected" | "skipped" | "error";

export type ExecutionResult = {
  decisionId: string;
  userId: string;
  status: ExecutionStatus;
  orderId: string | null;
  filledNotionalUsd: string;
  avgPrice: number | null;
  errorMessage?: string;
};

// ---------------------------------------------------------------------------
// Phase 2 paper-mode dispatcher input/output shapes
// ---------------------------------------------------------------------------

// Mirrors `PlannedExecution` from services/orchestrator (kept duplicated
// here so this package does not import the orchestrator).
export type ProposedDecisionAction = "open" | "hold" | "close" | "reduce";

export type ProposedDecisionSide = "BUY" | "SELL";

export type ProposedDecisionConfidence = "low" | "medium" | "high";

export interface ProposedDecision {
  readonly action: ProposedDecisionAction;
  readonly eventSlug: string;
  readonly marketSlug: string;
  readonly tokenId: string;
  readonly side: ProposedDecisionSide;
  // Pre-cap notional (USD) — what the upstream Pulse engine sized
  // before per-user risk caps were applied.
  readonly notionalUsd: number;
  readonly aiProb: number;
  readonly marketProb: number;
  readonly edge: number;
  readonly confidence: ProposedDecisionConfidence;
  readonly thesisMd: string;
}

// Decision after per-user caps applied. `notionalUsd` is what the
// dispatcher would trade in live mode; `bankrollRatio` is informational.
export interface AppliedDecision extends ProposedDecision {
  readonly bankrollRatio: number;
}

// Decision dropped by per-user caps. Carries a human-readable reason.
export interface SkippedDecision extends ProposedDecision {
  readonly skippedReason: string;
}

// One run of the dispatcher for one user.
export type RunStatus = "pending" | "completed" | "failed" | "skipped";

export interface RunInput {
  readonly userId: string;
  readonly proposedDecisions: ReadonlyArray<ProposedDecision>;
}

export interface RunResult {
  readonly userId: string;
  readonly runId: string | null;
  readonly status: RunStatus;
  readonly bankrollUsd: number | null;
  readonly keptCount: number;
  readonly skippedCount: number;
  readonly errorMessage?: string;
  readonly skippedReason?: string;
}
