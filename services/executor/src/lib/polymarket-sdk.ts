import { randomUUID } from "node:crypto";
import { ClobClient, OrderType, Side, type Chain } from "@polymarket/clob-client";
import { buildPaperOrderResult } from "@autopoly/contracts";
import { Wallet } from "ethers";
import type { ExecutorConfig } from "../config.js";

export interface BookSnapshot {
  bestBid: number;
  bestAsk: number;
}

export interface RemotePosition {
  tokenId: string;
  outcome: string;
  size: number;
  title?: string;
  eventSlug?: string;
  marketSlug?: string;
}

export type GammaRecord = Record<string, unknown>;

let cachedClientPromise: Promise<ClobClient | null> | null = null;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function resolveApiCredentials(boot: ClobClient) {
  const deriveCreds = (boot as any).deriveApiKey?.bind(boot);
  const createCreds = (boot as any).createOrDeriveApiKey?.bind(boot);
  let lastError: unknown;

  if (deriveCreds) {
    try {
      const derived = await deriveCreds();
      if (derived) {
        return derived;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (createCreds) {
    try {
      const created = await createCreds();
      if (created) {
        return created;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError
      ? `Failed to derive Polymarket API credentials: ${errorMessage(lastError)}`
      : "Failed to derive Polymarket API credentials."
  );
}

export async function getClobClient(config: ExecutorConfig): Promise<ClobClient | null> {
  if (!config.privateKey || !config.funderAddress) {
    return null;
  }

  if (!cachedClientPromise) {
    cachedClientPromise = (async () => {
      try {
        const signer = new Wallet(config.privateKey);
        const boot = new ClobClient(config.polymarketHost, config.chainId as Chain, signer);
        const creds = await resolveApiCredentials(boot);

        return new ClobClient(
          config.polymarketHost,
          config.chainId as Chain,
          signer,
          creds as any,
          config.signatureType,
          config.funderAddress
        );
      } catch (error) {
        cachedClientPromise = null;
        throw error;
      }
    })();
  }

  return cachedClientPromise;
}

export async function getCollateralBalanceAllowance(config: ExecutorConfig): Promise<Record<string, unknown> | null> {
  const client = await getClobClient(config);
  if (!client) {
    return null;
  }
  return await (client as any).getBalanceAllowance({ asset_type: "COLLATERAL" });
}

export async function executeMarketOrder(
  config: ExecutorConfig,
  signal: { tokenId: string; side: "BUY" | "SELL"; amount: number }
) {
  const client = await getClobClient(config);
  if (!client) {
    return {
      ...buildPaperOrderResult({ side: signal.side, amount: signal.amount }),
      orderId: `mock-${randomUUID()}`,
    };
  }

  const response = await (client as any).createAndPostMarketOrder(
    {
      tokenID: signal.tokenId,
      amount: signal.amount,
      side: signal.side === "BUY" ? Side.BUY : Side.SELL,
      orderType: OrderType.FOK
    },
    undefined,
    OrderType.FOK
  );

  const avgPrice = Number((response as any)?.price ?? (response as any)?.avgPrice ?? 0.5);
  return {
    ok: Boolean((response as any)?.success ?? (response as any)?.orderID),
    orderId: (response as any)?.orderID ?? (response as any)?.orderId ?? null,
    avgPrice,
    filledNotionalUsd:
      signal.side === "BUY"
        ? signal.amount
        : Number((response as any)?.filledNotionalUsd ?? signal.amount * avgPrice),
    rawResponse: response
  };
}

export async function readBook(config: ExecutorConfig, tokenId: string): Promise<BookSnapshot | null> {
  const client = await getClobClient(config);
  if (!client) {
    return {
      bestBid: 0.48,
      bestAsk: 0.52
    };
  }
  const book = await client.getOrderBook(tokenId);
  const bids = (book as any)?.bids ?? [];
  const asks = (book as any)?.asks ?? [];
  if (bids.length === 0 || asks.length === 0) {
    return null;
  }
  const bestBid = bids.reduce((max: number, level: { price: string | number }) => {
    const price = Number(level.price);
    return Number.isFinite(price) ? Math.max(max, price) : max;
  }, Number.NEGATIVE_INFINITY);
  const bestAsk = asks.reduce((min: number, level: { price: string | number }) => {
    const price = Number(level.price);
    return Number.isFinite(price) ? Math.min(min, price) : min;
  }, Number.POSITIVE_INFINITY);
  if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) {
    return null;
  }
  return {
    bestBid,
    bestAsk
  };
}

export async function fetchRemotePositions(config: ExecutorConfig): Promise<RemotePosition[]> {
  if (!config.funderAddress) {
    return [];
  }
  const response = await fetch(
    `https://data-api.polymarket.com/positions?user=${config.funderAddress}&sizeThreshold=.1`,
    {
      headers: {
        "user-agent": "@autopoly/executor"
      }
    }
  );
  if (!response.ok) {
    throw new Error(`fetch positions failed: ${response.status}`);
  }
  const data = await response.json() as Array<Record<string, unknown>>;
  return data
    .map((row) => ({
      tokenId: String(row.asset ?? row.asset_id ?? row.token_id ?? ""),
      outcome: String(row.outcome ?? ""),
      size: Number(row.size ?? row.currentValue ?? 0),
      title: typeof row.title === "string" ? row.title : typeof row.question === "string" ? row.question : undefined,
      eventSlug: typeof row.slug === "string" ? row.slug : typeof row.event_slug === "string" ? row.event_slug : undefined,
      marketSlug: typeof row.market_slug === "string" ? row.market_slug : typeof row.slug === "string" ? row.slug : undefined
    }))
    .filter((row) => row.tokenId && row.size > 0);
}

export async function fetchEventBySlug(_config: ExecutorConfig, slug: string): Promise<GammaRecord> {
  const response = await fetch(`https://gamma-api.polymarket.com/events/slug/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`Failed to resolve event slug "${slug}": ${response.status}`);
  }
  const event = (await response.json()) as unknown;
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new Error(`Gamma event payload for "${slug}" is invalid.`);
  }
  return event as GammaRecord;
}

export async function fetchMarketBySlug(_config: ExecutorConfig, slug: string): Promise<GammaRecord[]> {
  const response = await fetch(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`Failed to resolve market slug "${slug}": ${response.status}`);
  }
  const markets = (await response.json()) as unknown;
  if (!Array.isArray(markets)) {
    throw new Error(`Gamma market payload for "${slug}" is invalid.`);
  }
  return markets.filter((entry): entry is GammaRecord => Boolean(entry) && typeof entry === "object");
}

export async function fetchActiveMarkets(_config: ExecutorConfig, limit = 100): Promise<GammaRecord[]> {
  const clampedLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const response = await fetch(
    `https://gamma-api.polymarket.com/markets?limit=${clampedLimit}&active=true&closed=false&order=liquidity&ascending=false`
  );
  if (!response.ok) {
    throw new Error(`Gamma API failed: ${response.status}`);
  }
  const markets = (await response.json()) as unknown;
  if (!Array.isArray(markets)) {
    throw new Error("Gamma markets payload is invalid.");
  }
  return markets.filter((entry): entry is GammaRecord => Boolean(entry) && typeof entry === "object");
}

export async function computeAvgCost(config: ExecutorConfig, tokenId: string): Promise<number | null> {
  const client = await getClobClient(config);
  if (!client || !config.funderAddress) {
    return null;
  }
  try {
    const trades = await (client as any).getTrades(
      { maker_address: config.funderAddress, asset_id: tokenId },
      true
    );
    const buys = Array.isArray(trades) ? trades.filter((trade) => trade.side === "BUY" || trade.side === Side.BUY) : [];
    let totalCost = 0;
    let totalSize = 0;
    for (const trade of buys) {
      const size = Number(trade.size ?? 0);
      const price = Number(trade.price ?? 0);
      if (size > 0 && price > 0) {
        totalCost += size * price;
        totalSize += size;
      }
    }
    return totalSize > 0 ? totalCost / totalSize : null;
  } catch {
    return null;
  }
}
