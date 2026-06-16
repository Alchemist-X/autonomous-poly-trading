/**
 * Settlement reader for World Cup group-stage fixtures.
 *
 * Market-blind policy (2026-06-11 user decision): the public forecasting
 * pipeline must never read or display market prices / implied probabilities —
 * BUT "市场数据只用于事件结构与结算映射" (market data may be used for event
 * structure and *settlement mapping*). This module is exactly that allowed use:
 * it reads Polymarket's post-match resolution to recover the real-world result
 * (winner + final score) and stores ONLY those settled facts. It never keeps a
 * price, an implied probability, or any pre-settlement quote.
 *
 * Result derivation, per fixture, from two Gamma events:
 *   <slug>-exact-score : the resolved "Home X - Y Away" market → score + winner
 *   <slug>             : the resolved 1x2 moneyline market     → winner fallback
 * Home is always team `a` (first team in the event slug); our forecast
 * event_slug IS the Polymarket event slug, so the ordering is consistent.
 */

const GAMMA_BASE = "https://gamma-api.polymarket.com";

export type Winner = "a" | "draw" | "b";

export interface MatchResult {
  readonly event_slug: string;
  readonly status: "resolved" | "pending";
  readonly winner: Winner | null;
  readonly homeGoals: number | null;
  readonly awayGoals: number | null;
  readonly score: string | null; // "1-1" — home-away, ordered as team a vs team b
  readonly settledAt: string | null; // ISO timestamp of UMA resolution
  // "espn": Polymarket settled the winner only (e.g. its exact-score market hit
  // the "Any Other Score" bucket), so the numeric score was backfilled from
  // ESPN's results feed (see lib/espn-results.ts). Winner stays Polymarket's.
  readonly source: "exact_score" | "moneyline" | "espn" | null;
}

interface GammaMarket {
  readonly question?: string;
  readonly groupItemTitle?: string;
  readonly outcomes?: string;
  readonly outcomePrices?: string;
  readonly closed?: boolean;
  readonly umaResolutionStatus?: string;
  readonly umaEndDate?: string;
  readonly endDate?: string;
}

interface GammaEvent {
  readonly slug?: string;
  readonly title?: string;
  readonly closed?: boolean;
  readonly markets?: readonly GammaMarket[];
}

function parseJsonArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// A binary Yes/No market is "settled YES" when UMA has resolved it and the
// first (Yes) leg paid out 1. We read outcomePrices ONLY as the settlement bit
// (1 vs 0); the numeric value is never stored or surfaced.
function isResolvedYes(m: GammaMarket): boolean {
  if (m.umaResolutionStatus !== "resolved" || !m.closed) return false;
  const prices = parseJsonArray(m.outcomePrices);
  return prices.length > 0 && Math.round(Number(prices[0])) === 1;
}

function settledAtOf(m: GammaMarket): string | null {
  return m.umaEndDate ?? m.endDate ?? null;
}

async function fetchEventBySlug(slug: string, fetchImpl: typeof fetch): Promise<GammaEvent | null> {
  const res = await fetchImpl(`${GAMMA_BASE}/events?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`Gamma events fetch failed (${slug}): ${res.status}`);
  const data: unknown = await res.json();
  return Array.isArray(data) && data.length > 0 ? (data[0] as GammaEvent) : null;
}

const PENDING = (event_slug: string): MatchResult => ({
  event_slug,
  status: "pending",
  winner: null,
  homeGoals: null,
  awayGoals: null,
  score: null,
  settledAt: null,
  source: null
});

function winnerFromGoals(home: number, away: number): Winner {
  return home > away ? "a" : home < away ? "b" : "draw";
}

// Parse "Canada 1 - 1 Bosnia-Herzegovina" → [1, 1]. Home is team a by position.
function goalsFromLabel(label: string): readonly [number, number] | null {
  const m = label.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

function resultFromExactScore(slug: string, ev: GammaEvent): MatchResult | null {
  const won = ev.markets?.find(isResolvedYes);
  if (!won) return null;
  const goals = goalsFromLabel(won.groupItemTitle ?? won.question ?? "");
  if (!goals) return null;
  const [home, away] = goals;
  return {
    event_slug: slug,
    status: "resolved",
    winner: winnerFromGoals(home, away),
    homeGoals: home,
    awayGoals: away,
    score: `${home}-${away}`,
    settledAt: settledAtOf(won),
    source: "exact_score"
  };
}

// Fallback when the exact-score event hasn't resolved yet: derive only the
// winner from the 1x2 moneyline. The draw leg's title starts with "Draw"; the
// other two are single-team win legs. With no score, map the winning leg to
// home/away by its position among the non-draw legs (home = team a).
function resultFromMoneyline(slug: string, ev: GammaEvent): MatchResult | null {
  const markets = ev.markets ?? [];
  const won = markets.find(isResolvedYes);
  if (!won) return null;
  const title = won.groupItemTitle ?? won.question ?? "";
  const isDraw = /^draw\b/i.test(title) || /end in a draw/i.test(won.question ?? "");
  if (isDraw) {
    return { ...PENDING(slug), status: "resolved", winner: "draw", settledAt: settledAtOf(won), source: "moneyline" };
  }
  const teamLegs = markets.filter((m) => !/^draw\b/i.test(m.groupItemTitle ?? "") && !/end in a draw/i.test(m.question ?? ""));
  const idx = teamLegs.indexOf(won);
  const winner: Winner = idx <= 0 ? "a" : "b";
  return { ...PENDING(slug), status: "resolved", winner, settledAt: settledAtOf(won), source: "moneyline" };
}

/**
 * Resolve one fixture: try the exact-score event first (gives winner + score in
 * one call), fall back to the moneyline event for a winner-only result. Returns
 * a `pending` result when nothing has settled yet.
 */
export async function fetchResult(event_slug: string, fetchImpl: typeof fetch = fetch): Promise<MatchResult> {
  const exact = await fetchEventBySlug(`${event_slug}-exact-score`, fetchImpl);
  if (exact) {
    const r = resultFromExactScore(event_slug, exact);
    if (r) return r;
  }
  const moneyline = await fetchEventBySlug(event_slug, fetchImpl);
  if (moneyline) {
    const r = resultFromMoneyline(event_slug, moneyline);
    if (r) return r;
  }
  return PENDING(event_slug);
}

/**
 * Resolve many fixtures with a small concurrency pool, preserving input order.
 * A per-fixture fetch error is isolated (that fixture becomes `pending` and is
 * reported via onError) so one flaky request never aborts a daily run.
 */
export async function fetchResults(
  slugs: readonly string[],
  opts?: {
    concurrency?: number;
    onProgress?: (done: number, total: number, slug: string) => void;
    onError?: (slug: string, err: unknown) => void;
    fetchImpl?: typeof fetch;
  }
): Promise<readonly MatchResult[]> {
  const concurrency = opts?.concurrency ?? 6;
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const out: MatchResult[] = new Array(slugs.length);
  let cursor = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (cursor < slugs.length) {
      const i = cursor;
      cursor += 1;
      try {
        out[i] = await fetchResult(slugs[i], fetchImpl);
      } catch (err) {
        out[i] = PENDING(slugs[i]);
        opts?.onError?.(slugs[i], err);
      }
      done += 1;
      opts?.onProgress?.(done, slugs.length, slugs[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, slugs.length) }, worker));
  return out;
}
