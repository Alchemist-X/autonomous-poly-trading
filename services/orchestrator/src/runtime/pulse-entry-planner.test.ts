import { describe, expect, it } from "vitest";
import type { RuntimeExecutionContext } from "./agent-runtime.js";
import type { PulseEntryPlan } from "./decision-metadata.js";
import {
  applyBatchCap,
  buildPulseEntryPlans,
  calculateMonthlyReturn,
  rankByMonthlyReturn
} from "./pulse-entry-planner.js";

const FIXED_NOW_MS = new Date("2026-03-17T00:00:00.000Z").getTime();

function createContext(markdown: string, overrides?: {
  candidates?: RuntimeExecutionContext["pulse"]["candidates"];
  totalEquityUsd?: number;
  reviewPositionsOnly?: boolean;
}): RuntimeExecutionContext {
  return {
    runId: "11111111-1111-4111-8111-111111111111",
    mode: "full",
    overview: {
      status: "running",
      cash_balance_usd: overrides?.totalEquityUsd ?? 20,
      total_equity_usd: overrides?.totalEquityUsd ?? 20,
      high_water_mark_usd: overrides?.totalEquityUsd ?? 20,
      drawdown_pct: 0,
      open_positions: 0,
      last_run_at: null,
      latest_risk_event: null,
      equity_curve: []
    },
    positions: [],
    pulse: {
      id: "pulse-1",
      generatedAtUtc: "2026-03-17T00:00:00.000Z",
      title: "Pulse",
      relativeMarkdownPath: "reports/pulse/demo.md",
      absoluteMarkdownPath: "/tmp/reports/pulse/demo.md",
      relativeJsonPath: "reports/pulse/demo.json",
      absoluteJsonPath: "/tmp/reports/pulse/demo.json",
      markdown,
      totalFetched: 10,
      totalFiltered: 5,
      selectedCandidates: overrides?.candidates?.length ?? 1,
      minLiquidityUsd: 5000,
      fetchConfig: {
        pagesPerDimension: 5,
        eventsPerPage: 50,
        minFetchedMarkets: 5000,
        dimensions: ["volume24hr", "liquidity", "startDate", "competitive"]
      },
      categoryStats: { fetched: [], filtered: [] },
      tagStats: { fetched: [], filtered: [] },
      candidates: overrides?.candidates ?? [
        {
          question: "Demo market question",
          eventSlug: "demo-event",
          marketSlug: "demo-market",
          url: "https://example.com/demo-market",
          liquidityUsd: 10000,
          volume24hUsd: 1000,
          outcomes: ["Yes", "No"],
          outcomePrices: [0.42, 0.58],
          clobTokenIds: ["token-yes", "token-no"],
          endDate: "2026-12-31T00:00:00Z",
          bestBid: 0.41,
          bestAsk: 0.43,
          spread: 0.02,
          categorySlug: "geopolitics",
          categoryLabel: "Geopolitics",
          categorySource: null,
          tags: []
        }
      ],
      riskFlags: [],
      tradeable: true
    },
    reviewPositionsOnly: overrides?.reviewPositionsOnly
  };
}

