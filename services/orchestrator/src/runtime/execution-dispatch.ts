import { randomUUID } from "node:crypto";
import type { Queue } from "bullmq";
import { JOBS, QUEUES, type TradeDecision } from "@autopoly/contracts";
import { executionEvents, getDb } from "@autopoly/db";
import type { PlannedExecution, SkippedDecision } from "../lib/execution-planning.js";

export type ExecutionDispatchMode = "mock" | "live";
export type ExecutionDispatchOrderStatus = "ready" | "queued" | "mocked" | "skipped" | "failed";

export interface ExecutionDispatchRecommendation {
  runId: string;
  decisions: TradeDecision[];
  executablePlans: PlannedExecution[];
  skipped?: SkippedDecision[];
}

export interface ExecutionDispatchOrder {
  id: string;
  runId: string;
  decisionId: string | null;
  status: ExecutionDispatchOrderStatus;
  action: PlannedExecution["action"];
  marketSlug: string;
  eventSlug: string;
  tokenId: string;
  side: PlannedExecution["side"];
  notionalUsd: number;
  executionAmount: number;
  executionUnit: PlannedExecution["unit"];
  orderType: PlannedExecution["orderType"];
  gtcLimitPrice: number | null;
  reason: string | null;
  jobId: string | null;
  plan: PlannedExecution;
  decision: TradeDecision | null;
}

export interface ExecutionDispatchPlan {
  schemaVersion: 1;
  createdAtUtc: string;
  dispatchedAtUtc: string | null;
  runId: string;
  mode: ExecutionDispatchMode;
  sourceRecommendationPath: string;
  queue: {
    name: typeof QUEUES.execution;
    job: typeof JOBS.executeTrade;
  };
  orders: ExecutionDispatchOrder[];
  readyOrders: ExecutionDispatchOrder[];
  skipped: SkippedDecision[];
  summary: {
    total: number;
    ready: number;
    queued: number;
    mocked: number;
    skipped: number;
    failed: number;
  };
}

export interface QueuedExecutionOrder {
  orderId: string;
  jobId: string;
}

function buildDecisionKey(input: {
  action: string;
  marketSlug?: string;
  market_slug?: string;
  eventSlug?: string;
  event_slug?: string;
  tokenId?: string;
  token_id?: string;
  side: string;
}) {
  return [
    input.action,
    input.marketSlug ?? input.market_slug,
    input.eventSlug ?? input.event_slug,
    input.tokenId ?? input.token_id,
    input.side
  ].join("::");
}

function cloneDecisionForPlan(decision: TradeDecision, plan: PlannedExecution): TradeDecision {
  return {
    ...decision,
    notional_usd: plan.notionalUsd,
    order_type: plan.orderType,
    execution_amount: plan.executionAmount,
    execution_unit: plan.unit
  };
}

function summarizeOrders(orders: ExecutionDispatchOrder[]): ExecutionDispatchPlan["summary"] {
  return {
    total: orders.length,
    ready: orders.filter((order) => order.status === "ready").length,
    queued: orders.filter((order) => order.status === "queued").length,
    mocked: orders.filter((order) => order.status === "mocked").length,
    skipped: orders.filter((order) => order.status === "skipped").length,
    failed: orders.filter((order) => order.status === "failed").length
  };
}

function withDerivedViews(plan: Omit<ExecutionDispatchPlan, "readyOrders" | "summary">): ExecutionDispatchPlan {
  return {
    ...plan,
    readyOrders: plan.orders.filter((order) => order.status === "ready"),
    summary: summarizeOrders(plan.orders)
  };
}

