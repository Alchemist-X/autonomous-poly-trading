import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { JOBS, inferPaperSellAmount, type TradeDecision } from "@autopoly/contracts";
import { executionEvents, getDb, positions } from "@autopoly/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { ExecutorConfig } from "../config.js";
import { executeMarketOrder, fetchRemotePositions, readBook, computeAvgCost } from "../lib/polymarket.js";
import { calculatePositionPnlPct, shouldTriggerStopLoss } from "../lib/risk.js";
import {
  currentOpenExposureUsd,
  findOpenPosition,
  getStatus,
  markStatus,
  recordExecutionEvent,
  upsertPosition,
  writeSnapshot,
  latestSnapshot
} from "../lib/store.js";

function inferSellAmount(position: Awaited<ReturnType<typeof findOpenPosition>>, decision: TradeDecision): number {
  return inferPaperSellAmount(
    position
      ? {
          id: position.id,
          event_slug: position.eventSlug,
          market_slug: position.marketSlug,
          token_id: position.tokenId,
          side: position.side as "BUY" | "SELL",
          outcome_label: position.outcomeLabel,
          size: Number(position.size),
          avg_cost: Number(position.avgCost),
          current_price: Number(position.currentPrice),
          current_value_usd: Number(position.currentValueUsd),
          unrealized_pnl_pct: Number(position.unrealizedPnlPct),
          stop_loss_pct: Number(position.stopLossPct),
          opened_at: position.openedAt.toISOString(),
          updated_at: position.updatedAt.toISOString()
        }
      : null,
    decision
  );
}

async function handleTradeJob(job: Job, config: ExecutorConfig) {
  const status = await getStatus();
  const decision = job.data.decision as TradeDecision;
  if (status === "halted" && decision.action === "open") {
    await recordExecutionEvent({
      runId: job.data.runId,
      decisionId: job.data.decisionId,
      marketSlug: decision.market_slug,
      tokenId: decision.token_id,
      side: decision.side,
      status: "drawdown_halt",
      requestedNotionalUsd: decision.notional_usd,
      filledNotionalUsd: 0,
      avgPrice: null,
      rawResponse: { rejected: true, reason: "system halted" }
    });
    return;
  }

  const position = await findOpenPosition(decision.token_id);
  const amount =
    decision.side === "BUY"
      ? decision.notional_usd
      : inferSellAmount(position, decision);

  const result = await executeMarketOrder(config, {
    tokenId: decision.token_id,
    side: decision.side,
    amount
  });

  const avgPrice = result.avgPrice ?? 0.5;
  const sizeDelta = decision.side === "BUY" ? amount / avgPrice : -amount;
  const previousSize = position ? Number(position.size) : 0;
  const nextSize = Math.max(0, previousSize + sizeDelta);
  const nextAvgCost =
    decision.side === "BUY"
      ? position
        ? (previousSize * Number(position.avgCost) + amount) / Math.max(nextSize, 1)
        : avgPrice
      : position
        ? Number(position.avgCost)
        : avgPrice;
  const currentValueUsd = nextSize * avgPrice;
  const currentPrice = avgPrice;
  const pnlPct = calculatePositionPnlPct(nextAvgCost, currentPrice);

  await upsertPosition({
    eventSlug: decision.event_slug,
    marketSlug: decision.market_slug,
    tokenId: decision.token_id,
    side: decision.side,
    outcomeLabel: decision.side === "BUY" ? "Yes" : "No",
    size: nextSize,
    avgCost: nextAvgCost,
    currentPrice,
    currentValueUsd,
    unrealizedPnlPct: pnlPct,
    stopLossPct: decision.stop_loss_pct
  });

  await recordExecutionEvent({
    runId: job.data.runId,
    decisionId: job.data.decisionId,
    marketSlug: decision.market_slug,
    tokenId: decision.token_id,
    side: decision.side,
    status: result.ok ? "filled" : "rejected",
    requestedNotionalUsd: decision.notional_usd,
    filledNotionalUsd: result.filledNotionalUsd,
    avgPrice: result.avgPrice,
    orderId: result.orderId,
    rawResponse: result.rawResponse
  });
}

