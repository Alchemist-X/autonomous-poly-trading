// Reflection = the backtest loop for a live paper book. Instead of replaying
// history against a strategy, we grade every decision the agent actually made:
//  1. CALIBRATION — paired Brier of the agent vs the market over EVERY
//     evaluated market that has since resolved (held positions AND watchlist
//     passes), plus the skill score 1 − agent/market (>0 = beat the market).
//     This answers the owner's headline question without waiting for our own
//     positions to be held to resolution.
//  2. EXIT ALPHA — per exit episode (market+limit halves merged), realized
//     proceeds vs "what if we had held" (to now/resolution).
//  3. FEE DRAG — total friction paid, split by taker/maker.
//  4. HYBRID QUALITY — limit fill rate + SAME-exit price improvement of the
//     limit half vs the market half on the same position (book-wide pooling
//     was misleading — review 2026-07-06).
//  5. ENGINE FLAGS — saturation/contamination counters over all evaluations.
// Output: reports/<ts>-reflection.{json,md} — the artifacts to review daily.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { log } from "./log";
import { loadPortfolio, type Portfolio } from "./portfolio";
import { fetchBook, fetchMarket, fetchPriceHistory, type MarketInfo } from "./polymarket";
import { readLedger, reportsDir } from "./store";

interface LedgerEvent {
  ts: string;
  type: string;
  side?: string;
  style?: string;
  positionId?: string;
  slug?: string;
  shares?: number;
  avgPrice?: number;
  feeUsd?: number;
  limitId?: string;
  reason?: string;
  agentProbOutcome?: number;
  probYes?: number;
  marketProbYes?: number | null;
  bestBid?: number;
  outcomeIndex?: number;
  saturatedAt?: string | null;
  contaminated?: boolean;
  saturatedHold?: boolean;
  kind?: string;
  outcome?: string;
}

export interface PositionSnapshot {
  positionId: string;
  question: string;
  direction: string;
  shares: number;
  avgEntryPrice: number;
  costUsd: number;
  mark: number | null;
  unrealizedUsd: number | null;
  agentProb: number | null;
  netEdgePp: number | null;
  saturated: boolean;
  contaminated: boolean;
}

export interface ExitEpisode {
  positionId: string;
  question: string;
  direction: string;
  ts: string;
  style: "market" | "limit" | "market+limit";
  legs: number;
  shares: number;
  exitPrice: number; // share-weighted across legs
  feeUsd: number;
  priceNow: number | null;
  exitAlphaUsd: number | null; // proceeds − hold-counterfactual value
  reason: string;
}

export interface CalibrationRow {
  label: string;
  agentProb: number;
  marketProb: number;
  outcome: 0 | 1;
  ts: string;
  // Horizon context (added 2026-08-21): how far ahead of resolution this call
  // was made, and which Gamma event the market belongs to. Both are needed to
  // read the headline number fairly — scoring only the LAST pre-resolution
  // eval measures near-zero-horizon calls, and sibling markets of one event
  // are not independent samples.
  horizonDays?: number | null;
  eventSlug?: string | null;
}

/** A pooled agent-vs-market Brier over some subset of scored calls. */
export interface BrierBlock {
  n: number;
  brierAgent: number | null;
  brierMarket: number | null;
  skill: number | null;
  medianHorizonDays: number | null;
}

export interface HorizonBucket extends BrierBlock {
  label: string;
  minDays: number;
  maxDays: number | null;
}

/** One Gamma event = one underlying uncertainty; its markets are correlated. */
export interface CalibrationCluster {
  eventSlug: string;
  label: string;
  n: number;
  skill: number | null;
  brierAgent: number | null;
  brierMarket: number | null;
}

/** An evaluated market that has NOT resolved yet — excluded from every Brier. */
export interface PendingCalibrationRow {
  label: string;
  slug: string;
  direction: string | null;
  agentProb: number;
  marketProb: number;
  horizonDays: number | null;
  unrealizedUsd: number | null;
}

export interface Reflection {
  generatedAtUtc: string;
  book: {
    cashUsd: number;
    bankrollUsd: number;
    openPositions: number;
    realizedPnlUsd: number;
    totalFeesUsd: number;
    equityUsd: number | null;
  };
  positions: PositionSnapshot[];
  exits: ExitEpisode[];
  exitAlphaTotalUsd: number;
  calibration: {
    n: number;
    brierAgent: number | null;
    brierMarket: number | null;
    skill: number | null; // 1 − brierAgent/brierMarket, >0 = beat the market
    note: string;
    rows: CalibrationRow[];
    // Fairness views (2026-08-21). The headline number above scores the LAST
    // eval before each resolution — the easiest call the agent ever makes, on
    // whichever markets happened to settle. These break that out so the
    // number can be read for what it is:
    //   atEntry   the FIRST call on each market (real foresight, long horizon)
    //   buckets   the same pooled score split by how far out the call was
    //   weighted  horizon^exponent-weighted pooling, so a 60-day call counts
    //             for more than a same-day one
    //   clusters  per Gamma event — sibling expiries of one story are one bet,
    //             so effectiveN (distinct events) is the honest sample size
    //   pending   evaluated markets still open: never scored here, which is
    //             why an unresolved winning book does not show up in Brier
    horizon: {
      atEntry: BrierBlock | null;
      atLast: BrierBlock | null;
      buckets: HorizonBucket[];
      weighted: { exponent: number; skill: number | null; n: number } | null;
    };
    clusters: { effectiveN: number; rows: CalibrationCluster[] };
    pending: PendingCalibrationRow[];
  };
  fees: { takerUsd: number; makerUsd: number; totalUsd: number };
  hybrid: {
    limitPlaced: number;
    limitFilled: number;
    limitFillRate: number | null;
    avgLimitPrice: number | null;
    avgMarketPrice: number | null;
    limitImprovementPp: number | null; // same-exit pairs only
  };
  engineFlags: {
    evaluations: number;
    saturated: number;
    contaminated: number;
    saturatedHolds: number; // negative_edge exits vetoed by the clamp guard
    flagsTracked: boolean; // old ledgers predate the flag fields
  };
}

