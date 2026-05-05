import type { OverviewResponse, PublicArtifactListItem, PublicPosition, PublicRunSummary, PublicTrade } from "@autopoly/contracts";
import { getOverview, getPublicPositions, getPublicRuns, getPublicTrades, getReports } from "@autopoly/db";

const DATA_API_BASE = "https://data-api.polymarket.com";
const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const DEFAULT_STOP_LOSS_PCT = 0.3;
const DEFAULT_ACTIVITY_LIMIT = 200;

interface PolymarketProfileResponse {
  createdAt?: string;
  proxyWallet?: string;
  displayUsernamePublic?: boolean;
  bio?: string;
  pseudonym?: string;
  name?: string;
}

interface PolymarketPositionRow {
  asset?: string;
  size?: number;
  avgPrice?: number;
  currentValue?: number;
  cashPnl?: number;
  percentPnl?: number;
  curPrice?: number;
  title?: string;
  slug?: string;
  eventSlug?: string;
  outcome?: string;
  endDate?: string;
}

interface PolymarketClosedPositionRow {
  asset?: string;
  realizedPnl?: number;
  avgPrice?: number;
  totalBought?: number;
  curPrice?: number;
  title?: string;
  slug?: string;
  eventSlug?: string;
  outcome?: string;
  timestamp?: number;
}

interface PolymarketActivityRow {
  type?: string;
  side?: string;
  asset?: string;
  size?: number;
  usdcSize?: number;
  price?: number;
  timestamp?: number;
  transactionHash?: string;
  title?: string;
  slug?: string;
  eventSlug?: string;
  outcome?: string;
}

export interface SpectatorProfile {
  address: string;
  display_name: string;
  pseudonym: string | null;
  bio: string | null;
  created_at: string | null;
  profile_url: string;
  display_username_public: boolean;
}

export interface SpectatorClosedPosition {
  id: string;
  token_id: string;
  market_slug: string;
  event_slug: string;
  outcome_label: string;
  realized_pnl_usd: number;
  avg_cost: number;
  exit_price: number;
  total_bought: number;
  closed_at: string;
}

export interface SpectatorActivityEvent {
  id: string;
  type: string;
  side: "BUY" | "SELL" | null;
  direction: "IN" | "OUT" | "INFO";
  token_id: string;
  market_slug: string;
  event_slug: string;
  outcome_label: string;
  title: string;
  share_size: number;
  usdc_size: number;
  price: number | null;
  transaction_hash: string | null;
  timestamp_utc: string;
}

interface SpectatorCashBalance {
  cashBalanceUsd: number;
  source: "reported" | "onchain" | "unavailable";
}

function resolveSpectatorWalletCandidate(): string {
  return (
    process.env.POLYMARKET_PUBLIC_WALLET_ADDRESS?.trim()
    || process.env.NEXT_PUBLIC_POLYMARKET_PUBLIC_WALLET_ADDRESS?.trim()
    || ""
  );
}

export function getSpectatorWalletAddress(): string | null {
  const value = resolveSpectatorWalletCandidate();
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? value : null;
}

export function isSpectatorWalletMode(): boolean {
  return Boolean(getSpectatorWalletAddress());
}

