import { describe, expect, it } from "vitest";
import { limitSellFilled, simulateMarketBuy, simulateMarketSell } from "./book-sim";
import {
  buildFeeParams,
  CATEGORY_FEE_RATES,
  DEFAULT_FEE_RATE,
  DEFAULT_FEES,
  feeUsd,
  loadFeeSchedule,
  makerFeeUsd,
  normalizeFeeParams,
  resolveFeeCategory,
  takerFeeUsd,
  type MarketFeeParams
} from "./fees";
import { applyBuy, applySell, applySettlement, type PaperPosition, type Portfolio } from "./portfolio";
import type { OrderBook } from "./polymarket";

const feeFree: MarketFeeParams = {
  takerBps: 0,
  makerBps: 0,
  tickSize: 0.01,
  feeRate: 0,
  category: null,
  rateSource: "clob_fee_free"
};
// A fee-enabled CLOB market: taker_base_fee=1000 is what EVERY fee-enabled
// market reports (a flag, not a rate); the rate comes from the category.
const feed: MarketFeeParams = {
  takerBps: 1000,
  makerBps: 1000,
  tickSize: 0.001,
  feeRate: 0.05,
  category: "sports",
  rateSource: "category"
};
const crypto: MarketFeeParams = { ...feed, feeRate: 0.07, category: "crypto" };
const clobFeeEnabled = { takerBps: 1000, makerBps: 1000, tickSize: 0.001 };
const clobFeeFree = { takerBps: 0, makerBps: 0, tickSize: 0.01 };

const book: OrderBook = {
  bids: [
    { price: 0.5, size: 60 },
    { price: 0.48, size: 100 }
  ],
  asks: [
    { price: 0.52, size: 40 },
    { price: 0.55, size: 200 }
  ]
};

describe("fees — documented CLOB schedule: fee = C × rate × p × (1 − p), takers only", () => {
  it("reproduces the docs' worked example: 100 shares @ $0.50 in Crypto (0.07) = $1.75", () => {
    expect(feeUsd(100, 0.5, 0.07)).toBeCloseTo(1.75, 10);
    expect(takerFeeUsd(100, 0.5, crypto)).toBeCloseTo(1.75, 10);
  });

  it("scales with p × (1 − p) and is symmetric around 0.5", () => {
    expect(feeUsd(100, 0.3, 0.05)).toBeCloseTo(100 * 0.05 * 0.3 * 0.7, 10);
    expect(feeUsd(100, 0.7, 0.05)).toBeCloseTo(feeUsd(100, 0.3, 0.05), 10);
    expect(feeUsd(100, 0.5, 0)).toBe(0);
    expect(feeUsd(0, 0.5, 0.05)).toBe(0);
  });

  it("p = 0.01 / 0.99 edge: tiny but non-zero, and exactly 0 at the bounds", () => {
    const edge = 100 * 0.07 * 0.01 * 0.99; // 0.0693
    expect(feeUsd(100, 0.01, 0.07)).toBeCloseTo(edge, 10);
    expect(feeUsd(100, 0.99, 0.07)).toBeCloseTo(edge, 10);
    expect(feeUsd(100, 0.01, 0.07)).toBeGreaterThan(0);
    expect(feeUsd(100, 0, 0.07)).toBe(0);
    expect(feeUsd(100, 1, 0.07)).toBe(0);
  });

  it("never applies the CLOB's 1000 bps as a rate (the old model's 10% × min(p, 1−p))", () => {
    const politics: MarketFeeParams = { ...feed, feeRate: 0.04, category: "politics" };
    // Old model: 100 × 0.10 × min(0.5, 0.5) = $5.00. Documented: 100 × 0.04 × 0.25 = $1.00.
    expect(takerFeeUsd(100, 0.5, politics)).toBeCloseTo(1.0, 10);
    expect(takerFeeUsd(100, 0.5, politics)).toBeLessThan(5);
  });

  it("charges ~3.6% of notional on a $0.10 token at a 0.04 rate (the fleet audit's documented figure), not 10%", () => {
    const politics: MarketFeeParams = { ...feed, feeRate: 0.04, category: "politics" };
    const shares = 1000;
    const notional = shares * 0.1;
    expect(takerFeeUsd(shares, 0.1, politics) / notional).toBeCloseTo(0.036, 10);
  });

  it("makers pay 0, even on a fee-enabled market reporting maker_base_fee=1000", () => {
    expect(makerFeeUsd(100, 0.5, feed)).toBe(0);
    expect(makerFeeUsd(100, 0.5, crypto)).toBe(0);
    expect(makerFeeUsd(100, 0.01, crypto)).toBe(0);
  });

  it("a geopolitics market (CLOB taker_base_fee=0) is fee-free", () => {
    const geo = buildFeeParams(clobFeeFree, ["geopolitics"]);
    expect(geo.feeRate).toBe(0);
    expect(geo.category).toBe("geopolitics");
    expect(geo.rateSource).toBe("clob_fee_free");
    expect(takerFeeUsd(100, 0.5, geo)).toBe(0);
    expect(makerFeeUsd(100, 0.5, geo)).toBe(0);
    expect(CATEGORY_FEE_RATES.geopolitics).toBe(0);
  });
});

