import type {
  PublicArtifactListItem,
  OverviewResponse,
  PublicPosition,
  PublicRunDetail,
  PublicRunSummary,
  PublicTrade
} from "@autopoly/contracts";
import { desc, eq, isNull } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "./client.js";
import {
  agentDecisions,
  agentRuns,
  artifacts,
  executionEvents,
  portfolioSnapshots,
  positions,
  riskEvents,
  systemState
} from "./schema.js";
import { asNumber } from "./helpers.js";
import {
  getConfiguredMockQueryState
} from "./mock-data.js";

export async function getOverview(): Promise<OverviewResponse> {
  if (!hasDatabaseUrl()) {
    return (await getConfiguredMockQueryState()).overview;
  }

  const db = getDb();
  const latestSnapshot = await db.query.portfolioSnapshots.findFirst({
    orderBy: (table, helpers) => helpers.desc(table.createdAt)
  });
  const latestRisk = await db.query.riskEvents.findFirst({
    orderBy: (table, helpers) => helpers.desc(table.createdAt)
  });
  const latestRun = await db.query.agentRuns.findFirst({
    orderBy: (table, helpers) => helpers.desc(table.generatedAtUtc)
  });
  const state = await db.query.systemState.findFirst({
    where: eq(systemState.key, "status")
  });
  const curveRows = await db
    .select()
    .from(portfolioSnapshots)
    .orderBy(desc(portfolioSnapshots.createdAt))
    .limit(24);

  if (!latestSnapshot) {
    return (await getConfiguredMockQueryState()).overview;
  }

  return {
    status: (state?.value as { status?: OverviewResponse["status"] } | undefined)?.status ?? "running",
    cash_balance_usd: asNumber(latestSnapshot.cashBalanceUsd),
    total_equity_usd: asNumber(latestSnapshot.totalEquityUsd),
    high_water_mark_usd: asNumber(latestSnapshot.highWaterMarkUsd),
    drawdown_pct: asNumber(latestSnapshot.drawdownPct),
    open_positions: latestSnapshot.openPositions,
    last_run_at: latestRun?.generatedAtUtc?.toISOString() ?? null,
    latest_risk_event: latestRisk?.message ?? null,
    equity_curve: curveRows.reverse().map((row) => ({
      timestamp: row.createdAt.toISOString(),
      total_equity_usd: asNumber(row.totalEquityUsd),
      drawdown_pct: asNumber(row.drawdownPct)
    }))
  };
}

export async function getPublicPositions(): Promise<PublicPosition[]> {
  if (!hasDatabaseUrl()) {
    return (await getConfiguredMockQueryState()).positions;
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(positions)
    .where(isNull(positions.closedAt))
    .orderBy(desc(positions.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    event_slug: row.eventSlug,
    market_slug: row.marketSlug,
    token_id: row.tokenId,
    side: row.side as PublicPosition["side"],
    outcome_label: row.outcomeLabel,
    size: asNumber(row.size),
    avg_cost: asNumber(row.avgCost),
    current_price: asNumber(row.currentPrice),
    current_value_usd: asNumber(row.currentValueUsd),
    unrealized_pnl_pct: asNumber(row.unrealizedPnlPct),
    stop_loss_pct: asNumber(row.stopLossPct),
    opened_at: row.openedAt.toISOString(),
    updated_at: row.updatedAt.toISOString()
  }));
}

