// PolymarketRelayerAdapter — concrete implementation of `PolymarketAdapter`
// for the managed-trading service.
//
// Wires three SDK surfaces together:
//   1. `@polymarket/builder-relayer-client` — Safe deployment status
//      checks via Raven's relayer (so we never accidentally trade on a
//      user whose proxy hasn't materialised).
//   2. `@polymarket/clob-client-v2` — order placement, signed by the
//      Privy session signer with `signatureType=2` (Safe proxy) and
//      `funderAddress=<user safe>`. Builder code is auto-stamped onto
//      every order via `builderConfig: { builderCode }`.
//   3. `viem` — direct ERC-20 reads for USDC.e bankroll on Polygon.
//
// Real-money rules that must hold even pre-cutover (see CLAUDE.md §6):
//   * paper-mode default; `placeOrder` refuses to run when `mode !== 'live'`
//   * config validation up-front so missing builder creds fail at startup
//     rather than on the first user trade
//   * every error path returns a structured failure shape (no swallowed
//     exceptions) so the dispatcher can persist it as a skip instead of
//     a silent retry

import {
  ClobClient,
  OrderType,
  Side,
  type Chain
} from "@polymarket/clob-client-v2";
import { RelayClient } from "@polymarket/builder-relayer-client";
import { Wallet } from "ethers";
import { createPublicClient, http, formatUnits, getAddress, type PublicClient } from "viem";
import { polygon } from "viem/chains";

import type {
  Address,
  OrderResult,
  PolymarketAdapter,
  Position,
  SafeBalance,
  SafeDeployResult,
  SessionSigner,
  OrderRequest
} from "./polymarket-adapter.js";
import type { BuilderAttribution, ManagedTradingConfig } from "./config.js";
import { loadConfig } from "./config.js";

// USDC.e on Polygon (canonical, bridged USDC). Used by Polymarket as the
// collateral token. 6 decimals.
//
// TODO: deduplicate with apps/raven-managed/lib/portfolio.ts — the
// frontend reads the same balance for the dashboard. When Phase 3a.2
// lands the cron path, move to a single shared helper in
// `services/managed-trading/src/lib/portfolio.ts` and have the Next.js
// route import from `@autopoly/managed-trading`.
const USDC_E_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;
const USDC_DECIMALS = 6;
const BALANCE_CACHE_TTL_MS = 30_000;

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

// Default Polymarket Data API for derived per-user position state. The
// executor uses the same endpoint for the Pizza wallet — see
// `services/executor/src/lib/polymarket-sdk.ts::fetchRemotePositions`.
const POLYMARKET_DATA_API = "https://data-api.polymarket.com";

// Minimum size threshold (in USD) below which we ignore dust positions.
// Mirrors the executor default so behavior is consistent across users.
const POSITION_SIZE_THRESHOLD_USD = 0.1;

// Polymarket Safe = SignatureTypeV2.POLY_GNOSIS_SAFE (= 2). Hardcoded
// numeric so we never accidentally pass the wrong sig type — every
// real-money order MUST be signed with the user's Safe proxy semantics.
const SIG_TYPE_POLY_GNOSIS_SAFE = 2 as const;

interface BalanceCacheEntry {
  readonly value: SafeBalance;
  readonly expiresAt: number;
}

// Lightweight shape of the relayer client surface this adapter needs.
// Matches `RelayClient.getDeployed`. Used so tests can inject a mock
// without booting a real relayer — and so we never accidentally rely on
// SDK methods that aren't exposed by 0.0.9.
export interface RelayerStatusClient {
  getDeployed(address: string, type?: string): Promise<boolean>;
}

// Builder of a CLOB v2 client for a given user Safe + signer key. Tests
// inject a stub via the `clobClientFactory` dep; production lazily
// constructs the real ClobClient.
export type ClobClientFactory = (params: {
  safeAddress: string;
  builderAttribution: BuilderAttribution;
  config: ManagedTradingConfig;
  privateKey: string;
}) => Promise<ClobClient>;

// Optional injection points so unit tests can substitute the on-chain
// reader, the data-API fetcher, and the SDK clients without monkey-
// patching modules.
export interface PolymarketRelayerAdapterDeps {
  readonly fetch?: typeof fetch;
  readonly viemClient?: PublicClient;
  readonly now?: () => number;
  readonly relayerStatusClient?: RelayerStatusClient;
  readonly clobClientFactory?: ClobClientFactory;
}

