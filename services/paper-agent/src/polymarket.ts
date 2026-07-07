// Read-only Polymarket market data over the public REST APIs (Gamma metadata,
// CLOB order books and price history). This module is the ONLY network
// surface of the paper agent, and every call is a GET — real order placement
// is structurally impossible from this service.
//
// Hardened per adversarial review 2026-07-03:
// - Gamma's plain ?slug= query EXCLUDES closed markets; settlement needs the
//   two-step lookup (plain, then &closed=true).
// - CLOB /book 404s once a market closes — callers must settle before booking.
// - All fetches carry a timeout and one retry.

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

export type ResolutionState = "open" | "resolved" | "voided" | "awaiting";

export interface MarketInfo {
  slug: string;
  conditionId: string;
  question: string;
  description: string;
  endDateIso: string | null;
  closed: boolean;
  negRisk: boolean;
  outcomes: string[]; // e.g. ["Yes","No"]
  tokenIds: string[]; // aligned with outcomes
  outcomePrices: number[] | null; // settlement prices once resolved
  resolvedOutcomeIndex: number | null;
  resolution: ResolutionState;
  // Parent event slug (Gamma groups related markets — e.g. the same macro
  // question at different expiries — under one event). Used to cap exposure to
  // a single underlying bet. Falls back to the market slug when absent.
  eventSlug: string;
}

export interface BookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  bids: BookLevel[]; // sorted best (highest) first
  asks: BookLevel[]; // sorted best (lowest) first
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface GammaMarket {
  slug?: string;
  conditionId?: string;
  question?: string;
  description?: string;
  endDateIso?: string;
  endDate?: string;
  closed?: boolean;
  negRisk?: boolean;
  outcomes?: unknown;
  outcomePrices?: unknown;
  clobTokenIds?: unknown;
  events?: Array<{ slug?: string; id?: string }>;
}

// Terminal settlement detection: winner needs a >0.99 leg; a ~50/50 close is
// a VOIDED market (refunds at $0.50); anything else closed = still awaiting
// UMA resolution.
function resolutionOf(closed: boolean, prices: number[] | null): { state: ResolutionState; winner: number | null } {
  if (!closed) return { state: "open", winner: null };
  if (!prices || !prices.length) return { state: "awaiting", winner: null };
  const winner = prices.findIndex((p) => p > 0.99);
  if (winner >= 0) return { state: "resolved", winner };
  if (prices.length === 2 && prices.every((p) => Math.abs(p - 0.5) < 0.02)) return { state: "voided", winner: null };
  return { state: "awaiting", winner: null };
}

// Two-step lookup: the plain slug query only returns OPEN markets; once a
// market closes it only appears with &closed=true. Polymarket also RENAMES
// market slugs in place (live incident 2026-07-07: putin-out-before-2027 →
// putin-out-before-2027-346, same conditionId), so a held position must be
// able to fall back to its immutable conditionId — otherwise it can neither
// be re-evaluated nor SETTLED for as long as the slug stays broken. A miss on
// all lookups = the market is gone (caller escalates to the operator).
export async function fetchMarket(slug: string, conditionId?: string): Promise<MarketInfo> {
  const enc = encodeURIComponent(slug);
  let rows = await fetchJson<GammaMarket[]>(`${GAMMA}/markets?slug=${enc}`);
  if (!rows.length) rows = await fetchJson<GammaMarket[]>(`${GAMMA}/markets?slug=${enc}&closed=true`);
  if (!rows.length && conditionId) {
    rows = await fetchJson<GammaMarket[]>(`${GAMMA}/markets?condition_ids=${encodeURIComponent(conditionId)}`);
  }
  const m = rows[0];
  if (!m) throw new Error(`no Polymarket market found for slug "${slug}" (open or closed${conditionId ? ", conditionId fallback tried" : ""})`);
  const outcomes = parseJsonArray(m.outcomes);
  const tokenIds = parseJsonArray(m.clobTokenIds);
  const priceStrings = parseJsonArray(m.outcomePrices);
  const outcomePrices = priceStrings.length ? priceStrings.map(Number) : null;
  const closed = Boolean(m.closed);
  const { state, winner } = resolutionOf(closed, outcomePrices);
  return {
    slug: m.slug ?? slug,
    conditionId: m.conditionId ?? "",
    question: m.question ?? slug,
    description: m.description ?? "",
    endDateIso: m.endDateIso ?? m.endDate ?? null,
    closed,
    negRisk: Boolean(m.negRisk),
    outcomes,
    tokenIds,
    outcomePrices,
    resolvedOutcomeIndex: winner,
    resolution: state,
    eventSlug: m.events?.[0]?.slug ?? m.events?.[0]?.id ?? m.slug ?? slug
  };
}

interface RawBook {
  bids?: Array<{ price: string; size: string }>;
  asks?: Array<{ price: string; size: string }>;
}

export async function fetchBook(tokenId: string): Promise<OrderBook> {
  const raw = await fetchJson<RawBook>(`${CLOB}/book?token_id=${encodeURIComponent(tokenId)}`);
  const toLevels = (rows: Array<{ price: string; size: string }> | undefined): BookLevel[] =>
    (rows ?? [])
      .map((r) => ({ price: Number(r.price), size: Number(r.size) }))
      .filter((l) => Number.isFinite(l.price) && Number.isFinite(l.size) && l.size > 0);
  const bids = toLevels(raw.bids).sort((a, b) => b.price - a.price);
  const asks = toLevels(raw.asks).sort((a, b) => a.price - b.price);
  return { bids, asks };
}

export function bestBid(book: OrderBook): number | null {
  return book.bids[0]?.price ?? null;
}

export function bestAsk(book: OrderBook): number | null {
  return book.asks[0]?.price ?? null;
}

export function midPrice(book: OrderBook): number | null {
  const bid = bestBid(book);
  const ask = bestAsk(book);
  if (bid === null || ask === null) return bid ?? ask;
  return (bid + ask) / 2;
}

export interface PricePoint {
  t: number;
  p: number;
}

// Price history for the counterfactual "what if we had held" analysis.
export async function fetchPriceHistory(tokenId: string, startTs: number, endTs: number): Promise<PricePoint[]> {
  const raw = await fetchJson<{ history?: PricePoint[] }>(
    `${CLOB}/prices-history?market=${encodeURIComponent(tokenId)}&startTs=${Math.floor(startTs)}&endTs=${Math.floor(endTs)}&fidelity=60`
  );
  return (raw.history ?? []).filter((h) => Number.isFinite(h.t) && Number.isFinite(h.p));
}
