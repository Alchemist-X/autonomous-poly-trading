import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type {
  OverviewResponse,
  PublicPosition,
  PublicRunDetail,
  PublicTrade,
  TradeDecisionSet
} from "@autopoly/contracts";
import type { PulseSnapshot } from "../pulse/market-pulse.js";
import type { PositionReviewResult, PulseEntryPlan } from "../runtime/decision-metadata.js";
import { buildEnglishMirrorRelativePath } from "./artifacts.js";
import {
  buildBacktestReportArtifact,
  buildPortfolioReportArtifacts
} from "./portfolio-report-artifacts.js";

function createOverview(): OverviewResponse {
  return {
    status: "running",
    cash_balance_usd: 18,
    total_equity_usd: 20,
    high_water_mark_usd: 20,
    drawdown_pct: 0.02,
    open_positions: 1,
    last_run_at: null,
    latest_risk_event: null,
    equity_curve: []
  };
}

function createPositions(): PublicPosition[] {
  return [
    {
      id: "position-1",
      event_slug: "demo-event",
      market_slug: "demo-market",
      token_id: "token-1",
      side: "BUY",
      outcome_label: "No",
      size: 3,
      avg_cost: 0.42,
      current_price: 0.38,
      current_value_usd: 1.14,
      unrealized_pnl_pct: -0.095238,
      stop_loss_pct: 0.3,
      opened_at: "2026-03-17T00:00:00.000Z",
      updated_at: "2026-03-17T00:00:00.000Z"
    }
  ];
}

function createPulse(): PulseSnapshot {
  return {
    id: "pulse-1",
    generatedAtUtc: "2026-03-17T00:00:00.000Z",
    title: "Daily Pulse",
    relativeMarkdownPath: "reports/pulse/demo.md",
    absoluteMarkdownPath: "/tmp/reports/pulse/demo.md",
    relativeJsonPath: "reports/pulse/demo.json",
    absoluteJsonPath: "/tmp/reports/pulse/demo.json",
    markdown: "# Pulse",
    totalFetched: 10,
    totalFiltered: 5,
    selectedCandidates: 2,
    minLiquidityUsd: 5000,
    fetchConfig: {
      pagesPerDimension: 5,
      eventsPerPage: 50,
      minFetchedMarkets: 5000,
      dimensions: ["volume24hr", "liquidity", "startDate", "competitive"]
    },
    categoryStats: { fetched: [], filtered: [] },
    tagStats: { fetched: [], filtered: [] },
    candidates: [],
    riskFlags: ["spread widened"],
    tradeable: true
  };
}

function createDecisionSet(): TradeDecisionSet {
  return {
    run_id: "11111111-1111-4111-8111-111111111111",
    runtime: "pulse-direct-runtime",
    generated_at_utc: "2026-03-17T00:00:00.000Z",
    bankroll_usd: 20,
    mode: "full",
    decisions: [
      {
        action: "open",
        event_slug: "demo-event",
        market_slug: "open-market",
        token_id: "token-open",
        side: "BUY",
        notional_usd: 2,
        order_type: "FOK",
        ai_prob: 0.61,
        market_prob: 0.52,
        edge: 0.09,
        confidence: "medium",
        thesis_md: "Positive edge.",
        sources: [
          {
            title: "Pulse",
            url: "https://example.com/pulse",
            retrieved_at_utc: "2026-03-17T00:00:00.000Z"
          }
        ],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      }
    ],
    artifacts: []
  };
}

function createPositionReviews(): PositionReviewResult[] {
  return [
    {
      position: createPositions()[0]!,
      action: "hold",
      stillHasEdge: true,
      edgeAssessment: "yes",
      edgeValue: 0,
      pulseCoverage: "none",
      evidenceRefreshStatus: "not-refreshed",
      freshEvidence: [
        "Fresh mark snapshot: current price 0.3800, average cost 0.5000, unrealized PnL -24.00%, marked value $1.14.",
        "No fresh Pulse research covered this held token in the current run."
      ],
      adverseSignals: [
        "No direct opposing Pulse signal was found, but the position also has no refreshed external evidence in this run."
      ],
      stopOrReduceTriggers: [
        "Close if unrealized PnL breaches configured stop-loss (30.0%).",
        "Require a fresh evidence refresh before upgrading this position back to active edge."
      ],
      pnlSnapshot: {
        currentValueUsd: 1.14,
        avgCost: 0.5,
        currentPrice: 0.38,
        unrealizedPnlPct: -0.24,
        stopLossPct: 0.3
      },
      humanReviewFlag: true,
      confidence: "low",
      reason: "No contradictory pulse signal was found, but there was no fresh dedicated pulse support.",
      reviewConclusion: "Keep the position unchanged for now, but require human review because no fresh Pulse edge refresh was produced.",
      suggestedExitPct: 0,
      basis: "no-fresh-signal",
      decision: {
        action: "hold",
        event_slug: "demo-event",
        market_slug: "demo-market",
        token_id: "token-1",
        side: "BUY",
        notional_usd: 1.14,
        order_type: "FOK",
        ai_prob: 0.38,
        market_prob: 0.38,
        edge: 0,
        confidence: "low",
        thesis_md: "Keep for now.",
        sources: [
          {
            title: "Position",
            url: "runtime-context://positions/position-1",
            retrieved_at_utc: "2026-03-17T00:00:00.000Z"
          }
        ],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      }
    }
  ];
}