export function buildPolymarketProfileUrl(address: string): string {
  return `https://polymarket.com/profile/${address}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "@autopoly/web"
    }
  });

  if (!response.ok) {
    throw new Error(`request failed (${response.status}) for ${url}`);
  }

  return await response.json() as T;
}

function toIsoTimestamp(value: number | string | null | undefined): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function safeSlug(primary: string | undefined, fallback: string | undefined, defaultValue: string): string {
  if (typeof primary === "string" && primary.trim()) {
    return primary;
  }
  if (typeof fallback === "string" && fallback.trim()) {
    return fallback;
  }
  return defaultValue;
}

function groupTradeTimesByToken(activities: SpectatorActivityEvent[]) {
  const index = new Map<string, { openedAt: string; updatedAt: string }>();

  for (const activity of activities) {
    const current = index.get(activity.token_id);
    if (!current) {
      index.set(activity.token_id, {
        openedAt: activity.timestamp_utc,
        updatedAt: activity.timestamp_utc
      });
      continue;
    }

    if (new Date(activity.timestamp_utc).getTime() < new Date(current.openedAt).getTime()) {
      current.openedAt = activity.timestamp_utc;
    }
    if (new Date(activity.timestamp_utc).getTime() > new Date(current.updatedAt).getTime()) {
      current.updatedAt = activity.timestamp_utc;
    }
  }

  return index;
}

function mapPolymarketActivity(row: PolymarketActivityRow): SpectatorActivityEvent {
  const side = row.side === "BUY" || row.side === "SELL" ? row.side : null;
  const type = typeof row.type === "string" ? row.type : "INFO";
  const usdcSize = Number(row.usdcSize ?? 0);
  const direction = type === "REDEEM"
    ? "IN"
    : side === "BUY"
      ? "OUT"
      : side === "SELL"
        ? "IN"
        : "INFO";

  const timestampUtc = toIsoTimestamp(row.timestamp);
  const tokenId = typeof row.asset === "string" ? row.asset : "";
  const marketSlug = safeSlug(row.slug, row.eventSlug, tokenId || "unknown-market");
  const eventSlug = safeSlug(row.eventSlug, row.slug, marketSlug);

  return {
    id: row.transactionHash ?? `${type.toLowerCase()}-${tokenId}-${timestampUtc}`,
    type,
    side,
    direction,
    token_id: tokenId,
    market_slug: marketSlug,
    event_slug: eventSlug,
    outcome_label: typeof row.outcome === "string" && row.outcome.trim() ? row.outcome : "N/A",
    title: typeof row.title === "string" && row.title.trim() ? row.title : marketSlug,
    share_size: Number(row.size ?? 0),
    usdc_size: Number.isFinite(usdcSize) ? usdcSize : 0,
    price: Number.isFinite(Number(row.price)) ? Number(row.price) : null,
    transaction_hash: typeof row.transactionHash === "string" ? row.transactionHash : null,
    timestamp_utc: timestampUtc
  };
}

function parseHexToUsd(value: unknown): number | null {
  if (typeof value !== "string" || !value.startsWith("0x")) {
    return null;
  }
  try {
    return Number(BigInt(value)) / 1e6;
  } catch {
    return null;
  }
}

async function fetchReportedCollateralBalance(address: string): Promise<number | null> {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  const configuredFunderAddress = (
    process.env.FUNDER_ADDRESS?.trim()
    || process.env.ADDRESS?.trim()
    || process.env.WALLET_ADDRESS?.trim()
    || process.env.EVM_ADDRESS?.trim()
    || address
  );

  if (!privateKey || configuredFunderAddress.toLowerCase() !== address.toLowerCase()) {
    return null;
  }

  try {
    const { getCollateralBalanceAllowance } = await import("../../../services/executor/src/lib/polymarket-sdk");
    const balance = await getCollateralBalanceAllowance({
      port: Number(process.env.PORT ?? 4002),
      redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
      envFilePath: null,
      privateKey,
      funderAddress: configuredFunderAddress,
      signatureType: Number(process.env.SIGNATURE_TYPE ?? 1),
      polymarketHost: process.env.POLYMARKET_HOST ?? "https://clob.polymarket.com",
      chainId: Number(process.env.CHAIN_ID ?? 137),
      defaultOrderType: "FOK",
      drawdownStopPct: Number(process.env.DRAWDOWN_STOP_PCT ?? 0.2),
      positionStopLossPct: Number(process.env.POSITION_STOP_LOSS_PCT ?? 0.3),
      initialBankrollUsd: Number(process.env.INITIAL_BANKROLL_USD ?? 0),
      builderAttribution: null
    });
    const parsed = Number((balance as { balance?: unknown } | null)?.balance ?? Number.NaN);
    return Number.isFinite(parsed) ? parsed / 1e6 : null;
  } catch {
    return null;
  }
}

async function fetchOnchainUsdcBalance(address: string): Promise<number | null> {
  if (!address) {
    return null;
  }

  const rpcUrl = process.env.POLYGON_RPC_URL?.trim() || "https://polygon-bor-rpc.publicnode.com";
  // Post-V2 (2026-04-28) Polymarket collateral is pUSD (0xC011a7E1...), not USDC.e.
  // POLYGON_PUSD_CONTRACT is the preferred override; POLYGON_USDC_CONTRACT remains for backward compatibility.
  const usdcContract =
    process.env.POLYGON_PUSD_CONTRACT?.trim()
    || process.env.POLYGON_USDC_CONTRACT?.trim()
    || "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";
  const normalized = address.toLowerCase().replace(/^0x/, "");

  if (normalized.length !== 40) {
    return null;
  }

  const data = `0x70a08231${normalized.padStart(64, "0")}`;

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: usdcContract, data }, "latest"]
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`rpc status ${response.status}`);
    }

    const payload = await response.json() as { result?: unknown; error?: { message?: string } };
    if (payload.error) {
      throw new Error(payload.error.message ?? "rpc returned error");
    }

    return parseHexToUsd(payload.result);
  } catch {
    return null;
  }
}

async function resolveSpectatorCashBalance(address: string): Promise<SpectatorCashBalance> {
  const [reportedBalanceUsd, onchainBalanceUsd] = await Promise.all([
    fetchReportedCollateralBalance(address),
    fetchOnchainUsdcBalance(address)
  ]);

  if ((reportedBalanceUsd ?? 0) > 0) {
    return {
      cashBalanceUsd: reportedBalanceUsd ?? 0,
      source: "reported"
    };
  }

  if ((onchainBalanceUsd ?? 0) > 0) {
    return {
      cashBalanceUsd: onchainBalanceUsd ?? 0,
      source: "onchain"
    };
  }

  if (reportedBalanceUsd != null) {
    return {
      cashBalanceUsd: reportedBalanceUsd,
      source: "reported"
    };
  }

  if (onchainBalanceUsd != null) {
    return {
      cashBalanceUsd: onchainBalanceUsd,
      source: "onchain"
    };
  }

  return {
    cashBalanceUsd: 0,
    source: "unavailable"
  };
}

async function fetchPolymarketProfile(address: string): Promise<SpectatorProfile | null> {
  try {
    const payload = await fetchJson<PolymarketProfileResponse>(`${GAMMA_API_BASE}/public-profile?address=${address}`);
    return {
      address,
      display_name: payload.name?.trim() || payload.pseudonym?.trim() || address,
      pseudonym: payload.pseudonym?.trim() || null,
      bio: payload.bio?.trim() || null,
      created_at: payload.createdAt?.trim() || null,
      profile_url: buildPolymarketProfileUrl(address),
      display_username_public: Boolean(payload.displayUsernamePublic)
    };
  } catch {
    return {
      address,
      display_name: address,
      pseudonym: null,
      bio: null,
      created_at: null,
      profile_url: buildPolymarketProfileUrl(address),
      display_username_public: false
    };
  }
}

async function fetchPolymarketOpenPositions(address: string): Promise<PolymarketPositionRow[]> {
  try {
    return await fetchJson<PolymarketPositionRow[]>(
      `${DATA_API_BASE}/positions?user=${address}&sizeThreshold=.1`
    );
  } catch {
    return [];
  }
}

async function fetchPolymarketClosedPositions(address: string): Promise<PolymarketClosedPositionRow[]> {
  try {
    return await fetchJson<PolymarketClosedPositionRow[]>(
      `${DATA_API_BASE}/closed-positions?user=${address}`
    );
  } catch {
    return [];
  }
}

async function fetchPolymarketActivity(address: string, limit = DEFAULT_ACTIVITY_LIMIT): Promise<SpectatorActivityEvent[]> {
  try {
    const rows = await fetchJson<PolymarketActivityRow[]>(
      `${DATA_API_BASE}/activity?user=${address}&limit=${Math.max(1, Math.min(limit, 500))}`
    );
    return rows.map(mapPolymarketActivity);
  } catch {
    return [];
  }
}

function mapOpenPositions(
  rows: PolymarketPositionRow[],
  activities: SpectatorActivityEvent[]
): PublicPosition[] {
  const tradeTimes = groupTradeTimesByToken(activities.filter((activity) => activity.type === "TRADE"));

  return rows
    .map((row) => {
      const tokenId = typeof row.asset === "string" ? row.asset : "";
      const timeline = tradeTimes.get(tokenId);
      const marketSlug = safeSlug(row.slug, row.eventSlug, tokenId || "unknown-market");
      const eventSlug = safeSlug(row.eventSlug, row.slug, marketSlug);
      const currentValueUsd = Number(row.currentValue ?? 0);
      const avgCost = Number(row.avgPrice ?? 0);
      const currentPrice = Number(row.curPrice ?? 0);
      const size = Number(row.size ?? 0);
      const unrealizedPnlPct = Number(row.percentPnl ?? 0) / 100;

      return {
        id: tokenId || `${marketSlug}-${row.outcome ?? "unknown"}`,
        event_slug: eventSlug,
        market_slug: marketSlug,
        token_id: tokenId,
        side: "BUY",
        outcome_label: typeof row.outcome === "string" && row.outcome.trim() ? row.outcome : "N/A",
        size,
        avg_cost: avgCost,
        current_price: currentPrice,
        current_value_usd: currentValueUsd,
        unrealized_pnl_pct: Number.isFinite(unrealizedPnlPct) ? unrealizedPnlPct : 0,
        stop_loss_pct: DEFAULT_STOP_LOSS_PCT,
        opened_at: timeline?.openedAt ?? toIsoTimestamp(row.endDate),
        updated_at: timeline?.updatedAt ?? new Date().toISOString()
      } satisfies PublicPosition;
    })
    .filter((row) => row.token_id && row.size > 0);
}

function mapTradeActivity(activities: SpectatorActivityEvent[]): PublicTrade[] {
  return activities
    .filter((activity) => activity.type === "TRADE" && activity.side)
    .map((activity) => ({
      id: activity.id,
      market_slug: activity.market_slug,
      token_id: activity.token_id,
      status: "filled",
      side: activity.side as "BUY" | "SELL",
      requested_notional_usd: activity.usdc_size,
      filled_notional_usd: activity.usdc_size,
      avg_price: activity.price,
      order_id: activity.transaction_hash,
      timestamp_utc: activity.timestamp_utc
    }));
}

function mapClosedPositions(rows: PolymarketClosedPositionRow[]): SpectatorClosedPosition[] {
  return rows
    .map((row) => {
      const tokenId = typeof row.asset === "string" ? row.asset : "";
      const marketSlug = safeSlug(row.slug, row.eventSlug, tokenId || "closed-market");
      const eventSlug = safeSlug(row.eventSlug, row.slug, marketSlug);

      return {
        id: `${tokenId || marketSlug}-${row.timestamp ?? "closed"}`,
        token_id: tokenId,
        market_slug: marketSlug,
        event_slug: eventSlug,
        outcome_label: typeof row.outcome === "string" && row.outcome.trim() ? row.outcome : "N/A",
        realized_pnl_usd: Number(row.realizedPnl ?? 0),
        avg_cost: Number(row.avgPrice ?? 0),
        exit_price: Number(row.curPrice ?? 0),
        total_bought: Number(row.totalBought ?? 0),
        closed_at: toIsoTimestamp(row.timestamp)
      } satisfies SpectatorClosedPosition;
    })
    .filter((row) => row.market_slug.length > 0);
}

function buildSpectatorOverview(
  positions: PublicPosition[],
  activities: SpectatorActivityEvent[],
  closedPositions: SpectatorClosedPosition[],
  cashBalance: SpectatorCashBalance
): OverviewResponse {
  const openMarketValueUsd = positions.reduce((sum, position) => sum + position.current_value_usd, 0);
  const realizedPnlUsd = closedPositions.reduce((sum, position) => sum + position.realized_pnl_usd, 0);
  const lastActivityAt = activities[0]?.timestamp_utc ?? null;
  const snapshotAt = lastActivityAt ?? new Date().toISOString();
  const totalEquityUsd = openMarketValueUsd + cashBalance.cashBalanceUsd;
  const cashSourceLabel = cashBalance.source === "reported"
    ? "Polymarket collateral 余额"
    : cashBalance.source === "onchain"
      ? "链上 USDC"
      : "公开数据不可得";

  return {
    status: "running",
    cash_balance_usd: cashBalance.cashBalanceUsd,
    total_equity_usd: totalEquityUsd,
    high_water_mark_usd: totalEquityUsd,
    drawdown_pct: 0,
    open_positions: positions.length,
    last_run_at: lastActivityAt,
    latest_risk_event: [
      "当前是公开地址围观模式。",
      `现金来源：${cashSourceLabel}。`,
      "Bridge 入金和出金历史仍然不是完整公开数据。",
      `已平仓已实现盈亏：${realizedPnlUsd.toFixed(2)} USD。`
    ].join(" "),
    equity_curve: [
      {
        timestamp: snapshotAt,
        total_equity_usd: totalEquityUsd,
        drawdown_pct: 0
      }
    ]
  };
}

export async function getPublicOverviewData(): Promise<OverviewResponse> {
  const address = getSpectatorWalletAddress();
  if (!address) {
    return await getOverview();
  }

  const [activities, positions, closedPositions, cashBalance] = await Promise.all([
    fetchPolymarketActivity(address),
    getPublicPositionsData(),
    getSpectatorClosedPositionsData(),
    resolveSpectatorCashBalance(address)
  ]);

  return buildSpectatorOverview(positions, activities, closedPositions, cashBalance);
}

export async function getPublicPositionsData(): Promise<PublicPosition[]> {
  const address = getSpectatorWalletAddress();
  if (!address) {
    return await getPublicPositions();
  }

  const [openPositions, activities] = await Promise.all([
    fetchPolymarketOpenPositions(address),
    fetchPolymarketActivity(address)
  ]);

  return mapOpenPositions(openPositions, activities);
}

export async function getPublicTradesData(): Promise<PublicTrade[]> {
  const address = getSpectatorWalletAddress();
  if (!address) {
    return await getPublicTrades();
  }

  const activities = await fetchPolymarketActivity(address);
  return mapTradeActivity(activities);
}

export async function getPublicRunsData(): Promise<PublicRunSummary[]> {
  if (isSpectatorWalletMode()) {
    return [];
  }
  return await getPublicRuns();
}

export async function getReportsData(): Promise<PublicArtifactListItem[]> {
  if (isSpectatorWalletMode()) {
    return [];
  }
  return await getReports();
}

export async function getSpectatorProfileData(): Promise<SpectatorProfile | null> {
  const address = getSpectatorWalletAddress();
  if (!address) {
    return null;
  }
  return await fetchPolymarketProfile(address);
}

export async function getSpectatorActivityData(): Promise<SpectatorActivityEvent[]> {
  const address = getSpectatorWalletAddress();
  if (!address) {
    return [];
  }
  return await fetchPolymarketActivity(address);
}

export async function getSpectatorClosedPositionsData(): Promise<SpectatorClosedPosition[]> {
  const address = getSpectatorWalletAddress();
  if (!address) {
    return [];
  }
  const rows = await fetchPolymarketClosedPositions(address);
  return mapClosedPositions(rows);
}