describe("pulse entry planner", () => {
  it("parses open plans from pulse markdown", () => {
    const markdown = [
      "## 1. Demo market question",
      "",
      "**\u94FE\u63A5\uFF1A** https://example.com/demo-market",
      "",
      "| \u65B9\u5411 | \u4E70\u5165 No |",
      "| \u5EFA\u8BAE\u4ED3\u4F4D | 10% |",
      "| **\u7F6E\u4FE1\u5EA6\uFF1A** \u4E2D |",
      "",
      "| No | 58% | 63% |",
      "",
      "### \u63A8\u7406\u903B\u8F91",
      "Because the No side still has edge."
    ].join("\n");

    const plans = buildPulseEntryPlans({
      context: createContext(markdown),
      positionStopLossPct: 0.3,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.marketSlug).toBe("demo-market");
    expect(plans[0]?.decision.action).toBe("open");
    expect(plans[0]?.decision.notional_usd).toBeCloseTo(0.5952, 4);
    expect(plans[0]?.quarterKellyPct).toBeCloseTo(0.029762, 6);
    expect(plans[0]?.decision.reported_suggested_pct).toBe(0.1);
    expect(plans[0]?.daysToResolution).toBe(289);
    expect(plans[0]?.monthlyReturn).toBeCloseTo(0.005190, 4);
  });

  it("accepts english labels and unnumbered sections", () => {
    const markdown = [
      "## Demo market question",
      "",
      "**Link:** https://example.com/demo-market",
      "",
      "| Direction | Buy Yes |",
      "| Suggested Size | 5% |",
      "| Confidence | medium-high |",
      "",
      "| Yes | 42% | 48% |",
      "",
      "### Reasoning",
      "The Yes side still has a modest edge."
    ].join("\n");

    const plans = buildPulseEntryPlans({
      context: createContext(markdown),
      positionStopLossPct: 0.3,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.outcomeLabel).toBe("Yes");
    expect(plans[0]?.decision.notional_usd).toBeCloseTo(0.5172, 4);
    expect(plans[0]?.confidence).toBe("medium-high");
    expect(plans[0]?.sources[0]?.url).toBe("https://example.com/demo-market");
    expect(plans[0]?.daysToResolution).toBe(289);
    expect(plans[0]?.monthlyReturn).toBeCloseTo(0.006228, 4);
  });

  it("extracts outcome label even when wrapped in markdown bold markers", () => {
    // LLM output often uses **No** / **Yes** to emphasize the outcome
    const markdown = [
      "## Demo market question",
      "",
      "**链接：** https://example.com/demo-market",
      "",
      "| 方向 | 买入 **No** @ 限价 0.39（No ask）|",
      "| 建议仓位 | 6.6% |",
      "| 置信度 | 低 |",
      "",
      "| Yes | 42% | 30% |",
      "| No | 58% | 70% |",
      "",
      "### 推理逻辑",
      "Bold markdown around No should still parse correctly."
    ].join("\n");

    const plans = buildPulseEntryPlans({
      context: createContext(markdown),
      positionStopLossPct: 0.3,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.outcomeLabel).toBe("No");
  });

  it("parses deterministic fallback-style open tables", () => {
    const markdown = [
      "## 1. Demo market question",
      "",
      "**\u94FE\u63A5\uFF1A** https://example.com/demo-market",
      "**Fallback \u72B6\u6001\uFF1A** \u672C\u5730 provisional \u5F00\u4ED3\u5019\u9009",
      "**\u7F6E\u4FE1\u5EA6\uFF1A** \u4E2D",
      "",
      "| \u65B9\u5411 | \u4E70\u5165 No |",
      "| \u5EFA\u8BAE\u4ED3\u4F4D | 10% |",
      "",
      "| Outcome | Market | AI |",
      "| --- | --- | --- |",
      "| Yes | 42.0% | 32.0% |",
      "| No | 58.0% | 68.0% |",
      "",
      "### \u63A8\u7406\u903B\u8F91",
      "Fallback generated one provisional open candidate."
    ].join("\n");

    const plans = buildPulseEntryPlans({
      context: createContext(markdown),
      positionStopLossPct: 0.3,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.outcomeLabel).toBe("No");
    expect(plans[0]?.decision.edge).toBeCloseTo(0.1);
    expect(plans[0]?.decision.notional_usd).toBeCloseTo(1.1905, 4);
    expect(plans[0]?.sources[0]?.url).toBe("https://example.com/demo-market");
    expect(plans[0]?.daysToResolution).toBe(289);
    expect(plans[0]?.monthlyReturn).toBeCloseTo(0.010381, 4);
  });

  it("keeps raw quarter Kelly as the decision target and stores liquidity cap separately", () => {
    const markdown = [
      "## 1. Demo market question",
      "",
      "**\u94FE\u63A5\uFF1A** https://example.com/demo-market",
      "| \u65B9\u5411 | \u4E70\u5165 No |",
      "| \u5EFA\u8BAE\u4ED3\u4F4D | 4% |",
      "| \u6D41\u52A8\u6027\u4E0A\u9650 | $0.80 |",
      "| \u7F6E\u4FE1\u5EA6 | \u4E2D |",
      "",
      "| No | 58% | 68% |",
      "",
      "### \u63A8\u7406\u903B\u8F91",
      "Raw Kelly stays in the decision, while liquidity is stored as a separate cap."
    ].join("\n");

    const plans = buildPulseEntryPlans({
      context: createContext(markdown),
      positionStopLossPct: 0.3,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.quarterKellyPct).toBeCloseTo(0.059524, 6);
    expect(plans[0]?.suggestedPct).toBeCloseTo(0.059524, 6);
    expect(plans[0]?.liquidityCapUsd).toBe(0.8);
    expect(plans[0]?.decision.notional_usd).toBeCloseTo(1.1905, 4);
    expect(plans[0]?.decision.liquidity_cap_usd).toBe(0.8);
    expect(plans[0]?.decision.execution_amount).toBeUndefined();
  });

  it("does not bind a same-event strike by URL when the section title names a different threshold", () => {
    const sharedUrl = "https://polymarket.com/event/cl-hit-jun-2026";
    const candidates = [
      {
        question: "Will Crude Oil (CL) hit (HIGH) $115 by end of June?",
        eventSlug: "cl-hit-jun-2026",
        marketSlug: "will-crude-oil-cl-hit-high-115-by-end-of-june",
        url: sharedUrl,
        liquidityUsd: 45000,
        volume24hUsd: 6900,
        outcomes: ["Yes", "No"],
        outcomePrices: [0.5435, 0.4565],
        clobTokenIds: ["token-115-yes", "token-115-no"],
        endDate: "2026-06-30T18:30:00Z",
        bestBid: 0.543,
        bestAsk: 0.544,
        spread: 0.001,
        categorySlug: "commodities",
        categoryLabel: "Commodities",
        categorySource: null,
        tags: [] as Array<{ slug: string; label: string }>
      },
      {
        question: "Will Crude Oil (CL) hit (HIGH) $200 by end of June?",
        eventSlug: "cl-hit-jun-2026",
        marketSlug: "will-crude-oil-cl-hit-high-200-by-end-of-june",
        url: sharedUrl,
        liquidityUsd: 236000,
        volume24hUsd: 32100,
        outcomes: ["Yes", "No"],
        outcomePrices: [0.0605, 0.9395],
        clobTokenIds: ["token-200-yes", "token-200-no"],
        endDate: "2026-06-30T18:30:00Z",
        bestBid: 0.06,
        bestAsk: 0.061,
        spread: 0.001,
        categorySlug: "commodities",
        categoryLabel: "Commodities",
        categorySource: null,
        tags: [] as Array<{ slug: string; label: string }>
      }
    ];
    const markdown = [
      "## 1. Crude Oil (CL) hit (HIGH) $200 by end of June 2026",
      "",
      `**链接：** ${sharedUrl}`,
      "| 方向 | 买入 No |",
      "| 建议仓位 | 15% |",
      "| 置信度 | 高 |",
      "",
      "| No | 93.95% | 99% |",
      "",
      "### 推理逻辑",
      "$200 is an extreme tail strike."
    ].join("\n");

    const plans = buildPulseEntryPlans({
      context: createContext(markdown, { candidates, totalEquityUsd: 1000 }),
      positionStopLossPct: 0.3,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.marketSlug).toBe("will-crude-oil-cl-hit-high-200-by-end-of-june");
    expect(plans[0]?.tokenId).toBe("token-200-no");
    expect(plans[0]?.decision.market_slug).toBe("will-crude-oil-cl-hit-high-200-by-end-of-june");
    expect(plans[0]?.decision.token_id).toBe("token-200-no");
    expect(plans[0]?.decision.outcome_label).toBe("No");
  });

  it("keeps both probability rows for position-only reviews even when one edge is negative", () => {
    const markdown = [
      "## 1. Demo market question",
      "",
      "**链接：** https://example.com/demo-market",
      "**模型当前更支持的一侧：** 买入 Yes",
      "**置信度：** 低",
      "",
      "| 结果 | 市场定价 | AI 估算 | Edge |",
      "| --- | --- | --- | --- |",
      "| Yes | 42% | 43% | +1% |",
      "| No | 58% | 57% | -1% |",
      "",
      "### 推理逻辑",
      "Position-only review keeps the held side edge visible."
    ].join("\n");

    const plans = buildPulseEntryPlans({
      context: createContext(markdown, { reviewPositionsOnly: true }),
      positionStopLossPct: 0.3,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(2);
    expect(plans.map((plan) => plan.outcomeLabel).sort()).toEqual(["No", "Yes"]);
    expect(plans.find((plan) => plan.outcomeLabel === "No")?.aiProb).toBeCloseTo(0.57);
    expect(plans.find((plan) => plan.outcomeLabel === "No")?.marketProb).toBeCloseTo(0.58);
    expect(plans.find((plan) => plan.outcomeLabel === "No")?.decision.edge).toBeCloseTo(-0.01);
  });
});

describe("calculateMonthlyReturn", () => {
  it("computes monthly return from edge and days to resolution", () => {
    const result = calculateMonthlyReturn({
      aiProb: 0.63,
      marketProb: 0.58,
      endDate: "2026-12-31T00:00:00Z",
      nowMs: FIXED_NOW_MS
    });

    expect(result.daysToResolution).toBe(289);
    expect(result.monthlyReturn).toBeCloseTo(0.005190, 4);
  });

  it("clamps daysToResolution to at least 1 for markets ending today", () => {
    const result = calculateMonthlyReturn({
      aiProb: 0.60,
      marketProb: 0.50,
      endDate: "2026-03-17T00:00:00.000Z",
      nowMs: FIXED_NOW_MS
    });

    expect(result.daysToResolution).toBe(1);
    expect(result.monthlyReturn).toBeCloseTo(0.10 / (1 / 30), 4);
  });

  it("uses 180-day fallback for invalid endDate", () => {
    const result = calculateMonthlyReturn({
      aiProb: 0.60,
      marketProb: 0.50,
      endDate: "invalid-date",
      nowMs: FIXED_NOW_MS
    });

    expect(result.daysToResolution).toBe(180);
    expect(result.monthlyReturn).toBeCloseTo(0.10 / (180 / 30), 4);
  });
});

describe("rankByMonthlyReturn", () => {
  function makePlan(slug: string, monthlyReturn: number): PulseEntryPlan {
    return {
      eventSlug: "event",
      marketSlug: slug,
      tokenId: `token-${slug}`,
      outcomeLabel: "Yes",
      side: "BUY",
      suggestedPct: 0.05,
      fullKellyPct: 0.2,
      quarterKellyPct: 0.05,
      reportedSuggestedPct: null,
      liquidityCapUsd: null,
      aiProb: 0.6,
      marketProb: 0.5,
      monthlyReturn,
      daysToResolution: 90,
      resolutionSource: "market" as const,
      entryFeePct: 0,
      roundTripFeePct: 0,
      netEdge: 0.1,
      categorySlug: null,
      confidence: "medium",
      thesisMd: "Thesis",
      sources: [],
      decision: {
        action: "open",
        event_slug: "event",
        market_slug: slug,
        token_id: `token-${slug}`,
        side: "BUY",
        notional_usd: 10,
        order_type: "FOK",
        ai_prob: 0.6,
        market_prob: 0.5,
        edge: 0.1,
        confidence: "medium",
        thesis_md: "Thesis",
        sources: [],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      }
    };
  }

  it("sorts by monthlyReturn descending and takes top N", () => {
    const plans = [
      makePlan("low", 0.01),
      makePlan("high", 0.05),
      makePlan("mid", 0.03),
      makePlan("very-high", 0.08),
      makePlan("medium", 0.02),
      makePlan("decent", 0.04)
    ];

    const ranked = rankByMonthlyReturn(plans, 4);

    expect(ranked).toHaveLength(4);
    expect(ranked.map((p) => p.marketSlug)).toEqual([
      "very-high",
      "high",
      "decent",
      "mid"
    ]);
  });

  it("returns all plans when fewer than maxPlans", () => {
    const plans = [makePlan("a", 0.05), makePlan("b", 0.03)];
    const ranked = rankByMonthlyReturn(plans, 4);
    expect(ranked).toHaveLength(2);
  });

  it("does not mutate the original array", () => {
    const plans = [makePlan("b", 0.01), makePlan("a", 0.05)];
    rankByMonthlyReturn(plans, 4);
    expect(plans[0]?.marketSlug).toBe("b");
  });
});

describe("applyBatchCap", () => {
  function makePlan(slug: string, notionalUsd: number): PulseEntryPlan {
    return {
      eventSlug: "event",
      marketSlug: slug,
      tokenId: `token-${slug}`,
      outcomeLabel: "Yes",
      side: "BUY",
      suggestedPct: 0.05,
      fullKellyPct: 0.2,
      quarterKellyPct: 0.05,
      reportedSuggestedPct: null,
      liquidityCapUsd: null,
      aiProb: 0.6,
      marketProb: 0.5,
      monthlyReturn: 0.01,
      daysToResolution: 90,
      resolutionSource: "market" as const,
      entryFeePct: 0,
      roundTripFeePct: 0,
      netEdge: 0.1,
      categorySlug: null,
      confidence: "medium",
      thesisMd: "Thesis",
      sources: [],
      decision: {
        action: "open",
        event_slug: "event",
        market_slug: slug,
        token_id: `token-${slug}`,
        side: "BUY",
        notional_usd: notionalUsd,
        order_type: "FOK",
        ai_prob: 0.6,
        market_prob: 0.5,
        edge: 0.1,
        confidence: "medium",
        thesis_md: "Thesis",
        sources: [],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      }
    };
  }

  it("does not scale when total notional is within cap", () => {
    const plans = [makePlan("a", 5), makePlan("b", 5)];
    const result = applyBatchCap(plans, 100, 0.2);

    expect(result[0]?.decision.notional_usd).toBe(5);
    expect(result[1]?.decision.notional_usd).toBe(5);
  });

  it("scales proportionally when total notional exceeds cap", () => {
    const plans = [makePlan("a", 15), makePlan("b", 15)];
    // bankroll 100, cap 20% = $20, total = $30, scaleFactor = 20/30 = 0.6667
    const result = applyBatchCap(plans, 100, 0.2);
    const totalScaled = result.reduce((sum, p) => sum + p.decision.notional_usd, 0);

    expect(totalScaled).toBeCloseTo(20, 2);
    expect(result[0]?.decision.notional_usd).toBeCloseTo(10, 4);
    expect(result[1]?.decision.notional_usd).toBeCloseTo(10, 4);
  });

  it("does not mutate the original plans", () => {
    const plans = [makePlan("a", 15), makePlan("b", 15)];
    applyBatchCap(plans, 100, 0.2);

    expect(plans[0]?.decision.notional_usd).toBe(15);
    expect(plans[1]?.decision.notional_usd).toBe(15);
  });
});

describe("buildPulseEntryPlans top-4 selection", () => {
  it("selects at most 4 plans ranked by monthly return", () => {
    const candidates = Array.from({ length: 6 }, (_, i) => ({
      question: `Market ${i}`,
      eventSlug: `event-${i}`,
      marketSlug: `market-${i}`,
      url: `https://example.com/market-${i}`,
      liquidityUsd: 10000,
      volume24hUsd: 1000,
      outcomes: ["Yes", "No"],
      outcomePrices: [0.40, 0.60],
      clobTokenIds: [`token-yes-${i}`, `token-no-${i}`],
      // Stagger end dates: sooner end = higher monthly return for same edge
      endDate: new Date(FIXED_NOW_MS + (30 + i * 60) * 86_400_000).toISOString(),
      bestBid: 0.39,
      bestAsk: 0.41,
      spread: 0.02,
      categorySlug: null,
      categoryLabel: null,
      categorySource: null,
      tags: [] as Array<{ slug: string; label: string }>
    }));

    const sections = candidates.map((c, i) => [
      `## ${i + 1}. ${c.question}`,
      "",
      `**Link:** ${c.url}`,
      "| Direction | Buy No |",
      "| Suggested Size | 5% |",
      "| Confidence | medium |",
      "",
      "| No | 60% | 70% |",
      "",
      "### Reasoning",
      `Edge on market ${i}.`
    ].join("\n"));

    const markdown = sections.join("\n\n");

    const plans = buildPulseEntryPlans({
      context: createContext(markdown, { candidates, totalEquityUsd: 1000 }),
      positionStopLossPct: 0.3,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(4);
    // First plan should be the one with the soonest end date (highest monthly return)
    expect(plans[0]?.marketSlug).toBe("market-0");
    expect(plans[1]?.marketSlug).toBe("market-1");
  });

  it("can temporarily limit entries to one best plan with fixed $5 sizing", () => {
    const candidates = Array.from({ length: 3 }, (_, i) => ({
      question: `Limited Market ${i}`,
      eventSlug: `limited-event-${i}`,
      marketSlug: `limited-market-${i}`,
      url: `https://example.com/limited-market-${i}`,
      liquidityUsd: 10000,
      volume24hUsd: 1000,
      outcomes: ["Yes", "No"],
      outcomePrices: [0.40, 0.60],
      clobTokenIds: [`limited-token-yes-${i}`, `limited-token-no-${i}`],
      endDate: new Date(FIXED_NOW_MS + (30 + i * 60) * 86_400_000).toISOString(),
      bestBid: 0.39,
      bestAsk: 0.41,
      spread: 0.02,
      categorySlug: null,
      categoryLabel: null,
      categorySource: null,
      tags: [] as Array<{ slug: string; label: string }>
    }));
    const markdown = candidates.map((candidate, index) => [
      `## ${index + 1}. ${candidate.question}`,
      "",
      `**Link:** ${candidate.url}`,
      "| Direction | Buy No |",
      "| Confidence | medium |",
      "",
      "| No | 60% | 70% |",
      "",
      "### Reasoning",
      `Edge on limited market ${index}.`
    ].join("\n")).join("\n\n");

    const plans = buildPulseEntryPlans({
      context: createContext(markdown, { candidates, totalEquityUsd: 1000 }),
      positionStopLossPct: 0.3,
      maxPlans: 1,
      fixedNotionalUsd: 5,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.marketSlug).toBe("limited-market-0");
    expect(plans[0]?.decision.notional_usd).toBe(5);
  });
});

describe("buildPulseEntryPlans fee integration", () => {
  it("populates fee fields from category slug and uses netEdge for ranking", () => {
    const markdown = [
      "## 1. Demo market question",
      "",
      "**Link:** https://example.com/demo-market",
      "",
      "| Direction | Buy No |",
      "| Suggested Size | 10% |",
      "| Confidence | medium |",
      "",
      "| No | 58% | 63% |",
      "",
      "### Reasoning",
      "Testing fee integration."
    ].join("\n");

    const candidates = [
      {
        question: "Demo market question",
        eventSlug: "demo-event",
        marketSlug: "demo-market",
        url: "https://example.com/demo-market",
        liquidityUsd: 10000,
        volume24hUsd: 1000,
        outcomes: ["Yes", "No"],
        outcomePrices: [0.42, 0.58],
        clobTokenIds: ["token-yes", "token-no"],
        endDate: "2026-12-31T00:00:00Z",
        bestBid: 0.41,
        bestAsk: 0.43,
        spread: 0.02,
        categorySlug: "politics",
        categoryLabel: "Politics",
        categorySource: null,
        tags: [] as Array<{ slug: string; label: string }>
      }
    ];

    const plans = buildPulseEntryPlans({
      context: createContext(markdown, { candidates }),
      positionStopLossPct: 0.3,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(1);
    const plan = plans[0]!;
    expect(plan.categorySlug).toBe("politics");

    // politics at p=0.58: feePct = 0.04 * (0.58 * 0.42)^1 = 0.04 * 0.2436 = 0.009744
    expect(plan.entryFeePct).toBeCloseTo(0.009744, 4);

    // round-trip at same price: 2 * 0.009744 = 0.019488
    expect(plan.roundTripFeePct).toBeCloseTo(0.019488, 4);

    // gross edge = 0.05, net edge = 0.05 - 0.009744 = 0.040256
    expect(plan.netEdge).toBeCloseTo(0.040256, 4);

    // monthlyReturn uses netEdge: 0.040256 / (289/30) = 0.004179...
    expect(plan.monthlyReturn).toBeCloseTo(0.040256 / (289 / 30), 4);
  });

  it("ranks fee-free geopolitics higher than fee-heavy crypto at same gross edge", () => {
    const candidates = [
      {
        question: "Crypto market",
        eventSlug: "crypto-event",
        marketSlug: "crypto-market",
        url: "https://example.com/crypto-market",
        liquidityUsd: 10000,
        volume24hUsd: 1000,
        outcomes: ["Yes", "No"],
        outcomePrices: [0.40, 0.60],
        clobTokenIds: ["token-yes-c", "token-no-c"],
        endDate: "2026-12-31T00:00:00Z",
        bestBid: 0.39,
        bestAsk: 0.41,
        spread: 0.02,
        categorySlug: "crypto",
        categoryLabel: "Crypto",
        categorySource: null,
        tags: [] as Array<{ slug: string; label: string }>
      },
      {
        question: "Geo market",
        eventSlug: "geo-event",
        marketSlug: "geo-market",
        url: "https://example.com/geo-market",
        liquidityUsd: 10000,
        volume24hUsd: 1000,
        outcomes: ["Yes", "No"],
        outcomePrices: [0.40, 0.60],
        clobTokenIds: ["token-yes-g", "token-no-g"],
        endDate: "2026-12-31T00:00:00Z",
        bestBid: 0.39,
        bestAsk: 0.41,
        spread: 0.02,
        categorySlug: "geopolitics",
        categoryLabel: "Geopolitics",
        categorySource: null,
        tags: [] as Array<{ slug: string; label: string }>
      }
    ];

    const sections = candidates.map((c) => [
      `## ${c.question}`,
      "",
      `**Link:** ${c.url}`,
      "| Direction | Buy No |",
      "| Suggested Size | 5% |",
      "| Confidence | medium |",
      "",
      "| No | 60% | 70% |",
      "",
      "### Reasoning",
      "Same edge, different fees."
    ].join("\n"));

    const markdown = sections.join("\n\n");

    const plans = buildPulseEntryPlans({
      context: createContext(markdown, { candidates, totalEquityUsd: 100 }),
      positionStopLossPct: 0.3,
      nowMs: FIXED_NOW_MS
    });

    expect(plans).toHaveLength(2);
    // Geopolitics (no fee) should rank higher than crypto (1.8% peak fee)
    expect(plans[0]!.marketSlug).toBe("geo-market");
    expect(plans[1]!.marketSlug).toBe("crypto-market");
    expect(plans[0]!.netEdge).toBeGreaterThan(plans[1]!.netEdge);
  });
});
