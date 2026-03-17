import { randomUUID } from "node:crypto";
import type {
  Artifact,
  PublicArtifactListItem,
  PublicPosition,
  PublicRunDetail,
  PublicRunSummary,
  TradeDecision,
  TradeDecisionSet
} from "@autopoly/contracts";
import {
  applyPaperTradeDecision,
  inferPaperSellAmount,
  buildPaperOrderResult
} from "@autopoly/contracts";
import type { LocalAppState } from "@autopoly/db";
import type { OrchestratorConfig } from "../config.js";
import { applyTradeGuards, calculateDrawdownPct, shouldHaltForDrawdown } from "../lib/risk.js";

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function appendEquityPoint(state: LocalAppState, timestampUtc: string, totalEquityUsd: number, drawdownPct: number) {
  return [
    ...state.overview.equity_curve.slice(-23),
    {
      timestamp: timestampUtc,
      total_equity_usd: roundCurrency(totalEquityUsd),
      drawdown_pct: Number(drawdownPct.toFixed(6))
    }
  ];
}

function buildTrackedSources(runId: string, decisions: TradeDecision[]): PublicRunDetail["tracked_sources"] {
  return decisions.flatMap((decision) =>
    decision.sources.map((source) => ({
      id: randomUUID(),
      run_id: runId,
      decision_id: null,
      event_slug: decision.event_slug,
      market_slug: decision.market_slug,
      title: source.title,
      url: source.url,
      source_kind: "external",
      role: "decision-source",
      status: "captured",
      retrieved_at_utc: source.retrieved_at_utc,
      last_checked_at: source.retrieved_at_utc,
      note: source.note ?? null,
      content_hash: null
    }))
  );
}

function toArtifactListItems(artifacts: Artifact[]): PublicArtifactListItem[] {
  return artifacts.map((artifact) => ({
    id: randomUUID(),
    title: artifact.title,
    kind: artifact.kind,
    path: artifact.path,
    published_at_utc: artifact.published_at_utc
  }));
}

function mergeArtifactLists(
  existing: PublicArtifactListItem[],
  incoming: PublicArtifactListItem[],
  predicate: (item: PublicArtifactListItem) => boolean
) {
  const seen = new Set(existing.filter(predicate).map((item) => item.path));
  const next = [...existing];

  for (const item of incoming) {
    if (!predicate(item) || seen.has(item.path)) {
      continue;
    }
    seen.add(item.path);
    next.unshift(item);
  }

  return next;
}

export function guardDecisionSetForPaper(input: {
  decisionSet: TradeDecisionSet;
  overview: { total_equity_usd: number; open_positions: number };
  positions: PublicPosition[];
  config: Pick<OrchestratorConfig, "maxTradePct" | "maxTotalExposurePct" | "maxEventExposurePct" | "maxPositions" | "minTradeUsd">;
}) {
  let projectedExposureUsd = input.positions.reduce((sum, position) => sum + position.current_value_usd, 0);
  let projectedOpenPositions = input.overview.open_positions;
  let droppedDecisionCount = 0;
  const projectedEventExposureUsd = new Map<string, number>();

  for (const position of input.positions) {
    projectedEventExposureUsd.set(
      position.event_slug,
      (projectedEventExposureUsd.get(position.event_slug) ?? 0) + position.current_value_usd
    );
  }

  const decisions = input.decisionSet.decisions.flatMap((decision) => {
    if (decision.action !== "open") {
      return [decision];
    }

    const guardedNotionalUsd = applyTradeGuards({
      requestedUsd: decision.notional_usd,
      bankrollUsd: input.overview.total_equity_usd,
      minTradeUsd: input.config.minTradeUsd,
      maxTradePct: input.config.maxTradePct,
      liquidityCapUsd: decision.notional_usd,
      totalExposureUsd: projectedExposureUsd,
      maxTotalExposurePct: input.config.maxTotalExposurePct,
      eventExposureUsd: projectedEventExposureUsd.get(decision.event_slug) ?? 0,
      maxEventExposurePct: input.config.maxEventExposurePct,
      openPositions: projectedOpenPositions,
      maxPositions: input.config.maxPositions,
      edge: decision.edge
    });

    if (guardedNotionalUsd <= 0) {
      droppedDecisionCount += 1;
      return [];
    }

    projectedExposureUsd += guardedNotionalUsd;
    projectedEventExposureUsd.set(
      decision.event_slug,
      (projectedEventExposureUsd.get(decision.event_slug) ?? 0) + guardedNotionalUsd
    );
    projectedOpenPositions += 1;
    return [
      {
        ...decision,
        notional_usd: guardedNotionalUsd
      }
    ];
  });

  return {
    decisionSet: {
      ...input.decisionSet,
      decisions
    },
    droppedDecisionCount
  };
}

