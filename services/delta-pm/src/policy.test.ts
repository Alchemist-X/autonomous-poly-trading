import { describe, expect, it } from "vitest";
import type { Portfolio, Position, TradeThesis, UniverseEntry } from "@autopoly/delta-pm-contracts";
import { checkHalt, decideEntry, equityOf, reviewPosition, updateTrailingStop, type EntryContext, type MarketView } from "./policy.js";

const NOW = "2026-08-19T15:00:00.000Z";

function universeEntry(over: Partial<UniverseEntry> = {}): UniverseEntry {
  return {
    ticker: "NVDA",
    company: "NVIDIA",
    companyZh: "英伟达",
    hlSymbol: "xyz:NVDA",
    group: "mag7",
    tags: ["ai-infrastructure"],
    aliases: ["nvidia"],
    benchmark: "XYZ100",
    liquidityTier: 1,
    marginMode: "cross",
    maxLeverageOnVenue: 20,
    preIpo: false,
    nextEarningsUtc: null,
    consensusBaseline: null,
    ...over
  };
}

function thesis(over: Partial<TradeThesis> = {}): TradeThesis {
  return {
    id: "th-1",
    signalId: "sig-1",
    ticker: "NVDA",
    direction: "long",
    tradeType: "event",
    fairImpactPct: { min: 3, max: 8, point: 5 },
    impactPath: [{ step: "s", value: "v" }],
    evidence: [],
    contamination: "none",
    horizonHours: 72,
    catalysts: [],
    falsifiers: ["f"],
    limitations: [],
    confidence: "medium",
    provider: "deepseek",
    createdAtUtc: NOW,
    ...over
  };
}

function view(over: Partial<MarketView> = {}): MarketView {
  return {
    markPx: 200,
    atr20d: 6,
    dailyVolPct: 0.025,
    maxDailyMovePct: 0.08,
    swingLowPx: 192,
    swingHighPx: 208,
    fundingHourly: 0.00000625,
    realizedExcessSinceT0Pct: 0.3,
    baselinePx: 199,
    benchmarkBaselinePx: 29_000,
    beta: 1,
    ...over
  };
}

function portfolio(over: Partial<Portfolio> = {}): Portfolio {
  return {
    mode: "shadow",
    initialCapitalUsd: 10_000,
    realizedPnlUsd: 0,
    positions: [],
    halted: false,
    haltedReason: null,
    lastStopOutUtc: {},
    updatedAtUtc: NOW,
    ...over
  };
}

function ctx(over: Partial<EntryContext> = {}): EntryContext {
  return {
    thesis: thesis(),
    entry: universeEntry(),
    view: view(),
    portfolio: portfolio(),
    equityUsd: 10_000,
    dayPnlPct: 0,
    clusterGrossUsd: new Map(),
    marksByTicker: new Map([["NVDA", 200]]),
    nowUtc: NOW,
    ...over
  };
}

describe("decideEntry", () => {
  it("opens with fixed-risk sizing when residual edge clears the threshold", () => {
    const d = decideEntry(ctx());
    expect(d.action).toBe("open");
    expect(d.direction).toBe("long");
    // stop = max(200 - 1.5*6, 192) = 192 → dist 4% → notional = 10000*0.01/0.04 = 2500
    expect(d.stop!.initialPx).toBeCloseTo(192);
    expect(d.sizeUsd).toBe(2500);
    expect(d.realizedRiskPct).toBeCloseTo(0.01, 5);
    expect(d.bindingConstraint).toBeNull();
    expect(d.stop!.hardFloorPx).toBeCloseTo(160); // −20% user rule
  });

  it("tier cap binds for tight stops and records the binding constraint", () => {
    const d = decideEntry(ctx({ view: view({ atr20d: 1.4, swingLowPx: 197.9 }) })); // stop ≈ 197.9-198 → ~1% dist → wants 10k
    expect(d.action).toBe("open");
    expect(d.bindingConstraint).toBe("tier1_cap");
    expect(d.sizeUsd).toBeLessThanOrEqual(3000);
    expect(d.realizedRiskPct!).toBeLessThan(0.01);
  });

  it("rejects below-threshold residual edge", () => {
    const d = decideEntry(ctx({ thesis: thesis({ fairImpactPct: { min: 0.5, max: 2, point: 1 } }), view: view({ realizedExcessSinceT0Pct: 0.4 }) }));
    expect(d.action).toBe("no_trade");
    expect(d.reason).toContain("residual edge");
  });

  it("adverse drift reclassifies instead of chasing inflated edge", () => {
    const d = decideEntry(ctx({ view: view({ realizedExcessSinceT0Pct: -1.2 }) }));
    expect(d.action).toBe("no_trade");
    expect(d.reason).toContain("adverse drift");
  });

  it("hard-contaminated thesis is vetoed", () => {
    const d = decideEntry(ctx({ thesis: thesis({ contamination: "hard" }) }));
    expect(d.action).toBe("no_trade");
    expect(d.reason).toContain("contaminated");
  });

  it("cooldown blocks same ticker+direction after a stop-out", () => {
    const d = decideEntry(ctx({ portfolio: portfolio({ lastStopOutUtc: { "NVDA:long": "2026-08-18T20:00:00.000Z" } }) }));
    expect(d.action).toBe("no_trade");
    expect(d.reason).toContain("cooldown");
  });

  it("earnings inside the horizon veto entry", () => {
    const d = decideEntry(ctx({ entry: universeEntry({ nextEarningsUtc: "2026-08-20T20:00:00.000Z" }) }));
    expect(d.action).toBe("no_trade");
    expect(d.reason).toContain("earnings");
  });

  it("halted portfolio refuses new risk", () => {
    const d = decideEntry(ctx({ portfolio: portfolio({ halted: true, haltedReason: "user halt" }) }));
    expect(d.action).toBe("no_trade");
    expect(d.reason).toContain("halted");
  });

  it("one net position per ticker: conflicting direction is not auto-flipped", () => {
    const pos: Position = position();
    const d = decideEntry(ctx({ thesis: thesis({ direction: "short", fairImpactPct: { min: -8, max: -3, point: -5 } }), portfolio: portfolio({ positions: [pos] }) }));
    expect(d.action).toBe("no_trade");
    expect(d.reason).toContain("conflicting direction");
  });

  it("isolated-margin headroom clips isolated names", () => {
    // Isolated position already consuming margin: notional 4000 at 1x = 4000 margin (of 5000 cap).
    const existing = position({ ticker: "AMD", hlSymbol: "xyz:AMD", leverage: 1, qty: 20, entryPx: 200 });
    const d = decideEntry(
      ctx({
        entry: universeEntry({ ticker: "ORCL", hlSymbol: "xyz:ORCL", marginMode: "isolated", liquidityTier: 2, maxLeverageOnVenue: 10 }),
        thesis: thesis({ ticker: "ORCL" }),
        portfolio: portfolio({ positions: [existing] }),
        marksByTicker: new Map([
          ["ORCL", 200],
          ["AMD", 200]
        ])
      })
    );
    expect(d.action).toBe("open");
    expect(["isolated_margin_cap", "tier2_cap"]).toContain(d.bindingConstraint);
  });
});

