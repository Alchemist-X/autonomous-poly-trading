import path from "node:path";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import type { PublicPosition, TradeDecision } from "@autopoly/contracts";

type ExecutionMode = "pulse:live" | "recommend-only" | "failed";

type OrderStatus = "filled" | "failed" | "blocked" | "not_sent" | "recommend_only";

interface PositionLike {
  event_slug: string;
  market_slug: string;
  token_id: string;
  outcome_label: string;
  size: number;
  avg_cost: number;
  current_price: number;
  current_value_usd: number;
  unrealized_pnl_pct: number;
  stop_loss_pct: number;
}

interface ExecutedOrderLike {
  action?: TradeDecision["action"] | null;
  marketSlug: string;
  eventSlug?: string | null;
  tokenId?: string | null;
  outcomeLabel?: string | null;
  side?: TradeDecision["side"] | null;
  notionalUsd?: number | null;
  executionAmount?: number | null;
  unit?: "usd" | "shares" | null;
  filledNotionalUsd?: number | null;
  orderId?: string | null;
  avgPrice?: number | null;
  ok?: boolean | null;
}

interface SkippedItemLike {
  action?: TradeDecision["action"] | null;
  marketSlug: string;
  tokenId?: string | null;
  reason: string;
}

export interface PositionMarkSnapshot {
  snapshotAtUtc: string;
  eventSlug: string;
  marketSlug: string;
  tokenId: string;
  outcomeLabel: string;
  size: number;
  avgCost: number;
  markPrice: number;
  markValueUsd: number;
  unrealizedPnlPct: number;
  stopLossPct: number;
}

export interface PositionMarkChange {
  eventSlug: string;
  marketSlug: string;
  tokenId: string;
  outcomeLabel: string;
  status: "existing-untraded" | "existing-traded" | "new" | "closed";
  beforeSize: number | null;
  afterSize: number | null;
  beforeMarkPrice: number | null;
  afterMarkPrice: number | null;
  beforeValueUsd: number | null;
  afterValueUsd: number | null;
  valueDeltaUsd: number;
  filledCashFlowUsd: number;
  markVsFillDeltaUsd: number | null;
}

export interface PositionMarkAttribution {
  beforeSnapshotAtUtc: string;
  afterSnapshotAtUtc: string;
  beforePositions: PositionMarkSnapshot[];
  afterPositions: PositionMarkSnapshot[];
  changes: PositionMarkChange[];
  totals: {
    beforeMarkedValueUsd: number;
    afterMarkedValueUsd: number;
    markedValueDeltaUsd: number;
    untradedExistingMarkDeltaUsd: number;
    tradedExistingMarkDeltaUsd: number;
    newPositionMarkVsFillDeltaUsd: number;
    closedPositionValueDeltaUsd: number;
  };
}

export interface CalibrationLedgerEntry {
  schemaVersion: 1;
  runId: string;
  generatedAtUtc: string;
  archiveDir: string;
  executionMode: ExecutionMode;
  decisionStrategy: string;
  decisionKey: string;
  decision: {
    action: TradeDecision["action"];
    eventSlug: string;
    marketSlug: string;
    tokenId: string;
    outcomeLabel: string | null;
    side: TradeDecision["side"];
    aiProb: number;
    marketProb: number;
    edge: number;
    confidence: TradeDecision["confidence"];
    notionalUsd: number;
    orderType: TradeDecision["order_type"];
    sourceCount: number;
    thesisMd: string;
  };
  execution: {
    status: OrderStatus;
    requestedNotionalUsd: number | null;
    filledNotionalUsd: number | null;
    avgPrice: number | null;
    orderId: string | null;
    blockedReason: string | null;
  };
  marks: {
    beforePrice: number | null;
    afterPrice: number | null;
    beforeValueUsd: number | null;
    afterValueUsd: number | null;
    valueDeltaUsd: number | null;
    markVsFillDeltaUsd: number | null;
  };
  outcome: {
    status: "pending";
    resolvedAtUtc: null;
    winningOutcome: null;
    realizedPnlUsd: null;
  };
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(4));
}

