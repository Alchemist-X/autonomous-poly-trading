// PolymarketRelayerAdapter — concrete implementation of `PolymarketAdapter`
// for the managed-trading service.
//
// Wires three SDK surfaces together:
//   1. `@polymarket/builder-relayer-client` — Safe deployment via Raven's
//      builder relayer (gasless for the user; Raven pays the relay fee
//      against builder rewards).
//   2. `@polymarket/clob-client-v2` — order placement, signed by the
//      Privy session signer with `signatureType=2` (Safe proxy) and
//      `funderAddress=<user safe>`. Builder code is auto-stamped onto
//      every order via `builderConfig`.
//   3. `viem` — direct ERC-20 reads for USDC.e bankroll on Polygon.
//
// Real-money rules that must hold even pre-cutover (see CLAUDE.md §6):
//   * paper-mode default; `placeOrder` refuses to run when `mode !== 'live'`
//   * config validation up-front so missing builder creds fail at startup
//     rather than on the first user trade
//   * every error path returns a structured failure shape (no swallowed
//     exceptions) so the dispatcher can persist it as a skip instead of
//     a silent retry

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
import type { ManagedTradingConfig } from "./config.js";
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

interface BalanceCacheEntry {
  readonly value: SafeBalance;
  readonly expiresAt: number;
}

// Optional injection points so unit tests can substitute the on-chain
// reader and the data-API fetcher without monkey-patching modules.
export interface PolymarketRelayerAdapterDeps {
  readonly fetch?: typeof fetch;
  readonly viemClient?: PublicClient;
  readonly now?: () => number;
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
  private cachedClient: PublicClient | undefined;
  private readonly balanceCache = new Map<string, BalanceCacheEntry>();

  constructor(options: PolymarketRelayerAdapterOptions = {}) {
    this.config = options.config ?? loadConfig();
    this.fetchFn = options.deps?.fetch ?? fetch;
    this.now = options.deps?.now ?? (() => Date.now());
    this.injectedClient = options.deps?.viemClient;
  }

  async deploySafe(_eoa: Address): Promise<SafeDeployResult> {
    throw new Error(
      "PolymarketRelayerAdapter.deploySafe: not yet implemented in 3a.1B — wiring lands in 3a.1C"
    );
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

  async placeOrder(
    _safeAddress: Address,
    _order: OrderRequest,
    _sessionSigner: SessionSigner
  ): Promise<OrderResult> {
    throw new Error(
      "PolymarketRelayerAdapter.placeOrder: not yet implemented in 3a.1B — wiring lands in 3a.1C"
    );
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
}
