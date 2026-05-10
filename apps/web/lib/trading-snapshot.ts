import type { OverviewResponse, PublicPosition } from "@autopoly/contracts";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEquityHistory, type EquitySnapshot } from "./equity-history";
import {
  getPublicOverviewData,
  getPublicPositionsData,
  getSpectatorActivityData,
  getSpectatorClosedPositionsData,
  type SpectatorActivityEvent,
  type SpectatorClosedPosition
} from "./public-wallet";

export type SnapshotTradeAction = "BUY" | "SELL";

export interface TradingSnapshotTrade {
  timestamp: string;
  ticker: string;
  title: string;
  category: string | null;
  action: SnapshotTradeAction;
  side: string;
  shares: number;
  price: number;
  cost: number;
  hours_to_close: number | null;
  close_time: string;
  model: string | null;
  model_confidence: number | null;
  rationale: string | null;
  market_pnl: number | null;
  market_outcome: string | null;
  market_position: string | null;
  fee?: number | null;
}

export interface TradingSnapshotSummary {
  agent: string;
  venue: string;
  valuation: string;
  starting_capital: number;
  ending_nav: number;
  net_pnl: number;
  roi_pct: number;
  sharpe_daily: number | null;
  mean_daily_return_pct?: number;
  daily_volatility_pct?: number;
  max_drawdown_pct: number;
  calendar_days?: number;
  days_traded?: number;
  trading_days?: number;
  n_trades: number;
  n_markets: number;
  n_settled: number;
  n_open: number;
  n_won: number;
  n_lost: number;
  win_rate_pct: number | null;
  peak_deployed_dollars?: number;
  peak_deployed_ts?: string;
  forecaster_brier?: number;
  market_brier?: number;
  bregman_divergence?: number;
  filters: string[];
  first_trade: string;
  last_trade: string;
  score_differential?: number;
}

export interface TradingSnapshotData {
  summary: TradingSnapshotSummary;
  trades: TradingSnapshotTrade[];
  nav_series: Array<[string, number]>;
}

interface PulsePositionReview {
  token_id: string;
  market_slug: string;
  outcome_label: string;
  action: string;
  ai_prob: number | null;
  market_prob: number | null;
  edge: number | null;
  confidence: string | null;
  thesis_md: string | null;
  generated_at_utc: string;
}

interface PulsePositionReviewFile {
  generated_at_utc: string;
  reviews: PulsePositionReview[];
}

interface TradingSnapshotConfig {
  starting_capital_usd?: number;
}

interface MarketMetrics {
  title: string;
  eventSlug: string;
  outcomeLabels: Set<string>;
  realizedPnl: number;
  openPnl: number;
  hasOpen: boolean;
  hasClosed: boolean;
  resolvedOutcome: string | null;
  closeTime: string;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeTimestamp(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function daysBetween(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return 0;
  }
  return Math.max(1, Math.ceil((endMs - startMs) / 86_400_000) + 1);
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStartingCapital(equityHistory: EquitySnapshot[], config: TradingSnapshotConfig | null): number {
  const configured = Number(process.env.INITIAL_BANKROLL_USD ?? 0);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  if (typeof config?.starting_capital_usd === "number" && config.starting_capital_usd > 0) {
    return config.starting_capital_usd;
  }

  const firstPositive = equityHistory.find((point) => point.total_equity_usd > 0);
  return roundCurrency(firstPositive?.total_equity_usd ?? 0);
}

function buildNavSeries(equityHistory: EquitySnapshot[], overview: OverviewResponse): Array<[string, number]> {
  const points = new Map<string, number>();

  for (const point of equityHistory) {
    if (point.timestamp && Number.isFinite(point.total_equity_usd)) {
      points.set(safeTimestamp(point.timestamp, point.timestamp), roundCurrency(point.total_equity_usd));
    }
  }

  const now = overview.last_run_at ?? new Date().toISOString();
  points.set(safeTimestamp(now, new Date().toISOString()), roundCurrency(overview.total_equity_usd));

  return Array.from(points.entries()).sort((left, right) => Date.parse(left[0]) - Date.parse(right[0]));
}

function computeReturnStats(navSeries: Array<[string, number]>) {
  const returns: number[] = [];
  let peak = 0;
  let maxDrawdown = 0;
  let peakDeployedTs: string | undefined;

  for (let index = 0; index < navSeries.length; index += 1) {
    const [timestamp, nav] = navSeries[index]!;
    if (nav > peak) {
      peak = nav;
      peakDeployedTs = timestamp;
    }

    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, (peak - nav) / peak);
    }

    if (index === 0) {
      continue;
    }

    const previous = navSeries[index - 1]![1];
    if (previous > 0) {
      returns.push((nav - previous) / previous);
    }
  }

