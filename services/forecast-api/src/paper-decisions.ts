// Decision-quality decomposition for the paper book.
//
// The agent makes exactly two decisions per position: ENTER (which side, at
// what price) and EXIT (whether to sell before the market resolves). This
// module splits every episode's realised/unrealised PnL into those two
// contributions against one shared counterfactual — "what the position is
// worth right now / at settlement":
//
//   benchmark      = settlement value (1 / 0 / 0.5) once resolved, else the
//                    latest observed price for the held outcome
//   entryAlphaUsd  = shares × benchmark − costUsd          (the buy-and-hold result)
//   exitAlphaUsd   = proceedsUsd − shares × benchmark      (what selling early added)
//   pnlUsd         = entryAlphaUsd + exitAlphaUsd          (exact identity)
//
// Open positions have no exit yet, so their exit contribution is 0 and their
// entry contribution is the current unrealised PnL. This is why the split is
// fairer than the old exit-only α: a book whose winners are still open shows
// its entry skill instead of only its (negative) early-selling record.
//
// Everything is derived from the ledger + portfolio so the two halves always
// reconcile to the book's own PnL; the reflection report is consulted only for
// live prices of positions that were sold before their market resolved.

import type { PaperLedgerEvent } from "./paper-ledger";
import { outcomeIndexOf } from "./paper-ledger";

export type BenchmarkSource = "settled" | "live" | "mark" | "exit";

export interface DecisionEpisode {
  positionId: string;
  slug: string;
  question: string;
  side: string;
  status: "open" | "closed";
  openedUtc: string;
  closedUtc: string | null;
  holdDays: number | null;
  shares: number;
  entryPrice: number;
  /** Notional + entry fees — the true cost basis the two alphas are measured against. */
  costUsd: number;
  exitPrice: number | null;
  proceedsUsd: number | null;
  benchmarkPrice: number | null;
  benchmarkSource: BenchmarkSource;
  entryAlphaUsd: number | null;
  exitAlphaUsd: number | null;
  pnlUsd: number | null;
  exitReason: string | null;
  exitStyle: string | null;
  /** Entry-time context from the watchlist evaluation that opened the position. */
  entryEdgePp: number | null;
  agentProbAtEntry: number | null;
  marketProbAtEntry: number | null;
  /** Review depth: engine rounds / sources behind the first review after entry. */
  roundsAtEntry: number | null;
  evidenceAtEntry: number | null;
  reviewCount: number;
}

