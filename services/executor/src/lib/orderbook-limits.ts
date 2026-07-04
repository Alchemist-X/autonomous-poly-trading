import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gammaFetch } from "./gamma.js";
import type { BookSnapshot } from "./polymarket-sdk.js";

export interface PersistedPolymarketOrderLimit {
  tokenId: string;
  updatedAt: string;
  bestBid: number | null;
  bestAsk: number | null;
  minOrderSize: number | null;
  tickSize: number | null;
  lastTradePrice: number | null;
  minBuyNotionalUsd: number | null;
}

export interface PersistedPolymarketActiveMarketLimit {
  marketId: string;
  slug: string;
  question: string;
  orderMinSize: number | null;
  orderPriceMinTickSize: number | null;
  clobTokenIds: string[];
  outcomes: string[];
  liquidityUsd: number | null;
  active: boolean;
  closed: boolean;
  enableOrderBook: boolean | null;
  sourceUpdatedAt: string | null;
  capturedAt: string;
}

export interface PersistedPolymarketOrderLimitStore {
  updatedAt: string;
  books: Record<string, PersistedPolymarketOrderLimit>;
  activeMarkets: {
    updatedAt: string | null;
    markets: Record<string, PersistedPolymarketActiveMarketLimit>;
  };
}

let persistQueue = Promise.resolve();

function sanitizeNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : null;
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function computeMinBuyNotionalUsd(book: BookSnapshot) {
  if (!(book.bestAsk > 0) || !(book.minOrderSize != null && book.minOrderSize > 0)) {
    return null;
  }
  return Number((book.bestAsk * book.minOrderSize).toFixed(2));
}

export function buildPersistedPolymarketOrderLimit(
  tokenId: string,
  book: BookSnapshot,
  updatedAt = new Date().toISOString()
): PersistedPolymarketOrderLimit {
  return {
    tokenId,
    updatedAt,
    bestBid: sanitizeNumber(book.bestBid),
    bestAsk: sanitizeNumber(book.bestAsk),
    minOrderSize: sanitizeNumber(book.minOrderSize),
    tickSize: sanitizeNumber(book.tickSize),
    lastTradePrice: sanitizeNumber(book.lastTradePrice),
    minBuyNotionalUsd: computeMinBuyNotionalUsd(book)
  };
}

export function buildPersistedPolymarketActiveMarketLimit(
  row: Record<string, unknown>,
  capturedAt = new Date().toISOString()
): PersistedPolymarketActiveMarketLimit {
  return {
    marketId: String(row.id ?? ""),
    slug: typeof row.slug === "string" ? row.slug : "",
    question: typeof row.question === "string" ? row.question : "",
    orderMinSize: sanitizeNumber(Number(row.orderMinSize ?? row.order_min_size ?? NaN)),
    orderPriceMinTickSize: sanitizeNumber(Number(row.orderPriceMinTickSize ?? row.order_price_min_tick_size ?? NaN)),
    clobTokenIds: parseStringArray(row.clobTokenIds ?? row.clob_token_ids),
    outcomes: parseStringArray(row.outcomes),
    liquidityUsd: sanitizeNumber(Number(row.liquidityNum ?? row.liquidity ?? NaN)),
    active: Boolean(row.active),
    closed: Boolean(row.closed),
    enableOrderBook: typeof row.enableOrderBook === "boolean"
      ? row.enableOrderBook
      : typeof row.enable_order_book === "boolean"
        ? row.enable_order_book
        : null,
    sourceUpdatedAt: typeof row.updatedAt === "string"
      ? row.updatedAt
      : typeof row.updated_at === "string"
        ? row.updated_at
        : null,
    capturedAt
  };
}

function emptyStore(): PersistedPolymarketOrderLimitStore {
  return {
    updatedAt: new Date(0).toISOString(),
    books: {},
    activeMarkets: {
      updatedAt: null,
      markets: {}
    }
  };
}