function parseOutcomeIndex(positionId: string): number | null {
  const match = /:(\d+)$/.exec(positionId);
  return match ? Number(match[1]) : null;
}

function slugOfPositionId(positionId: string): string {
  return positionId.replace(/:\d+$/, "");
}

function shareWeightedAvg(fills: LedgerEvent[]): number | null {
  const total = fills.reduce((sum, f) => sum + (f.shares ?? 0), 0);
  if (!total) return null;
  return fills.reduce((sum, f) => sum + (f.avgPrice ?? 0) * (f.shares ?? 0), 0) / total;
}

type MarketGetter = (slug: string) => Promise<MarketInfo | null>;

// Per-run memoized market lookup. Errors resolve to null so one dead/renamed
// market can never kill the whole report.
function memoizedMarketGetter(): MarketGetter {
  const cache = new Map<string, Promise<MarketInfo | null>>();
  return (slug) => {
    const cached = cache.get(slug);
    if (cached) return cached;
    const pending = fetchMarket(slug).catch(() => null);
    cache.set(slug, pending);
    return pending;
  };
}

// ---------------------------------------------------------------------------
// 1. Calibration: paired agent-vs-market Brier over every resolved eval unit.
// ---------------------------------------------------------------------------

interface ScoringUnit {
  key: string;
  slug: string;
  // Outcome index the unit's probabilities refer to: the HELD outcome for
  // position evals, YES (index 0) for watchlist evals.
  scoredIndex: number;
  evals: Array<{ ts: string; agentProb: number; marketProb: number }>;
}

// One scoring unit per evaluated market: position evals keyed by positionId,
// watchlist evals keyed by "wl:"+slug. Only evals carrying BOTH an agent and
// a market probability are kept, so the two Brier means stay paired (old
// watchlist events lack marketProbYes and drop out of both).
function collectScoringUnits(ledger: LedgerEvent[]): ScoringUnit[] {
  const units = new Map<string, ScoringUnit>();
  const add = (key: string, slug: string, scoredIndex: number, ev: ScoringUnit["evals"][number]): void => {
    const unit = units.get(key) ?? { key, slug, scoredIndex, evals: [] };
    units.set(key, { ...unit, evals: [...unit.evals, ev] });
  };
  for (const e of ledger) {
    if (e.type === "evaluation" && e.positionId && typeof e.agentProbOutcome === "number" && typeof e.bestBid === "number") {
      const idx = typeof e.outcomeIndex === "number" ? e.outcomeIndex : parseOutcomeIndex(e.positionId);
      if (idx === null) continue;
      add(e.positionId, e.slug ?? slugOfPositionId(e.positionId), idx, {
        ts: e.ts,
        agentProb: e.agentProbOutcome,
        marketProb: e.bestBid
      });
    } else if (e.type === "watchlist_eval" && e.slug && typeof e.probYes === "number" && typeof e.marketProbYes === "number") {
      add(`wl:${e.slug}`, e.slug, 0, { ts: e.ts, agentProb: e.probYes, marketProb: e.marketProbYes });
    }
  }
  return [...units.values()];
}

interface SlugResolution {
  winner: number | null; // winning outcome index; null = voided
  ts: string;
}

// Slug-level winners derived from ledgered settlements of OUR positions.
// kind won/lost speaks about the HELD outcome; the paper agent only trades
// binary Yes/No markets, so "lost" pins the winner on the other leg.
function ledgerResolutions(ledger: LedgerEvent[]): Map<string, SlugResolution> {
  const map = new Map<string, SlugResolution>();
  for (const e of ledger) {
    if (e.type !== "resolution" || !e.positionId) continue;
    const slug = e.slug ?? slugOfPositionId(e.positionId);
    const held = parseOutcomeIndex(e.positionId);
    if (e.kind === "voided") map.set(slug, { winner: null, ts: e.ts });
    else if (held !== null && (e.kind === "won" || e.kind === "lost")) {
      map.set(slug, { winner: e.kind === "won" ? held : 1 - held, ts: e.ts });
    }
  }
  return map;
}

interface ResolvedOutcome {
  winner: number;
  ts: string | null; // ledger resolution ts; null when fetched from Gamma
}

