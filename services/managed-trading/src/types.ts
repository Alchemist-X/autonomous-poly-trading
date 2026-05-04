// Shared types for the managed-trading service.
//
// `ManagedUser` mirrors the row shape from `@autopoly/db` `managedUsers`
// table — re-exported here so callers don't have to know about Drizzle.
// Phase 3 will fill in the trading flow that consumes these types.

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
