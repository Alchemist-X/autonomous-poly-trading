import { beforeEach, describe, expect, it, vi } from "vitest";
import { JOBS } from "@autopoly/contracts";

const mocks = vi.hoisted(() => {
  const positionFindMany = vi.fn();
  const executionEventFindMany = vi.fn();
  const dbUpdateWhere = vi.fn();
  const dbUpdateSet = vi.fn(() => ({ where: dbUpdateWhere }));
  const dbUpdate = vi.fn(() => ({ set: dbUpdateSet }));
  const getDb = vi.fn(() => ({
    query: {
      positions: {
        findMany: positionFindMany
      },
      executionEvents: {
        findMany: executionEventFindMany
      }
    },
    update: dbUpdate
  }));

  const fetchRemotePositions = vi.fn();
  const readBook = vi.fn();
  const computeAvgCost = vi.fn();
  const executeMarketOrder = vi.fn();

  const currentOpenExposureUsd = vi.fn();
  const findOpenPosition = vi.fn();
  const getStatus = vi.fn();
  const markStatus = vi.fn();
  const recordExecutionEvent = vi.fn();
  const upsertPosition = vi.fn();
  const writeSnapshot = vi.fn();
  const latestSnapshot = vi.fn();

  return {
    positionFindMany,
    executionEventFindMany,
    dbUpdateWhere,
    dbUpdateSet,
    dbUpdate,
    getDb,
    fetchRemotePositions,
    readBook,
    computeAvgCost,
    executeMarketOrder,
    currentOpenExposureUsd,
    findOpenPosition,
    getStatus,
    markStatus,
    recordExecutionEvent,
    upsertPosition,
    writeSnapshot,
    latestSnapshot,
    workerProcessor: null as ((job: { name: string; data?: Record<string, unknown> }) => Promise<void>) | null
  };
});

vi.mock("bullmq", () => ({
  Worker: class MockWorker {
    constructor(
      _queueName: string,
      processor: (job: { name: string; data?: Record<string, unknown> }) => Promise<void>
    ) {
      mocks.workerProcessor = processor;
    }
  }
}));

vi.mock("@autopoly/db", () => ({
  executionEvents: {},
  getDb: mocks.getDb,
  positions: {}
}));

vi.mock("../lib/polymarket.js", () => ({
  computeAvgCost: mocks.computeAvgCost,
  executeMarketOrder: mocks.executeMarketOrder,
  fetchRemotePositions: mocks.fetchRemotePositions,
  readBook: mocks.readBook
}));

vi.mock("../lib/store.js", () => ({
  currentOpenExposureUsd: mocks.currentOpenExposureUsd,
  findOpenPosition: mocks.findOpenPosition,
  getStatus: mocks.getStatus,
  latestSnapshot: mocks.latestSnapshot,
  markStatus: mocks.markStatus,
  recordExecutionEvent: mocks.recordExecutionEvent,
  upsertPosition: mocks.upsertPosition,
  writeSnapshot: mocks.writeSnapshot
}));

import { createQueueWorker } from "./queue-worker.js";

const baseConfig = {
  port: 4002,
  redisUrl: "redis://localhost:6379",
  envFilePath: null,
  privateKey: "test-private-key",
  funderAddress: "0x1111111111111111111111111111111111111111",
  signatureType: 2,
  polymarketHost: "https://clob.polymarket.com",
  chainId: 137,
  defaultOrderType: "FOK" as const,
  drawdownStopPct: 0.2,
  positionStopLossPct: 0.3,
  initialBankrollUsd: 1000,
  builderAttribution: null
};