// Resolution per slug: ledgered settlement first, else a live Gamma lookup.
// Voided, still-open and unfetchable markets are skipped, not scored.
async function resolveUnit(
  slug: string,
  settled: Map<string, SlugResolution>,
  getMarket: MarketGetter
): Promise<ResolvedOutcome | null> {
  const fromLedger = settled.get(slug);
  if (fromLedger) return fromLedger.winner === null ? null : { winner: fromLedger.winner, ts: fromLedger.ts };
  const market = await getMarket(slug);
  if (!market || market.resolution !== "resolved" || market.resolvedOutcomeIndex === null) return null;
  return { winner: market.resolvedOutcomeIndex, ts: null };
}

// ---- Fairness views over the same scored calls ----------------------------
//
// Longer-horizon calls are harder, so weighting them equally with a call made
// hours before settlement understates a forecaster who takes long positions.
// The market baseline absorbs most of that (it faces the same horizon), which
// is why the pooled skill score stays the headline; the exponent below only
// re-weights WHICH calls dominate the pool, it never rescales an individual
// Brier. 1.5 is the owner's chosen prior on how difficulty grows with days.
const HORIZON_EXPONENT = 1.5;
// Sub-day calls would otherwise get ~zero weight and drop out entirely.
const MIN_HORIZON_DAYS = 0.25;

const HORIZON_BUCKETS: Array<{ label: string; minDays: number; maxDays: number | null }> = [
  { label: "≤1 天", minDays: 0, maxDays: 1 },
  { label: "1–7 天", minDays: 1, maxDays: 7 },
  { label: "7–30 天", minDays: 7, maxDays: 30 },
  { label: "30 天以上", minDays: 30, maxDays: null }
];

interface ScoredCall {
  agentProb: number;
  marketProb: number;
  ts: string;
  horizonDays: number | null;
}

interface ScoredUnit {
  key: string;
  slug: string;
  eventSlug: string;
  label: string;
  outcome: 0 | 1;
  calls: ScoredCall[]; // chronological, all strictly before resolution
}

interface BrierSample {
  agentProb: number;
  marketProb: number;
  outcome: 0 | 1;
  horizonDays: number | null;
  weight: number;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  if (hi === undefined) return null;
  return sorted.length % 2 === 0 && lo !== undefined ? (lo + hi) / 2 : hi;
}

/**
 * Pooled paired Brier: weighted mean of the agent's squared error over the
 * weighted mean of the market's. Pooling the SUMS (rather than averaging
 * per-sample skill scores) is what keeps the number finite — a market that
 * was nearly exact drives its own Brier toward 0 and would blow up any
 * per-sample ratio.
 */
function poolBrier(samples: BrierSample[]): BrierBlock {
  const totalWeight = samples.reduce((s, x) => s + x.weight, 0);
  if (samples.length === 0 || totalWeight <= 0) {
    return { n: samples.length, brierAgent: null, brierMarket: null, skill: null, medianHorizonDays: null };
  }
  const agent = samples.reduce((s, x) => s + x.weight * (x.agentProb - x.outcome) ** 2, 0) / totalWeight;
  const market = samples.reduce((s, x) => s + x.weight * (x.marketProb - x.outcome) ** 2, 0) / totalWeight;
  const horizons = samples.flatMap((x) => (x.horizonDays === null ? [] : [x.horizonDays]));
  return {
    n: samples.length,
    brierAgent: agent,
    brierMarket: market,
    skill: market > 0 ? 1 - agent / market : null,
    medianHorizonDays: median(horizons)
  };
}

const sampleOf = (unit: ScoredUnit, call: ScoredCall, weight = 1): BrierSample => ({
  agentProb: call.agentProb,
  marketProb: call.marketProb,
  outcome: unit.outcome,
  horizonDays: call.horizonDays,
  weight
});

function horizonViews(units: ScoredUnit[]): Reflection["calibration"]["horizon"] {
  const firstCalls = units.flatMap((u) => {
    const call = u.calls[0];
    return call ? [{ unit: u, call }] : [];
  });
  const lastCalls = units.flatMap((u) => {
    const call = u.calls[u.calls.length - 1];
    return call ? [{ unit: u, call }] : [];
  });

  const buckets: HorizonBucket[] = HORIZON_BUCKETS.map((bucket) => {
    // At most one call per unit per bucket: the LAST call still inside the
    // band, so a market reviewed 40 times cannot dominate the bucket.
    const samples = units.flatMap((u) => {
      const inBucket = u.calls.filter(
        (c) =>
          c.horizonDays !== null &&
          c.horizonDays >= bucket.minDays &&
          (bucket.maxDays === null || c.horizonDays < bucket.maxDays)
      );
      const call = inBucket[inBucket.length - 1];
      return call ? [sampleOf(u, call)] : [];
    });
    return { ...bucket, ...poolBrier(samples) };
  });

  const weightedSamples = firstCalls.map(({ unit, call }) =>
    sampleOf(unit, call, Math.max(call.horizonDays ?? MIN_HORIZON_DAYS, MIN_HORIZON_DAYS) ** HORIZON_EXPONENT)
  );
  const weighted = poolBrier(weightedSamples);

  return {
    atEntry: firstCalls.length ? poolBrier(firstCalls.map(({ unit, call }) => sampleOf(unit, call))) : null,
    atLast: lastCalls.length ? poolBrier(lastCalls.map(({ unit, call }) => sampleOf(unit, call))) : null,
    buckets: buckets.filter((b) => b.n > 0),
    weighted: weightedSamples.length ? { exponent: HORIZON_EXPONENT, skill: weighted.skill, n: weighted.n } : null
  };
}

