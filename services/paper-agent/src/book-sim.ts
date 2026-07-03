// Fill simulation against a live order book snapshot. Market orders walk the
// visible book level by level (realistic slippage); resting limit orders fill
// when the opposite side crosses their price. Fees follow the live per-market
// params (fees.ts). Market buys carve the fee OUT of the USD budget so cash
// can never go negative.

import { feeUsd, makerFeeUsd, takerFeeUsd, type MarketFeeParams } from "./fees";
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

export function simulateMarketSell(book: OrderBook, shares: number, fees: MarketFeeParams): SimFill {
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

function walkBudget(book: OrderBook, budgetUsd: number): { shares: number; notional: number } {
  let remainingUsd = budgetUsd;
  let shares = 0;
  let notional = 0;
  for (const level of book.asks) {
    if (remainingUsd <= 0.000001) break;
    const affordable = remainingUsd / level.price;
    const take = Math.min(affordable, level.size);
    shares += take;
    notional += take * level.price;
    remainingUsd -= take * level.price;
  }
  return { shares, notional };
}

// Fee comes out of the budget: walk once to estimate the fee rate at the
// achieved price, then re-walk with the fee carved out. Converges in one
// pass for realistic fee sizes.
export function simulateMarketBuy(book: OrderBook, spendUsd: number, fees: MarketFeeParams): SimFill {
  const first = walkBudget(book, spendUsd);
  if (first.shares <= 0) return { shares: 0, avgPrice: 0, notionalUsd: 0, feeUsd: 0, liquidityExhausted: true };
  const estAvg = first.notional / first.shares;
  const estFee = takerFeeUsd(first.shares, estAvg, fees);
  const { shares, notional } = estFee > 0 ? walkBudget(book, Math.max(0, spendUsd - estFee)) : first;
  const avgPrice = shares > 0 ? notional / shares : 0;
  const fee = takerFeeUsd(shares, avgPrice, fees);
  return {
    shares,
    avgPrice,
    notionalUsd: notional,
    feeUsd: fee,
    liquidityExhausted: notional + fee < spendUsd - 0.01
  };
}

// A resting SELL limit fills (as maker) when the best bid reaches its price.
// Conservative model: fill capped by the size visible at-or-above the limit.
export function limitSellFilled(
  book: OrderBook,
  limitPrice: number,
  shares: number,
  fees: MarketFeeParams
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
    feeUsd: makerFeeUsd(filled, limitPrice, fees),
    liquidityExhausted: filled < shares
  };
}

export { feeUsd };