describe("queue worker", () => {
  beforeEach(() => {
    mocks.workerProcessor = null;
    mocks.positionFindMany.mockReset();
    mocks.executionEventFindMany.mockReset();
    mocks.dbUpdateWhere.mockReset();
    mocks.dbUpdateSet.mockReset();
    mocks.dbUpdateSet.mockImplementation(() => ({ where: mocks.dbUpdateWhere }));
    mocks.dbUpdate.mockReset();
    mocks.dbUpdate.mockImplementation(() => ({ set: mocks.dbUpdateSet }));
    mocks.getDb.mockClear();
    mocks.fetchRemotePositions.mockReset();
    mocks.readBook.mockReset();
    mocks.computeAvgCost.mockReset();
    mocks.executeMarketOrder.mockReset();
    mocks.currentOpenExposureUsd.mockReset();
    mocks.findOpenPosition.mockReset();
    mocks.getStatus.mockReset();
    mocks.markStatus.mockReset();
    mocks.recordExecutionEvent.mockReset();
    mocks.upsertPosition.mockReset();
    mocks.writeSnapshot.mockReset();
    mocks.latestSnapshot.mockReset();
  });

  it("uses explicit planned sell shares from queued live dispatch jobs", async () => {
    mocks.getStatus.mockResolvedValue("running");
    mocks.findOpenPosition.mockResolvedValue({
      id: "position-1",
      eventSlug: "demo-event",
      marketSlug: "demo-market",
      tokenId: "token-1",
      side: "BUY",
      outcomeLabel: "Yes",
      size: "10",
      avgCost: "0.5",
      currentPrice: "0.5",
      currentValueUsd: "5",
      unrealizedPnlPct: "0",
      stopLossPct: "0.3",
      openedAt: new Date("2026-05-04T00:00:00.000Z"),
      updatedAt: new Date("2026-05-04T00:00:00.000Z")
    });
    mocks.executeMarketOrder.mockResolvedValue({
      ok: true,
      filledNotionalUsd: 1.5,
      avgPrice: 0.5,
      orderId: "order-1",
      rawResponse: { ok: true }
    });
    mocks.upsertPosition.mockResolvedValue(undefined);
    mocks.recordExecutionEvent.mockResolvedValue(undefined);

    createQueueWorker(baseConfig, { host: "localhost" });

    expect(mocks.workerProcessor).not.toBeNull();
    await mocks.workerProcessor!({
      name: JOBS.executeTrade,
      data: {
        runId: "run-1",
        decisionId: "decision-1",
        decision: {
          action: "reduce",
          event_slug: "demo-event",
          market_slug: "demo-market",
          token_id: "token-1",
          side: "SELL",
          notional_usd: 1,
          order_type: "FOK",
          ai_prob: 0.5,
          market_prob: 0.5,
          edge: 0,
          confidence: "medium",
          thesis_md: "Reduce exposure.",
          sources: [
            {
              title: "Pulse",
              url: "https://example.com/pulse",
              retrieved_at_utc: "2026-05-04T00:00:00.000Z"
            }
          ],
          execution_amount: 3,
          execution_unit: "shares",
          stop_loss_pct: 0.3,
          resolution_track_required: true
        }
      }
    });

    expect(mocks.executeMarketOrder).toHaveBeenCalledWith(baseConfig, {
      tokenId: "token-1",
      side: "SELL",
      amount: 3
    });
    expect(mocks.recordExecutionEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: "run-1",
      decisionId: "decision-1",
      status: "filled",
      requestedNotionalUsd: 1,
      filledNotionalUsd: 1.5
    }));
  });

  it("syncs remote positions and triggers stop-loss sells", async () => {
    mocks.positionFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "open-position-1" }]);
    mocks.executionEventFindMany.mockResolvedValue([]);
    mocks.latestSnapshot.mockResolvedValue({
      cashBalanceUsd: "1000",
      highWaterMarkUsd: "1000",
      createdAt: new Date("2026-03-17T00:00:00.000Z")
    });
    mocks.fetchRemotePositions.mockResolvedValue([
      {
        tokenId: "token-1",
        size: 2,
        marketSlug: "market-1",
        eventSlug: "event-1",
        outcome: "No",
        title: "Demo market"
      }
    ]);
    mocks.computeAvgCost.mockResolvedValue(0.5);
    mocks.readBook.mockResolvedValue({ bestBid: 0.35 });
    mocks.currentOpenExposureUsd.mockResolvedValue(0.7);
    mocks.upsertPosition.mockResolvedValue(undefined);
    mocks.executeMarketOrder.mockResolvedValue({
      ok: true,
      filledNotionalUsd: 0.7,
      avgPrice: 0.35,
      rawResponse: { ok: true }
    });
    mocks.recordExecutionEvent.mockResolvedValue(undefined);
    mocks.writeSnapshot.mockResolvedValue(undefined);
    mocks.markStatus.mockResolvedValue(undefined);

    createQueueWorker(baseConfig, { host: "localhost" });

    expect(mocks.workerProcessor).not.toBeNull();
    await mocks.workerProcessor!({ name: JOBS.syncPortfolio });

    expect(mocks.fetchRemotePositions).toHaveBeenCalledWith(baseConfig);
    expect(mocks.upsertPosition).toHaveBeenCalledWith(expect.objectContaining({
      tokenId: "token-1",
      currentPrice: 0.35,
      currentValueUsd: 0.7,
      stopLossPct: 0.3
    }));
    expect(mocks.executeMarketOrder).toHaveBeenCalledWith(baseConfig, {
      tokenId: "token-1",
      side: "SELL",
      amount: 2
    });
    expect(mocks.recordExecutionEvent).toHaveBeenCalledWith(expect.objectContaining({
      marketSlug: "market-1",
      tokenId: "token-1",
      side: "SELL",
      status: "stop_loss_triggered"
    }));
    expect(mocks.writeSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      cashBalanceUsd: 1000,
      totalEquityUsd: 1000.7,
      openPositions: 1,
      halted: false
    }));
    expect(mocks.markStatus).not.toHaveBeenCalled();
  });

  it("flattens all open positions and records manual flatten events", async () => {
    mocks.positionFindMany.mockResolvedValue([
      {
        id: "position-1",
        marketSlug: "market-1",
        tokenId: "token-1",
        size: "2",
        currentPrice: "0.5",
        currentValueUsd: "1"
      },
      {
        id: "position-2",
        marketSlug: "market-2",
        tokenId: "token-2",
        size: "3",
        currentPrice: "0.7",
        currentValueUsd: "2.1"
      }
    ]);
    mocks.readBook.mockImplementation(async (_config, tokenId: string) => ({
      bestBid: tokenId === "token-1" ? 0.4 : 0.6
    }));
    mocks.executeMarketOrder.mockResolvedValue({
      ok: true,
      filledNotionalUsd: 1,
      avgPrice: 0.5,
      rawResponse: { ok: true }
    });
    mocks.recordExecutionEvent.mockResolvedValue(undefined);

    createQueueWorker(baseConfig, { host: "localhost" });

    expect(mocks.workerProcessor).not.toBeNull();
    await mocks.workerProcessor!({ name: JOBS.flattenPortfolio });

    expect(mocks.executeMarketOrder).toHaveBeenNthCalledWith(1, baseConfig, {
      tokenId: "token-1",
      side: "SELL",
      amount: 2
    });
    expect(mocks.executeMarketOrder).toHaveBeenNthCalledWith(2, baseConfig, {
      tokenId: "token-2",
      side: "SELL",
      amount: 3
    });
    expect(mocks.dbUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.recordExecutionEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      marketSlug: "market-1",
      tokenId: "token-1",
      status: "manual_flatten"
    }));
    expect(mocks.recordExecutionEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      marketSlug: "market-2",
      tokenId: "token-2",
      status: "manual_flatten"
    }));
  });
});