async function handleSyncJob(config: ExecutorConfig) {
  const latest = await latestSnapshot();
  const remotePositions = await fetchRemotePositions(config).catch(() => []);
  const db = getDb();
  const localPositions = await db.query.positions.findMany({
    where: isNull(positions.closedAt)
  });

  const remoteByToken = new Map(remotePositions.map((position) => [position.tokenId, position]));
  for (const remote of remotePositions) {
    const avgCost = (await computeAvgCost(config, remote.tokenId)) ?? 0.5;
    const book = await readBook(config, remote.tokenId);
    const currentPrice = book?.bestBid ?? avgCost;
    const pnlPct = calculatePositionPnlPct(avgCost, currentPrice);

    await upsertPosition({
      eventSlug: remote.eventSlug ?? remote.title?.toLowerCase().replaceAll(/\s+/g, "-") ?? remote.tokenId,
      marketSlug: remote.marketSlug ?? remote.eventSlug ?? remote.tokenId,
      tokenId: remote.tokenId,
      side: "BUY",
      outcomeLabel: remote.outcome || "Unknown",
      size: remote.size,
      avgCost,
      currentPrice,
      currentValueUsd: remote.size * currentPrice,
      unrealizedPnlPct: pnlPct,
      stopLossPct: config.positionStopLossPct
    });

    if (shouldTriggerStopLoss(avgCost, currentPrice, config.positionStopLossPct)) {
      await executeMarketOrder(config, {
        tokenId: remote.tokenId,
        side: "SELL",
        amount: remote.size
      });
      await recordExecutionEvent({
        marketSlug: remote.marketSlug ?? remote.eventSlug ?? remote.tokenId,
        tokenId: remote.tokenId,
        side: "SELL",
        status: "stop_loss_triggered",
        requestedNotionalUsd: remote.size * currentPrice,
        filledNotionalUsd: remote.size * currentPrice,
        avgPrice: currentPrice,
        rawResponse: { stop_loss: true }
      });
    }
  }

  for (const local of localPositions) {
    if (!remoteByToken.has(local.tokenId)) {
      await db.update(positions).set({
        closedAt: new Date(),
        currentValueUsd: "0",
        updatedAt: new Date()
      }).where(eq(positions.id, local.id));
    }
  }

  const openPositions = await db.query.positions.findMany({
    where: isNull(positions.closedAt)
  });
  const openExposureUsd = await currentOpenExposureUsd();
  const previousCash = latest ? Number(latest.cashBalanceUsd) : config.initialBankrollUsd;
  const recentEvents = await db.query.executionEvents.findMany({
    where: latest
      ? gt(executionEvents.timestampUtc, latest.createdAt)
      : undefined
  });
  const cashDeltaUsd = recentEvents.reduce((sum, event) => {
    const filled = Number(event.filledNotionalUsd);
    if (!(filled > 0)) {
      return sum;
    }
    return event.side === "SELL" ? sum + filled : sum - filled;
  }, 0);
  const cashBalanceUsd = Number((previousCash + cashDeltaUsd).toFixed(2));
  const totalEquityUsd = Number((cashBalanceUsd + openExposureUsd).toFixed(2));
  const highWaterMarkUsd = Math.max(latest ? Number(latest.highWaterMarkUsd) : config.initialBankrollUsd, totalEquityUsd);
  const drawdownPct = highWaterMarkUsd > 0 ? Math.max(0, (highWaterMarkUsd - totalEquityUsd) / highWaterMarkUsd) : 0;
  const halted = drawdownPct >= config.drawdownStopPct;

  await writeSnapshot({
    cashBalanceUsd,
    totalEquityUsd,
    highWaterMarkUsd,
    drawdownPct,
    openPositions: openPositions.length,
    halted
  });

  if (halted) {
    await markStatus("halted", `Portfolio drawdown reached ${(drawdownPct * 100).toFixed(2)}%.`);
  }
}

async function handleFlattenJob(config: ExecutorConfig) {
  const db = getDb();
  const openPositions = await db.query.positions.findMany({
    where: isNull(positions.closedAt)
  });

  for (const position of openPositions) {
    const book = await readBook(config, position.tokenId);
    const price = book?.bestBid ?? Number(position.currentPrice);
    await executeMarketOrder(config, {
      tokenId: position.tokenId,
      side: "SELL",
      amount: Number(position.size)
    });
    await db.update(positions).set({
      currentPrice: String(price),
      currentValueUsd: "0",
      size: "0",
      closedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(positions.id, position.id));
    await recordExecutionEvent({
      marketSlug: position.marketSlug,
      tokenId: position.tokenId,
      side: "SELL",
      status: "manual_flatten",
      requestedNotionalUsd: Number(position.currentValueUsd),
      filledNotionalUsd: Number(position.currentValueUsd),
      avgPrice: price
    });
  }
}

export function createQueueWorker(config: ExecutorConfig, connection: { host?: string } | any) {
  return new Worker(
    "execution-jobs",
    async (job) => {
      switch (job.name) {
        case JOBS.executeTrade:
          await handleTradeJob(job, config);
          break;
        case JOBS.syncPortfolio:
          await handleSyncJob(config);
          break;
        case JOBS.flattenPortfolio:
          await handleFlattenJob(config);
          break;
        case JOBS.cancelOpenOrders:
          await recordExecutionEvent({
            marketSlug: "system",
            tokenId: "system",
            side: "SELL",
            status: "canceled",
            requestedNotionalUsd: 0,
            filledNotionalUsd: 0,
            avgPrice: null,
            rawResponse: {
              note: "No open orders are expected because v1 uses FOK only."
            }
          });
          break;
        default:
          throw new Error(`Unhandled job: ${job.name}`);
      }
    },
    { connection }
  );
}