export interface DecisionQuality {
  /** Benchmark prices are as of this timestamp (latest reflection / last review). */
  benchmarkAsOfUtc: string | null;
  entry: { totalUsd: number; openUsd: number; closedUsd: number; scored: number; unscored: number };
  exit: { totalUsd: number; scored: number; unscored: number };
  /**
   * Closed episodes must sum to the book's own realised PnL. Both sides are
   * computed independently (replay here, running total in the portfolio), so a
   * non-zero delta means the episode replay is wrong — surface it, never hide it.
   */
  reconciliation: { closedPnlUsd: number; realizedPnlUsd: number; deltaUsd: number };
  episodes: DecisionEpisode[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const SETTLEMENT_PER_SHARE: Record<string, number> = { won: 1, lost: 0, voided: 0.5 };

/** Raw episode as replayed from the ledger, before benchmarks are applied. */
export interface RawEpisode {
  positionId: string;
  slug: string;
  question: string;
  side: string;
  openedUtc: string;
  closedUtc: string | null;
  shares: number;
  entryPrice: number;
  costUsd: number;
  exitPrice: number | null;
  proceedsUsd: number | null;
  settledPerShare: number | null;
  exitReason: string | null;
  exitStyle: string | null;
}

/**
 * Replay buys/sells/resolutions per positionId into complete episodes. A
 * position can round-trip more than once under the same id (re-entry after a
 * stop-loss), so episodes are emitted in close order and the still-open tail
 * is returned separately by the caller via `openTail`.
 */
export function replayEpisodes(events: readonly PaperLedgerEvent[]): {
  closed: RawEpisode[];
  openTail: Map<string, RawEpisode>;
} {
  interface Acc {
    slug: string;
    question: string;
    side: string;
    openedUtc: string;
    shares: number;
    notionalUsd: number;
    buyFeesUsd: number;
    proceedsUsd: number;
    soldShares: number;
    lastSellUtc: string;
    lastReason: string;
    styles: Set<string>;
  }
  const open = new Map<string, Acc>();
  const closed: RawEpisode[] = [];

  const emit = (id: string, acc: Acc, closedUtc: string, settledPerShare: number | null, reason: string): void => {
    const soldShares = acc.soldShares + (settledPerShare === null ? 0 : acc.shares);
    const proceeds = acc.proceedsUsd + (settledPerShare === null ? 0 : acc.shares * settledPerShare);
    if (!(soldShares > 0)) return;
    closed.push({
      positionId: id,
      slug: acc.slug,
      question: acc.question,
      side: acc.side,
      openedUtc: acc.openedUtc,
      closedUtc,
      shares: round2(soldShares),
      entryPrice: acc.notionalUsd / soldShares,
      costUsd: round2(acc.notionalUsd + acc.buyFeesUsd),
      exitPrice: proceeds / soldShares,
      proceedsUsd: round2(proceeds),
      settledPerShare,
      exitReason: reason,
      exitStyle: [...acc.styles].sort().join("+") || null
    });
  };

  for (const e of events) {
    const id = String(e.positionId ?? "");
    if (!id) continue;
    if (e.type === "resolution") {
      const acc = open.get(id);
      const perShare = SETTLEMENT_PER_SHARE[String(e.kind ?? "")];
      if (!acc || perShare === undefined || acc.shares <= 0.01) {
        open.delete(id);
        continue;
      }
      emit(id, acc, String(e.ts ?? ""), perShare, `settled_${String(e.kind)}`);
      open.delete(id);
      continue;
    }
    if (e.type !== "trade") continue;
    const shares = Number(e.shares ?? 0);
    const price = Number(e.avgPrice ?? 0);
    if (!(shares > 0)) continue;
    if (e.side === "buy") {
      const acc = open.get(id) ?? {
        slug: String(e.slug ?? ""),
        question: "",
        side: String(e.outcome ?? ""),
        openedUtc: String(e.ts ?? ""),
        shares: 0,
        notionalUsd: 0,
        buyFeesUsd: 0,
        proceedsUsd: 0,
        soldShares: 0,
        lastSellUtc: "",
        lastReason: "",
        styles: new Set<string>()
      };
      open.set(id, {
        ...acc,
        shares: acc.shares + shares,
        notionalUsd: acc.notionalUsd + shares * price,
        buyFeesUsd: acc.buyFeesUsd + Number(e.feeUsd ?? 0)
      });
      continue;
    }
    const acc = open.get(id);
    if (!acc) continue;
    const styles = new Set(acc.styles);
    styles.add(String(e.style ?? "market"));
    const next: Acc = {
      ...acc,
      shares: acc.shares - shares,
      proceedsUsd: acc.proceedsUsd + shares * price - Number(e.feeUsd ?? 0),
      soldShares: acc.soldShares + shares,
      lastSellUtc: String(e.ts ?? ""),
      lastReason: String(e.reason ?? "").split(":")[0] ?? "",
      styles
    };
    if (next.shares <= 0.01) {
      emit(id, next, next.lastSellUtc, null, next.lastReason);
      open.delete(id);
    } else {
      open.set(id, next);
    }
  }

  const openTail = new Map<string, RawEpisode>();
  for (const [id, acc] of open) {
    if (!(acc.shares > 0.01)) continue;
    const heldShares = acc.shares;
    openTail.set(id, {
      positionId: id,
      slug: acc.slug,
      question: acc.question,
      side: acc.side,
      openedUtc: acc.openedUtc,
      closedUtc: null,
      shares: round2(heldShares),
      // Cost basis of the REMAINING shares only: a partially-sold position
      // carries its already-realised leg in the closed episodes, not here.
      entryPrice: acc.notionalUsd / (heldShares + acc.soldShares),
      costUsd: round2(
        (acc.notionalUsd + acc.buyFeesUsd) * (heldShares / (heldShares + acc.soldShares))
      ),
      exitPrice: null,
      proceedsUsd: null,
      settledPerShare: null,
      exitReason: null,
      exitStyle: null
    });
  }
  return { closed, openTail };
}

export interface EntryContext {
  edgePp: number | null;
  agentProb: number | null;
  marketProb: number | null;
  roundsAtEntry: number | null;
  evidenceAtEntry: number | null;
  reviewCount: number;
}

/**
 * Entry-time context per position: the watchlist evaluation immediately before
 * the buy (the decision that opened it) plus the depth of the first review
 * after it. Keyed by positionId; re-entries reuse the latest matching pair.
 */
export function collectEntryContext(events: readonly PaperLedgerEvent[]): Map<string, EntryContext> {
  const out = new Map<string, EntryContext>();
  // Last watchlist eval seen per slug — the buy that follows it is its result.
  const lastWatchlist = new Map<string, PaperLedgerEvent>();
  const reviewCounts = new Map<string, number>();
  const firstReviewAfterBuy = new Map<string, PaperLedgerEvent>();
  const awaitingReview = new Set<string>();

  for (const e of events) {
    if (e.type === "watchlist_eval" && typeof e.slug === "string") {
      lastWatchlist.set(e.slug, e);
      continue;
    }
    if (e.type === "trade" && e.side === "buy" && typeof e.positionId === "string") {
      const slug = String(e.slug ?? "");
      const wl = lastWatchlist.get(slug);
      const idx = outcomeIndexOf(e.positionId);
      const probYes = typeof wl?.probYes === "number" ? wl.probYes : null;
      const marketYes = typeof wl?.marketProbYes === "number" ? wl.marketProbYes : null;
      out.set(e.positionId, {
        edgePp: typeof e.edgePp === "number" ? e.edgePp : typeof wl?.edgePp === "number" ? wl.edgePp : null,
        // Probabilities are reported for the HELD outcome, matching the way
        // the position's own reviews report agentProbOutcome.
        agentProb: probYes === null ? null : idx === 1 ? 1 - probYes : probYes,
        marketProb: marketYes === null ? null : idx === 1 ? 1 - marketYes : marketYes,
        roundsAtEntry: null,
        evidenceAtEntry: null,
        reviewCount: 0
      });
      awaitingReview.add(e.positionId);
      continue;
    }
    if (e.type === "evaluation" && typeof e.positionId === "string") {
      reviewCounts.set(e.positionId, (reviewCounts.get(e.positionId) ?? 0) + 1);
      if (awaitingReview.has(e.positionId)) {
        firstReviewAfterBuy.set(e.positionId, e);
        awaitingReview.delete(e.positionId);
      }
    }
  }

  for (const [id, ctx] of out) {
    const first = firstReviewAfterBuy.get(id);
    out.set(id, {
      ...ctx,
      roundsAtEntry: typeof first?.engineRounds === "number" ? first.engineRounds : null,
      evidenceAtEntry: typeof first?.evidenceCount === "number" ? first.evidenceCount : null,
      reviewCount: reviewCounts.get(id) ?? 0
    });
  }
  return out;
}

export interface BenchmarkInputs {
  /** positionId → last live price for the held outcome (reflection exit rows). */
  livePrices: Map<string, number>;
  /** positionId → current bid mark from the portfolio's last review. */
  markPrices: Map<string, number>;
  /** slug/positionId → display question text. */
  questions: Map<string, string>;
  benchmarkAsOfUtc: string | null;
}

function benchmarkFor(
  ep: RawEpisode,
  inputs: BenchmarkInputs
): { price: number | null; source: BenchmarkSource } {
  if (ep.settledPerShare !== null) return { price: ep.settledPerShare, source: "settled" };
  const mark = inputs.markPrices.get(ep.positionId);
  if (mark !== undefined) return { price: mark, source: "mark" };
  const live = inputs.livePrices.get(ep.positionId);
  if (live !== undefined) return { price: live, source: "live" };
  // No observable price: fall back to the exit price so the episode still
  // reconciles (exit α = 0, all of the PnL attributed to the entry) and flag
  // the substitution so the UI can mark the row as unscored for exit quality.
  return ep.exitPrice === null ? { price: null, source: "exit" } : { price: ep.exitPrice, source: "exit" };
}

export function buildDecisionQuality(
  events: readonly PaperLedgerEvent[],
  inputs: BenchmarkInputs,
  realizedPnlUsd: number
): DecisionQuality {
  const { closed, openTail } = replayEpisodes(events);
  const entryCtx = collectEntryContext(events);
  const raw: RawEpisode[] = [...closed, ...openTail.values()];

  const episodes: DecisionEpisode[] = raw.map((ep) => {
    const { price, source } = benchmarkFor(ep, inputs);
    const ctx = entryCtx.get(ep.positionId);
    const isOpen = ep.closedUtc === null;
    const entryAlpha = price === null ? null : round2(ep.shares * price - ep.costUsd);
    const exitAlpha =
      isOpen || price === null || ep.proceedsUsd === null ? (isOpen ? 0 : null) : round2(ep.proceedsUsd - ep.shares * price);
    const pnl =
      isOpen
        ? entryAlpha
        : ep.proceedsUsd === null
          ? null
          : round2(ep.proceedsUsd - ep.costUsd);
    const closedMs = ep.closedUtc ? Date.parse(ep.closedUtc) : Date.parse(inputs.benchmarkAsOfUtc ?? "");
    const openedMs = Date.parse(ep.openedUtc);
    return {
      positionId: ep.positionId,
      slug: ep.slug,
      question: inputs.questions.get(ep.positionId) ?? inputs.questions.get(ep.slug) ?? (ep.question || ep.slug),
      side: ep.side,
      status: isOpen ? "open" : "closed",
      openedUtc: ep.openedUtc,
      closedUtc: ep.closedUtc,
      holdDays:
        Number.isFinite(closedMs) && Number.isFinite(openedMs)
          ? Math.round(((closedMs - openedMs) / 86_400_000) * 10) / 10
          : null,
      shares: ep.shares,
      entryPrice: Math.round(ep.entryPrice * 10000) / 10000,
      costUsd: ep.costUsd,
      exitPrice: ep.exitPrice === null ? null : Math.round(ep.exitPrice * 10000) / 10000,
      proceedsUsd: ep.proceedsUsd,
      benchmarkPrice: price === null ? null : Math.round(price * 10000) / 10000,
      benchmarkSource: source,
      entryAlphaUsd: entryAlpha,
      exitAlphaUsd: exitAlpha,
      pnlUsd: pnl,
      exitReason: ep.exitReason,
      exitStyle: ep.exitStyle,
      entryEdgePp: ctx?.edgePp ?? null,
      agentProbAtEntry: ctx?.agentProb ?? null,
      marketProbAtEntry: ctx?.marketProb ?? null,
      roundsAtEntry: ctx?.roundsAtEntry ?? null,
      evidenceAtEntry: ctx?.evidenceAtEntry ?? null,
      reviewCount: ctx?.reviewCount ?? 0
    };
  });

  episodes.sort((a, b) => (a.openedUtc < b.openedUtc ? 1 : a.openedUtc > b.openedUtc ? -1 : 0));

  const sum = (xs: Array<number | null>): number => round2(xs.reduce<number>((s, x) => s + (x ?? 0), 0));
  const entryVals = episodes.map((e) => e.entryAlphaUsd);
  const openEntry = episodes.filter((e) => e.status === "open").map((e) => e.entryAlphaUsd);
  const closedEntry = episodes.filter((e) => e.status === "closed").map((e) => e.entryAlphaUsd);
  const exitVals = episodes.filter((e) => e.status === "closed").map((e) => e.exitAlphaUsd);
  const entryTotal = sum(entryVals);
  const exitTotal = sum(exitVals);
  const closedPnl = sum(episodes.filter((e) => e.status === "closed").map((e) => e.pnlUsd));

  return {
    benchmarkAsOfUtc: inputs.benchmarkAsOfUtc,
    entry: {
      totalUsd: entryTotal,
      openUsd: sum(openEntry),
      closedUsd: sum(closedEntry),
      scored: entryVals.filter((v) => v !== null).length,
      unscored: entryVals.filter((v) => v === null).length
    },
    exit: {
      totalUsd: exitTotal,
      scored: episodes.filter((e) => e.status === "closed" && e.benchmarkSource !== "exit").length,
      unscored: episodes.filter((e) => e.status === "closed" && e.benchmarkSource === "exit").length
    },
    reconciliation: {
      closedPnlUsd: closedPnl,
      realizedPnlUsd: round2(realizedPnlUsd),
      deltaUsd: round2(closedPnl - realizedPnlUsd)
    },
    episodes
  };
}