  if (returns.length === 0) {
    return {
      sharpeDaily: null,
      meanDailyReturnPct: undefined,
      dailyVolatilityPct: undefined,
      maxDrawdownPct: roundMetric(maxDrawdown * 100),
      peakNav: roundCurrency(peak),
      peakNavTs: peakDeployedTs
    };
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  return {
    sharpeDaily: volatility > 0 ? roundMetric((mean / volatility) * Math.sqrt(365)) : null,
    meanDailyReturnPct: roundMetric(mean * 100),
    dailyVolatilityPct: roundMetric(volatility * 100),
    maxDrawdownPct: roundMetric(maxDrawdown * 100),
    peakNav: roundCurrency(peak),
    peakNavTs: peakDeployedTs
  };
}

function groupReviewsByToken(reviewFile: PulsePositionReviewFile | null): Map<string, PulsePositionReview> {
  const byToken = new Map<string, PulsePositionReview>();
  for (const review of reviewFile?.reviews ?? []) {
    if (review.token_id) {
      byToken.set(review.token_id, review);
    }
  }
  return byToken;
}

async function loadPulsePositionReviews(): Promise<PulsePositionReviewFile | null> {
  const filePath = path.join(process.cwd(), "public", "pulse-position-review.json");
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as PulsePositionReviewFile;
  } catch {
    return null;
  }
}

async function loadTradingSnapshotConfig(): Promise<TradingSnapshotConfig | null> {
  const filePath = path.join(process.cwd(), "public", "trading-snapshot-config.json");
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as TradingSnapshotConfig;
  } catch {
    return null;
  }
}

function ensureMarket(metrics: Map<string, MarketMetrics>, slug: string): MarketMetrics {
  const current = metrics.get(slug);
  if (current) {
    return current;
  }

  const next: MarketMetrics = {
    title: titleFromSlug(slug),
    eventSlug: slug,
    outcomeLabels: new Set(),
    realizedPnl: 0,
    openPnl: 0,
    hasOpen: false,
    hasClosed: false,
    resolvedOutcome: null,
    closeTime: new Date().toISOString()
  };
  metrics.set(slug, next);
  return next;
}

function buildMarketMetrics(
  positions: PublicPosition[],
  closedPositions: SpectatorClosedPosition[],
  activities: SpectatorActivityEvent[]
): Map<string, MarketMetrics> {
  const metrics = new Map<string, MarketMetrics>();

  for (const activity of activities) {
    if (activity.type !== "TRADE") {
      continue;
    }

    const metric = ensureMarket(metrics, activity.market_slug);
    metric.title = activity.title || metric.title;
    metric.eventSlug = activity.event_slug || metric.eventSlug;
    metric.outcomeLabels.add(activity.outcome_label);
    metric.closeTime = safeTimestamp(activity.timestamp_utc, metric.closeTime);
  }

  for (const position of positions) {
    const metric = ensureMarket(metrics, position.market_slug);
    metric.eventSlug = position.event_slug || metric.eventSlug;
    metric.outcomeLabels.add(position.outcome_label);
    metric.openPnl += (position.current_value_usd - (position.size * position.avg_cost));
    metric.hasOpen = true;
    metric.closeTime = safeTimestamp(position.updated_at, metric.closeTime);
  }

  for (const position of closedPositions) {
    const metric = ensureMarket(metrics, position.market_slug);
    metric.eventSlug = position.event_slug || metric.eventSlug;
    metric.outcomeLabels.add(position.outcome_label);
    metric.realizedPnl += position.realized_pnl_usd;
    metric.hasClosed = true;
    metric.resolvedOutcome = position.outcome_label;
    metric.closeTime = safeTimestamp(position.closed_at, metric.closeTime);
  }

  for (const metric of metrics.values()) {
    if (!metric.hasOpen && !metric.hasClosed) {
      metric.hasClosed = true;
    }
  }

  return metrics;
}