function clusterViews(units: ScoredUnit[]): Reflection["calibration"]["clusters"] {
  const groups = new Map<string, ScoredUnit[]>();
  for (const unit of units) {
    groups.set(unit.eventSlug, [...(groups.get(unit.eventSlug) ?? []), unit]);
  }
  const rows: CalibrationCluster[] = [...groups.entries()].map(([eventSlug, members]) => {
    const samples = members.flatMap((u) => {
      const call = u.calls[u.calls.length - 1];
      return call ? [sampleOf(u, call)] : [];
    });
    const pooled = poolBrier(samples);
    return {
      eventSlug,
      label: members[0]?.label ?? eventSlug,
      n: members.length,
      skill: pooled.skill,
      brierAgent: pooled.brierAgent,
      brierMarket: pooled.brierMarket
    };
  });
  return {
    effectiveN: rows.length,
    rows: rows.sort((a, b) => b.n - a.n)
  };
}

async function buildPending(
  units: ScoringUnit[],
  scoredKeys: Set<string>,
  getMarket: MarketGetter,
  portfolio: Portfolio,
  nowMs: number
): Promise<PendingCalibrationRow[]> {
  const rows: PendingCalibrationRow[] = [];
  for (const unit of units) {
    if (scoredKeys.has(unit.key)) continue;
    const last = unit.evals[unit.evals.length - 1];
    if (!last) continue;
    const market = await getMarket(unit.slug);
    if (market && market.resolution !== "open") continue;
    const position = portfolio.positions.find((p) => p.id === unit.key);
    const endMs = market?.endDateIso ? Date.parse(market.endDateIso) : NaN;
    rows.push({
      label: market?.question ?? unit.slug,
      slug: unit.slug,
      direction: position?.outcomeLabel.toUpperCase() ?? null,
      agentProb: last.agentProb,
      marketProb: last.marketProb,
      horizonDays: Number.isFinite(endMs) ? Math.round(((endMs - nowMs) / 86_400_000) * 10) / 10 : null,
      unrealizedUsd:
        position && position.lastEval?.mark !== undefined && position.lastEval.mark !== null
          ? position.shares * (position.lastEval.mark - position.avgEntryPrice)
          : null
    });
  }
  return rows.sort((a, b) => (b.unrealizedUsd ?? -Infinity) - (a.unrealizedUsd ?? -Infinity));
}

async function buildCalibration(
  ledger: LedgerEvent[],
  getMarket: MarketGetter,
  portfolio: Portfolio,
  nowMs: number = Date.now()
): Promise<Reflection["calibration"]> {
  const units = collectScoringUnits(ledger);
  const settled = ledgerResolutions(ledger);
  const rows: CalibrationRow[] = [];
  const scored: ScoredUnit[] = [];
  const scoredKeys = new Set<string>();
  let sumAgent = 0;
  let sumMarket = 0;
  for (const unit of units) {
    const resolved = await resolveUnit(unit.slug, settled, getMarket);
    if (!resolved) continue;
    const market = await getMarket(unit.slug);
    // Last eval strictly before the ledgered resolution time; fetched
    // resolutions carry no timestamp, but evals stop once a market closes,
    // so the last eval IS the pre-resolution one.
    const resolvedTs = resolved.ts;
    const usable = resolvedTs === null ? unit.evals : unit.evals.filter((e) => e.ts < resolvedTs);
    const last = usable[usable.length - 1];
    if (!last) continue;
    const outcome: 0 | 1 = resolved.winner === unit.scoredIndex ? 1 : 0;
    sumAgent += (last.agentProb - outcome) ** 2;
    sumMarket += (last.marketProb - outcome) ** 2;
    // Resolution instant for horizon maths: the ledgered settlement if we held
    // it, else the market's own end date. Without either, horizon is unknown
    // and the call still counts in the headline but not in the horizon views.
    const endMs = resolvedTs
      ? Date.parse(resolvedTs)
      : market?.endDateIso
        ? Date.parse(market.endDateIso)
        : NaN;
    const horizonOf = (ts: string): number | null => {
      const callMs = Date.parse(ts);
      if (!Number.isFinite(endMs) || !Number.isFinite(callMs)) return null;
      return Math.max(0, Math.round(((endMs - callMs) / 86_400_000) * 100) / 100);
    };
    const label = market?.question ?? unit.slug;
    scoredKeys.add(unit.key);
    scored.push({
      key: unit.key,
      slug: unit.slug,
      // Sibling expiries of one story share a Gamma event; without one, the
      // market stands alone as its own cluster.
      eventSlug: market?.eventSlug || unit.slug,
      label,
      outcome,
      calls: usable.map((e) => ({
        agentProb: e.agentProb,
        marketProb: e.marketProb,
        ts: e.ts,
        horizonDays: horizonOf(e.ts)
      }))
    });
    rows.push({
      label,
      agentProb: last.agentProb,
      marketProb: last.marketProb,
      outcome,
      ts: last.ts,
      horizonDays: horizonOf(last.ts),
      eventSlug: market?.eventSlug ?? null
    });
  }
  const n = rows.length;
  const brierAgent = n ? sumAgent / n : null;
  const brierMarket = n ? sumMarket / n : null;
  const skill = brierAgent !== null && brierMarket !== null && brierMarket > 0 ? 1 - brierAgent / brierMarket : null;
  return {
    n,
    brierAgent,
    brierMarket,
    skill,
    note: n
      ? "paired Brier over every resolved eval unit: last pre-resolution agent prob vs market price (bestBid); skill = 1 - agent/market, >0 beats the market"
      : "尚无已结算市场，Brier 暂不可计",
    rows: [...rows].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)).slice(0, 30),
    horizon: horizonViews(scored),
    clusters: clusterViews(scored),
    pending: await buildPending(units, scoredKeys, getMarket, portfolio, nowMs)
  };
}