export function persistPaperRecommendation(input: {
  state: LocalAppState;
  promptSummary: string;
  reasoningMd: string;
  logsMd: string;
  decisionSet: TradeDecisionSet;
}) {
  const now = input.decisionSet.generated_at_utc;
  const runSummary: PublicRunSummary = {
    id: input.decisionSet.run_id,
    mode: input.decisionSet.mode,
    runtime: input.decisionSet.runtime,
    status: "awaiting-approval",
    bankroll_usd: input.decisionSet.bankroll_usd,
    decision_count: input.decisionSet.decisions.length,
    generated_at_utc: now
  };
  const runDetail: PublicRunDetail = {
    ...runSummary,
    prompt_summary: input.promptSummary,
    reasoning_md: input.reasoningMd,
    logs_md: input.logsMd,
    decisions: input.decisionSet.decisions,
    artifacts: input.decisionSet.artifacts,
    tracked_sources: buildTrackedSources(input.decisionSet.run_id, input.decisionSet.decisions),
    resolution_checks: []
  };
  const artifactList = toArtifactListItems(input.decisionSet.artifacts);

  return {
    ...input.state,
    overview: {
      ...input.state.overview,
      last_run_at: now
    },
    runs: [runSummary, ...input.state.runs.filter((run) => run.id !== runSummary.id)],
    runDetails: {
      ...input.state.runDetails,
      [runSummary.id]: runDetail
    },
    reports: mergeArtifactLists(
      input.state.reports,
      artifactList,
      (artifact) => artifact.kind !== "backtest-report"
    ),
    backtests: mergeArtifactLists(
      input.state.backtests,
      artifactList,
      (artifact) => artifact.kind === "backtest-report"
    ),
    actionLog: [...input.state.actionLog, `${now} recommend-run ${runSummary.id}`]
  };
}

function resolvePendingRunId(state: LocalAppState, options: { runId?: string; latest?: boolean }) {
  if (options.runId) {
    return options.runId;
  }

  if (options.latest) {
    return state.runs.find((run) => run.status === "awaiting-approval")?.id ?? null;
  }

  return null;
}

function replacePosition(positions: PublicPosition[], nextPosition: PublicPosition | null, tokenId: string) {
  const remaining = positions.filter((position) => position.token_id !== tokenId);
  return nextPosition ? [nextPosition, ...remaining] : remaining;
}