export interface PolymarketRelayerAdapterOptions {
  // Optional pre-loaded config for tests. When omitted, `loadConfig()`
  // runs at construction time so misconfiguration surfaces fast.
  readonly config?: ManagedTradingConfig;
  readonly deps?: PolymarketRelayerAdapterDeps;
}

// Concrete adapter wired to Polymarket's relayer + CLOB v2 SDK. Instances
// are safe to share across requests — internal SDK clients are lazy and
// per-Safe (one ClobClient cache key per `funderAddress`).
export class PolymarketRelayerAdapter implements PolymarketAdapter {
  readonly config: ManagedTradingConfig;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly injectedClient: PublicClient | undefined;
  private readonly injectedRelayer: RelayerStatusClient | undefined;
  private readonly clobClientFactory: ClobClientFactory;
  private cachedClient: PublicClient | undefined;
  private cachedRelayerStatus: RelayerStatusClient | undefined;
  // Per-Safe ClobClient cache. Each user keeps its own `funderAddress`
  // bound on the client, so we cannot share a single instance.
  private readonly clobClientCache = new Map<string, Promise<ClobClient>>();
  private readonly balanceCache = new Map<string, BalanceCacheEntry>();

  constructor(options: PolymarketRelayerAdapterOptions = {}) {
    this.config = options.config ?? loadConfig();
    this.fetchFn = options.deps?.fetch ?? fetch;
    this.now = options.deps?.now ?? (() => Date.now());
    this.injectedClient = options.deps?.viemClient;
    this.injectedRelayer = options.deps?.relayerStatusClient;
    this.clobClientFactory = options.deps?.clobClientFactory ?? defaultClobClientFactory;
  }

  // Verify whether the Polymarket Safe proxy for a given EOA has been
  // deployed on-chain. Returns the deterministic Safe address (provided
  // by the caller — derived via `apps/raven-managed/lib/polymarket-safe.ts`)
  // and an `alreadyDeployed` flag.
  //
  // We deliberately do NOT call `relayClient.deploy()` server-side:
  //   * Deploying requires a wallet signer for the EOA. The user's
  //     wallet lives in Privy's iframe — we don't hold their EOA key.
  //   * Polymarket auto-deploys the Safe on first trade as a proxy
  //     pattern; an explicit deploy is only useful when the user has
  //     deposited but not yet traded.
  //   * The frontend onboarding flow drives explicit deploy via the
  //     relayer (with the user's signer attached) when needed.
  //
  // For 3a.1C this method is a status check + idempotent return shape.
  // 3a.4 dogfood will tell us whether a server-side deploy step is
  // actually needed; if so, 3a.5 wires it via a separate per-user
  // signer (Turnkey/HSM) that *can* sign on behalf of the user.
  async deploySafe(eoa: Address): Promise<SafeDeployResult> {
    let normalisedEoa: `0x${string}`;
    try {
      normalisedEoa = getAddress(eoa);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`deploySafe: invalid EOA address "${eoa}": ${message}`);
    }