function normalizePosition(position: PositionLike, snapshotAtUtc: string): PositionMarkSnapshot {
  return {
    snapshotAtUtc,
    eventSlug: position.event_slug,
    marketSlug: position.market_slug,
    tokenId: position.token_id,
    outcomeLabel: position.outcome_label,
    size: roundMetric(position.size),
    avgCost: roundMetric(position.avg_cost),
    markPrice: roundMetric(position.current_price),
    markValueUsd: roundCurrency(position.current_value_usd),
    unrealizedPnlPct: roundMetric(position.unrealized_pnl_pct),
    stopLossPct: roundMetric(position.stop_loss_pct)
  };
}

function mapByToken<T extends { tokenId: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.tokenId, item]));
}

function getOrderCashFlowUsd(order: ExecutedOrderLike): number {
  if (!(order.ok ?? false) || !(order.filledNotionalUsd != null && order.filledNotionalUsd > 0)) {
    return 0;
  }
  if (order.side === "BUY") {
    return -order.filledNotionalUsd;
  }
  if (order.side === "SELL") {
    return order.filledNotionalUsd;
  }
  return 0;
}

function buildFilledCashFlowByToken(orders: ExecutedOrderLike[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const order of orders) {
    if (!order.tokenId) {
      continue;
    }
    result.set(order.tokenId, roundCurrency((result.get(order.tokenId) ?? 0) + getOrderCashFlowUsd(order)));
  }
  return result;
}

function buildTokenUniverse(
  before: PositionMarkSnapshot[],
  after: PositionMarkSnapshot[],
  orders: ExecutedOrderLike[]
): string[] {
  const tokens = new Set<string>();
  for (const item of before) tokens.add(item.tokenId);
  for (const item of after) tokens.add(item.tokenId);
  for (const order of orders) {
    if (order.tokenId) tokens.add(order.tokenId);
  }
  return [...tokens].sort();
}

function resolveChangeStatus(input: {
  before: PositionMarkSnapshot | null;
  after: PositionMarkSnapshot | null;
  filledCashFlowUsd: number;
}): PositionMarkChange["status"] {
  if (input.before && input.after) {
    return input.filledCashFlowUsd === 0 ? "existing-untraded" : "existing-traded";
  }
  if (!input.before && input.after) {
    return "new";
  }
  return "closed";
}

function buildFallbackMarkChange(input: {
  tokenId: string;
  before: PositionMarkSnapshot | null;
  after: PositionMarkSnapshot | null;
  order: ExecutedOrderLike | null;
  filledCashFlowUsd: number;
}): PositionMarkChange {
  const before = input.before;
  const after = input.after;
  const valueDeltaUsd = roundCurrency((after?.markValueUsd ?? 0) - (before?.markValueUsd ?? 0));
  const status = resolveChangeStatus({ before, after, filledCashFlowUsd: input.filledCashFlowUsd });
  const markVsFillDeltaUsd =
    status === "new" || status === "existing-traded"
      ? roundCurrency(valueDeltaUsd + input.filledCashFlowUsd)
      : null;

  return {
    eventSlug: after?.eventSlug ?? before?.eventSlug ?? input.order?.eventSlug ?? "",
    marketSlug: after?.marketSlug ?? before?.marketSlug ?? input.order?.marketSlug ?? "",
    tokenId: input.tokenId,
    outcomeLabel: after?.outcomeLabel ?? before?.outcomeLabel ?? input.order?.outcomeLabel ?? "",
    status,
    beforeSize: before?.size ?? null,
    afterSize: after?.size ?? null,
    beforeMarkPrice: before?.markPrice ?? null,
    afterMarkPrice: after?.markPrice ?? input.order?.avgPrice ?? null,
    beforeValueUsd: before?.markValueUsd ?? null,
    afterValueUsd: after?.markValueUsd ?? null,
    valueDeltaUsd,
    filledCashFlowUsd: roundCurrency(input.filledCashFlowUsd),
    markVsFillDeltaUsd
  };
}