export function buildExecutionDispatchPlan(input: {
  recommendation: ExecutionDispatchRecommendation;
  sourceRecommendationPath: string;
  mode: ExecutionDispatchMode;
  now?: Date;
}): ExecutionDispatchPlan {
  const decisionsByKey = new Map<string, TradeDecision[]>();
  for (const decision of input.recommendation.decisions) {
    const key = buildDecisionKey(decision);
    const existing = decisionsByKey.get(key) ?? [];
    existing.push(decision);
    decisionsByKey.set(key, existing);
  }

  const orders = input.recommendation.executablePlans.map((plan) => {
    const key = buildDecisionKey(plan);
    const decision = decisionsByKey.get(key)?.shift() ?? null;
    const unsupportedGtc = plan.orderType === "GTC";
    const status: ExecutionDispatchOrderStatus = decision && !unsupportedGtc ? "ready" : "skipped";
    const reason = !decision
      ? "matching_decision_not_found"
      : unsupportedGtc
        ? "gtc_queue_dispatch_not_supported"
        : null;

    return {
      id: randomUUID(),
      runId: input.recommendation.runId,
      decisionId: null,
      status,
      action: plan.action,
      marketSlug: plan.marketSlug,
      eventSlug: plan.eventSlug,
      tokenId: plan.tokenId,
      side: plan.side,
      notionalUsd: plan.notionalUsd,
      executionAmount: plan.executionAmount,
      executionUnit: plan.unit,
      orderType: plan.orderType,
      gtcLimitPrice: plan.gtcLimitPrice,
      reason,
      jobId: null,
      plan,
      decision: decision ? cloneDecisionForPlan(decision, plan) : null
    } satisfies ExecutionDispatchOrder;
  });

  return withDerivedViews({
    schemaVersion: 1,
    createdAtUtc: (input.now ?? new Date()).toISOString(),
    dispatchedAtUtc: null,
    runId: input.recommendation.runId,
    mode: input.mode,
    sourceRecommendationPath: input.sourceRecommendationPath,
    queue: {
      name: QUEUES.execution,
      job: JOBS.executeTrade
    },
    orders,
    skipped: input.recommendation.skipped ?? []
  });
}

export function markExecutionDispatchPlanMocked(input: {
  plan: ExecutionDispatchPlan;
  now?: Date;
}): ExecutionDispatchPlan {
  const orders = input.plan.orders.map((order) => order.status === "ready"
    ? {
        ...order,
        status: "mocked" as const,
        reason: "mock_executor_enabled"
      }
    : order
  );

  return withDerivedViews({
    ...input.plan,
    dispatchedAtUtc: (input.now ?? new Date()).toISOString(),
    orders
  });
}

export async function dispatchExecutionPlanToQueue(input: {
  plan: ExecutionDispatchPlan;
  executionQueue: Queue;
  now?: Date;
  recordSubmittedEvents?: boolean;
}): Promise<ExecutionDispatchPlan> {
  const orders: ExecutionDispatchOrder[] = [];
  const shouldRecordSubmittedEvents = input.recordSubmittedEvents ?? true;

  for (const order of input.plan.orders) {
    if (order.status !== "ready") {
      orders.push(order);
      continue;
    }
    if (!order.decision) {
      orders.push({
        ...order,
        status: "failed",
        reason: "ready_order_missing_decision"
      });
      continue;
    }

    const job = await input.executionQueue.add(
      JOBS.executeTrade,
      {
        runId: order.runId,
        decisionId: order.decisionId,
        decision: order.decision
      },
      {
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    if (shouldRecordSubmittedEvents) {
      const db = getDb();
      await db.insert(executionEvents).values({
        id: randomUUID(),
        runId: order.runId,
        decisionId: order.decisionId,
        marketSlug: order.decision.market_slug,
        tokenId: order.decision.token_id,
        side: order.decision.side,
        status: "submitted",
        requestedNotionalUsd: String(order.decision.notional_usd),
        filledNotionalUsd: "0",
        rawResponse: {
          queued: true,
          queue: QUEUES.execution,
          jobId: job.id,
          source: "agent-persistent-runner"
        }
      });
    }

    orders.push({
      ...order,
      status: "queued",
      jobId: String(job.id),
      reason: null
    });
  }

  return withDerivedViews({
    ...input.plan,
    dispatchedAtUtc: (input.now ?? new Date()).toISOString(),
    orders
  });
}