function createEntryPlans(): PulseEntryPlan[] {
  return [
    {
      eventSlug: "demo-event-2",
      marketSlug: "demo-market-open",
      tokenId: "token-open",
      outcomeLabel: "No",
      side: "BUY",
      suggestedPct: 0.1,
      fullKellyPct: 0.4,
      quarterKellyPct: 0.1,
      reportedSuggestedPct: 0.1,
      liquidityCapUsd: null,
      aiProb: 0.63,
      marketProb: 0.56,
      monthlyReturn: 0.007,
      daysToResolution: 90,
      resolutionSource: "market" as const,
      entryFeePct: 0,
      roundTripFeePct: 0,
      netEdge: 0.07,
      categorySlug: null,
      confidence: "medium",
      thesisMd: "Open because edge is positive.",
      sources: [
        {
          title: "Pulse",
          url: "https://example.com/open",
          retrieved_at_utc: "2026-03-17T00:00:00.000Z"
        }
      ],
      decision: {
        action: "open",
        event_slug: "demo-event-2",
        market_slug: "demo-market-open",
        token_id: "token-open",
        side: "BUY",
        notional_usd: 2,
        order_type: "FOK",
        ai_prob: 0.63,
        market_prob: 0.56,
        edge: 0.07,
        confidence: "medium",
        thesis_md: "Open because edge is positive.",
        sources: [
          {
            title: "Pulse",
            url: "https://example.com/open",
            retrieved_at_utc: "2026-03-17T00:00:00.000Z"
          }
        ],
        full_kelly_pct: 0.4,
        quarter_kelly_pct: 0.1,
        reported_suggested_pct: 0.1,
        liquidity_cap_usd: null,
        stop_loss_pct: 0.3,
        resolution_track_required: true
      }
    }
  ];
}

function createRunDetails(): PublicRunDetail[] {
  return [
    {
      id: "run-1",
      mode: "full",
      runtime: "pulse-direct-runtime",
      status: "completed",
      bankroll_usd: 20,
      decision_count: 1,
      generated_at_utc: "2026-03-17T00:00:00.000Z",
      prompt_summary: "Prompt summary",
      reasoning_md: "Reasoning summary",
      logs_md: "- log line",
      decisions: createDecisionSet().decisions,
      artifacts: [],
      tracked_sources: [],
      resolution_checks: []
    },
    {
      id: "run-2",
      mode: "review",
      runtime: "pulse-direct-runtime",
      status: "completed",
      bankroll_usd: 20,
      decision_count: 1,
      generated_at_utc: "2026-03-16T12:00:00.000Z",
      prompt_summary: "Prompt summary 2",
      reasoning_md: "Reasoning summary 2",
      logs_md: "- log line 2",
      decisions: [
        {
          ...createDecisionSet().decisions[0]!,
          market_slug: "second-open-market",
          token_id: "token-open-2",
          edge: 0.12,
          notional_usd: 3
        }
      ],
      artifacts: [],
      tracked_sources: [],
      resolution_checks: []
    }
  ];
}

function createTrades(): PublicTrade[] {
  return [
    {
      id: "trade-1",
      market_slug: "open-market",
      token_id: "token-open",
      status: "filled",
      side: "BUY",
      requested_notional_usd: 2,
      filled_notional_usd: 2,
      avg_price: 0.52,
      order_id: "order-1",
      timestamp_utc: "2026-03-17T00:05:00.000Z"
    },
    {
      id: "trade-2",
      market_slug: "second-open-market",
      token_id: "token-open-2",
      status: "submitted",
      side: "BUY",
      requested_notional_usd: 3,
      filled_notional_usd: 0,
      avg_price: null,
      order_id: "order-2",
      timestamp_utc: "2026-03-16T12:05:00.000Z"
    }
  ];
}

