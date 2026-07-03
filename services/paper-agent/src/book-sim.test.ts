import { describe, expect, it } from "vitest";
import { limitSellFilled, simulateMarketBuy, simulateMarketSell } from "./book-sim";
import { feeParamsFor, takerFeeUsd } from "./fees";
import { applyBuy, applyResolution, applySell, type PaperPosition, type Portfolio } from "./portfolio";
import type { OrderBook } from "./polymarket";

const feeFree = feeParamsFor("", true);
const sports = feeParamsFor("sports", false);

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

describe("fees", () => {
  it("mirrors the orchestrator formula", () => {
    // fee = shares * price * feeRate * (p(1-p))^exp — sports 3%, exp 1
    expect(takerFeeUsd(100, 0.5, sports)).toBeCloseTo(100 * 0.5 * 0.03 * 0.25, 8);
    expect(takerFeeUsd(100, 0.5, feeFree)).toBe(0);
  });

  it("category aliases resolve", () => {
    expect(feeParamsFor("NBA Finals", false).feeRate).toBe(0.03);
    expect(feeParamsFor("bitcoin-2026", false).feeRate).toBe(0.072);
    expect(feeParamsFor("mystery", false).feeRate).toBe(0.04);
  });
});

describe("simulateMarketSell", () => {
  it("walks the bids with slippage", () => {
    const fill = simulateMarketSell(book, 100, feeFree);
    // 60 @ .50 + 40 @ .48
    expect(fill.shares).toBe(100);
    expect(fill.notionalUsd).toBeCloseTo(60 * 0.5 + 40 * 0.48, 8);
    expect(fill.avgPrice).toBeLessThan(0.5);
    expect(fill.liquidityExhausted).toBe(false);
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
    // 40 @ .52 costs 20.8; remaining 9.2 buys 16.72 @ .55
    expect(fill.shares).toBeCloseTo(40 + 9.2 / 0.55, 3);
    expect(fill.notionalUsd).toBeCloseTo(30, 6);
  });
});

describe("limitSellFilled", () => {
  it("fills at the limit when the bid reaches it", () => {
    const fill = limitSellFilled(book, 0.5, 40, feeFree, 0);
    expect(fill?.shares).toBe(40);
    expect(fill?.avgPrice).toBe(0.5);
    expect(fill?.feeUsd).toBe(0);
  });

  it("caps at visible size at-or-above the limit", () => {
    const fill = limitSellFilled(book, 0.5, 100, feeFree, 0);
    expect(fill?.shares).toBe(60);
    expect(fill?.liquidityExhausted).toBe(true);
  });

  it("no fill while the bid is below the limit", () => {
    expect(limitSellFilled(book, 0.55, 10, feeFree, 0)).toBeNull();
  });

  it("maker fee factor scales the taker fee", () => {
    const half = limitSellFilled(book, 0.5, 10, sports, 0.5)!;
    expect(half.feeUsd).toBeCloseTo(takerFeeUsd(10, 0.5, sports) * 0.5, 8);
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
    conditionId: "c",
    question: "q",
    category: "sports",
    negRisk: false,
    outcomeIndex: 0,
    outcomeLabel: "Yes",
    tokenId: "tok",
    shares: 100,
    avgEntryPrice: 0.4,
    entryFeeUsd: 0.3,
    openedAtUtc: "t0"
  };

  it("buy → cash down by notional+fee; sell realizes PnL net of fees", () => {
    let p = applyBuy(empty, pos, 40, 0.3);
    expect(p.cashUsd).toBeCloseTo(1000 - 40.3, 8);
    p = applySell(p, "m:0", 100, 0.5, 0.4);
    // proceeds 50 − 0.4 = 49.6, basis 40 → +9.6 realized
    expect(p.realizedPnlUsd).toBeCloseTo(9.6, 8);
    expect(p.positions).toHaveLength(0);
    expect(p.totalFeesUsd).toBeCloseTo(0.7, 8);
  });

  it("partial sell keeps the remainder and its resting limits", () => {
    let p = applyBuy(empty, pos, 40, 0);
    p = { ...p, restingLimits: [{ id: "l1", positionId: "m:0", shares: 50, limitPrice: 0.6, placedAtUtc: "t", expiresAtUtc: "t", reason: "r" }] };
    p = applySell(p, "m:0", 30, 0.5, 0);
    expect(p.positions[0]?.shares).toBe(70);
    expect(p.restingLimits).toHaveLength(1);
  });

  it("resolution pays $1 per winning share, $0 per losing share", () => {
    const won = applyResolution(applyBuy(empty, pos, 40, 0), "m:0", true);
    expect(won.cashUsd).toBeCloseTo(1000 - 40 + 100, 8);
    expect(won.realizedPnlUsd).toBeCloseTo(60, 8);
    const lost = applyResolution(applyBuy(empty, pos, 40, 0), "m:0", false);
    expect(lost.realizedPnlUsd).toBeCloseTo(-40, 8);
  });
});