function marketPosition(metric: MarketMetrics | undefined): string | null {
  if (!metric) {
    return null;
  }
  if (metric.hasOpen) {
    return "open";
  }
  if (metric.hasClosed) {
    return "closed";
  }
  return null;
}

function marketOutcome(metric: MarketMetrics | undefined): string | null {
  if (!metric || metric.hasOpen) {
    return null;
  }
  return metric.resolvedOutcome;
}

function marketPnl(metric: MarketMetrics | undefined): number | null {
  if (!metric) {
    return null;
  }
  return roundCurrency(metric.realizedPnl + metric.openPnl);
}

function buildTradeRecords(
  activities: SpectatorActivityEvent[],
  metrics: Map<string, MarketMetrics>,
  reviewsByToken: Map<string, PulsePositionReview>
): TradingSnapshotTrade[] {
  return activities
    .filter((activity) => activity.type === "TRADE" && (activity.side === "BUY" || activity.side === "SELL"))
    .map((activity) => {
      const action = activity.side === "SELL" ? "SELL" : "BUY";
      const metric = metrics.get(activity.market_slug);
      const review = reviewsByToken.get(activity.token_id);
      const rationale = review?.thesis_md
        ?? [
          "Public Polymarket fill imported from the wallet activity feed.",
          "No bundled Pulse rationale artifact was found for this token."
        ].join(" ");

      return {
        timestamp: safeTimestamp(activity.timestamp_utc, new Date().toISOString()),
        ticker: activity.market_slug,
        title: activity.title || metric?.title || titleFromSlug(activity.market_slug),
        category: activity.event_slug || metric?.eventSlug || null,
        action,
        side: activity.outcome_label || "N/A",
        shares: finiteNumber(activity.share_size),
        price: finiteNumber(activity.price),
        cost: roundCurrency(finiteNumber(activity.usdc_size)),
        hours_to_close: null,
        close_time: metric?.closeTime ?? activity.timestamp_utc,
        model: review ? `Pulse position review · ${review.confidence ?? "unrated"}` : "Polymarket public activity",
        model_confidence: review?.ai_prob ?? null,
        rationale,
        market_pnl: marketPnl(metric),
        market_outcome: marketOutcome(metric),
        market_position: marketPosition(metric),
        fee: 0
      } satisfies TradingSnapshotTrade;
    })
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
}