describe("fee category lookup (Gamma tag slugs → documented rate)", () => {
  it("matches the documented schedule by category", () => {
    for (const c of ["politics", "finance", "tech", "mentions"]) expect(resolveFeeCategory([c]).rate, c).toBe(0.04);
    for (const c of ["sports", "economics", "culture", "weather", "other"])
      expect(resolveFeeCategory([c]).rate, c).toBe(0.05);
    expect(resolveFeeCategory(["crypto"]).rate).toBe(0.07);
    expect(resolveFeeCategory(["geopolitics"]).rate).toBe(0);
  });

  it("maps sub-tags and Gamma labels onto the buckets", () => {
    expect(resolveFeeCategory(["nba"]).category).toBe("sports");
    expect(resolveFeeCategory(["bitcoin"]).category).toBe("crypto");
    expect(resolveFeeCategory(["fed-rates"]).category).toBe("economics");
    expect(resolveFeeCategory(["Pop Culture"]).category).toBe("culture"); // label form
    expect(resolveFeeCategory(["trump-machado"]).category).toBe("politics"); // alias
    expect(resolveFeeCategory(["premier-league"]).category).toBe("sports"); // alias
  });

  it("an exact match on any tag beats an alias on an earlier tag", () => {
    const m = resolveFeeCategory(["trump-machado", "crypto"]);
    expect(m.category).toBe("crypto");
    expect(m.matchedTag).toBe("crypto");
  });

  it("falls back to the default rate (the docs' Other bucket) when no tag matches", () => {
    const m = resolveFeeCategory(["metadao", "recurring"]);
    expect(m.category).toBeNull();
    expect(m.rate).toBe(DEFAULT_FEE_RATE);
    expect(DEFAULT_FEE_RATE).toBe(0.05);
    expect(resolveFeeCategory([]).rate).toBe(DEFAULT_FEE_RATE);
    // Short substrings ("war", "ai") are deliberately NOT aliases — no false geopolitics/tech hits.
    expect(resolveFeeCategory(["warriors"]).category).toBeNull();
    expect(resolveFeeCategory(["bahrain"]).category).toBeNull();
  });

  it("buildFeeParams: fee-enabled + known tag → category rate", () => {
    const p = buildFeeParams(clobFeeEnabled, ["crypto"]);
    expect(p).toMatchObject({
      takerBps: 1000,
      makerBps: 1000,
      tickSize: 0.001,
      feeRate: 0.07,
      category: "crypto",
      rateSource: "category"
    });
  });

  it("buildFeeParams: fee-enabled + unknown tag → default rate, category null", () => {
    const p = buildFeeParams(clobFeeEnabled, ["metadao"]);
    expect(p.feeRate).toBe(DEFAULT_FEE_RATE);
    expect(p.category).toBeNull();
    expect(p.rateSource).toBe("default");
  });

  it("buildFeeParams: the CLOB's fee-enabled flag beats a 0-rate tag (never assume a free trade the exchange charges for)", () => {
    const p = buildFeeParams(clobFeeEnabled, ["geopolitics"]);
    expect(p.feeRate).toBe(DEFAULT_FEE_RATE);
    expect(p.category).toBe("geopolitics");
    expect(p.rateSource).toBe("default");
  });

  it("buildFeeParams: CLOB fee-free wins over any category", () => {
    expect(buildFeeParams(clobFeeFree, ["crypto"]).feeRate).toBe(0);
    expect(buildFeeParams(clobFeeFree, []).rateSource).toBe("clob_fee_free");
  });

  it("env overrides: PAPER_FEE_RATES replaces buckets, PAPER_FEE_DEFAULT_RATE the fallback", () => {
    const s = loadFeeSchedule({
      PAPER_FEE_RATES: "crypto=0.02, Sports=0.03",
      PAPER_FEE_DEFAULT_RATE: "0.04"
    } as NodeJS.ProcessEnv);
    expect(s.rates.crypto).toBe(0.02);
    expect(s.rates.sports).toBe(0.03);
    expect(s.rates.politics).toBe(0.04); // untouched
    expect(s.defaultRate).toBe(0.04);
    expect(buildFeeParams(clobFeeEnabled, ["bitcoin"], s).feeRate).toBe(0.02);
    expect(buildFeeParams(clobFeeEnabled, [], s).feeRate).toBe(0.04);
  });

  it("env overrides: malformed entries are ignored, never zeroing a fee", () => {
    const s = loadFeeSchedule({
      PAPER_FEE_RATES: "crypto=abc,bogus=0.1,sports",
      PAPER_FEE_DEFAULT_RATE: "2"
    } as NodeJS.ProcessEnv);
    expect(s.rates).toEqual(CATEGORY_FEE_RATES);
    expect(s.defaultRate).toBe(DEFAULT_FEE_RATE);
    expect(loadFeeSchedule({} as NodeJS.ProcessEnv)).toEqual({
      rates: CATEGORY_FEE_RATES,
      defaultRate: DEFAULT_FEE_RATE
    });
  });

  it("normalizeFeeParams migrates rows written under the old bps model", () => {
    // Fee-enabled legacy row: no stored rate → default until the next refresh.
    const legacyFeed = normalizeFeeParams({ takerBps: 1000, makerBps: 1000, tickSize: 0.001 });
    expect(legacyFeed).toMatchObject({
      takerBps: 1000,
      makerBps: 1000,
      tickSize: 0.001,
      feeRate: DEFAULT_FEE_RATE,
      category: null,
      rateSource: "default"
    });
    // Fee-free legacy row stays free.
    expect(normalizeFeeParams({ takerBps: 0, makerBps: 0, tickSize: 0.01 }).feeRate).toBe(0);
    // Pre-fee-params row (no fees at all) → DEFAULT_FEES.
    expect(normalizeFeeParams(undefined)).toEqual(DEFAULT_FEES);
    // A current row round-trips untouched.
    expect(normalizeFeeParams(crypto)).toEqual(crypto);
  });
});

