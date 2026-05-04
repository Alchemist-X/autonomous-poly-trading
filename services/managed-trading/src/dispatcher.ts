// ManagedTradingDispatcher — paper-mode multi-user fan-out.
//
// Phase 2 scope: take pre-sized `ProposedDecision[]` (produced upstream
// by the orchestrator's pulse engine), apply per-user risk caps, and
// persist the resulting kept + skipped decisions to the `managed_*`
// tables. NO real trading: no CLOB calls, no SDK signing, no
// orchestrator coupling. Phase 3 swaps this out for the live path.
//
// The class takes `db` + `adapter` via constructor DI so tests can
// inject mocks without spinning up Postgres or wiring a real
// PolymarketAdapter.

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  managedDecisions,
  managedPaperRuns,
  managedUsers,
  type schemaModule
} from "./db-schema-adapter.js";
import type { Db } from "./db-schema-adapter.js";
import { applyCaps, getRiskCapsForTier, type RiskCaps } from "./risk-manager.js";
import type {
  Address,
  PolymarketAdapter
} from "./polymarket-adapter.js";
import type {
  AppliedDecision,
  ManagedUser,
  ProposedDecision,
  RiskTier,
  RunResult,
  SkippedDecision
} from "./types.js";

// Polymarket convention: user "safe address" stored as `0x…` checksum
// hex string. Validates the column shape so adapter calls are typed.
function asAddress(value: string): Address {
  return value.toLowerCase() as Address;
}

// `managedUsers.riskTier` is varchar(16). DB-side default is `'balanced'`,
// but we narrow to the RiskTier union here defensively in case a row
// exists with an unexpected value.
function normalizeTier(raw: string): RiskTier {
  switch (raw) {
    case "conservative":
    case "balanced":
    case "aggressive":
      return raw;
    default:
      return "balanced";
  }
}

export interface ManagedTradingDispatcherOptions {
  readonly db: Db;
  readonly adapter: PolymarketAdapter;
  // Optional clock injection for deterministic tests.
  readonly now?: () => Date;
}

export class ManagedTradingDispatcher {
  readonly db: Db;
  readonly adapter: PolymarketAdapter;
  private readonly now: () => Date;

  constructor(options: ManagedTradingDispatcherOptions) {
    this.db = options.db;
    this.adapter = options.adapter;
    this.now = options.now ?? (() => new Date());
  }

  // Run paper-mode dispatcher for one user. Returns a RunResult so the
  // caller can aggregate outcomes across the fan-out without throwing.
  //
  // TODO(phase 3): swap the persist-only flow for real CLOB submission
  // via `adapter.placeOrder` once session signer + spending caps are
  // wired. This method's signature should remain stable; only the
  // execution side needs to change.
  async runPaperPulse(
    userId: string,
    proposedDecisions: ReadonlyArray<ProposedDecision>
  ): Promise<RunResult> {
    const user = await this.loadUser(userId);
    if (!user) {
      return {
        userId,
        runId: null,
        status: "skipped",
        bankrollUsd: null,
        keptCount: 0,
        skippedCount: 0,
        skippedReason: "user_not_found"
      };
    }

    if (user.aiAutoTradeEnabled !== true || user.sessionSignerRevokedAt != null) {
      return {
        userId,
        runId: null,
        status: "skipped",
        bankrollUsd: null,
        keptCount: 0,
        skippedCount: 0,
        skippedReason: "ai_auto_trade_disabled"
      };
    }

    if (!user.safeAddress) {
      return {
        userId,
        runId: null,
        status: "skipped",
        bankrollUsd: null,
        keptCount: 0,
        skippedCount: 0,
        skippedReason: "safe_not_deployed"
      };
    }

    let bankrollUsd = 0;
    try {
      const balance = await this.adapter.getBalance(asAddress(user.safeAddress));
      bankrollUsd = Number.parseFloat(balance.usdcFormatted);
      if (!Number.isFinite(bankrollUsd)) {
        bankrollUsd = 0;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[managed-trading] adapter.getBalance failed for user ${userId}: ${message}`);
      return {
        userId,
        runId: null,
        status: "failed",
        bankrollUsd: null,
        keptCount: 0,
        skippedCount: 0,
        errorMessage: `getBalance failed: ${message}`
      };
    }

    if (bankrollUsd <= 0) {
      return {
        userId,
        runId: null,
        status: "skipped",
        bankrollUsd: 0,
        keptCount: 0,
        skippedCount: 0,
        skippedReason: "empty_safe"
      };
    }

    const tier = normalizeTier(user.riskTier);
    const caps = getRiskCapsForTier(tier);
    const { kept, skipped } = applyCaps(proposedDecisions, caps, bankrollUsd);

    const startedAt = this.now();
    const runId = randomUUID();

    try {
      await this.db.insert(managedPaperRuns).values({
        id: runId,
        userId,
        mode: "paper",
        status: "pending",
        bankrollUsd: bankrollUsd.toFixed(2),
        decisionCount: 0,
        startedAtUtc: startedAt
      });

      await this.persistDecisions({
        runId,
        userId,
        tier,
        caps,
        kept,
        skipped
      });

      const completedAt = this.now();
      await this.db
        .update(managedPaperRuns)
        .set({
          status: "completed",
          decisionCount: kept.length + skipped.length,
          completedAtUtc: completedAt
        })
        .where(eq(managedPaperRuns.id, runId));

      return {
        userId,
        runId,
        status: "completed",
        bankrollUsd,
        keptCount: kept.length,
        skippedCount: skipped.length
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[managed-trading] persist failed for user ${userId} run ${runId}: ${message}`);
      // Best-effort flip to failed; if this also throws we let the outer
      // caller handle it via the returned status.
      try {
        await this.db
          .update(managedPaperRuns)
          .set({
            status: "failed",
            completedAtUtc: this.now(),
            errorMessage: message
          })
          .where(eq(managedPaperRuns.id, runId));
      } catch {
        // swallow — we already have an error to report
      }
      return {
        userId,
        runId,
        status: "failed",
        bankrollUsd,
        keptCount: 0,
        skippedCount: 0,
        errorMessage: message
      };
    }
  }