export function buildPositionMarkAttribution(input: {
  beforePositions: PublicPosition[];
  afterPositions: PublicPosition[];
  executedOrders: ExecutedOrderLike[];
  beforeSnapshotAtUtc: string;
  afterSnapshotAtUtc: string;
}): PositionMarkAttribution {
  const beforePositions = input.beforePositions.map((position) =>
    normalizePosition(position, input.beforeSnapshotAtUtc)
  );
  const afterPositions = input.afterPositions.map((position) =>
    normalizePosition(position, input.afterSnapshotAtUtc)
  );
  const beforeByToken = mapByToken(beforePositions);
  const afterByToken = mapByToken(afterPositions);
  const filledCashFlowByToken = buildFilledCashFlowByToken(input.executedOrders);
  const orderByToken = new Map(
    input.executedOrders
      .filter((order) => Boolean(order.tokenId))
      .map((order) => [order.tokenId!, order])
  );

  const changes = buildTokenUniverse(beforePositions, afterPositions, input.executedOrders)
    .map((tokenId) => buildFallbackMarkChange({
      tokenId,
      before: beforeByToken.get(tokenId) ?? null,
      after: afterByToken.get(tokenId) ?? null,
      order: orderByToken.get(tokenId) ?? null,
      filledCashFlowUsd: filledCashFlowByToken.get(tokenId) ?? 0
    }))
    .filter((change) => change.marketSlug || change.beforeValueUsd != null || change.afterValueUsd != null);

  const sumByStatus = (status: PositionMarkChange["status"], selector: (change: PositionMarkChange) => number) =>
    roundCurrency(changes.filter((change) => change.status === status).reduce((sum, change) => sum + selector(change), 0));

  const beforeMarkedValueUsd = roundCurrency(beforePositions.reduce((sum, position) => sum + position.markValueUsd, 0));
  const afterMarkedValueUsd = roundCurrency(afterPositions.reduce((sum, position) => sum + position.markValueUsd, 0));

  return {
    beforeSnapshotAtUtc: input.beforeSnapshotAtUtc,
    afterSnapshotAtUtc: input.afterSnapshotAtUtc,
    beforePositions,
    afterPositions,
    changes,
    totals: {
      beforeMarkedValueUsd,
      afterMarkedValueUsd,
      markedValueDeltaUsd: roundCurrency(afterMarkedValueUsd - beforeMarkedValueUsd),
      untradedExistingMarkDeltaUsd: sumByStatus("existing-untraded", (change) => change.valueDeltaUsd),
      tradedExistingMarkDeltaUsd: sumByStatus("existing-traded", (change) => change.valueDeltaUsd),
      newPositionMarkVsFillDeltaUsd: sumByStatus("new", (change) => change.markVsFillDeltaUsd ?? 0),
      closedPositionValueDeltaUsd: sumByStatus("closed", (change) => change.valueDeltaUsd)
    }
  };
}

function getDecisionOutcomeLabel(decision: TradeDecision): string | null {
  return (decision as TradeDecision & { outcome_label?: string }).outcome_label ?? null;
}

function buildDecisionKey(runId: string, decision: TradeDecision): string {
  return [
    runId,
    decision.action,
    decision.market_slug,
    decision.token_id,
    getDecisionOutcomeLabel(decision) ?? "unknown"
  ].join(":");
}

function findExecutionStatus(input: {
  decision: TradeDecision;
  executedOrders: ExecutedOrderLike[];
  skipped: SkippedItemLike[];
  executionMode: ExecutionMode;
}) {
  if (input.executionMode === "recommend-only") {
    return {
      status: "recommend_only" as const,
      order: null,
      blockedReason: null
    };
  }

  const order = input.executedOrders.find((item) => item.tokenId === input.decision.token_id) ?? null;
  if (order) {
    return {
      status: (order.ok ?? false) ? "filled" as const : "failed" as const,
      order,
      blockedReason: null
    };
  }

  const skipped = input.skipped.find((item) => item.tokenId === input.decision.token_id) ?? null;
  if (skipped) {
    return {
      status: "blocked" as const,
      order: null,
      blockedReason: skipped.reason
    };
  }

  return {
    status: "not_sent" as const,
    order: null,
    blockedReason: null
  };
}

