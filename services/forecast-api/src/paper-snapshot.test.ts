import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildPaperSnapshot, getPaperSnapshot, resetPaperSnapshotCache } from "./paper-snapshot";

let root: string;

const ledgerLines = [
  { ts: "2026-07-03T07:17:40.520Z", type: "cycle_start", positions: 0, cashUsd: 10000 },
  // Dropped by the book-lock race — must be excluded from pairing but still
  // counted in droppedBuyFills.
  {
    ts: "2026-07-03T07:36:00.000Z",
    type: "trade",
    side: "buy",
    positionId: "strait-of-hormuz-traffic-returns-to-normal-by-july-31:1",
    slug: "strait-of-hormuz-traffic-returns-to-normal-by-july-31",
    outcome: "No",
    shares: 666.67,
    avgPrice: 0.75,
    feeUsd: 0
  },
  {
    ts: "2026-07-04T00:00:00.000Z",
    type: "trade",
    side: "buy",
    positionId: "demo-market:1",
    slug: "demo-market",
    outcome: "No",
    shares: 100,
    avgPrice: 0.8,
    feeUsd: 0
  },
  {
    ts: "2026-07-05T00:00:00.000Z",
    type: "trade",
    side: "sell",
    style: "market",
    positionId: "demo-market:1",
    slug: "demo-market",
    shares: 50,
    avgPrice: 0.9,
    feeUsd: 0,
    reason: "negative_edge"
  },
  {
    ts: "2026-07-05T01:00:00.000Z",
    type: "trade",
    side: "sell",
    style: "limit",
    positionId: "demo-market:1",
    slug: "demo-market",
    shares: 50,
    avgPrice: 0.9,
    feeUsd: 0,
    reason: "negative_edge:limit_ttl_fallback"
  },
  // Second round trip on the same positionId (the MOU pattern).
  {
    ts: "2026-07-06T00:00:00.000Z",
    type: "trade",
    side: "buy",
    positionId: "demo-market:1",
    slug: "demo-market",
    outcome: "No",
    shares: 200,
    avgPrice: 0.1,
    feeUsd: 0
  },
  {
    ts: "2026-07-06T04:00:00.000Z",
    type: "trade",
    side: "sell",
    style: "market",
    positionId: "demo-market:1",
    slug: "demo-market",
    shares: 200,
    avgPrice: 0.05,
    feeUsd: 0,
    reason: "stop_loss"
  },
  {
    ts: "2026-07-06T10:00:00.000Z",
    type: "evaluation",
    positionId: "open-pos:1",
    saturatedAt: "floor",
    contaminated: false,
    saturatedHold: true,
    action: "hold",
    reason: "hold"
  },
  { ts: "2026-07-06T10:01:00.000Z", type: "evaluation", positionId: "open-pos:1", saturatedAt: null, contaminated: true },
  { ts: "2026-07-06T10:02:00.000Z", type: "watchlist_eval", slug: "w1" },
  { ts: "2026-07-06T10:03:00.000Z", type: "evaluation_error", positionId: "open-pos:1", error: "boom" },
  { ts: "2026-07-06T10:04:00.000Z", type: "limit_placed", positionId: "demo-market:1" },
  // Hold-to-settlement path (the saturated-hold scenario): bought, half sold,
  // remainder resolved WON — must pair into ONE combined closed episode.
  {
    ts: "2026-07-07T00:00:00.000Z",
    type: "trade",
    side: "buy",
    positionId: "settle-market:1",
    slug: "settle-market",
    outcome: "No",
    shares: 100,
    avgPrice: 0.8,
    feeUsd: 0
  },
  {
    ts: "2026-07-07T06:00:00.000Z",
    type: "trade",
    side: "sell",
    style: "market",
    positionId: "settle-market:1",
    slug: "settle-market",
    shares: 40,
    avgPrice: 0.95,
    feeUsd: 0,
    reason: "negative_edge"
  },
  {
    ts: "2026-07-08T00:00:00.000Z",
    type: "resolution",
    positionId: "settle-market:1",
    slug: "settle-market",
    kind: "won",
    shares: 60,
    avgEntryPrice: 0.8
  },
  // Voided settlement with no preceding sells refunds $0.50/share.
  {
    ts: "2026-07-08T01:00:00.000Z",
    type: "trade",
    side: "buy",
    positionId: "void-market:1",
    slug: "void-market",
    outcome: "Yes",
    shares: 200,
    avgPrice: 0.4,
    feeUsd: 0
  },
  {
    ts: "2026-07-08T02:00:00.000Z",
    type: "resolution",
    positionId: "void-market:1",
    slug: "void-market",
    kind: "voided",
    shares: 200,
    avgEntryPrice: 0.4
  },
  // Fee-bearing market (the NVDA pattern): entry fee must land in the round's
  // cost basis and pnl, or the closed-trades table drifts from realized PnL.
  {
    ts: "2026-07-09T00:00:00.000Z",
    type: "trade",
    side: "buy",
    positionId: "fee-market:1",
    slug: "fee-market",
    outcome: "Yes",
    shares: 1000,
    avgPrice: 0.2,
    feeUsd: 20
  },
  {
    ts: "2026-07-09T06:00:00.000Z",
    type: "trade",
    side: "sell",
    style: "market",
    positionId: "fee-market:1",
    slug: "fee-market",
    shares: 1000,
    avgPrice: 0.1,
    feeUsd: 10,
    reason: "stop_loss"
  },
  { ts: "2026-07-06T18:00:00.000Z", type: "cycle_end", positions: 1, cashUsd: 9500 }
];