// ---------------------------------------------------------------------------
// 2. Exit alpha: merged market+limit episodes vs the hold counterfactual.
// ---------------------------------------------------------------------------

// Counterfactual "price if we had held": a ledgered settlement of OUR
// position is authoritative; otherwise live market state (prices-history
// 404s after close, so resolution is checked first — review finding).
async function computePriceNow(
  positionId: string,
  slug: string,
  resolutions: LedgerEvent[],
  getMarket: MarketGetter
): Promise<number | null> {
  const settled = resolutions.find((r) => r.positionId === positionId);
  if (settled) return settled.kind === "voided" ? 0.5 : settled.kind === "won" ? 1 : 0;
  const idx = parseOutcomeIndex(positionId);
  const market = await getMarket(slug);
  if (!market || idx === null) return null;
  if (market.resolution === "resolved") return market.resolvedOutcomeIndex === idx ? 1 : 0;
  if (market.resolution === "voided") return 0.5;
  const tokenId = market.tokenIds[idx];
  if (!tokenId) return null;
  try {
    const nowSec = Date.now() / 1000;
    const history = await fetchPriceHistory(tokenId, nowSec - 6 * 3600, nowSec);
    return history.length ? history[history.length - 1]!.p : null;
  } catch {
    return null;
  }
}

// YES/NO from the trade's outcome label, else the positionId ":N" suffix.
function directionOf(event: LedgerEvent): string {
  if (event.outcome) return event.outcome.toUpperCase();
  const idx = event.positionId ? parseOutcomeIndex(event.positionId) : null;
  if (idx === 0) return "YES";
  if (idx === 1) return "NO";
  return "?";
}

async function buildExits(
  ledger: LedgerEvent[],
  getMarket: MarketGetter
): Promise<{ episodes: ExitEpisode[]; totalAlphaUsd: number }> {
  const sells = ledger.filter((e) => e.type === "trade" && e.side === "sell");
  const resolutions = ledger.filter((e) => e.type === "resolution");
  // One episode per positionId + reason prefix: the market half, the limit
  // half's (partial) fills and any ttl-fallback leg of the same exit decision
  // collapse into a single row.
  const groups = new Map<string, LedgerEvent[]>();
  for (const sell of sells) {
    if (!sell.positionId || !sell.slug || !sell.shares || sell.avgPrice === undefined) continue;
    const prefix = (sell.reason ?? "").split(":")[0] ?? "";
    const key = `${sell.positionId}|${prefix}`;
    groups.set(key, [...(groups.get(key) ?? []), sell]);
  }
  const priceNowCache = new Map<string, Promise<number | null>>();
  const priceNowFor = (positionId: string, slug: string): Promise<number | null> => {
    const cached = priceNowCache.get(positionId);
    if (cached) return cached;
    const pending = computePriceNow(positionId, slug, resolutions, getMarket);
    priceNowCache.set(positionId, pending);
    return pending;
  };
  const episodes: ExitEpisode[] = [];
  let totalAlphaUsd = 0;
  for (const legs of groups.values()) {
    const first = legs[0]!;
    const positionId = first.positionId!;
    const slug = first.slug!;
    const priceNow = await priceNowFor(positionId, slug);
    const shares = legs.reduce((s, l) => s + (l.shares ?? 0), 0);
    const exitPrice = shareWeightedAvg(legs) ?? 0;
    const feeUsd = legs.reduce((s, l) => s + (l.feeUsd ?? 0), 0);
    const proceeds = shares * exitPrice - feeUsd;
    const alpha = priceNow === null ? null : proceeds - shares * priceNow;
    if (alpha !== null) totalAlphaUsd += alpha;
    const hasLimit = legs.some((l) => l.style === "limit");
    const hasMarket = legs.some((l) => l.style !== "limit");
    const hasFallback = legs.some((l) => (l.reason ?? "").endsWith(":limit_ttl_fallback"));
    const prefix = (first.reason ?? "").split(":")[0] ?? "";
    const market = await getMarket(slug);
    episodes.push({
      positionId,
      question: market?.question ?? slug,
      direction: directionOf(first),
      ts: first.ts,
      style: hasLimit && hasMarket ? "market+limit" : hasLimit ? "limit" : "market",
      legs: legs.length,
      shares,
      exitPrice,
      feeUsd,
      priceNow,
      exitAlphaUsd: alpha,
      reason: prefix + (hasFallback ? "+limit_ttl_fallback" : "")
    });
  }
  return { episodes, totalAlphaUsd };
}