    // Resolve a Safe address up-front. We avoid pulling the deriveSafe
    // helper here to keep this file independent of raven-managed; the
    // dispatcher caller is expected to pass an already-derived
    // `safeAddress` in the user record. To remain idempotent + safe
    // we re-confirm via the relayer.
    //
    // TODO(3a.2): inline `deriveSafe` here once the helper is moved
    // into managed-trading/lib (currently in
    // `apps/raven-managed/lib/polymarket-safe.ts`).
    const relayer = this.getRelayerStatusClient();
    let alreadyDeployed = false;
    try {
      alreadyDeployed = await relayer.getDeployed(normalisedEoa, "SAFE");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`deploySafe: relayer.getDeployed failed: ${message}`);
    }

    return {
      // Note: this method does not derive the Safe address itself —
      // callers pass the EOA, and the deterministic Safe is derived
      // upstream (raven-managed onboarding) and stored in
      // `managedUsers.safeAddress`. We surface the EOA back in the
      // response so the caller can correlate.
      safeAddress: normalisedEoa as Address,
      deployTxHash: null,
      alreadyDeployed
    };
  }

  // Read on-chain USDC.e balance for the user's Safe. 30-second per-Safe
  // cache prevents hammering the RPC on tight cron loops.
  //
  // Failure handling: any RPC error is rethrown so the dispatcher can
  // persist a clear `getBalance failed: <message>` and skip the user.
  // Returning a fake "0" would risk blocking the user from trading on
  // transient infra issues — fail-loud is the safer default per
  // CLAUDE.md §6.
  async getBalance(safeAddress: Address): Promise<SafeBalance> {
    let normalised: `0x${string}`;
    try {
      normalised = getAddress(safeAddress);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`getBalance: invalid safe address "${safeAddress}": ${message}`);
    }

    const cached = this.balanceCache.get(normalised);
    const now = this.now();
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const client = this.getViemClient();
    let raw: bigint;
    try {
      raw = (await client.readContract({
        address: USDC_E_ADDRESS,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [normalised]
      })) as bigint;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`getBalance: USDC.e balanceOf RPC call failed: ${message}`);
    }

    const value: SafeBalance = {
      usdcRaw: raw,
      usdcFormatted: formatUnits(raw, USDC_DECIMALS)
    };
    this.balanceCache.set(normalised, {
      value,
      expiresAt: now + BALANCE_CACHE_TTL_MS
    });
    return value;
  }

  // Place a real CLOB order on behalf of `safeAddress`, signed by the
  // server-side Privy session signer key with Raven's builder code
  // attached. Returns a structured `OrderResult` on both success and
  // failure — never throws on operational errors.
  //
  // Live-mode-only: in `paper` mode this method is unreachable from the
  // dispatcher (paper path persists decisions without calling adapter
  // execution). The explicit guard is a defense-in-depth check so a
  // misconfigured caller (e.g. cron flipped to live but adapter still
  // paper) never trades on stale config.
  async placeOrder(
    safeAddress: Address,
    order: OrderRequest,
    sessionSigner: SessionSigner
  ): Promise<OrderResult> {
    if (this.config.mode !== "live") {
      return failedResult(
        `placeOrder: managed-trading mode is "${this.config.mode}" — live mode required`
      );
    }
    if (!this.config.builderAttribution) {
      return failedResult("placeOrder: builder attribution missing — refuse to trade");
    }
    if (!this.config.privySessionSignerPrivateKey) {
      return failedResult("placeOrder: PRIVY_SESSION_SIGNER_PRIVATE_KEY missing");
    }

    let normalisedSafe: `0x${string}`;
    try {
      normalisedSafe = getAddress(safeAddress);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failedResult(`placeOrder: invalid safe address "${safeAddress}": ${message}`);
    }

    const orderError = validateOrderRequest(order);
    if (orderError) {
      return failedResult(`placeOrder: ${orderError}`);
    }

    const notionalUsd = Number(order.notionalUsd);
    // BUY market orders are sized in USD; SELL would be in shares but the
    // dispatcher passes `notionalUsd` for both (Phase 3a is BUY-only via
    // pulse open actions). Phase 3a.3 will revisit SELL sizing.
    //
    // TODO(3a.3): when sell-side support lands, divide by limit price to
    // produce share-count, mirroring services/executor/src/risk.ts.
    const amountUsdcOrShares = notionalUsd;

    let client: ClobClient;
    try {
      client = await this.getClobClient(normalisedSafe, sessionSigner);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failedResult(`placeOrder: clob client init failed: ${message}`);
    }

    // We use FOK (fill-or-kill) market orders for the same reason the
    // executor does for the pizza wallet: deterministic outcomes — either
    // we get the full fill at the limit price, or nothing.
    let response: unknown;
    try {
      response = await (client as unknown as {
        createAndPostMarketOrder: (
          orderArg: {
            tokenID: string;
            amount: number;
            price: number;
            side: Side;
            orderType: OrderType;
            builderCode?: string;
          },
          options?: unknown,
          orderType?: OrderType
        ) => Promise<unknown>;
      }).createAndPostMarketOrder(
        {
          tokenID: order.tokenId,
          amount: amountUsdcOrShares,
          price: order.price,
          side: order.side === "BUY" ? Side.BUY : Side.SELL,
          orderType: OrderType.FOK,
          builderCode: this.config.builderAttribution.code
        },
        undefined,
        OrderType.FOK
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failedResult(classifyOrderError(message));
    }

    return mapOrderResponse(response, order);
  }

  // Read the user's open Polymarket positions via the public data API.
  //
  // Returns an empty array on transport failure — positions are an
  // observability surface, not a gating decision; the dispatcher should
  // proceed with the run. (Contrast with `getBalance`, which is
  // load-bearing for cap math and therefore must throw.)
  //
  // TODO(3a.2): cross-check against on-chain ERC1155 balances for the
  // CTF contract to catch data-api lag. Mirrors
  // `services/executor/src/lib/polymarket-sdk.ts::checkOnChainTokenBalance`.
  async getPositions(safeAddress: Address): Promise<Position[]> {
    let normalised: `0x${string}`;
    try {
      normalised = getAddress(safeAddress);
    } catch {
      return [];
    }

    const url =
      `${POLYMARKET_DATA_API}/positions?user=${normalised}` +
      `&sizeThreshold=${POSITION_SIZE_THRESHOLD_USD}`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: { "user-agent": "@autopoly/managed-trading" }
      });
    } catch {
      return [];
    }

    if (!response.ok) {
      return [];
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return [];
    }

    if (!Array.isArray(payload)) {
      return [];
    }

    const positions: Position[] = [];
    for (const row of payload) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const tokenId = String(r.asset ?? r.asset_id ?? r.token_id ?? "");
      if (!tokenId) continue;

      const size = Number(r.size ?? 0);
      if (!Number.isFinite(size) || size <= 0) continue;

      const outcomeRaw = String(r.outcome ?? "yes").toLowerCase();
      const side: Position["side"] = outcomeRaw === "no" ? "no" : "yes";

      const avgCost = Number(r.avgPrice ?? r.avg_price ?? r.entryPrice ?? 0);
      const currentPrice = Number(r.curPrice ?? r.currentPrice ?? r.markPrice ?? 0);
      const currentValueUsdRaw = Number(
        r.currentValue ?? r.current_value ?? size * currentPrice
      );
      const unrealizedPctRaw = Number(
        r.percentPnl ?? r.unrealized_pnl_pct ?? r.cashPnL ?? 0
      );

      const marketSlug =
        (typeof r.market_slug === "string" && r.market_slug) ||
        (typeof r.slug === "string" && r.slug) ||
        (typeof r.eventSlug === "string" && r.eventSlug) ||
        "";

      positions.push({
        tokenId,
        marketSlug,
        side,
        size: size.toString(),
        avgCost: Number.isFinite(avgCost) ? avgCost : 0,
        currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
        currentValueUsd: (Number.isFinite(currentValueUsdRaw)
          ? currentValueUsdRaw
          : 0
        ).toFixed(2),
        unrealizedPnlPct: Number.isFinite(unrealizedPctRaw) ? unrealizedPctRaw : 0
      });
    }
    return positions;
  }

  // Lazy viem client. When a config-supplied `polygonRpcUrl` is present
  // we use it; otherwise viem falls back to its bundled default Polygon
  // public RPC. Tests can inject `deps.viemClient` to bypass network.
  private getViemClient(): PublicClient {
    if (this.injectedClient) {
      return this.injectedClient;
    }
    if (!this.cachedClient) {
      this.cachedClient = createPublicClient({
        chain: polygon,
        transport: http(this.config.polygonRpcUrl)
      });
    }
    return this.cachedClient;
  }

  private getRelayerStatusClient(): RelayerStatusClient {
    if (this.injectedRelayer) {
      return this.injectedRelayer;
    }
    if (!this.cachedRelayerStatus) {
      // RelayClient with empty signer + relayer URL is sufficient for
      // status reads (`getDeployed` is a non-authenticated GET). For
      // 3a.1 we don't materially deploy from the server (see method
      // comment); 3a.5 will bring a configured relayerUrl when we
      // actually wire deploy.
      const relayer = new RelayClient("", this.config.chainId);
      this.cachedRelayerStatus = relayer as unknown as RelayerStatusClient;
    }
    return this.cachedRelayerStatus;
  }

  private async getClobClient(
    safeAddress: `0x${string}`,
    sessionSigner: SessionSigner
  ): Promise<ClobClient> {
    const cached = this.clobClientCache.get(safeAddress);
    if (cached) {
      return cached;
    }

    if (!this.config.builderAttribution) {
      throw new Error("builder attribution missing");
    }
    const privateKey = this.config.privySessionSignerPrivateKey;
    if (!privateKey) {
      throw new Error("PRIVY_SESSION_SIGNER_PRIVATE_KEY missing");
    }

    // sessionSigner is currently only an opaque tag carried by the
    // dispatcher (kept for forward compatibility). The actual signing
    // material is the env-supplied key. 3a.5 will swap to a per-user
    // KMS-backed signer keyed by `sessionSigner.id`.
    void sessionSigner;

    const promise = this.clobClientFactory({
      safeAddress,
      builderAttribution: this.config.builderAttribution,
      config: this.config,
      privateKey
    });
    this.clobClientCache.set(safeAddress, promise);
    try {
      return await promise;
    } catch (error) {
      // Don't poison the cache on init failure — next attempt should
      // re-try a fresh init.
      this.clobClientCache.delete(safeAddress);
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function failedResult(message: string): OrderResult {
  return {
    orderId: "",
    status: "rejected",
    filledNotionalUsd: "0.00",
    avgPrice: null,
    errorMessage: message
  };
}

function validateOrderRequest(order: OrderRequest): string | null {
  if (!order.tokenId || typeof order.tokenId !== "string") {
    return `missing tokenId`;
  }
  if (order.side !== "BUY" && order.side !== "SELL") {
    return `invalid side "${String(order.side)}"`;
  }
  if (!Number.isFinite(order.price) || order.price <= 0 || order.price >= 1) {
    return `invalid price ${order.price} (must be 0 < p < 1)`;
  }
  const notional = Number(order.notionalUsd);
  if (!Number.isFinite(notional) || notional <= 0) {
    return `invalid notionalUsd "${order.notionalUsd}"`;
  }
  return null;
}

function classifyOrderError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("429")) {
    return `placeOrder: rate_limit — ${message}`;
  }
  if (lower.includes("signature")) {
    return `placeOrder: signature_invalid — ${message}`;
  }
  if (lower.includes("insufficient") || lower.includes("balance")) {
    return `placeOrder: insufficient_balance — ${message}`;
  }
  if (lower.includes("network") || lower.includes("timeout")) {
    return `placeOrder: network — ${message}`;
  }
  return `placeOrder: unknown — ${message}`;
}