  // Fan-out for the daily-pulse cron. Sequential per-user execution —
  // parallelism is a Phase 3 concern (needs adapter rate-limit + DB
  // connection-pool sizing). Errors on one user do NOT stop the loop;
  // they get reported in the per-user RunResult.
  //
  // TODO(phase 3): caller is responsible for producing
  // `proposedDecisions`; the orchestrator's `buildExecutionPlan` is the
  // expected source. Wire the orchestrator → dispatcher integration in
  // Phase 3 once the live path is ready.
  async runPaperPulseForAllAuthorizedUsers(
    proposedDecisions: ReadonlyArray<ProposedDecision>
  ): Promise<RunResult[]> {
    const authorized = await this.db
      .select()
      .from(managedUsers)
      .where(
        and(
          eq(managedUsers.aiAutoTradeEnabled, true),
          isNull(managedUsers.sessionSignerRevokedAt)
        )
      );

    const results: RunResult[] = [];
    for (const user of authorized as ManagedUser[]) {
      try {
        const result = await this.runPaperPulse(user.id, proposedDecisions);
        results.push(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[managed-trading] runPaperPulse threw for user ${user.id}: ${message}`);
        results.push({
          userId: user.id,
          runId: null,
          status: "failed",
          bankrollUsd: null,
          keptCount: 0,
          skippedCount: 0,
          errorMessage: message
        });
      }
    }
    return results;
  }

  private async loadUser(userId: string): Promise<ManagedUser | null> {
    const rows = await this.db
      .select()
      .from(managedUsers)
      .where(eq(managedUsers.id, userId))
      .limit(1);
    return (rows[0] as ManagedUser | undefined) ?? null;
  }

  private async persistDecisions(input: {
    runId: string;
    userId: string;
    tier: RiskTier;
    caps: RiskCaps;
    kept: ReadonlyArray<AppliedDecision>;
    skipped: ReadonlyArray<SkippedDecision>;
  }): Promise<void> {
    const capsJson = {
      perPositionPct: input.caps.perPositionPct,
      totalExposurePct: input.caps.totalExposurePct,
      perEventPct: input.caps.perEventPct,
      maxPositions: input.caps.maxPositions,
      minNotionalUsd: input.caps.minNotionalUsd
    };

    const rows: Array<typeof managedDecisions.$inferInsert> = [];

    for (const decision of input.kept) {
      rows.push({
        id: randomUUID(),
        runId: input.runId,
        userId: input.userId,
        action: decision.action,
        eventSlug: decision.eventSlug,
        marketSlug: decision.marketSlug,
        tokenId: decision.tokenId,
        side: decision.side,
        notionalUsd: decision.notionalUsd.toFixed(2),
        bankrollRatio: decision.bankrollRatio.toFixed(6),
        aiProb: decision.aiProb.toFixed(6),
        marketProb: decision.marketProb.toFixed(6),
        edge: decision.edge.toFixed(6),
        confidence: decision.confidence,
        thesisMd: decision.thesisMd,
        riskTierAtDecision: input.tier,
        riskCapsApplied: capsJson,
        skippedReason: null
      });
    }

    for (const decision of input.skipped) {
      rows.push({
        id: randomUUID(),
        runId: input.runId,
        userId: input.userId,
        action: "skipped",
        eventSlug: decision.eventSlug,
        marketSlug: decision.marketSlug,
        tokenId: decision.tokenId,
        side: decision.side,
        notionalUsd: decision.notionalUsd.toFixed(2),
        bankrollRatio: "0.000000",
        aiProb: decision.aiProb.toFixed(6),
        marketProb: decision.marketProb.toFixed(6),
        edge: decision.edge.toFixed(6),
        confidence: decision.confidence,
        thesisMd: decision.thesisMd,
        riskTierAtDecision: input.tier,
        riskCapsApplied: capsJson,
        skippedReason: decision.skippedReason
      });
    }

    if (rows.length > 0) {
      await this.db.insert(managedDecisions).values(rows);
    }
  }
}

// Re-export schema module so consumers don't need a direct @autopoly/db
// import for the dispatcher tables. (Helps the public surface stay
// self-contained.)
export type { schemaModule };
