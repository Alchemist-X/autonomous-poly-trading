import { randomUUID } from "node:crypto";
import { getDb } from "./client.js";
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
import {
  mockBacktests,
  mockOverview,
  mockPositions,
  mockReports,
  mockRunDetail,
  mockTrades
} from "./mock-data.js";

async function main() {
  const db = getDb();
  const runId = mockRunDetail.id;

  await db.insert(systemState).values({
    key: "status",
    value: { status: mockOverview.status }
  }).onConflictDoUpdate({
    target: systemState.key,
    set: {
      value: { status: mockOverview.status },
      updatedAt: new Date()
    }
  });

  await db.insert(portfolioSnapshots).values({
    id: randomUUID(),
    cashBalanceUsd: String(mockOverview.cash_balance_usd),
    totalEquityUsd: String(mockOverview.total_equity_usd),
    highWaterMarkUsd: String(mockOverview.high_water_mark_usd),
    drawdownPct: String(mockOverview.drawdown_pct),
    openPositions: mockOverview.open_positions,
    halted: mockOverview.status === "halted",
    createdAt: new Date()
  });

  await db.insert(riskEvents).values({
    id: randomUUID(),
    eventType: "status",
    severity: "info",
    message: mockOverview.latest_risk_event ?? "No active risk event.",
    metadata: {}
  });

  await db.insert(agentRuns).values({
    id: runId,
    runtime: mockRunDetail.runtime,
    mode: mockRunDetail.mode,
    status: mockRunDetail.status,
    bankrollUsd: String(mockRunDetail.bankroll_usd),
    promptSummary: mockRunDetail.prompt_summary,
    reasoningMd: mockRunDetail.reasoning_md,
    logsMd: mockRunDetail.logs_md,
    generatedAtUtc: new Date(mockRunDetail.generated_at_utc)
  }).onConflictDoNothing();

  for (const decision of mockRunDetail.decisions) {
    await db.insert(agentDecisions).values({
      id: randomUUID(),
      runId,
      action: decision.action,
      eventSlug: decision.event_slug,
      marketSlug: decision.market_slug,
      tokenId: decision.token_id,
      side: decision.side,
      notionalUsd: String(decision.notional_usd),
      orderType: decision.order_type,
      aiProb: String(decision.ai_prob),
      marketProb: String(decision.market_prob),
      edge: String(decision.edge),
      confidence: decision.confidence,
      thesisMd: decision.thesis_md,
      sources: decision.sources,
      stopLossPct: String(decision.stop_loss_pct),
      resolutionTrackRequired: decision.resolution_track_required
    });
  }

  for (const position of mockPositions) {
    await db.insert(positions).values({
      id: position.id,
      eventSlug: position.event_slug,
      marketSlug: position.market_slug,
      tokenId: position.token_id,
      side: position.side,
      outcomeLabel: position.outcome_label,
      size: String(position.size),
      avgCost: String(position.avg_cost),
      currentPrice: String(position.current_price),
      currentValueUsd: String(position.current_value_usd),
      unrealizedPnlPct: String(position.unrealized_pnl_pct),
      stopLossPct: String(position.stop_loss_pct),
      openedAt: new Date(position.opened_at),
      updatedAt: new Date(position.updated_at)
    }).onConflictDoNothing();
  }

  for (const trade of mockTrades) {
    await db.insert(executionEvents).values({
      id: trade.id,
      runId,
      marketSlug: trade.market_slug,
      tokenId: trade.token_id,
      side: trade.side,
      status: trade.status,
      requestedNotionalUsd: String(trade.requested_notional_usd),
      filledNotionalUsd: String(trade.filled_notional_usd),
      avgPrice: trade.avg_price == null ? null : String(trade.avg_price),
      orderId: trade.order_id,
      rawResponse: {},
      timestampUtc: new Date(trade.timestamp_utc)
    }).onConflictDoNothing();
  }

  for (const report of [...mockRunDetail.artifacts, ...mockReports, ...mockBacktests]) {
    await db.insert(artifacts).values({
      id: "id" in report ? report.id : randomUUID(),
      runId,
      kind: report.kind,
      title: report.title,
      path: report.path,
      content: "content" in report ? report.content ?? null : null,
      publishedAtUtc: new Date(report.published_at_utc)
    }).onConflictDoNothing();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