function mapOrderResponse(response: unknown, order: OrderRequest): OrderResult {
  const r = (response ?? {}) as {
    success?: boolean;
    orderID?: string;
    orderId?: string;
    takingAmount?: string | number;
    makingAmount?: string | number;
    status?: string;
    errorMsg?: string;
  };

  const orderId = r.orderID ?? r.orderId ?? null;
  const success = Boolean(r.success ?? orderId);

  if (!success) {
    return failedResult(
      `placeOrder: clob rejected — ${r.errorMsg ?? r.status ?? "no orderID"}`
    );
  }

  const taking = Number(r.takingAmount ?? 0);
  const making = Number(r.makingAmount ?? 0);

  // BUY: making = USDC, taking = shares.  SELL: opposite.
  let avgPrice: number | null = null;
  let filledNotional = 0;
  if (order.side === "BUY") {
    if (making > 0 && taking > 0) {
      avgPrice = making / taking;
    } else {
      avgPrice = order.price;
    }
    filledNotional = making > 0 ? making : Number(order.notionalUsd);
  } else {
    if (making > 0 && taking > 0) {
      avgPrice = taking / making;
    } else {
      avgPrice = order.price;
    }
    filledNotional = taking > 0 ? taking : Number(order.notionalUsd) * order.price;
  }

  return {
    orderId: orderId ?? "",
    status: "filled",
    filledNotionalUsd: filledNotional.toFixed(2),
    avgPrice
  };
}

// Default factory: build a real ClobClient pointing at the user Safe as
// `funderAddress`, signed by the env-supplied session signer key, with
// Raven's builder code stamped via `builderConfig`. This is the only
// place that ever instantiates ClobClient with real creds.
const defaultClobClientFactory: ClobClientFactory = async ({
  safeAddress,
  builderAttribution,
  config,
  privateKey
}) => {
  const signer = new Wallet(privateKey);
  const boot = new ClobClient({
    host: config.polymarketHost,
    chain: config.chainId as Chain,
    signer
  });
  // Derive (or create) the L2 API creds for this signer. Polymarket
  // ties API keys to the signing address, so each managed wallet gets
  // its own derived creds — that's expected and idempotent.
  const creds = await (
    boot as unknown as {
      createOrDeriveApiKey: () => Promise<{
        key: string;
        secret: string;
        passphrase: string;
      }>;
    }
  ).createOrDeriveApiKey();

  return new ClobClient({
    host: config.polymarketHost,
    chain: config.chainId as Chain,
    signer,
    creds,
    signatureType: SIG_TYPE_POLY_GNOSIS_SAFE,
    funderAddress: safeAddress,
    builderConfig: { builderCode: builderAttribution.code }
  });
};