function position(over: Partial<Position> = {}): Position {
  return {
    ticker: "NVDA",
    hlSymbol: "xyz:NVDA",
    direction: "long",
    qty: 12.5,
    entryPx: 200,
    entryUtc: "2026-08-18T15:00:00.000Z",
    notionalUsdAtEntry: 2500,
    leverage: 3,
    stopPx: 192,
    hardFloorPx: 160,
    targetPctExcess: { lo: 3, hi: 5 },
    horizonUtc: "2026-08-22T15:00:00.000Z",
    extendedOnce: false,
    thesisId: "th-1",
    decisionId: "pmd-1",
    signalT0Utc: "2026-08-18T14:00:00.000Z",
    baselinePx: 199,
    benchmarkBaselinePx: 29_000,
    beta: 1,
    trailArmed: false,
    highestClosePx: null,
    ...over
  };
}

describe("reviewPosition", () => {
  it("valuation track: closes at conservative target — take it, don't chase the top", () => {
    const r = reviewPosition({ position: position(), markPx: 206, realizedExcessSinceT0Pct: 3.2, nowUtc: NOW });
    expect(r.action).toBe("close");
    expect((r as { track: string }).track).toBe("valuation");
  });

  it("valuation track: negative residual edge closes (house rule)", () => {
    const r = reviewPosition({ position: position({ targetPctExcess: { lo: 6, hi: 5.0 } }), markPx: 205, realizedExcessSinceT0Pct: 5.5, nowUtc: NOW });
    expect(r.action).toBe("close");
  });

  it("hard floor closes unconditionally at −20% adverse", () => {
    const r = reviewPosition({ position: position(), markPx: 159, realizedExcessSinceT0Pct: -20, nowUtc: NOW });
    expect(r.action).toBe("close");
    expect((r as { track: string }).track).toBe("hard_floor");
  });

  it("technical track closes through the stop", () => {
    const r = reviewPosition({ position: position(), markPx: 191, realizedExcessSinceT0Pct: -4, nowUtc: NOW });
    expect(r.action).toBe("close");
    expect((r as { track: string }).track).toBe("technical");
  });

  it("time track: expired horizon with residual edge extends exactly once", () => {
    const p = position({ horizonUtc: "2026-08-19T00:00:00.000Z" });
    const r = reviewPosition({ position: p, markPx: 201, realizedExcessSinceT0Pct: 1, nowUtc: NOW });
    expect(r.action).toBe("extend");
    const r2 = reviewPosition({ position: { ...p, extendedOnce: true }, markPx: 201, realizedExcessSinceT0Pct: 1, nowUtc: NOW });
    expect(r2.action).toBe("close");
  });

  it("holds otherwise", () => {
    const r = reviewPosition({ position: position(), markPx: 202, realizedExcessSinceT0Pct: 1.5, nowUtc: NOW });
    expect(r.action).toBe("hold");
  });
});

describe("updateTrailingStop", () => {
  it("arms at 50% of target and only ever tightens (long)", () => {
    let p = position();
    p = updateTrailingStop(p, 205, 4, 2.6); // 2.6% ≥ 50% of 5% target → arm
    expect(p.trailArmed).toBe(true);
    expect(p.stopPx).toBeCloseTo(205 - 2.5 * 4); // 195 > 192
    const before = p.stopPx;
    p = updateTrailingStop(p, 198, 4, 1.0); // pullback must NOT lower the stop
    expect(p.stopPx).toBe(before);
  });
});

describe("halt / equity", () => {
  it("equityOf marks to market with direction signs", () => {
    const p = portfolio({ positions: [position(), position({ ticker: "AMD", direction: "short", entryPx: 100, qty: 10 })] });
    const marks = new Map([
      ["NVDA", 210],
      ["AMD", 90]
    ]);
    // NVDA: +10*12.5=125; AMD short: +10*10=100
    expect(equityOf(p, marks)).toBeCloseTo(10_000 + 125 + 100);
  });

  it("user −25% total-loss rule halts", () => {
    const p = portfolio({ realizedPnlUsd: -2600 });
    const r = checkHalt(p, new Map());
    expect(r.halted).toBe(true);
    expect(r.reason).toContain("user −25%");
  });
});