// ---------------------------------------------------------------------------
// 4. Hybrid quality: same-exit limit-vs-market comparison.
// ---------------------------------------------------------------------------

function buildHybrid(ledger: LedgerEvent[]): Reflection["hybrid"] {
  const limitPlaced = ledger.filter((e) => e.type === "limit_placed").length;
  const sells = ledger.filter((e) => e.type === "trade" && e.side === "sell");
  const limitFills = sells.filter((s) => s.style === "limit");
  // Only positions where BOTH halves of a negative_edge hybrid exit filled
  // are comparable. TTL-fallback fills are market executions at a later book
  // state — excluded from both sides of the pairing.
  const isLimitHalf = (s: LedgerEvent): boolean =>
    s.style === "limit" && (s.reason ?? "").startsWith("negative_edge") && !(s.reason ?? "").includes("limit_ttl_fallback");
  const isMarketHalf = (s: LedgerEvent): boolean => s.style === "market" && s.reason === "negative_edge";
  const byPosition = new Map<string, { limit: LedgerEvent[]; market: LedgerEvent[] }>();
  for (const s of sells) {
    if (!s.positionId) continue;
    const bucket = byPosition.get(s.positionId) ?? { limit: [], market: [] };
    if (isLimitHalf(s)) byPosition.set(s.positionId, { ...bucket, limit: [...bucket.limit, s] });
    else if (isMarketHalf(s)) byPosition.set(s.positionId, { ...bucket, market: [...bucket.market, s] });
  }
  const pairedLimit: LedgerEvent[] = [];
  const pairedMarket: LedgerEvent[] = [];
  let improvementWeighted = 0;
  let improvementWeight = 0;
  for (const bucket of byPosition.values()) {
    const avgLimit = shareWeightedAvg(bucket.limit);
    const avgMarket = shareWeightedAvg(bucket.market);
    if (avgLimit === null || avgMarket === null) continue;
    const weight = bucket.limit.reduce((s, f) => s + (f.shares ?? 0), 0);
    improvementWeighted += (avgLimit - avgMarket) * weight;
    improvementWeight += weight;
    pairedLimit.push(...bucket.limit);
    pairedMarket.push(...bucket.market);
  }
  return {
    limitPlaced,
    limitFilled: limitFills.length,
    limitFillRate: limitPlaced ? limitFills.length / limitPlaced : null,
    avgLimitPrice: shareWeightedAvg(pairedLimit),
    avgMarketPrice: shareWeightedAvg(pairedMarket),
    limitImprovementPp: improvementWeight ? (improvementWeighted / improvementWeight) * 100 : null
  };
}

// ---------------------------------------------------------------------------
// 5. Engine flags + positions snapshot.
// ---------------------------------------------------------------------------

function buildEngineFlags(ledger: LedgerEvent[]): Reflection["engineFlags"] {
  const evals = ledger.filter((e) => e.type === "evaluation" || e.type === "watchlist_eval");
  return {
    evaluations: evals.length,
    saturated: evals.filter((e) => Boolean(e.saturatedAt)).length,
    contaminated: evals.filter((e) => e.contaminated === true).length,
    saturatedHolds: evals.filter((e) => e.saturatedHold === true).length,
    // Old ledgers predate these fields; the quality line only renders once
    // at least one event carries them (or a flag actually fired).
    flagsTracked: evals.some((e) => e.saturatedAt !== undefined || e.contaminated !== undefined)
  };
}

function snapshotPositions(portfolio: Portfolio): PositionSnapshot[] {
  return portfolio.positions.map((pos) => {
    const mark = pos.lastEval?.mark ?? null;
    return {
      positionId: pos.id,
      question: pos.question,
      direction: pos.outcomeLabel.toUpperCase(),
      shares: pos.shares,
      avgEntryPrice: pos.avgEntryPrice,
      costUsd: pos.shares * pos.avgEntryPrice,
      mark,
      unrealizedUsd: mark === null ? null : pos.shares * (mark - pos.avgEntryPrice),
      agentProb: pos.lastEval?.agentProb ?? null,
      netEdgePp: pos.lastEval?.netEdgePp ?? null,
      saturated: Boolean(pos.lastEval?.saturatedAt),
      contaminated: Boolean(pos.lastEval?.contaminated)
    };
  });
}

// ---------------------------------------------------------------------------
// Assembly.
// ---------------------------------------------------------------------------

