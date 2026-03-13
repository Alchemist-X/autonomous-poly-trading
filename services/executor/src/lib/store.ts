import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  executionEvents,
  getDb,
  portfolioSnapshots,
  positions,
  riskEvents,
  systemState
} from "@autopoly/db";

export async function getStatus(): Promise<"running" | "paused" | "halted"> {
  const db = getDb();
  const row = await db.query.systemState.findFirst({
    where: eq(systemState.key, "status")
  });

  return (row?.value as { status?: "running" | "paused" | "halted" } | undefined)?.status ?? "running";
}

export async function markStatus(status: "running" | "paused" | "halted", message: string) {
  const db = getDb();
  await db.insert(systemState).values({
    key: "status",
    value: { status }
  }).onConflictDoUpdate({
    target: systemState.key,
    set: {
      value: { status },
      updatedAt: new Date()
    }
  });

  await db.insert(riskEvents).values({
    id: randomUUID(),
    eventType: "executor-status",
    severity: status === "halted" ? "critical" : "info",
    message,
    metadata: { status }
  });
}

export async function findOpenPosition(tokenId: string) {
  const db = getDb();
  return db.query.positions.findFirst({
    where: and(eq(positions.tokenId, tokenId), isNull(positions.closedAt))
  });
}

export async function upsertPosition(row: {
  eventSlug: string;
  marketSlug: string;
  tokenId: string;
  side: "BUY" | "SELL";
  outcomeLabel: string;
  size: number;
  avgCost: number;
  currentPrice: number;
  currentValueUsd: number;
  unrealizedPnlPct: number;
  stopLossPct: number;
}) {
  const db = getDb();
  const existing = await findOpenPosition(row.tokenId);

  if (!existing) {
    await db.insert(positions).values({
      id: randomUUID(),
      eventSlug: row.eventSlug,
      marketSlug: row.marketSlug,
      tokenId: row.tokenId,
      side: row.side,
      outcomeLabel: row.outcomeLabel,
      size: String(row.size),
      avgCost: String(row.avgCost),
      currentPrice: String(row.currentPrice),
      currentValueUsd: String(row.currentValueUsd),
      unrealizedPnlPct: String(row.unrealizedPnlPct),
      stopLossPct: String(row.stopLossPct),
      openedAt: new Date(),
      updatedAt: new Date()
    });
    return;
  }

  await db.update(positions).set({
    size: String(row.size),
    avgCost: String(row.avgCost),
    currentPrice: String(row.currentPrice),
    currentValueUsd: String(row.currentValueUsd),
    unrealizedPnlPct: String(row.unrealizedPnlPct),
    stopLossPct: String(row.stopLossPct),
    updatedAt: new Date(),
    closedAt: row.size <= 0 ? new Date() : null
  }).where(eq(positions.id, existing.id));
}

export async function recordExecutionEvent(event: {
  runId?: string | null;
  decisionId?: string | null;
  marketSlug: string;
  tokenId: string;
  side: "BUY" | "SELL";
  status: string;
  requestedNotionalUsd: number;
  filledNotionalUsd: number;
  avgPrice: number | null;
  orderId?: string | null;
  rawResponse?: unknown;
}) {
  const db = getDb();
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId: event.runId ?? null,
    decisionId: event.decisionId ?? null,
    marketSlug: event.marketSlug,
    tokenId: event.tokenId,
    side: event.side,
    status: event.status,
    requestedNotionalUsd: String(event.requestedNotionalUsd),
    filledNotionalUsd: String(event.filledNotionalUsd),
    avgPrice: event.avgPrice == null ? null : String(event.avgPrice),
    orderId: event.orderId ?? null,
    rawResponse: event.rawResponse ?? null
  });
}

export async function latestSnapshot() {
  const db = getDb();
  return db.query.portfolioSnapshots.findFirst({
    orderBy: (table, helpers) => helpers.desc(table.createdAt)
  });
}

export async function writeSnapshot(input: {
  cashBalanceUsd: number;
  totalEquityUsd: number;
  highWaterMarkUsd: number;
  drawdownPct: number;
  openPositions: number;
  halted: boolean;
}) {
  const db = getDb();
  await db.insert(portfolioSnapshots).values({
    id: randomUUID(),
    cashBalanceUsd: String(input.cashBalanceUsd),
    totalEquityUsd: String(input.totalEquityUsd),
    highWaterMarkUsd: String(input.highWaterMarkUsd),
    drawdownPct: String(input.drawdownPct),
    openPositions: input.openPositions,
    halted: input.halted
  });
}

export async function currentOpenExposureUsd(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${positions.currentValueUsd}), 0)`
    })
    .from(positions)
    .where(isNull(positions.closedAt));
  return Number(row?.total ?? 0);
}