export function buildCalibrationLedgerEntries(input: {
  runId: string;
  generatedAtUtc: string;
  archiveDir: string;
  executionMode: ExecutionMode;
  decisionStrategy: string;
  decisions: TradeDecision[];
  executedOrders: ExecutedOrderLike[];
  skipped: SkippedItemLike[];
  markAttribution: PositionMarkAttribution;
}): CalibrationLedgerEntry[] {
  const marksByToken = new Map(input.markAttribution.changes.map((change) => [change.tokenId, change]));

  return input.decisions.map((decision) => {
    const execution = findExecutionStatus({
      decision,
      executedOrders: input.executedOrders,
      skipped: input.skipped,
      executionMode: input.executionMode
    });
    const mark = marksByToken.get(decision.token_id) ?? null;

    return {
      schemaVersion: 1,
      runId: input.runId,
      generatedAtUtc: input.generatedAtUtc,
      archiveDir: input.archiveDir,
      executionMode: input.executionMode,
      decisionStrategy: input.decisionStrategy,
      decisionKey: buildDecisionKey(input.runId, decision),
      decision: {
        action: decision.action,
        eventSlug: decision.event_slug,
        marketSlug: decision.market_slug,
        tokenId: decision.token_id,
        outcomeLabel: getDecisionOutcomeLabel(decision),
        side: decision.side,
        aiProb: roundMetric(decision.ai_prob),
        marketProb: roundMetric(decision.market_prob),
        edge: roundMetric(decision.edge),
        confidence: decision.confidence,
        notionalUsd: roundCurrency(decision.notional_usd),
        orderType: decision.order_type,
        sourceCount: decision.sources.length,
        thesisMd: decision.thesis_md
      },
      execution: {
        status: execution.status,
        requestedNotionalUsd: execution.order?.notionalUsd ?? decision.notional_usd ?? null,
        filledNotionalUsd: execution.order?.filledNotionalUsd ?? null,
        avgPrice: execution.order?.avgPrice ?? null,
        orderId: execution.order?.orderId ?? null,
        blockedReason: execution.blockedReason
      },
      marks: {
        beforePrice: mark?.beforeMarkPrice ?? null,
        afterPrice: mark?.afterMarkPrice ?? null,
        beforeValueUsd: mark?.beforeValueUsd ?? null,
        afterValueUsd: mark?.afterValueUsd ?? null,
        valueDeltaUsd: mark?.valueDeltaUsd ?? null,
        markVsFillDeltaUsd: mark?.markVsFillDeltaUsd ?? null
      },
      outcome: {
        status: "pending",
        resolvedAtUtc: null,
        winningOutcome: null,
        realizedPnlUsd: null
      }
    };
  });
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeJsonl(filePath: string, rows: unknown[], append: boolean) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const content = rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length > 0 ? "\n" : "");
  if (append) {
    await appendFile(filePath, content, "utf8");
    return;
  }
  await writeFile(filePath, content, "utf8");
}

export async function writePulseEvaluationArtifacts(input: {
  artifactStorageRoot: string;
  archiveDir: string;
  runId: string;
  generatedAtUtc: string;
  executionMode: ExecutionMode;
  decisionStrategy: string;
  decisions: TradeDecision[];
  skipped: SkippedItemLike[];
  executedOrders: ExecutedOrderLike[];
  beforePositions: PublicPosition[];
  afterPositions: PublicPosition[];
  beforeSnapshotAtUtc: string;
  afterSnapshotAtUtc: string;
}) {
  const markAttribution = buildPositionMarkAttribution({
    beforePositions: input.beforePositions,
    afterPositions: input.afterPositions,
    executedOrders: input.executedOrders,
    beforeSnapshotAtUtc: input.beforeSnapshotAtUtc,
    afterSnapshotAtUtc: input.afterSnapshotAtUtc
  });
  const ledgerEntries = buildCalibrationLedgerEntries({
    runId: input.runId,
    generatedAtUtc: input.generatedAtUtc,
    archiveDir: input.archiveDir,
    executionMode: input.executionMode,
    decisionStrategy: input.decisionStrategy,
    decisions: input.decisions,
    executedOrders: input.executedOrders,
    skipped: input.skipped,
    markAttribution
  });

  const markSnapshotPath = path.join(input.archiveDir, "position-mark-snapshot.json");
  const runLedgerPath = path.join(input.archiveDir, "calibration-ledger.jsonl");
  const globalLedgerPath = path.join(input.artifactStorageRoot, "evaluation", "pulse-calibration-ledger.jsonl");

  await Promise.all([
    writeJson(markSnapshotPath, markAttribution),
    writeJsonl(runLedgerPath, ledgerEntries, false),
    writeJsonl(globalLedgerPath, ledgerEntries, true)
  ]);

  return {
    markAttribution,
    ledgerEntries,
    markSnapshotPath,
    runLedgerPath,
    globalLedgerPath
  };
}