describe("portfolio report artifacts", () => {
  it("writes review, monitor, and rebalance artifacts with English mirrors", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autopoly-portfolio-reports-"));
    try {
      const artifacts = await buildPortfolioReportArtifacts({
        config: { artifactStorageRoot: tempDir },
        overview: createOverview(),
        positions: createPositions(),
        pulse: createPulse(),
        decisionSet: createDecisionSet(),
        promptSummary: "Prompt summary",
        reasoningMd: "Reasoning summary",
        positionReviews: createPositionReviews(),
        entryPlans: createEntryPlans()
      });

      expect(artifacts.map((artifact) => artifact.kind)).toEqual([
        "review-report",
        "monitor-report",
        "rebalance-report"
      ]);

      const reviewPath = path.join(tempDir, artifacts[0]!.path);
      const reviewEnglishPath = path.join(tempDir, buildEnglishMirrorRelativePath(artifacts[0]!.path));
      const rebalancePath = path.join(tempDir, artifacts[2]!.path);
      const rebalanceEnglishPath = path.join(tempDir, buildEnglishMirrorRelativePath(artifacts[2]!.path));
      const reviewContent = await readFile(reviewPath, "utf8");
      const reviewEnglishContent = await readFile(reviewEnglishPath, "utf8");
      const rebalanceContent = await readFile(rebalancePath, "utf8");
      const rebalanceEnglishContent = await readFile(rebalanceEnglishPath, "utf8");

      expect(reviewContent).toContain("# 组合复盘报告");
      expect(reviewContent).toContain("## 人工优先核对");
      expect(reviewContent).toContain("仍有 edge：是");
      expect(reviewContent).toContain("Pulse 覆盖：none");
      expect(reviewContent).toContain("证据刷新：not-refreshed");
      expect(reviewContent).toContain("fresh evidence");
      expect(reviewContent).toContain("归因：no-fresh-signal");
      expect(reviewContent).toContain("人工复核：是");
      expect(reviewContent).toContain("## 新开仓建议");
      expect(reviewContent).toContain("1/4 Kelly 10.00% -> $2.00");
      expect(reviewEnglishContent).toContain("# Portfolio Review Report");
      expect(reviewEnglishContent).toContain("still has edge: yes");
      expect(reviewEnglishContent).toContain("pulse coverage: none");
      expect(reviewEnglishContent).toContain("evidence refresh: not-refreshed");
      expect(reviewEnglishContent).toContain("Quarter Kelly 10.00% -> $2.00");
      expect(rebalanceContent).toContain("口径：基于当前持仓 + 本轮决策提案估算结构变化");
      expect(rebalanceContent).toContain("按 1/4 Kelly 目标与 liquidity_cap_usd 取更小值");
      expect(rebalanceEnglishContent).toContain("proposal-based structure view");
      expect(rebalanceEnglishContent).toContain("the smaller of quarter-Kelly target and liquidity_cap_usd");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("drops zero-value event exposures from the rebalance after-state", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autopoly-rebalance-zero-exposure-"));
    try {
      const closeDecisionSet: TradeDecisionSet = {
        ...createDecisionSet(),
        decisions: [
          {
            ...createDecisionSet().decisions[0]!,
            action: "close",
            market_slug: "demo-market",
            token_id: "token-1",
            notional_usd: createPositions()[0]!.current_value_usd
          }
        ]
      };

      const artifacts = await buildPortfolioReportArtifacts({
        config: { artifactStorageRoot: tempDir },
        overview: createOverview(),
        positions: createPositions(),
        pulse: createPulse(),
        decisionSet: closeDecisionSet,
        promptSummary: "Prompt summary",
        reasoningMd: "Reasoning summary",
        positionReviews: createPositionReviews(),
        entryPlans: []
      });

      const rebalancePath = path.join(tempDir, artifacts[2]!.path);
      const rebalanceContent = await readFile(rebalancePath, "utf8");

      expect(rebalanceContent).toContain("运行前事件敞口数：1");
      expect(rebalanceContent).toContain("运行后事件敞口数：0");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes a bilingual backtest artifact", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autopoly-backtest-report-"));
    try {
      const artifact = await buildBacktestReportArtifact({
        config: { artifactStorageRoot: tempDir },
        generatedAtUtc: "2026-03-17T00:00:00.000Z",
        runId: "22222222-2222-4222-8222-222222222222",
        overview: createOverview(),
        positions: createPositions(),
        runDetails: createRunDetails(),
        trades: createTrades(),
        lookbackDays: 21
      });

      const zhPath = path.join(tempDir, artifact.path);
      const enPath = path.join(tempDir, buildEnglishMirrorRelativePath(artifact.path));
      expect(await readFile(zhPath, "utf8")).toContain("# 推荐回测报告");
      expect(await readFile(zhPath, "utf8")).toContain("## 数据充足度总览");
      expect(await readFile(zhPath, "utf8")).toContain("已实现 / 未实现盈亏拆分");
      expect(await readFile(enPath, "utf8")).toContain("# Recommendation Backtest Report");
      expect(await readFile(enPath, "utf8")).toContain("## Data Sufficiency Overview");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