const portfolio = {
  bankrollUsd: 10000,
  cashUsd: 9500,
  realizedPnlUsd: -90,
  totalFeesUsd: 0,
  positions: [
    {
      id: "open-pos:1",
      slug: "open-pos",
      question: "Will the demo resolve?",
      outcomeLabel: "No",
      openedAtUtc: "2026-07-04T00:00:00.000Z",
      shares: 500,
      avgEntryPrice: 0.8,
      lastEval: {
        ts: "2026-07-06T10:00:00.000Z",
        agentProb: 0.99,
        mark: 0.95,
        netEdgePp: 4,
        decision: "hold:hold",
        saturatedAt: "floor",
        contaminated: false,
        saturatedHold: true
      }
    }
  ]
};

const reflection = {
  generatedAtUtc: "2026-07-06T18:18:00.000Z",
  book: { cashUsd: 9500, bankrollUsd: 10000, openPositions: 1, realizedPnlUsd: -90, totalFeesUsd: 0, equityUsd: 9975 },
  exits: [
    {
      positionId: "demo-market:1",
      question: "Demo market?",
      direction: "No",
      ts: "2026-07-05T00:00:00.000Z",
      style: "market+limit",
      legs: 2,
      shares: 100,
      exitPrice: 0.9,
      feeUsd: 0,
      priceNow: 1,
      exitAlphaUsd: -10,
      reason: "negative_edge"
    }
  ],
  exitAlphaTotalUsd: -10,
  hybrid: { limitPlaced: 1, limitFilled: 1, limitFillRate: 1, avgLimitPrice: 0.9, avgMarketPrice: 0.895, limitImprovementPp: 0.5 },
  calibration: {
    rows: [{ label: "Demo market?", agentProb: 0.9, marketProb: 0.95, outcome: 1, ts: "2026-07-05T00:00:00.000Z" }],
    n: 1,
    brierAgent: 0.01,
    brierMarket: 0.0025,
    skill: -3
  }
};

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "paper-snap-"));
  mkdirSync(path.join(root, "reports"), { recursive: true });
  writeFileSync(path.join(root, "portfolio.json"), JSON.stringify(portfolio));
  writeFileSync(path.join(root, "ledger.jsonl"), ledgerLines.map((l) => JSON.stringify(l)).join("\n"));
  writeFileSync(path.join(root, "reports", "2026-07-06T1818-reflection.json"), JSON.stringify(reflection));
  resetPaperSnapshotCache();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("buildPaperSnapshot", () => {
  it("aggregates book headline numbers and equity from lastEval marks", () => {
    const s = buildPaperSnapshot(root);
    expect(s.bankrollUsd).toBe(10000);
    expect(s.cashUsd).toBe(9500);
    expect(s.realizedPnlUsd).toBe(-90);
    // equity = 9500 + 500 × 0.95
    expect(s.equityUsd).toBeCloseTo(9975, 2);
    expect(s.startedUtc).toBe("2026-07-03T07:17:40.520Z");
    expect(s.lastEvalCycleUtc).toBe("2026-07-06T18:00:00.000Z");
    expect(s.reflectionReportUtc).toBe("2026-07-06T18:18:00.000Z");
  });

  it("counts fills, cycles, evals and the saturated-hold interventions", () => {
    const s = buildPaperSnapshot(root);
    expect(s.fills).toEqual({ total: 11, buys: 6, sells: 5 });
    expect(s.droppedBuyFills).toBe(1);
    expect(s.evalCycles).toBe(1);
    expect(s.evaluations).toBe(2);
    expect(s.watchlistEvals).toBe(1);
    expect(s.evalErrors).toBe(1);
    expect(s.saturatedHolds).toBe(1);
    expect(s.engineQuality.saturated).toBe(1);
    expect(s.engineQuality.contaminated).toBe(1);
    expect(s.engineQuality.limitOrdersPlaced).toBe(1);
    expect(s.engineQuality.limitFills).toBe(1);
    expect(s.engineQuality.limitVsMarketPp).toBe(0.5);
  });

  it("pairs round trips sequentially, supporting re-entry on the same positionId", () => {
    const s = buildPaperSnapshot(root);
    expect(s.closedTrades).toHaveLength(5);
    const [first, second] = s.closedTrades;
    expect(first?.pnlUsd).toBeCloseTo(10, 2); // 100 sh: 0.8 -> 0.9
    expect(first?.exitReason).toBe("negative_edge"); // ttl-fallback suffix stripped
    expect(second?.pnlUsd).toBeCloseTo(-10, 2); // 200 sh: 0.1 -> 0.05
    expect(second?.exitReason).toBe("stop_loss");
    // The dropped hormuz fill never pairs into a closed trade.
    expect(s.closedTrades.every((t) => !t.slug.includes("hormuz"))).toBe(true);
  });

  it("closes hold-to-settlement positions, combining partial-sell and settlement economics", () => {
    const s = buildPaperSnapshot(root);
    const settled = s.closedTrades.find((t) => t.slug === "settle-market");
    // cost 100×0.8 = 80; proceeds = 40×0.95 (sell) + 60×$1 (won) = 98
    expect(settled?.exitReason).toBe("settled_won");
    expect(settled?.shares).toBeCloseTo(100, 2);
    expect(settled?.pnlUsd).toBeCloseTo(18, 2);
    expect(settled?.exitPrice).toBeCloseTo(0.98, 4);
    const voided = s.closedTrades.find((t) => t.slug === "void-market");
    // cost 200×0.4 = 80; refund 200×$0.50 = 100
    expect(voided?.exitReason).toBe("settled_voided");
    expect(voided?.pnlUsd).toBeCloseTo(20, 2);
  });

  it("folds entry fees into the round's cost basis and pnl", () => {
    const s = buildPaperSnapshot(root);
    const fee = s.closedTrades.find((t) => t.slug === "fee-market");
    expect(fee?.costUsd).toBeCloseTo(220, 2); // 1000×0.2 notional + $20 entry fee
    expect(fee?.pnlUsd).toBeCloseTo(-130, 2); // (100 − $10 sell fee) − 220
    expect(fee?.entryPrice).toBeCloseTo(0.2, 4); // true fill price, fee excluded
    expect(fee?.exitPrice).toBeCloseTo(0.09, 4);
  });

  it("maps open positions with flags and saturatedHold", () => {
    const s = buildPaperSnapshot(root);
    expect(s.openPositions).toHaveLength(1);
    const p = s.openPositions[0];
    expect(p?.flag).toBe("saturated");
    expect(p?.saturatedHold).toBe(true);
    expect(p?.unrealizedUsd).toBeCloseTo(75, 2);
  });

  it("builds the equity curve from reflections bracketed by bankroll start and live now-point", () => {
    const s = buildPaperSnapshot(root);
    expect(s.equityCurve[0]).toEqual({ date: "起点", equityUsd: 10000 });
    expect(s.equityCurve).toContainEqual({ date: "07-06", equityUsd: 9975 });
    expect(s.equityCurve[s.equityCurve.length - 1]?.date).toBe("现在");
  });

  it("keys curve points by full date so a later year never overwrites an earlier one", () => {
    writeFileSync(
      path.join(root, "reports", "2027-07-06T1818-reflection.json"),
      JSON.stringify({ ...reflection, generatedAtUtc: "2027-07-06T18:18:00.000Z", book: { ...reflection.book, equityUsd: 12000 } })
    );
    const s = buildPaperSnapshot(root);
    const labels = s.equityCurve.filter((p) => p.date === "07-06");
    expect(labels).toHaveLength(2);
    expect(labels[0]?.equityUsd).toBe(9975); // 2026 first
    expect(labels[1]?.equityUsd).toBe(12000); // 2027 appended, not overwritten
  });

  it("passes exit alpha and Brier through from the latest reflection", () => {
    const s = buildPaperSnapshot(root);
    expect(s.exitAlpha.totalUsd).toBe(-10);
    expect(s.exitAlpha.rows[0]?.alphaUsd).toBe(-10);
    expect(s.brier.skillScore).toBe(-3);
    expect(s.brier.rows[0]?.happened).toBe(true);
  });

  it("degrades gracefully when files are missing", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "paper-empty-"));
    try {
      const s = buildPaperSnapshot(empty);
      expect(s.fills.total).toBe(0);
      expect(s.openPositions).toEqual([]);
      expect(s.exitAlpha.totalUsd).toBeNull();
      expect(s.brier.n).toBe(0);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("readPaperConfigView", () => {
  const CONFIG_KEYS = [
    "PAPER_MAX_POSITIONS",
    "PAPER_MAX_EVALS_PER_CYCLE",
    "PAPER_SATURATED_HOLD",
    "PAPER_CATEGORIES",
    "PAPER_EVAL_TIMES_UTC"
  ];

  afterEach(() => {
    for (const k of CONFIG_KEYS) delete process.env[k];
  });

  it("mirrors paper-agent defaults when env is unset", () => {
    const s = buildPaperSnapshot(root);
    expect(s.config.maxPositions).toBe(10);
    expect(s.config.entryEdgePp).toBe(8);
    expect(s.config.stopLossPct).toBe(0.35);
    expect(s.config.saturatedHoldEnabled).toBe(true);
    expect(s.config.evalTimesUtc).toEqual(["00:10", "08:10", "16:10"]);
  });

  it("honors env overrides and the saturated-hold kill-switch spellings", () => {
    process.env.PAPER_MAX_POSITIONS = "22";
    process.env.PAPER_MAX_EVALS_PER_CYCLE = "16";
    process.env.PAPER_SATURATED_HOLD = "off";
    process.env.PAPER_CATEGORIES = "Finance, Tech";
    process.env.PAPER_EVAL_TIMES_UTC = "02:00,10:00,18:00";
    const s = buildPaperSnapshot(root);
    expect(s.config.maxPositions).toBe(22);
    expect(s.config.maxEvalsPerCycle).toBe(16);
    expect(s.config.saturatedHoldEnabled).toBe(false);
    expect(s.config.categories).toEqual(["finance", "tech"]);
    expect(s.config.evalTimesUtc).toEqual(["02:00", "10:00", "18:00"]);
  });
});

describe("getPaperSnapshot cache", () => {
  it("serves cached payloads within the TTL and rebuilds after it", () => {
    process.env.PAPER_ARTIFACTS_ROOT = root;
    try {
      const first = getPaperSnapshot(1000);
      const cachedResult = getPaperSnapshot(1000 + 59_000);
      expect(cachedResult).toBe(first);
      const rebuilt = getPaperSnapshot(1000 + 61_000);
      expect(rebuilt).not.toBe(first);
    } finally {
      delete process.env.PAPER_ARTIFACTS_ROOT;
      resetPaperSnapshotCache();
    }
  });
});
