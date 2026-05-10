import { describe, expect, it, vi } from "vitest";
import { JOBS } from "@autopoly/contracts";
import type { PlannedExecution } from "../lib/execution-planning.js";
import {
  buildExecutionDispatchPlan,
  dispatchExecutionPlanToQueue,
  markExecutionDispatchPlanMocked
} from "./execution-dispatch.js";

function createDecision() {
  return {
    action: "open" as const,
    event_slug: "demo-event",
    market_slug: "demo-market",
    token_id: "token-1",
    side: "BUY" as const,
    notional_usd: 12,
    order_type: "FOK" as const,
    ai_prob: 0.63,
    market_prob: 0.54,
    edge: 0.09,
    confidence: "medium" as const,
    thesis_md: "Positive edge.",
    sources: [
      {
        title: "Pulse",
        url: "https://example.com/pulse",
        retrieved_at_utc: "2026-05-04T00:00:00.000Z"
      }
    ],
    stop_loss_pct: 0.3,
    resolution_track_required: true
  };
}

function createPlan(overrides: Partial<PlannedExecution> = {}): PlannedExecution {
  return {
    action: "open",
    marketSlug: "demo-market",
    eventSlug: "demo-event",
    tokenId: "token-1",
    side: "BUY",
    notionalUsd: 10,
    bankrollRatio: 0.1,
    executionAmount: 10,
    unit: "usd",
    thesisMd: "Positive edge.",
    bestAsk: 0.52,
    bestBid: 0.51,
    minOrderSize: 5,
    exchangeMinNotionalUsd: 2.6,
    orderType: "FOK",
    gtcLimitPrice: null,
    categorySlug: "politics",
    negRisk: false,
    ...overrides
  };
}

describe("execution dispatch", () => {
  it("builds ready queue decisions from executable plans", () => {
    const plan = buildExecutionDispatchPlan({
      recommendation: {
        runId: "run-1",
        decisions: [createDecision()],
        executablePlans: [createPlan()]
      },
      sourceRecommendationPath: "/tmp/recommendation.json",
      mode: "live",
      now: new Date("2026-05-04T00:00:00.000Z")
    });

    expect(plan.summary.ready).toBe(1);
    expect(plan.readyOrders).toHaveLength(1);
    expect(plan.readyOrders[0]?.decision).toMatchObject({
      notional_usd: 10,
      execution_amount: 10,
      execution_unit: "usd",
      order_type: "FOK"
    });
  });

  it("marks mock executor orders without queueing them", () => {
    const plan = buildExecutionDispatchPlan({
      recommendation: {
        runId: "run-1",
        decisions: [createDecision()],
        executablePlans: [createPlan()]
      },
      sourceRecommendationPath: "/tmp/recommendation.json",
      mode: "mock",
      now: new Date("2026-05-04T00:00:00.000Z")
    });

    const mocked = markExecutionDispatchPlanMocked({
      plan,
      now: new Date("2026-05-04T00:00:01.000Z")
    });

    expect(mocked.summary.ready).toBe(0);
    expect(mocked.summary.mocked).toBe(1);
    expect(mocked.orders[0]?.reason).toBe("mock_executor_enabled");
  });

  it("queues ready orders to the executor queue", async () => {
    const add = vi.fn(async () => ({ id: "job-1" }));
    const queue = { add } as any;
    const plan = buildExecutionDispatchPlan({
      recommendation: {
        runId: "run-1",
        decisions: [createDecision()],
        executablePlans: [createPlan()]
      },
      sourceRecommendationPath: "/tmp/recommendation.json",
      mode: "live",
      now: new Date("2026-05-04T00:00:00.000Z")
    });

    const queued = await dispatchExecutionPlanToQueue({
      plan,
      executionQueue: queue,
      recordSubmittedEvents: false,
      now: new Date("2026-05-04T00:00:01.000Z")
    });

    expect(add).toHaveBeenCalledWith(
      JOBS.executeTrade,
      expect.objectContaining({
        runId: "run-1",
        decision: expect.objectContaining({
          token_id: "token-1",
          execution_amount: 10,
          execution_unit: "usd"
        })
      }),
      expect.objectContaining({ removeOnComplete: true })
    );
    expect(queued.summary.queued).toBe(1);
    expect(queued.orders[0]?.jobId).toBe("job-1");
  });

  it("skips GTC plans until queue worker supports limit order lifecycle", () => {
    const plan = buildExecutionDispatchPlan({
      recommendation: {
        runId: "run-1",
        decisions: [createDecision()],
        executablePlans: [createPlan({ orderType: "GTC", gtcLimitPrice: 0.51 })]
      },
      sourceRecommendationPath: "/tmp/recommendation.json",
      mode: "live"
    });

    expect(plan.summary.ready).toBe(0);
    expect(plan.summary.skipped).toBe(1);
    expect(plan.orders[0]?.reason).toBe("gtc_queue_dispatch_not_supported");
  });
});