export async function buildReflection(): Promise<Reflection> {
  const ledger = readLedger() as unknown as LedgerEvent[];
  const portfolio = loadPortfolio();
  const getMarket = memoizedMarketGetter();

  const calibration = await buildCalibration(ledger, getMarket, portfolio);
  const { episodes, totalAlphaUsd } = await buildExits(ledger, getMarket);
  const hybrid = buildHybrid(ledger);
  const engineFlags = buildEngineFlags(ledger);

  const takerUsd = ledger
    .filter((e) => e.type === "trade" && e.style === "market")
    .reduce((s, e) => s + (e.feeUsd ?? 0), 0);
  const makerUsd = ledger
    .filter((e) => e.type === "trade" && e.style === "limit")
    .reduce((s, e) => s + (e.feeUsd ?? 0), 0);

  // Equity = cash + freshly marked open positions (fall back to the last
  // eval's mark when the book is unreachable; null only if neither exists).
  let equity: number | null = portfolio.cashUsd;
  for (const pos of portfolio.positions) {
    let mark: number | null = null;
    try {
      const book = await fetchBook(pos.tokenId);
      mark = book.bids[0]?.price ?? null;
    } catch {
      mark = null;
    }
    mark = mark ?? pos.lastEval?.mark ?? null;
    if (mark === null) {
      equity = null;
      break;
    }
    equity += pos.shares * mark;
  }

  return {
    generatedAtUtc: new Date().toISOString(),
    book: {
      cashUsd: portfolio.cashUsd,
      bankrollUsd: portfolio.bankrollUsd,
      openPositions: portfolio.positions.length,
      realizedPnlUsd: portfolio.realizedPnlUsd,
      totalFeesUsd: portfolio.totalFeesUsd,
      equityUsd: equity
    },
    positions: snapshotPositions(portfolio),
    exits: episodes,
    exitAlphaTotalUsd: totalAlphaUsd,
    calibration,
    fees: { takerUsd, makerUsd, totalUsd: takerUsd + makerUsd },
    hybrid,
    engineFlags
  };
}

// ---------------------------------------------------------------------------
// Markdown rendering (Chinese-first; numbers/dates stay ASCII).
// ---------------------------------------------------------------------------

function fmtUsd(v: number | null): string {
  return v === null ? "–" : `$${v.toFixed(2)}`;
}

function fmtSignedUsd(v: number | null): string {
  return v === null ? "–" : `${v < 0 ? "-" : "+"}$${Math.abs(v).toFixed(2)}`;
}

