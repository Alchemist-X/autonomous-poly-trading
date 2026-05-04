// ManagedTradingDispatcher — multi-user daily-pulse orchestrator.
//
// Phase 3 will wire this into the existing daily-pulse pipeline. For now
// the class is a typed skeleton so consumers can compile against it; the
// methods throw when invoked.

import type { PolymarketAdapter } from "./polymarket-adapter.js";
import type { ExecutionResult, RiskParams, RiskTier } from "./types.js";

// Maps risk tiers to per-user execution caps. Phase 3 will load these
// from config + scale by user bankroll.
export const DEFAULT_RISK_PARAMS: Record<RiskTier, RiskParams> = {
  conservative: {
    maxSinglePositionPct: 0.05,
    maxTotalExposurePct: 0.5,
    maxPerEventPct: 0.15,
    maxOpenPositions: 10,
    minOrderUsd: 5
  },
  balanced: {
    maxSinglePositionPct: 0.1,
    maxTotalExposurePct: 0.7,
    maxPerEventPct: 0.25,
    maxOpenPositions: 16,
    minOrderUsd: 5
  },
  aggressive: {
    maxSinglePositionPct: 0.15,
    maxTotalExposurePct: 0.8,
    maxPerEventPct: 0.3,
    maxOpenPositions: 22,
    minOrderUsd: 5
  }
};

export type ManagedTradingDispatcherOptions = {
  adapter: PolymarketAdapter;
};

export class ManagedTradingDispatcher {
  readonly adapter: PolymarketAdapter;

  constructor(options: ManagedTradingDispatcherOptions) {
    this.adapter = options.adapter;
  }

  // Run daily Pulse for one managed user — fetch user state, scale
  // pulse decisions by risk tier, send orders through the adapter.
  // Phase 3 implementation: pull `daily-pulse` decision deck, filter
  // per user, place orders.
  async runDailyPulse(_userId: string): Promise<ExecutionResult[]> {
    throw new Error("ManagedTradingDispatcher.runDailyPulse: not implemented yet");
  }

  // Resolve risk envelope for a user — combines DB-stored RiskTier with
  // current bankroll. Phase 3 implementation will read from
  // `managedUsers.riskTier` + on-chain Safe balance.
  async getUserRiskParams(_userId: string): Promise<RiskParams> {
    throw new Error("ManagedTradingDispatcher.getUserRiskParams: not implemented yet");
  }
}
