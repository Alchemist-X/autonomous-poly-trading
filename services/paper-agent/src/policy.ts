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
  // True when applySaturatedHold converted a negative_edge exit into a hold —
  // consumers must cancel resting exit limits and ledger the veto explicitly.
  saturatedHold?: boolean;
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

// Selling at/above this net-of-fee price captures effectively full value —
// exiting is then strictly better than waiting for resolution (same payout,
// sooner, and no voided-market risk), so the saturation veto steps aside.
export const SATURATED_HOLD_FULL_VALUE = 0.999;

// True when the engine's probability clamp binds in the HELD side's favor:
// probYes pinned at the ceiling while we hold YES, or at the floor while we
// hold NO (P(NO) = 1 − probYes is then pinned at the ceiling).
function saturationFavorsHeldSide(saturatedAt: "floor" | "ceil" | null, outcomeIndex: number): boolean {
  return (outcomeIndex === 0 && saturatedAt === "ceil") || (outcomeIndex === 1 && saturatedAt === "floor");
}

// A negative-edge exit computed from a ceiling-clamped probability carries no
// information: the true posterior lies somewhere in [0.99, 1) and the flip
// point sits inside that inexpressible band, so "edge < 0" only restates the
// clamp (empirically: the mojtaba 2026-07-15 exit at bid 0.994 vs clamped
// 0.99, alpha −$3.21 versus resolution). Convert such exits into holds and let
// the position ride to settlement. The veto never touches stop-loss (decided
// before negative_edge and model-free) and steps aside once the bid nets
// SATURATED_HOLD_FULL_VALUE — at that price selling dominates holding.
export function applySaturatedHold(
  cfg: PaperConfig,
  decision: ExitDecision,
  saturatedAt: "floor" | "ceil" | null,
  outcomeIndex: number,
  book: OrderBook,
  fees: MarketFeeParams
): ExitDecision {
  if (!cfg.saturatedHoldEnabled) return decision;
  if (decision.reason !== "negative_edge") return decision;
  if (!saturationFavorsHeldSide(saturatedAt, outcomeIndex)) return decision;
  const bid = bestBid(book);
  if (bid === null) return decision;
  const exitNet = bid - takerFeeUsd(1, bid, fees);
  if (exitNet >= SATURATED_HOLD_FULL_VALUE) return decision;
  // The veto is only justified when some true probability inside the clamp
  // band [ceil, 1] would clear the hold threshold. If even P = 1 leaves the
  // edge below exitEdgePp, the exit is correct for every expressible belief
  // and must stand (matters when PAPER_EXIT_EDGE_PP > 0).
  if ((1 - exitNet) * 100 < cfg.exitEdgePp) return decision;
  return {
    ...decision,
    action: "hold",
    reason: "hold",
    saturatedHold: true,
    detail: `saturated ${saturatedAt} eval — ceiling-clamped edge is a bound, not a signal; holding to resolution (${decision.detail})`
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
