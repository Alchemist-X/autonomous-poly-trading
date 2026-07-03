// Decision policy: where beliefs meet prices. Pure functions — everything is
// unit-testable and every number that reaches the ledger derives from here.
//
// Exit rule (user 2026-07-03 + standing repo rule): recompute the held side's
// fair probability with the isolated evaluator; if the net edge of HOLDING
// versus exiting now (fees included) is below the threshold, close. Stop-loss
// outranks the model view (and is ALSO checked without any model in the fast
// tick — see run-cycle). Execution is the 50/50 hybrid: half taker now, half
// resting maker limit (fee friction is exactly why the split exists);
// stop-loss exits go 100% market.

import type { PaperConfig } from "./config";
import { takerFeeUsd, type MarketFeeParams } from "./fees";
import type { OrderBook } from "./polymarket";
import { bestBid } from "./polymarket";

export type ExitReason = "negative_edge" | "stop_loss" | "hold";

export interface ExitDecision {
  action: "hold" | "exit";
  reason: ExitReason;
  agentProb: number;
  mark: number | null;
  netEdgePp: number | null;
  detail: string;
}

// Net edge of HOLDING one share: fair value P minus what a sale nets now.
// Selling nets bid − perShareFee; holding to resolution pays P × $1 (no fee
// on redemption). Positive → holding is worth more than exiting.
export function holdNetEdgePp(
  agentProb: number,
  book: OrderBook,
  fees: MarketFeeParams
): { edgePp: number; mark: number } | null {
  const bid = bestBid(book);
  if (bid === null) return null;
  const perShareFee = takerFeeUsd(1, bid, fees);
  const exitNetPerShare = bid - perShareFee;
  return { edgePp: (agentProb - exitNetPerShare) * 100, mark: bid };
}

// Model-free stop-loss check — usable from the fast tick without an LLM.
export function stopLossBreached(cfg: PaperConfig, avgEntryPrice: number, book: OrderBook): boolean {
  const bid = bestBid(book);
  return bid !== null && bid <= avgEntryPrice * (1 - cfg.stopLossPct);
}

export function decideExit(
  cfg: PaperConfig,
  agentProb: number,
  avgEntryPrice: number,
  book: OrderBook,
  fees: MarketFeeParams
): ExitDecision {
  const edge = holdNetEdgePp(agentProb, book, fees);
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
  if (stopLossBreached(cfg, avgEntryPrice, book)) {
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

function roundToTick(p: number, tick: number): number {
  const inv = Math.round(1 / tick);
  return Math.round(p * inv) / inv;
}

// Split an exit into the taker half and a maker limit. The limit asks for the
// better of (fair value, one tick inside the ask) but always at least one
// tick ABOVE the bid — a resting order priced at/under the bid would be
// instantly marketable, defeating the maker intent. Tick size comes from the
// market's live metadata (0.001 on most books today).
export function planHybridExit(cfg: PaperConfig, shares: number, agentProb: number, book: OrderBook, tick: number): HybridPlan {
  const marketShares = shares * cfg.hybridMarketRatio;
  const limitShares = shares - marketShares;
  const bid = book.bids[0]?.price ?? tick;
  const ask = book.asks[0]?.price ?? 1 - tick;
  const insideAsk = Math.max(bid + tick, ask - tick);
  const raw = Math.max(agentProb, Math.min(insideAsk, 1 - tick), bid + tick);
  const limitPrice = Math.min(1 - tick, Math.max(bid + tick, roundToTick(raw, tick)));
  return { marketShares, limitShares, limitPrice };
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
  fees: MarketFeeParams
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
