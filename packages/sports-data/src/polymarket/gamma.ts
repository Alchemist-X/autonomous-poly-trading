import { categorizeMarket } from "./categorize.js";
import type { WcMarket } from "./types.js";

export const GAMMA_BASE = "https://gamma-api.polymarket.com";
// fifa-world-cup (finals) + fifa-friendly (pre-WC internationals), per the reference table.
export const WORLD_CUP_TAG_IDS = [102232, 102539] as const;
const PAGE_LIMIT = 100; // Gamma caps page size at 100.

interface GammaEvent {
  slug?: string;
  title?: string;
}
interface GammaMarket {
  id?: string | number;
  conditionId?: string;
  questionID?: string;
  question?: string;
  slug?: string;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  groupItemTitle?: string;
  negRisk?: boolean;
  negRiskMarketID?: string;
  enableOrderBook?: boolean;
  acceptingOrders?: boolean;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  bestBid?: number;
  bestAsk?: number;
  lastTradePrice?: number;
  spread?: number;
  oneDayPriceChange?: number;
  liquidityNum?: number;
  volumeNum?: number;
  volume24hr?: number;
  startDate?: string;
  endDate?: string;
  updatedAt?: string;
  events?: GammaEvent[];
}

function parseJsonArray<T>(raw: string | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function numOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeMarket(raw: GammaMarket, tagId: number): WcMarket | null {
  const id = raw.id == null ? "" : String(raw.id);
  const marketSlug = raw.slug ?? "";
  if (!id || !marketSlug) return null;
  const event = raw.events?.[0] ?? {};
  const eventSlug = event.slug ?? "";
  const eventTitle = (event.title ?? "").trim();
  const { category, subtype } = categorizeMarket({
    question: raw.question ?? "",
    eventSlug,
    eventTitle,
    groupItem: raw.groupItemTitle ?? null
  });
  return {
    id,
    conditionId: raw.conditionId ?? "",
    questionId: raw.questionID ?? "",
    question: raw.question ?? "",
    marketSlug,
    eventSlug,
    eventTitle,
    category,
    subtype,
    groupItem: raw.groupItemTitle ?? null,
    outcomes: parseJsonArray<string>(raw.outcomes),
    // Coerce non-finite prices to 0 so a malformed element can never poison the
    // price-change diff (NaN would make maxDelta NaN and silently miss updates).
    outcomePrices: parseJsonArray<string>(raw.outcomePrices).map((p) => {
      const n = Number(p);
      return Number.isFinite(n) ? n : 0;
    }),
    clobTokenIds: parseJsonArray<string>(raw.clobTokenIds),
    negRisk: Boolean(raw.negRisk),
    negRiskMarketId: raw.negRiskMarketID ?? null,
    enableOrderBook: Boolean(raw.enableOrderBook),
    acceptingOrders: Boolean(raw.acceptingOrders),
    active: Boolean(raw.active),
    closed: Boolean(raw.closed),
    archived: Boolean(raw.archived),
    bestBid: numOrNull(raw.bestBid),
    bestAsk: numOrNull(raw.bestAsk),
    lastTradePrice: numOrNull(raw.lastTradePrice),
    spread: numOrNull(raw.spread),
    oneDayPriceChange: numOrNull(raw.oneDayPriceChange),
    liquidity: numOrNull(raw.liquidityNum) ?? 0,
    volume: numOrNull(raw.volumeNum) ?? 0,
    volume24hr: numOrNull(raw.volume24hr) ?? 0,
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? null,
    url: eventSlug ? `https://polymarket.com/event/${eventSlug}` : `https://polymarket.com/market/${marketSlug}`,
    tagIds: [tagId],
    updatedAt: raw.updatedAt ?? null
  };
}

async function fetchTagPage(tagId: number, offset: number): Promise<GammaMarket[]> {
  // Stable sort (order=id) so sequential offset paging cannot skip rows when the
  // server-side set shifts between page fetches.
  const url = `${GAMMA_BASE}/markets?tag_id=${tagId}&limit=${PAGE_LIMIT}&offset=${offset}&order=id&ascending=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gamma fetch failed (tag ${tagId}, offset ${offset}): ${res.status}`);
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as GammaMarket[]) : [];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch ALL World Cup markets across the given tags, paginating each tag until a
 * short page, normalising every market, and de-duplicating by market id.
 */
export async function fetchAllWorldCupMarkets(
  tagIds: readonly number[] = WORLD_CUP_TAG_IDS,
  opts?: { maxPagesPerTag?: number; onProgress?: (msg: string) => void; delayMs?: number }
): Promise<WcMarket[]> {
  const maxPages = opts?.maxPagesPerTag ?? 200;
  const delayMs = opts?.delayMs ?? 120;
  const byId = new Map<string, WcMarket>();
  for (const tagId of tagIds) {
    let exhausted = false;
    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * PAGE_LIMIT;
      const rows = await fetchTagPage(tagId, offset);
      for (const raw of rows) {
        const market = normalizeMarket(raw, tagId);
        if (!market) continue;
        const existing = byId.get(market.id);
        if (existing) {
          byId.set(market.id, { ...existing, tagIds: [...new Set([...existing.tagIds, tagId])] });
        } else {
          byId.set(market.id, market);
        }
      }
      opts?.onProgress?.(`tag ${tagId} page ${page} (+${rows.length}) → total ${byId.size}`);
      if (rows.length < PAGE_LIMIT) { exhausted = true; break; }
      await sleep(delayMs);
    }
    if (!exhausted) {
      opts?.onProgress?.(`WARNING: tag ${tagId} hit maxPages cap (${maxPages}); results may be truncated`);
    }
  }
  return [...byId.values()];
}