describe("simulateMarketSell", () => {
  it("walks the bids with slippage", () => {
    const fill = simulateMarketSell(book, 100, feeFree);
    expect(fill.shares).toBe(100);
    expect(fill.notionalUsd).toBeCloseTo(60 * 0.5 + 40 * 0.48, 8);
    expect(fill.avgPrice).toBeLessThan(0.5);
    expect(fill.liquidityExhausted).toBe(false);
  });

  it("charges the taker fee on the achieved average price", () => {
    const fill = simulateMarketSell(book, 100, feed);
    expect(fill.feeUsd).toBeCloseTo(feeUsd(100, fill.avgPrice, 0.05), 10);
    expect(fill.feeUsd).toBeGreaterThan(0);
  });

  it("reports exhausted liquidity on a thin book", () => {
    const fill = simulateMarketSell(book, 500, feeFree);
    expect(fill.shares).toBe(160);
    expect(fill.liquidityExhausted).toBe(true);
  });
});

describe("simulateMarketBuy", () => {
  it("converts a USD budget into shares across levels", () => {
    const fill = simulateMarketBuy(book, 30, feeFree);
    expect(fill.shares).toBeCloseTo(40 + 9.2 / 0.55, 3);
    expect(fill.notionalUsd).toBeCloseTo(30, 6);
  });

  it("carves the fee OUT of the budget so notional+fee ≤ budget", () => {
    const fill = simulateMarketBuy(book, 30, crypto);
    expect(fill.notionalUsd + fill.feeUsd).toBeLessThanOrEqual(30 + 0.01);
    expect(fill.feeUsd).toBeGreaterThan(0);
    expect(fill.feeUsd).toBeCloseTo(feeUsd(fill.shares, fill.avgPrice, 0.07), 10);
  });
});