async function readStore(filePath: string): Promise<PersistedPolymarketOrderLimitStore> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedPolymarketOrderLimitStore>;
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      books: parsed.books && typeof parsed.books === "object" ? parsed.books : {},
      activeMarkets: {
        updatedAt: typeof parsed.activeMarkets?.updatedAt === "string" ? parsed.activeMarkets.updatedAt : null,
        markets:
          parsed.activeMarkets?.markets && typeof parsed.activeMarkets.markets === "object"
            ? parsed.activeMarkets.markets
            : {}
      }
    };
  } catch (error) {
    const code = typeof error === "object" && error != null && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "ENOENT") {
      return emptyStore();
    }
    throw error;
  }
}

async function writeStore(filePath: string, store: PersistedPolymarketOrderLimitStore) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

async function fetchActiveMarketPage(limit: number, offset: number) {
  const response = await gammaFetch(
    `/markets?limit=${limit}&offset=${offset}&active=true&closed=false&order=liquidity&ascending=false`
  );
  if (!response.ok) {
    throw new Error(`Gamma API failed: ${response.status}`);
  }
  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Gamma markets payload is invalid.");
  }
  return payload.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

export async function persistPolymarketOrderLimit(input: {
  filePath: string;
  tokenId: string;
  book: BookSnapshot;
  updatedAt?: string;
}) {
  const nextRecord = buildPersistedPolymarketOrderLimit(input.tokenId, input.book, input.updatedAt);
  persistQueue = persistQueue.then(async () => {
    const store = await readStore(input.filePath);
    const nextStore: PersistedPolymarketOrderLimitStore = {
      ...store,
      updatedAt: nextRecord.updatedAt,
      books: {
        ...store.books,
        [input.tokenId]: nextRecord
      }
    };
    await writeStore(input.filePath, nextStore);
  });
  await persistQueue;
}

export async function persistPolymarketActiveMarketLimits(input: {
  filePath: string;
  markets: PersistedPolymarketActiveMarketLimit[];
  updatedAt?: string;
}) {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const nextMarkets = Object.fromEntries(
    input.markets
      .filter((market) => market.marketId || market.slug)
      .map((market) => [market.marketId || market.slug, market])
  );

  persistQueue = persistQueue.then(async () => {
    const store = await readStore(input.filePath);
    const nextStore: PersistedPolymarketOrderLimitStore = {
      ...store,
      updatedAt,
      activeMarkets: {
        updatedAt,
        markets: nextMarkets
      }
    };
    await writeStore(input.filePath, nextStore);
  });
  await persistQueue;
}

export async function snapshotPolymarketActiveMarketLimits(input: {
  filePath: string;
  pageSize?: number;
  maxMarkets?: number | null;
}) {
  const pageSize = Math.max(1, Math.min(500, Math.trunc(input.pageSize ?? 500)));
  const maxMarkets = input.maxMarkets == null ? null : Math.max(1, Math.trunc(input.maxMarkets));
  const markets: PersistedPolymarketActiveMarketLimit[] = [];
  const seen = new Set<string>();

  for (let offset = 0; ; offset += pageSize) {
    if (maxMarkets != null && markets.length >= maxMarkets) {
      break;
    }

    const limit = maxMarkets == null ? pageSize : Math.min(pageSize, maxMarkets - markets.length);
    const page = await fetchActiveMarketPage(limit, offset);
    const capturedAt = new Date().toISOString();
    for (const row of page) {
      const market = buildPersistedPolymarketActiveMarketLimit(row, capturedAt);
      const cacheKey = market.marketId || market.slug || market.question;
      if (!cacheKey || seen.has(cacheKey)) {
        continue;
      }
      seen.add(cacheKey);
      markets.push(market);
    }

    if (page.length < limit) {
      break;
    }
  }

  const updatedAt = new Date().toISOString();
  await persistPolymarketActiveMarketLimits({
    filePath: input.filePath,
    markets,
    updatedAt
  });

  return {
    filePath: input.filePath,
    updatedAt,
    marketCount: markets.length,
    tokenCount: markets.reduce((sum, market) => sum + market.clobTokenIds.length, 0)
  };
}

export function resolveDefaultPolymarketOrderLimitPath(repoRoot: string) {
  return path.join(repoRoot, "runtime-artifacts", "local", "polymarket-order-limits.json");
}
