import { describe, expect, it } from "vitest";
import type { Portfolio } from "@autopoly/delta-pm-contracts";
import { buildReflection, renderReflectionMd, type StoredSignal } from "./reflect.js";

function signal(over: Partial<StoredSignal> = {}): StoredSignal {
  return {
    id: `sig-${Math.random().toString(36).slice(2, 8)}`,
    newsId: "n1",
    fingerprint: "fp",
    firstSeenUtc: "2026-08-20T14:00:00.000Z",
    firstSeenBasis: "test",
    expectedDirection: "bullish",
    coarseImpactBand: "medium",
    consensusBaselineAsOf: null,
    materiality: {
      tradeable: true,
      score: 70,
      eventType: "order_contract",
      factLevel: "fact",
      tickers: ["NVDA"],
      surpriseNote: "s",
      reason: "r"
    },
    pricedIn: {
      status: "none",
      tEvalUtc: "2026-08-20T14:10:00.000Z",
      deltaTMinutes: 10,
      realizedExcessPct: 0.2,
      volumeZ: null,
      dataBasis: "hl_perp",
      sessionBucket: "rth",
      benchmarkUsed: "XYZ100",
      betaUsed: 1,
      confidence: "high",
      note: "n"
    },
    priorCoverage: null,
    createdAtUtc: "2026-08-20T14:10:00.000Z",
    ...over
  };
}

const portfolio: Portfolio = {
  mode: "shadow",
  initialCapitalUsd: 10_000,
  realizedPnlUsd: -50,
  positions: [],
  halted: false,
  haltedReason: null,
  lastStopOutUtc: {},
  updatedAtUtc: "2026-08-21T00:00:00.000Z"
};

describe("buildReflection", () => {
  const signals: StoredSignal[] = [
    // forwarded, tracked, hit
    signal({ followUp24h: { realizedExcessPct: 2.5, directionHit: true, computedAtUtc: "x" } }),
    // forwarded, tracked, miss
    signal({ followUp24h: { realizedExcessPct: -1.2, directionHit: false, computedAtUtc: "x" } }),
    // archived as full, then kept moving with the news ≥1% — a "wrong kill"
    signal({
      pricedIn: { ...signal().pricedIn!, status: "full" },
      followUp24h: { realizedExcessPct: 3.1, directionHit: true, computedAtUtc: "x" }
    }),
    // archived: no ticker
    signal({ materiality: { ...signal().materiality, tickers: [], tradeable: false }, pricedIn: null })
  ];
  const ledger = [
    { type: "news_seen" },
    { type: "news_seen" },
    { type: "thesis_created", contamination: "hard", engine: "claude-cli" },
    { type: "thesis_created", contamination: "none", engine: "claude-cli" },
    { type: "decision", decision: { action: "open", reason: "ok" } },
    { type: "decision", decision: { action: "no_trade", reason: "cooldown: stopped out" } },
    { type: "decision", decision: { action: "no_trade", reason: "cooldown: stopped out again" } },
    { type: "signal_archived", why: "stale: duplicate" }
  ];

  const r = buildReflection({ signals, ledger, portfolio, equityUsd: 9950 }, "2026-08-22T13:00:00.000Z");

  it("computes the funnel and priced-in distribution", () => {
    expect(r.funnel.newsSeen).toBe(2);
    expect(r.funnel.signals).toBe(4);
    expect(r.funnel.archivedNoTicker).toBe(1);
    expect(r.funnel.archivedStale).toBe(1);
    expect(r.funnel.decisionsOpen).toBe(1);
    expect(r.funnel.decisionsNoTrade).toBe(2);
    expect(r.pricedInDistribution.none).toBe(2);
    expect(r.pricedInDistribution.full).toBe(1);
    expect(r.pricedInDistribution.not_evaluated).toBe(1);
  });

  it("M1 calibration: forwarded hit rate and wrongly-killed column", () => {
    expect(r.m1Calibration.forwarded.n).toBe(2);
    expect(r.m1Calibration.forwarded.hits).toBe(1);
    expect(r.m1Calibration.forwarded.hitRate).toBeCloseTo(0.5);
    expect(r.m1Calibration.archivedFullReverse).toEqual({ n: 1, movedWithNews: 1 });
  });

  it("contamination rate and no-trade reason grouping", () => {
    expect(r.contamination).toMatchObject({ theses: 2, hard: 1, soft: 0, rate: 0.5 });
    expect(r.noTradeReasons[0]).toEqual({ reason: "cooldown", count: 2 });
  });

  it("renders markdown with the headline numbers", () => {
    const md = renderReflectionMd(r);
    expect(md).toContain("新闻 2 → 信号 4");
    expect(md).toContain("命中率 50%");
    expect(md).toContain("错杀检查");
    expect(md).toContain("1/1");
    expect(md).toContain("污染率 50%");
  });
});
