import { randomUUID } from "node:crypto";
import { getDb, portfolioSnapshots, riskEvents, systemState } from "@autopoly/db";
import { eq } from "drizzle-orm";

export async function getSystemStatus(): Promise<"running" | "paused" | "halted"> {
  const db = getDb();
  const row = await db.query.systemState.findFirst({
    where: eq(systemState.key, "status")
  });

  return (row?.value as { status?: "running" | "paused" | "halted" } | undefined)?.status ?? "running";
}

export async function setSystemStatus(status: "running" | "paused" | "halted", message: string) {
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
    eventType: "system-status",
    severity: status === "running" ? "info" : "warning",
    message,
    metadata: { status }
  });
}

export async function getLatestPortfolioSnapshot() {
  const db = getDb();
  return db.query.portfolioSnapshots.findFirst({
    orderBy: (table, helpers) => helpers.desc(table.createdAt)
  });
}

export async function writePortfolioSnapshot(snapshot: {
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
    cashBalanceUsd: String(snapshot.cashBalanceUsd),
    totalEquityUsd: String(snapshot.totalEquityUsd),
    highWaterMarkUsd: String(snapshot.highWaterMarkUsd),
    drawdownPct: String(snapshot.drawdownPct),
    openPositions: snapshot.openPositions,
    halted: snapshot.halted
  });
}