function buildSummary(input: {
  overview: OverviewResponse;
  positions: PublicPosition[];
  closedPositions: SpectatorClosedPosition[];
  trades: TradingSnapshotTrade[];
  navSeries: Array<[string, number]>;
  equityHistory: EquitySnapshot[];
  pulseReviewGeneratedAt: string | null;
  snapshotConfig: TradingSnapshotConfig | null;
}): TradingSnapshotSummary {
  const { overview, positions, closedPositions, trades, navSeries, equityHistory, pulseReviewGeneratedAt, snapshotConfig } = input;
  const startingCapital = getStartingCapital(equityHistory, snapshotConfig);
  const endingNav = roundCurrency(overview.total_equity_usd);
  const netPnl = roundCurrency(endingNav - startingCapital);
  const roiPct = startingCapital > 0 ? roundMetric((netPnl / startingCapital) * 100) : 0;
  const firstTrade = trades[0]?.timestamp ?? navSeries[0]?.[0] ?? new Date().toISOString();
  const lastTrade = overview.last_run_at ?? trades[trades.length - 1]?.timestamp ?? navSeries[navSeries.length - 1]?.[0] ?? firstTrade;
  const uniqueTradeMarkets = new Set(trades.map((trade) => trade.ticker));
  const openMarkets = new Set(positions.map((position) => position.market_slug));
  const closedMarkets = new Set(closedPositions.map((position) => position.market_slug));
  const settledClosed = closedPositions.filter((position) => !openMarkets.has(position.market_slug));
  const won = settledClosed.filter((position) => position.realized_pnl_usd > 0).length;
  const lost = settledClosed.filter((position) => position.realized_pnl_usd < 0).length;
  const stats = computeReturnStats(navSeries);
  const peakDeployed = equityHistory.reduce(
    (current, point) => point.positions_value_usd > current.value ? { value: point.positions_value_usd, timestamp: point.timestamp } : current,
    { value: positions.reduce((sum, position) => sum + position.current_value_usd, 0), timestamp: lastTrade }
  );

  return {
    agent: pulseReviewGeneratedAt
      ? `Pulse position review (${pulseReviewGeneratedAt.slice(0, 10)})`
      : "Polymarket public wallet adapter",
    venue: "Polymarket",
    valuation: "Public wallet activity + live open-position marks",
    starting_capital: roundCurrency(startingCapital),
    ending_nav: endingNav,
    net_pnl: netPnl,
    roi_pct: roiPct,
    sharpe_daily: stats.sharpeDaily,
    mean_daily_return_pct: stats.meanDailyReturnPct,
    daily_volatility_pct: stats.dailyVolatilityPct,
    max_drawdown_pct: stats.maxDrawdownPct,
    calendar_days: daysBetween(firstTrade, lastTrade),
    days_traded: new Set(trades.map((trade) => trade.timestamp.slice(0, 10))).size,
    trading_days: new Set(trades.map((trade) => trade.timestamp.slice(0, 10))).size,
    n_trades: trades.length,
    n_markets: new Set([...uniqueTradeMarkets, ...openMarkets, ...closedMarkets]).size,
    n_settled: settledClosed.length,
    n_open: openMarkets.size,
    n_won: won,
    n_lost: lost,
    win_rate_pct: settledClosed.length > 0 ? roundMetric((won / settledClosed.length) * 100) : null,
    peak_deployed_dollars: roundCurrency(peakDeployed.value),
    peak_deployed_ts: peakDeployed.timestamp,
    filters: [
      "Public-wallet mode: positions, trades, closed positions, and activity are read from Polymarket public endpoints.",
      "Starting capital comes from INITIAL_BANKROLL_USD when present, otherwise the bundled Pizza snapshot config.",
      "NAV = visible collateral cash + current open-position marks; bridge deposits/withdrawals are not fully reconstructable from public data.",
      "Rationale uses bundled Pulse position-review output when a token match exists; otherwise the row is marked as public wallet activity.",
      "This dashboard is read-only and does not place orders."
    ],
    first_trade: firstTrade,
    last_trade: lastTrade
  };
}

export async function getTradingSnapshotData(): Promise<TradingSnapshotData> {
  const [overview, positions, closedPositions, activities, equityHistory, pulseReviews, snapshotConfig] = await Promise.all([
    getPublicOverviewData(),
    getPublicPositionsData(),
    getSpectatorClosedPositionsData(),
    getSpectatorActivityData(),
    loadEquityHistory(),
    loadPulsePositionReviews(),
    loadTradingSnapshotConfig()
  ]);

  const marketMetrics = buildMarketMetrics(positions, closedPositions, activities);
  const trades = buildTradeRecords(activities, marketMetrics, groupReviewsByToken(pulseReviews));
  const navSeries = buildNavSeries(equityHistory, overview);

  return {
    summary: buildSummary({
      overview,
      positions,
      closedPositions,
      trades,
      navSeries,
      equityHistory,
      pulseReviewGeneratedAt: pulseReviews?.generated_at_utc ?? null,
      snapshotConfig
    }),
    trades,
    nav_series: navSeries
  };
}
