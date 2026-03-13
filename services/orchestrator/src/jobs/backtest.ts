import { randomUUID } from "node:crypto";
import { artifacts, getDb, getPublicPositions } from "@autopoly/db";

export async function runBacktestJob() {
  const db = getDb();
  const positions = await getPublicPositions();
  const avgPnl =
    positions.length === 0
      ? 0
      : positions.reduce((sum, position) => sum + position.unrealized_pnl_pct, 0) / positions.length;

  const timestamp = new Date().toISOString();
  const content = [
    "# Daily Backtest",
    "",
    `Generated at ${timestamp}`,
    "",
    `Open positions: ${positions.length}`,
    `Average unrealized PnL: ${(avgPnl * 100).toFixed(2)}%`
  ].join("\n");

  await db.insert(artifacts).values({
    id: randomUUID(),
    runId: null,
    kind: "backtest-report",
    title: `Backtest ${timestamp}`,
    path: `reports/backtest-${timestamp.replaceAll(":", "-")}.md`,
    content,
    publishedAtUtc: new Date(timestamp)
  });
}