describe("limitSellFilled", () => {
  it("fills at the limit when the bid reaches it — maker pays nothing even on a fee-enabled market", () => {
    const fill = limitSellFilled(book, 0.5, 40, crypto);
    expect(fill?.shares).toBe(40);
    expect(fill?.avgPrice).toBe(0.5);
    expect(fill?.feeUsd).toBe(0);
  });

  it("caps at visible size at-or-above the limit", () => {
    const fill = limitSellFilled(book, 0.5, 100, feeFree);
    expect(fill?.shares).toBe(60);
    expect(fill?.liquidityExhausted).toBe(true);
  });

  it("no fill while the bid is below the limit", () => {
    expect(limitSellFilled(book, 0.55, 10, feeFree)).toBeNull();
  });
});

describe("portfolio accounting", () => {
  const empty: Portfolio = {
    createdAtUtc: "t0",
    bankrollUsd: 1000,
    cashUsd: 1000,
    positions: [],
    restingLimits: [],
    realizedPnlUsd: 0,
    totalFeesUsd: 0
  };
  const pos: PaperPosition = {
    id: "m:0",
    slug: "m",
    eventSlug: "m",
    conditionId: "c",
    question: "q",
    outcomeIndex: 0,
    outcomeLabel: "Yes",
    tokenId: "tok",
    shares: 100,
    avgEntryPrice: 0.4,
    entryFeePerShare: 0.003, // $0.30 total entry fee
    openedAtUtc: "t0",
    fees: feed
  };

  it("realized PnL includes the ENTRY fee in the cost basis (cash reconciles)", () => {
    let p = applyBuy(empty, pos, 40, 0.3);
    expect(p.cashUsd).toBeCloseTo(1000 - 40.3, 8);
    p = applySell(p, "m:0", 100, 0.5, 0.4);
    // proceeds 50 − 0.4 = 49.6; basis 40 + 0.30 entry fee → realized 9.3
    expect(p.realizedPnlUsd).toBeCloseTo(9.3, 8);
    // cash − bankroll must equal realized on a fully-closed book
    expect(p.cashUsd - p.bankrollUsd).toBeCloseTo(p.realizedPnlUsd, 8);
    expect(p.positions).toHaveLength(0);
    expect(p.totalFeesUsd).toBeCloseTo(0.7, 8);
  });

  it("partial sell keeps the remainder and realizes a proportional entry fee", () => {
    let p = applyBuy(empty, pos, 40, 0.3);
    p = applySell(p, "m:0", 30, 0.5, 0);
    // proceeds 15; basis 30×(0.4+0.003)=12.09 → +2.91
    expect(p.realizedPnlUsd).toBeCloseTo(2.91, 8);
    expect(p.positions[0]?.shares).toBe(70);
  });

  it("settlement pays $1 won / $0 lost / $0.50 voided, entry fee in basis", () => {
    const base = applyBuy(empty, pos, 40, 0.3);
    expect(applySettlement(base, "m:0", "won").realizedPnlUsd).toBeCloseTo(100 - 40.3, 8);
    expect(applySettlement(base, "m:0", "lost").realizedPnlUsd).toBeCloseTo(-40.3, 8);
    expect(applySettlement(base, "m:0", "voided").realizedPnlUsd).toBeCloseTo(50 - 40.3, 8);
    // cash reconciliation holds for all three
    const won = applySettlement(base, "m:0", "won");
    expect(won.cashUsd - won.bankrollUsd).toBeCloseTo(won.realizedPnlUsd, 8);
  });
});