function fmtSigned(v: number | null, digits: number): string {
  return v === null ? "–" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

function fmtSignedPp(v: number | null): string {
  return v === null ? "–" : `${fmtSigned(v, 1)}pp`;
}

function fmtProb(v: number | null): string {
  return v === null ? "–" : v.toFixed(3);
}

function fmtWhen(ts: string): string {
  return `${ts.slice(5, 10)} ${ts.slice(11, 16)}`; // MM-DD HH:mm
}

function truncate(text: string, max = 60): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function exitStyleLabel(style: ExitEpisode["style"]): string {
  return style === "market+limit" ? "market+limit 两腿" : style;
}

function exitReasonLabel(reason: string): string {
  const prefix = reason.split("+")[0] ?? reason;
  const base = prefix === "negative_edge" ? "负edge退出" : prefix === "stop_loss" ? "止损" : prefix;
  return reason.includes("limit_ttl_fallback") ? `${base}+限价单超时回落` : base;
}

function renderPositionsSection(r: Reflection): string[] {
  const lines = ["## 持仓快照 Positions", ""];
  if (!r.positions.length) return [...lines, "当前无持仓。", ""];
  lines.push("| 问题 | 方向 | 成本 | mark | 浮盈 | agent P | edge | 备注 |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const p of r.positions) {
    const flags = [p.saturated ? "⚠饱和" : "", p.contaminated ? "⛔污染" : ""].filter(Boolean).join(" ");
    const cost = `${fmtUsd(p.costUsd)} (${p.shares.toFixed(1)}×${p.avgEntryPrice.toFixed(3)})`;
    lines.push(
      `| ${truncate(p.question)} | ${p.direction} | ${cost} | ${fmtProb(p.mark)} | ${fmtSignedUsd(p.unrealizedUsd)} | ${fmtProb(p.agentProb)} | ${fmtSignedPp(p.netEdgePp)} | ${flags} |`
    );
  }
  const markValueUsd = r.positions.reduce((s, p) => s + (p.mark === null ? 0 : p.shares * p.mark), 0);
  const totalUsd = r.book.cashUsd + markValueUsd;
  const pct = r.book.bankrollUsd > 0 ? ` = 本金的 ${((totalUsd / r.book.bankrollUsd) * 100).toFixed(1)}%` : "";
  lines.push("");
  lines.push(`总权益 = 现金 ${fmtUsd(r.book.cashUsd)} + 持仓市值 ${fmtUsd(markValueUsd)}（按 mark）= ${fmtUsd(totalUsd)}${pct}`);
  lines.push("");
  lines.push("edge = agent 估计的持有价值 − 立刻卖出净得；饱和 = 概率打到引擎 1%/99% 上限；污染 = 该预测被检测到引用了预测市场价格");
  lines.push("");
  return lines;
}

function renderExitsSection(r: Reflection): string[] {
  const lines = [`## 退出质量 Exit alpha（卖出所得 vs 持有反事实）：${fmtUsd(r.exitAlphaTotalUsd)}`, ""];
  if (!r.exits.length) return [...lines, "尚无退出。", ""];
  lines.push("| 问题 | 方向 | 时间 | 方式 | shares | 卖价 | 现价 | α | 原因 |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const e of r.exits.slice(-30)) {
    lines.push(
      `| ${truncate(e.question)} | ${e.direction} | ${fmtWhen(e.ts)} | ${exitStyleLabel(e.style)} | ${e.shares.toFixed(1)} | ${e.exitPrice.toFixed(3)} | ${fmtProb(e.priceNow)} | ${fmtSignedUsd(e.exitAlphaUsd)} | ${exitReasonLabel(e.reason)} |`
    );
  }
  lines.push("");
  lines.push("α = 卖出所得 −（若持有到现在/结算的价值）；正 = 卖对了");
  lines.push("");
  return lines;
}

function renderCalibrationSection(r: Reflection): string[] {
  const lines = ["## 校准 Calibration (Brier)", ""];
  const c = r.calibration;
  if (!c.n) return [...lines, "尚无已结算市场，Brier 暂不可计。", ""];
  lines.push(
    `n=${c.n} · agent ${fmtProb(c.brierAgent)} vs market ${fmtProb(c.brierMarket)} · skill score ${fmtSigned(c.skill, 2)}（>0 = 跑赢市场）`
  );
  lines.push("");
  lines.push("| 问题 | agent P | market P | 结果 | 日期 |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const row of c.rows) {
    lines.push(
      `| ${truncate(row.label)} | ${row.agentProb.toFixed(3)} | ${row.marketProb.toFixed(3)} | ${row.outcome ? "✓ 发生" : "✗ 未发生"} | ${row.ts.slice(0, 10)} |`
    );
  }
  lines.push("");
  return lines;
}

function renderTailSections(r: Reflection): string[] {
  const lines = [
    "## 费用 Fees",
    `taker（市价）${fmtUsd(r.fees.takerUsd)} · maker（限价）${fmtUsd(r.fees.makerUsd)} · 合计 ${fmtUsd(r.fees.totalUsd)}`,
    "",
    "## 混合执行 Hybrid execution"
  ];
  const h = r.hybrid;
  const fillRate = h.limitFillRate === null ? "–" : `${Math.round(h.limitFillRate * 100)}%`;
  const pairing =
    h.limitImprovementPp === null
      ? "同笔退出配对：暂无（需同一持仓的 market 腿与 limit 腿都成交）"
      : `同笔退出配对：limit 均价 ${fmtProb(h.avgLimitPrice)} vs market 均价 ${fmtProb(h.avgMarketPrice)} · limit 改善 ${fmtSignedPp(h.limitImprovementPp)}`;
  lines.push(`限价单挂出 ${h.limitPlaced} · 成交 ${h.limitFilled}（${fillRate}）· ${pairing}`);
  lines.push("");
  const f = r.engineFlags;
  if (f.evaluations > 0 && (f.saturated > 0 || f.contaminated > 0 || f.flagsTracked)) {
    const holdNote = f.saturatedHolds > 0 ? `、${f.saturatedHolds} 次饱和持有（负 edge 退出被钳位守卫改判持有到结算）` : "";
    lines.push(`引擎质量：${f.evaluations} 次评估中 ${f.saturated} 次饱和、${f.contaminated} 次检测到市场价格污染${holdNote}`);
    lines.push("");
  }
  return lines;
}

export function renderReflectionMd(r: Reflection): string {
  const lines = [
    `# 模拟盘每日反思（paper agent reflection）— ${r.generatedAtUtc}`,
    "",
    "## 账本 Book",
    `现金 ${fmtUsd(r.book.cashUsd)} · 持仓 ${r.book.openPositions} 个 · 已实现盈亏 ${fmtUsd(r.book.realizedPnlUsd)} · 已付费用 ${fmtUsd(r.book.totalFeesUsd)} · 总权益（equity）${fmtUsd(r.book.equityUsd)}`,
    "",
    ...renderPositionsSection(r),
    ...renderExitsSection(r),
    ...renderCalibrationSection(r),
    ...renderTailSections(r),
    "_模拟盘——无真实订单。费用按仓库校准的分类费率模型计。_"
  ];
  return lines.join("\n") + "\n";
}

export async function writeReflectionReport(): Promise<string> {
  const reflection = await buildReflection();
  mkdirSync(reportsDir(), { recursive: true });
  const stamp = reflection.generatedAtUtc.replace(/[:]/g, "").slice(0, 15);
  const jsonPath = path.join(reportsDir(), `${stamp}-reflection.json`);
  const mdPath = path.join(reportsDir(), `${stamp}-reflection.md`);
  writeFileSync(jsonPath, JSON.stringify(reflection, null, 2), "utf8");
  writeFileSync(mdPath, renderReflectionMd(reflection), "utf8");
  log.info(`reflection written: ${mdPath}`);
  return mdPath;
}
