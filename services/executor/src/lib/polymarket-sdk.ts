import { randomUUID } from "node:crypto";
import { ClobClient, OrderType, Side, type Chain } from "@polymarket/clob-client-v2";
import { buildPaperOrderResult } from "@autopoly/contracts";
import { Wallet } from "ethers";
import type { ExecutorConfig } from "../config.js";
import {
  OkxAgenticSigner,
  type ExecutorWalletProvider,
  resolveOnchainOsAddress,
  resolveWalletProvider
} from "./okx-agentic-wallet.js";

// Polymarket Conditional Tokens Framework (ERC1155) on Polygon — unchanged across V1/V2
const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const DEFAULT_POLYGON_RPC = "https://polygon-bor-rpc.publicnode.com";

export interface BookLevel {
  price: number;
  size: number;
}

export interface BookSnapshot {
  bestBid: number;
  bestAsk: number;
  minOrderSize?: number | null;
  tickSize?: number | null;
  lastTradePrice?: number | null;
  /** Full ask-side depth sorted ascending by price (for slippage sizing on BUY). */
  asks?: BookLevel[];
  /** Full bid-side depth sorted descending by price (for slippage sizing on SELL). */
  bids?: BookLevel[];
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

interface PolymarketPublicProfile {
  proxyWallet?: string | null;
}

export interface PolymarketSigningIdentity {
  walletProvider: ExecutorWalletProvider;
  signerAddress: string;
  funderAddress: string;
  signatureType: number;
  walletMode: "eoa" | "proxy";
  proxyWallet: string | null;
}

let cachedClientPromise: Promise<ClobClient | null> | null = null;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function hasApiCredentials(value: unknown): value is { key: string; secret: string; passphrase: string } {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return [candidate.key, candidate.secret, candidate.passphrase].every(
    (field) => typeof field === "string" && field.trim().length > 0
  );
}

function normalizeAddress(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || !/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
}

function resolveProxySignatureType(signatureType: number) {
  if (signatureType === 1 || signatureType === 2 || signatureType === 3) {
    return signatureType;
  }
  return 3;
}

export async function fetchPolymarketProxyWallet(address: string): Promise<string | null> {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) {
    return null;
  }

  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/public-profile?address=${encodeURIComponent(normalizedAddress)}`,
      {
        headers: {
          "user-agent": "@autopoly/executor"
        }
      }
    );

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`profile lookup failed: ${response.status}`);
    }

    const profile = (await response.json()) as PolymarketPublicProfile;
    const proxyWallet = normalizeAddress(profile.proxyWallet);
    if (!proxyWallet || proxyWallet === normalizedAddress) {
      return null;
    }
    return proxyWallet;
  } catch {
    return null;
  }
}

export async function resolvePolymarketSigningIdentity(
  config: Pick<ExecutorConfig, "walletProvider" | "privateKey" | "funderAddress" | "signatureType" | "onchainosBin"> & Partial<Pick<ExecutorConfig, "onchainosTimeoutMs">>
): Promise<PolymarketSigningIdentity> {
  const walletProvider = resolveWalletProvider(config);
  if (walletProvider === "private-key") {
    if (!config.privateKey) {
      throw new Error("PRIVATE_KEY is required in private-key mode.");
    }
    const signerAddress = normalizeAddress(new Wallet(config.privateKey).address);
    if (!signerAddress) {
      throw new Error("Unable to derive signer address from PRIVATE_KEY.");
    }
    const funderAddress = normalizeAddress(config.funderAddress) ?? signerAddress;
    const walletMode = funderAddress === signerAddress && config.signatureType === 0 ? "eoa" : "proxy";
    return {
      walletProvider,
      signerAddress,
      funderAddress,
      signatureType: walletMode === "proxy" ? resolveProxySignatureType(config.signatureType) : 0,
      walletMode,
      proxyWallet: walletMode === "proxy" ? funderAddress : null
    };
  }

  const signerAddress = normalizeAddress(await resolveOnchainOsAddress(config));
  if (!signerAddress) {
    throw new Error("Unable to resolve an OnchainOS signer address.");
  }

  const explicitFunderAddress = normalizeAddress(config.funderAddress);
  if (explicitFunderAddress) {
    const walletMode = explicitFunderAddress === signerAddress && config.signatureType === 0 ? "eoa" : "proxy";
    return {
      walletProvider,
      signerAddress,
      funderAddress: explicitFunderAddress,
      signatureType: walletMode === "proxy" ? resolveProxySignatureType(config.signatureType) : 0,
      walletMode,
      proxyWallet: walletMode === "proxy" ? explicitFunderAddress : null
    };
  }

  const proxyWallet = await fetchPolymarketProxyWallet(signerAddress);
  if (proxyWallet) {
    return {
      walletProvider,
      signerAddress,
      funderAddress: proxyWallet,
      signatureType: resolveProxySignatureType(config.signatureType),
      walletMode: "proxy",
      proxyWallet
    };
  }

  return {
    walletProvider,
    signerAddress,
    funderAddress: signerAddress,
    signatureType: 0,
    walletMode: "eoa",
    proxyWallet: null
  };
}

export async function resolvePolymarketFunderAddress(config: ExecutorConfig): Promise<string> {
  const identity = await resolvePolymarketSigningIdentity(config);
  return identity.funderAddress;
}

async function resolveApiCredentials(boot: ClobClient) {
  const deriveCreds = (boot as any).deriveApiKey?.bind(boot);
  const createCreds = (boot as any).createOrDeriveApiKey?.bind(boot);
  let lastError: unknown;

  if (deriveCreds) {
    try {
      const derived = await deriveCreds();
      if (hasApiCredentials(derived)) {
        return derived;
      }
      lastError = new Error(`deriveApiKey returned an invalid credential payload: ${JSON.stringify(derived)}`);
    } catch (error) {
      lastError = error;
    }
  }

  if (createCreds) {
    try {
      const created = await createCreds();
      if (hasApiCredentials(created)) {
        return created;
      }
      lastError = new Error(`createOrDeriveApiKey returned an invalid credential payload: ${JSON.stringify(created)}`);
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
  const walletProvider = resolveWalletProvider(config);
  if (walletProvider === "private-key" && (!config.privateKey || !config.funderAddress)) {
    return null;
  }

  if (!cachedClientPromise) {
    cachedClientPromise = (async () => {
      try {
        const signer = walletProvider === "onchainos"
          ? new OkxAgenticSigner(config)
          : new Wallet(config.privateKey);
        const identity = await resolvePolymarketSigningIdentity(config);
        const boot = new ClobClient({
          host: config.polymarketHost,
          chain: config.chainId as Chain,
          signer: signer as any,
        });
        const creds = await resolveApiCredentials(boot);

        // When builder attribution is configured, pass `builderConfig` so the
        // V2 SDK auto-stamps `builderCode` onto every signed order. The SDK
        // populates `builderCode` if the per-order field is unset, which keeps
        // this purely additive — no per-call changes needed downstream.
        const builderConfig = config.builderAttribution
          ? { builderCode: config.builderAttribution.code }
          : undefined;

        return new ClobClient({
          host: config.polymarketHost,
          chain: config.chainId as Chain,
          signer: signer as any,
          creds,
          signatureType: identity.signatureType,
          funderAddress: identity.funderAddress,
          builderConfig,
        });
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

  const taking = Number((response as any)?.takingAmount ?? 0);
  const making = Number((response as any)?.makingAmount ?? 0);

  // For BUY: making = USDC given, taking = shares received → price = making / taking
  // For SELL: making = shares given, taking = USDC received → price = taking / making
  const derivedAvgPrice =
    making > 0 && taking > 0
      ? signal.side === "BUY"
        ? making / taking
        : taking / making
      : Number((response as any)?.price ?? (response as any)?.avgPrice ?? 0.5);

  const filledNotionalUsd =
    signal.side === "BUY"
      ? (making > 0 ? making : signal.amount)
      : (taking > 0 ? taking : signal.amount * derivedAvgPrice);

  return {
    ok: Boolean((response as any)?.success ?? (response as any)?.orderID),
    orderId: (response as any)?.orderID ?? (response as any)?.orderId ?? null,
    avgPrice: derivedAvgPrice,
    filledNotionalUsd,
    rawResponse: response
  };
}

// ---------------------------------------------------------------------------
// GTC (Good Till Cancelled) limit orders
// ---------------------------------------------------------------------------

export interface LimitOrderResult {
  ok: boolean;
  orderId: string | null;
  price: number;
  size: number;
  rawResponse: unknown;
}

/**
 * Place a GTC limit order on the CLOB.
 *
 * Unlike FOK market orders, GTC orders sit on the book until filled or
 * cancelled. They avoid taker fees (and may earn maker rebates) but are
 * not guaranteed to fill.
 */
export async function executeLimitOrder(
  config: ExecutorConfig,
  signal: { tokenId: string; side: "BUY" | "SELL"; price: number; size: number }
): Promise<LimitOrderResult> {
  const client = await getClobClient(config);
  if (!client) {
    return {
      ok: true,
      orderId: `mock-gtc-${randomUUID()}`,
      price: signal.price,
      size: signal.size,
      rawResponse: null
    };
  }

  const response = await (client as any).createAndPostOrder(
    {
      tokenID: signal.tokenId,
      price: signal.price,
      size: signal.size,
      side: signal.side === "BUY" ? Side.BUY : Side.SELL
    },
    undefined,
    OrderType.GTC
  );

  return {
    ok: Boolean((response as any)?.orderID),
    orderId: (response as any)?.orderID ?? null,
    price: signal.price,
    size: signal.size,
    rawResponse: response
  };
}

/**
 * Cancel an open GTC order by its order ID.
 */
export async function cancelOrder(
  config: ExecutorConfig,
  orderId: string
): Promise<{ ok: boolean; rawResponse: unknown }> {
  const client = await getClobClient(config);
  if (!client) {
    return { ok: true, rawResponse: null };
  }

  try {
    const response = await (client as any).cancelOrder({ orderID: orderId });
    return { ok: true, rawResponse: response };
  } catch (err) {
    return { ok: false, rawResponse: err instanceof Error ? err.message : String(err) };
  }
}

export type OrderStatus = "live" | "matched" | "filled" | "canceled" | "delayed" | "unknown";

/**
 * Query the current status of an order.
 */
export async function getOrderStatus(
  config: ExecutorConfig,
  orderId: string
): Promise<{ status: OrderStatus; filledSize: number; rawResponse: unknown }> {
  const client = await getClobClient(config);
  if (!client) {
    return { status: "filled", filledSize: 0, rawResponse: null };
  }

  try {
    const order = await (client as any).getOrder(orderId);
    const status = String((order as any)?.status ?? "unknown").toLowerCase() as OrderStatus;
    const filledSize = Number((order as any)?.size_matched ?? (order as any)?.filledSize ?? 0);
    return { status, filledSize, rawResponse: order };
  } catch {
    return { status: "unknown", filledSize: 0, rawResponse: null };
  }
}

export async function readBook(config: ExecutorConfig, tokenId: string): Promise<BookSnapshot | null> {
  const client = await getClobClient(config);
  if (!client) {
    return {
      bestBid: 0.48,
      bestAsk: 0.52,
      minOrderSize: null,
      tickSize: null,
      lastTradePrice: null,
      asks: [{ price: 0.52, size: 1000 }],
      bids: [{ price: 0.48, size: 1000 }]
    };
  }
  const book = await client.getOrderBook(tokenId);
  const rawBids = (book as any)?.bids ?? [];
  const rawAsks = (book as any)?.asks ?? [];
  if (rawBids.length === 0 || rawAsks.length === 0) {
    return null;
  }
  const normalizeLevel = (level: { price: string | number; size: string | number }): BookLevel | null => {
    const price = Number(level.price);
    const size = Number(level.size);
    if (!Number.isFinite(price) || !Number.isFinite(size) || size <= 0) return null;
    return { price, size };
  };
  const askLevels = (rawAsks as any[])
    .map(normalizeLevel)
    .filter((l): l is BookLevel => l != null)
    .sort((a, b) => a.price - b.price);
  const bidLevels = (rawBids as any[])
    .map(normalizeLevel)
    .filter((l): l is BookLevel => l != null)
    .sort((a, b) => b.price - a.price);
  if (askLevels.length === 0 || bidLevels.length === 0) {
    return null;
  }
  const bestAsk = askLevels[0]!.price;
  const bestBid = bidLevels[0]!.price;
  return {
    bestBid,
    bestAsk,
    minOrderSize: Number.isFinite(Number((book as any)?.min_order_size))
      ? Number((book as any)?.min_order_size)
      : null,
    tickSize: Number.isFinite(Number((book as any)?.tick_size))
      ? Number((book as any)?.tick_size)
      : null,
    lastTradePrice: Number.isFinite(Number((book as any)?.last_trade_price))
      ? Number((book as any)?.last_trade_price)
      : null,
    asks: askLevels,
    bids: bidLevels
  };
}

export async function fetchRemotePositions(config: ExecutorConfig): Promise<RemotePosition[]> {
  const funderAddress = await resolvePolymarketFunderAddress(config).catch(() => normalizeAddress(config.funderAddress) ?? "");
  if (!funderAddress) {
    return [];
  }
  const response = await fetch(
    `https://data-api.polymarket.com/positions?user=${funderAddress}&sizeThreshold=.1`,
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
  const funderAddress = await resolvePolymarketFunderAddress(config).catch(() => normalizeAddress(config.funderAddress) ?? "");
  if (!client || !funderAddress) {
    return null;
  }
  try {
    const trades = await (client as any).getTrades(
      { maker_address: funderAddress, asset_id: tokenId },
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

// ---------------------------------------------------------------------------
// On-chain ERC1155 balance verification
// ---------------------------------------------------------------------------

/**
 * Query the on-chain ERC1155 balance for a specific CTF token.
 *
 * Uses `balanceOf(address, uint256)` (selector 0x00fdd58e) on the
 * Conditional Tokens Framework contract.  This is the ground-truth
 * balance — if it disagrees with Polymarket's data API, the on-chain
 * value is authoritative.
 *
 * Returns the raw token balance (in shares, 6 decimal places on Polygon)
 * or null if the RPC call fails.
 */
export async function checkOnChainTokenBalance(
  ownerAddress: string,
  tokenId: string
): Promise<number | null> {
  const rpcUrl = process.env.POLYGON_RPC_URL?.trim() || DEFAULT_POLYGON_RPC;
  const owner = ownerAddress.toLowerCase().replace(/^0x/, "").padStart(64, "0");

  // tokenId is a uint256 decimal string — convert to hex, left-pad to 32 bytes
  let tokenHex: string;
  try {
    tokenHex = BigInt(tokenId).toString(16).padStart(64, "0");
  } catch {
    return null;
  }

  // ERC1155 balanceOf(address, uint256) selector = 0x00fdd58e
  const data = `0x00fdd58e${owner}${tokenHex}`;

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: CTF_CONTRACT, data }, "latest"]
      })
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      result?: string;
      error?: { message?: string };
    };
    if (payload.error || !payload.result) {
      return null;
    }
    // Result is a hex-encoded uint256.  CTF tokens use 6 decimal places.
    const raw = BigInt(payload.result);
    return Number(raw) / 1e6;
  } catch {
    return null;
  }
}

/**
 * Validate that the wallet holds enough tokens on-chain before selling.
 *
 * Returns `{ ok, onChainBalance, requestedAmount, shortfall }`.
 * If the RPC call fails, returns `ok: true` (fail-open to avoid blocking
 * trades when the RPC is down).
 */
export async function validateSellBalance(
  ownerAddress: string,
  tokenId: string,
  requestedShares: number
): Promise<{
  ok: boolean;
  onChainBalance: number | null;
  requestedAmount: number;
  shortfall: number;
}> {
  const balance = await checkOnChainTokenBalance(ownerAddress, tokenId);
  if (balance == null) {
    // RPC unavailable — fail-open
    return { ok: true, onChainBalance: null, requestedAmount: requestedShares, shortfall: 0 };
  }
  const shortfall = Math.max(0, requestedShares - balance);
  return {
    ok: shortfall <= 0.01, // tolerance for rounding
    onChainBalance: balance,
    requestedAmount: requestedShares,
    shortfall
  };
}