export function approvePaperRun(input: {
  state: LocalAppState;
  config: Pick<OrchestratorConfig, "drawdownStopPct">;
  runId?: string;
  latest?: boolean;
}) {
  const resolvedRunId = resolvePendingRunId(input.state, input);
  if (!resolvedRunId) {
    throw new Error("No awaiting-approval run is available.");
  }

  const runDetail = input.state.runDetails[resolvedRunId];
  if (!runDetail) {
    throw new Error(`Run ${resolvedRunId} was not found in local state.`);
  }
  if (runDetail.status !== "awaiting-approval") {
    throw new Error(`Run ${resolvedRunId} is already ${runDetail.status}.`);
  }

  const timestampUtc = new Date().toISOString();
  let positions = [...input.state.positions];
  let cashBalanceUsd = input.state.overview.cash_balance_usd;
  const trades = [...input.state.trades];
  let executedTradeCount = 0;

  for (const decision of runDetail.decisions) {
    if (!["open", "close", "reduce"].includes(decision.action)) {
      continue;
    }

    const currentPosition = positions.find((position) => position.token_id === decision.token_id) ?? null;
    const executionAmount =
      decision.side === "BUY"
        ? decision.notional_usd
        : inferPaperSellAmount(currentPosition, decision);
    const orderResult = buildPaperOrderResult({
      side: decision.side,
      amount: executionAmount
    });
    const tradeResult = applyPaperTradeDecision({
      position: currentPosition,
      decision,
      avgPrice: orderResult.avgPrice,
      timestampUtc
    });

    trades.unshift({
      id: randomUUID(),
      market_slug: decision.market_slug,
      token_id: decision.token_id,
      status: tradeResult.status,
      side: decision.side,
      requested_notional_usd: decision.notional_usd,
      filled_notional_usd: tradeResult.filledNotionalUsd,
      avg_price: tradeResult.status === "filled" ? tradeResult.avgPrice : null,
      order_id: tradeResult.status === "filled" ? `paper-${resolvedRunId}-${executedTradeCount + 1}` : null,
      timestamp_utc: timestampUtc
    });

    if (tradeResult.status !== "filled") {
      continue;
    }

    executedTradeCount += 1;
    cashBalanceUsd += decision.side === "BUY" ? -tradeResult.filledNotionalUsd : tradeResult.filledNotionalUsd;
    positions = replacePosition(positions, tradeResult.nextPosition, decision.token_id);
  }

  const totalExposureUsd = positions.reduce((sum, position) => sum + position.current_value_usd, 0);
  const totalEquityUsd = roundCurrency(cashBalanceUsd + totalExposureUsd);
  const highWaterMarkUsd = Math.max(input.state.overview.high_water_mark_usd, totalEquityUsd);
  const drawdownPct = calculateDrawdownPct({ totalEquityUsd, highWaterMarkUsd });
  const halted = shouldHaltForDrawdown({ totalEquityUsd, highWaterMarkUsd }, input.config.drawdownStopPct);
  const nextOverviewStatus: LocalAppState["overview"]["status"] = halted
    ? "halted"
    : input.state.overview.status === "paused"
      ? "paused"
      : "running";
  const nextRuns: PublicRunSummary[] = input.state.runs.map((run) =>
    run.id === resolvedRunId ? { ...run, status: "completed" as const } : run
  );
  const nextRunDetails: LocalAppState["runDetails"] = {
    ...input.state.runDetails,
    [resolvedRunId]: {
      ...runDetail,
      status: "completed"
    }
  };

  return {
    runId: resolvedRunId,
    executedTradeCount,
    state: {
      ...input.state,
      positions,
      trades,
      runs: nextRuns,
      runDetails: nextRunDetails,
      overview: {
        ...input.state.overview,
        status: nextOverviewStatus,
        cash_balance_usd: roundCurrency(cashBalanceUsd),
        total_equity_usd: totalEquityUsd,
        high_water_mark_usd: roundCurrency(highWaterMarkUsd),
        drawdown_pct: Number(drawdownPct.toFixed(6)),
        open_positions: positions.length,
        last_run_at: timestampUtc,
        latest_risk_event: halted
          ? `Paper approval halted the system at ${(drawdownPct * 100).toFixed(2)}% drawdown.`
          : `Paper run ${resolvedRunId} approved and executed.`,
        equity_curve: appendEquityPoint(input.state, timestampUtc, totalEquityUsd, drawdownPct)
      },
      actionLog: [...input.state.actionLog, `${timestampUtc} approve-run ${resolvedRunId}`]
    }
  };
}
