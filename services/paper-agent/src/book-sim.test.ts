import { describe, expect, it } from "vitest";
import { limitSellFilled, simulateMarketBuy, simulateMarketSell } from "./book-sim";
import { feeUsd, makerFeeUsd, takerFeeUsd, type MarketFeeParams } from "./fees";
import { applyBuy, applySell, applySettlement, type PaperPosition, type Portfolio } from "./portfolio";
import type { OrderBook } from "./polymarket";

const feeFree: MarketFeeParams = { takerBps: 0, makerBps: 0, tickSize: 0.01 };
// 500bps taker (matches the fee-enabled markets seen live 2026-07), maker 0.
const feed: MarketFeeParams = { takerBps: 500, makerBps: 0, tickSize: 0.001 };

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

describe("fees (live CLOB bps model)", () => {
  it("fee = shares × rate × min(p, 1−p)", () => {
    expect(feeUsd(100, 0.5, 500)).toBeCloseTo(100 * 0.05 * 0.5, 8);
    expect(feeUsd(100, 0.9, 500)).toBeCloseTo(100 * 0.05 * 0.1, 8);
    expect(feeUsd(100, 0.5, 0)).toBe(0);
    expect(takerFeeUsd(100, 0.5, feed)).toBeCloseTo(2.5, 8);
    expect(makerFeeUsd(100, 0.5, feed)).toBe(0);
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
    const fill = simulateMarketBuy(book, 30, feed);
    expect(fill.notionalUsd + fill.feeUsd).toBeLessThanOrEqual(30 + 0.01);
    expect(fill.feeUsd).toBeGreaterThan(0);
  });
});

describe("limitSellFilled", () => {
  it("fills at the limit when the bid reaches it, maker fee applied", () => {
    const fill = limitSellFilled(book, 0.5, 40, feed);
    expect(fill?.shares).toBe(40);
    expect(fill?.avgPrice).toBe(0.5);
    expect(fill?.feeUsd).toBe(0); // makerBps 0
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
