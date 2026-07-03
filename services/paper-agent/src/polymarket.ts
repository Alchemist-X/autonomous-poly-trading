// Read-only Polymarket market data over the public REST APIs (Gamma metadata,
// CLOB order books and price history). This module is the ONLY network
// surface of the paper agent, and every call is a GET — real order placement
// is structurally impossible from this service.

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

export interface MarketInfo {
  slug: string;
  conditionId: string;
  question: string;
  description: string;
  category: string;
  endDateIso: string | null;
  closed: boolean;
  negRisk: boolean;
  outcomes: string[]; // e.g. ["Yes","No"]
  tokenIds: string[]; // aligned with outcomes
  outcomePrices: number[] | null; // aligned; settlement prices once resolved
  resolvedOutcomeIndex: number | null; // when closed and prices are 0/1
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
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return (await res.json()) as T;
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
  category?: string;
  endDate?: string;
  closed?: boolean;
  negRisk?: boolean;
  outcomes?: unknown;
  outcomePrices?: unknown;
  clobTokenIds?: unknown;
}

export async function fetchMarket(slug: string): Promise<MarketInfo> {
  const rows = await fetchJson<GammaMarket[]>(`${GAMMA}/markets?slug=${encodeURIComponent(slug)}`);
  const m = rows[0];
  if (!m) throw new Error(`no Polymarket market found for slug "${slug}"`);
  const outcomes = parseJsonArray(m.outcomes);
  const tokenIds = parseJsonArray(m.clobTokenIds);
  const priceStrings = parseJsonArray(m.outcomePrices);
  const outcomePrices = priceStrings.length ? priceStrings.map(Number) : null;
  let resolvedOutcomeIndex: number | null = null;
  if (m.closed && outcomePrices && outcomePrices.length) {
    const winner = outcomePrices.findIndex((p) => p > 0.99);
    resolvedOutcomeIndex = winner >= 0 ? winner : null;
  }
  return {
    slug: m.slug ?? slug,
    conditionId: m.conditionId ?? "",
    question: m.question ?? slug,
    description: m.description ?? "",
    category: m.category ?? "",
    endDateIso: m.endDate ?? null,
    closed: Boolean(m.closed),
    negRisk: Boolean(m.negRisk),
    outcomes,
    tokenIds,
    outcomePrices,
    resolvedOutcomeIndex
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
