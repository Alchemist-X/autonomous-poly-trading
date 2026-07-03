// Decision policy: where beliefs meet prices. Pure functions — everything is
// unit-testable and every number that reaches the ledger derives from here.
//
// Exit rule (user 2026-07-03 + standing repo rule): recompute the held side's
// fair probability with the isolated evaluator; if the net edge of HOLDING
// versus exiting now (fees included) is below the threshold, close. Stop-loss
// outranks the model view. Execution is the 50/50 hybrid: half taker now,
// half resting maker limit (fee friction is exactly why the split exists).

import type { PaperConfig } from "./config";
import type { FeeParams } from "./fees";
import { takerFeeUsd } from "./fees";
import type { OrderBook } from "./polymarket";
import { bestBid } from "./polymarket";

export type ExitReason = "negative_edge" | "stop_loss" | "hold";

export interface ExitDecision {
  action: "hold" | "exit";
  reason: ExitReason;
  agentProb: number;
  mark: number | null;
  // EV per share of holding to resolution vs selling now (fees in), in pp.
  netEdgePp: number | null;
  detail: string;
}

// Net edge of HOLDING one share: fair value P minus what a sale nets now.
// Selling nets bid − perShareFee; holding to resolution pays P × $1 (no fee
// on redemption). Positive → holding is worth more than exiting.
export function holdNetEdgePp(
  agentProb: number,
  book: OrderBook,
  shares: number,
  fees: FeeParams
): { edgePp: number; mark: number } | null {
  const bid = bestBid(book);
  if (bid === null || shares <= 0) return null;
  const perShareFee = takerFeeUsd(shares, bid, fees) / shares;
  const exitNetPerShare = bid - perShareFee;
  return { edgePp: (agentProb - exitNetPerShare) * 100, mark: bid };
}

export function decideExit(
  cfg: PaperConfig,
  agentProb: number,
  avgEntryPrice: number,
  book: OrderBook,
  shares: number,
  fees: FeeParams
): ExitDecision {
  const edge = holdNetEdgePp(agentProb, book, shares, fees);
  if (!edge) {
    return {
      action: "hold",
      reason: "hold",
      agentProb,
      mark: null,
      netEdgePp: null,
      detail: "no bids on the book — nothing to exit into; holding by necessity"
    };
  }
  // Stop-loss first (standing rule: it outranks the model view).
  if (edge.mark <= avgEntryPrice * (1 - cfg.stopLossPct)) {
    return {
      action: "exit",
      reason: "stop_loss",
      agentProb,
      mark: edge.mark,
      netEdgePp: edge.edgePp,
      detail: `mark ${edge.mark.toFixed(3)} breached stop-loss (entry ${avgEntryPrice.toFixed(3)} − ${cfg.stopLossPct * 100}%)`
    };
  }
  if (edge.edgePp < cfg.exitEdgePp) {
    return {
      action: "exit",
      reason: "negative_edge",
      agentProb,
      mark: edge.mark,
      netEdgePp: edge.edgePp,
      detail: `hold-vs-exit net edge ${edge.edgePp.toFixed(1)}pp < threshold ${cfg.exitEdgePp}pp (agent ${(agentProb * 100).toFixed(1)}% vs executable ${edge.mark.toFixed(3)})`
    };
  }
  return {
    action: "hold",
    reason: "hold",
    agentProb,
    mark: edge.mark,
    netEdgePp: edge.edgePp,
    detail: `net edge ${edge.edgePp.toFixed(1)}pp ≥ ${cfg.exitEdgePp}pp — keep`
  };
}

export interface HybridPlan {
  marketShares: number;
  limitShares: number;
  limitPrice: number;
}

// Split an exit into the taker half and a maker limit. The limit price asks
// for the better of (fair value, one tick inside the ask) but never below the
// current bid — a resting order priced under the bid would be instantly
// marketable, defeating the maker intent.
export function planHybridExit(
  cfg: PaperConfig,
  shares: number,
  agentProb: number,
  book: OrderBook
): HybridPlan {
  const marketShares = shares * cfg.hybridMarketRatio;
  const limitShares = shares - marketShares;
  const bid = book.bids[0]?.price ?? 0.01;
  const ask = book.asks[0]?.price ?? 0.99;
  const tick = 0.01;
  const insideAsk = Math.max(bid, ask - tick);
  const limitPrice = clampPrice(Math.max(agentProb, Math.min(insideAsk, 0.99), bid + tick));
  return { marketShares, limitShares, limitPrice };
}

function clampPrice(p: number): number {
  return Math.min(0.99, Math.max(0.01, Math.round(p * 100) / 100));
}

export interface EntryDecision {
  enter: boolean;
  outcomeIndex: number;
  edgePp: number;
  detail: string;
}

// Watchlist entries: buy the side whose executable ask trades below the
// agent's fair value by at least entryEdgePp after the taker fee.
export function decideEntry(
  cfg: PaperConfig,
  probYes: number,
  yesBook: OrderBook,
  noBook: OrderBook,
  fees: FeeParams
): EntryDecision {
  const sides: Array<{ idx: number; prob: number; book: OrderBook }> = [
    { idx: 0, prob: probYes, book: yesBook },
    { idx: 1, prob: 1 - probYes, book: noBook }
  ];
  let best: EntryDecision = { enter: false, outcomeIndex: 0, edgePp: -Infinity, detail: "no ask liquidity" };
  for (const side of sides) {
    const ask = side.book.asks[0]?.price;
    if (ask === undefined) continue;
    const perShareFee = takerFeeUsd(1, ask, fees);
    const edgePp = (side.prob - ask - perShareFee) * 100;
    if (edgePp > best.edgePp) {
      best = {
        enter: edgePp >= cfg.entryEdgePp,
        outcomeIndex: side.idx,
        edgePp,
        detail: `side ${side.idx === 0 ? "YES" : "NO"}: fair ${(side.prob * 100).toFixed(1)}% vs ask ${ask.toFixed(3)} (fee-adj edge ${edgePp.toFixed(1)}pp, threshold ${cfg.entryEdgePp}pp)`
      };
    }
  }
  return best;
}
