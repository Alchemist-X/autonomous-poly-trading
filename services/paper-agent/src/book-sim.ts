// Fill simulation against a live order book snapshot. Market orders walk the
// visible book level by level (realistic slippage); resting limit orders fill
// when the opposite side crosses their price. Fees follow fees.ts; maker
// fills charge makerFeeFactor × taker fee (0 by default — Polymarket charges
// takers).

import { takerFeeUsd, type FeeParams } from "./fees";
import type { BookLevel, OrderBook } from "./polymarket";

export interface SimFill {
  shares: number;
  avgPrice: number;
  notionalUsd: number; // shares × avgPrice
  feeUsd: number;
  liquidityExhausted: boolean; // book was thinner than the requested size
}

// Walk book levels until `shares` are filled (SELL walks bids, BUY walks asks).
function walk(levels: BookLevel[], shares: number): { filled: number; notional: number } {
  let remaining = shares;
  let notional = 0;
  for (const level of levels) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, level.size);
    notional += take * level.price;
    remaining -= take;
  }
  return { filled: shares - remaining, notional };
}

export function simulateMarketSell(book: OrderBook, shares: number, fees: FeeParams, makerFeeFactor = 0): SimFill {
  void makerFeeFactor;
  const { filled, notional } = walk(book.bids, shares);
  const avgPrice = filled > 0 ? notional / filled : 0;
  return {
    shares: filled,
    avgPrice,
    notionalUsd: notional,
    feeUsd: takerFeeUsd(filled, avgPrice, fees),
    liquidityExhausted: filled < shares
  };
}

export function simulateMarketBuy(book: OrderBook, spendUsd: number, fees: FeeParams): SimFill {
  // Convert a USD budget into shares by walking the asks.
  let remainingUsd = spendUsd;
  let sharesAcquired = 0;
  let notional = 0;
  for (const level of book.asks) {
    if (remainingUsd <= 0.000001) break;
    const affordable = remainingUsd / level.price;
    const take = Math.min(affordable, level.size);
    sharesAcquired += take;
    notional += take * level.price;
    remainingUsd -= take * level.price;
  }
  const avgPrice = sharesAcquired > 0 ? notional / sharesAcquired : 0;
  return {
    shares: sharesAcquired,
    avgPrice,
    notionalUsd: notional,
    feeUsd: takerFeeUsd(sharesAcquired, avgPrice, fees),
    liquidityExhausted: remainingUsd > 0.01
  };
}

// A resting SELL limit fills (as maker) when the best bid reaches its price.
// Conservative model: fill the whole rest at the limit price, capped by the
// size visible at-or-above it.
export function limitSellFilled(
  book: OrderBook,
  limitPrice: number,
  shares: number,
  fees: FeeParams,
  makerFeeFactor: number
): SimFill | null {
  const eligible = book.bids.filter((b) => b.price >= limitPrice);
  if (!eligible.length) return null;
  const available = eligible.reduce((s, b) => s + b.size, 0);
  const filled = Math.min(shares, available);
  if (filled <= 0) return null;
  return {
    shares: filled,
    avgPrice: limitPrice,
    notionalUsd: filled * limitPrice,
    feeUsd: takerFeeUsd(filled, limitPrice, fees) * makerFeeFactor,
    liquidityExhausted: filled < shares
  };
}