export async function getPublicTrades(): Promise<PublicTrade[]> {
  if (!hasDatabaseUrl()) {
    return (await getConfiguredMockQueryState()).trades;
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(executionEvents)
    .orderBy(desc(executionEvents.timestampUtc))
    .limit(100);

  return rows.map((row) => ({
    id: row.id,
    market_slug: row.marketSlug,
    token_id: row.tokenId,
    status: row.status,
    side: row.side as PublicTrade["side"],
    requested_notional_usd: asNumber(row.requestedNotionalUsd),
    filled_notional_usd: asNumber(row.filledNotionalUsd),
    avg_price: row.avgPrice == null ? null : asNumber(row.avgPrice),
    order_id: row.orderId,
    timestamp_utc: row.timestampUtc.toISOString()
  }));
}

export async function getPublicRuns(): Promise<PublicRunSummary[]> {
  if (!hasDatabaseUrl()) {
    return (await getConfiguredMockQueryState()).runs;
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(agentRuns)
    .orderBy(desc(agentRuns.generatedAtUtc))
    .limit(50);

  return Promise.all(
    rows.map(async (row) => {
      const decisionRows = await db
        .select()
        .from(agentDecisions)
        .where(eq(agentDecisions.runId, row.id));

      return {
        id: row.id,
        mode: row.mode as PublicRunSummary["mode"],
        runtime: row.runtime,
        status: row.status,
        bankroll_usd: asNumber(row.bankrollUsd),
        decision_count: decisionRows.length,
        generated_at_utc: row.generatedAtUtc.toISOString()
      };
    })
  );
}

export async function getPublicRunDetail(runId: string): Promise<PublicRunDetail | null> {
  if (!hasDatabaseUrl()) {
    const state = await getConfiguredMockQueryState();
    return state.runDetails[runId] ?? null;
  }

  const db = getDb();
  const run = await db.query.agentRuns.findFirst({
    where: eq(agentRuns.id, runId)
  });

  if (!run) {
    return null;
  }

  const decisions = await db.query.agentDecisions.findMany({
    where: eq(agentDecisions.runId, runId),
    orderBy: (table, helpers) => helpers.desc(table.createdAt)
  });
  const artifactRows = await db.query.artifacts.findMany({
    where: eq(artifacts.runId, runId),
    orderBy: (table, helpers) => helpers.desc(table.publishedAtUtc)
  });

  return {
    id: run.id,
    mode: run.mode as PublicRunDetail["mode"],
    runtime: run.runtime,
    status: run.status,
    bankroll_usd: asNumber(run.bankrollUsd),
    decision_count: decisions.length,
    generated_at_utc: run.generatedAtUtc.toISOString(),
    prompt_summary: run.promptSummary,
    reasoning_md: run.reasoningMd,
    logs_md: run.logsMd,
    decisions: decisions.map((row) => ({
      action: row.action as PublicRunDetail["decisions"][number]["action"],
      event_slug: row.eventSlug,
      market_slug: row.marketSlug,
      token_id: row.tokenId,
      side: row.side as PublicRunDetail["decisions"][number]["side"],
      notional_usd: asNumber(row.notionalUsd),
      order_type: "FOK",
      ai_prob: asNumber(row.aiProb),
      market_prob: asNumber(row.marketProb),
      edge: asNumber(row.edge),
      confidence: row.confidence as PublicRunDetail["decisions"][number]["confidence"],
      thesis_md: row.thesisMd,
      sources: row.sources as PublicRunDetail["decisions"][number]["sources"],
      stop_loss_pct: asNumber(row.stopLossPct),
      resolution_track_required: row.resolutionTrackRequired
    })),
    artifacts: artifactRows.map((row) => ({
      kind: row.kind as PublicRunDetail["artifacts"][number]["kind"],
      title: row.title,
      path: row.path,
      content: row.content ?? undefined,
      published_at_utc: row.publishedAtUtc.toISOString()
    }))
  };
}

export async function getReports(): Promise<PublicArtifactListItem[]> {
  if (!hasDatabaseUrl()) {
    return (await getConfiguredMockQueryState()).reports;
  }

  const db = getDb();
  const rows = await db
    .select({
      id: artifacts.id,
      title: artifacts.title,
      kind: artifacts.kind,
      path: artifacts.path,
      published_at_utc: artifacts.publishedAtUtc
    })
    .from(artifacts)
    .orderBy(desc(artifacts.publishedAtUtc))
    .limit(100);

  return rows.map((row) => ({
    ...row,
    kind: row.kind as PublicArtifactListItem["kind"],
    published_at_utc: row.published_at_utc.toISOString()
  }));
}

export async function getBacktests(): Promise<PublicArtifactListItem[]> {
  if (!hasDatabaseUrl()) {
    return (await getConfiguredMockQueryState()).backtests;
  }

  const db = getDb();
  const rows = await db
    .select({
      id: artifacts.id,
      title: artifacts.title,
      kind: artifacts.kind,
      path: artifacts.path,
      published_at_utc: artifacts.publishedAtUtc
    })
    .from(artifacts)
    .where(eq(artifacts.kind, "backtest-report"))
    .orderBy(desc(artifacts.publishedAtUtc))
    .limit(30);

  return rows.map((row) => ({
    ...row,
    kind: row.kind as PublicArtifactListItem["kind"],
    published_at_utc: row.published_at_utc.toISOString()
  }));
}
