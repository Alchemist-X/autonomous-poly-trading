"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./prophets-profit-snapshot.module.css";

type TradeAction = "BUY" | "SELL";

interface TradeRecord {
  timestamp: string;
  ticker: string;
  title: string;
  category: string | null;
  action: TradeAction;
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

interface SnapshotSummary {
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

interface SnapshotData {
  summary: SnapshotSummary;
  trades: TradeRecord[];
  nav_series: Array<[string, number]>;
}

interface MarketGroup {
  ticker: string;
  title: string;
  category: string | null;
  closeTime: string;
  trades: TradeRecord[];
  netCost: number;
  totalBuyQty: number;
  totalSellQty: number;
  marketPnl: number | null;
  marketOutcome: string | null;
  marketPosition: string | null;
  lastActivity: string;
  rationale: string | null;
  model: string | null;
  modelConfidence: number | null;
}

interface RunningPosition {
  inventory: Record<string, number>;
  cash: number;
}

interface CanvasPoint {
  x: number;
  y: number;
  roi: number;
}

interface ChartSegments {
  positiveLines: string[];
  negativeLines: string[];
  positiveAreas: string[];
  negativeAreas: string[];
}

type FilterKey = "all" | "settled" | "open" | "won" | "lost";
type SortKey = "time" | "pnl" | "cost";
export type SnapshotStyleVariant = "original" | "folio" | "terminal" | "exchange";
type SnapshotContainerElement = "main" | "div";

const POSITIVE = "#22c55e";
const NEGATIVE = "#ef4444";
const VARIANT_CLASS: Record<SnapshotStyleVariant, string> = {
  original: "",
  folio: styles.variantFolio ?? "",
  terminal: styles.variantTerminal ?? "",
  exchange: styles.variantExchange ?? ""
};
const VARIANT_LABEL: Record<SnapshotStyleVariant, string | null> = {
  original: null,
  folio: "Version A · Folio",
  terminal: "Version B · Terminal",
  exchange: "Version C · Exchange"
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function dateKey(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatSignedUsd(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatUsd(Math.abs(value))}`;
}

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return `${new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  })} UTC`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

function firstDefined<T>(values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

function buildMarketGroups(trades: TradeRecord[]): MarketGroup[] {
  const byTicker = new Map<string, TradeRecord[]>();

  for (const trade of trades) {
    const current = byTicker.get(trade.ticker);
    if (current) {
      current.push(trade);
    } else {
      byTicker.set(trade.ticker, [trade]);
    }
  }

  const groups: MarketGroup[] = [];

  byTicker.forEach((items, ticker) => {
    const sorted = [...items].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const last = sorted[sorted.length - 1]!;
    const buys = sorted.filter((trade) => trade.action === "BUY");
    const sells = sorted.filter((trade) => trade.action === "SELL");
    const rationaleTrade = [...sorted].reverse().find((trade) => trade.rationale);

    groups.push({
      ticker,
      title: last.title,
      category: last.category,
      closeTime: last.close_time,
      trades: sorted,
      netCost: sorted.reduce((sum, trade) => sum + (trade.action === "BUY" ? trade.cost : -trade.cost), 0),
      totalBuyQty: buys.reduce((sum, trade) => sum + trade.shares, 0),
      totalSellQty: sells.reduce((sum, trade) => sum + trade.shares, 0),
      marketPnl: firstDefined(sorted.map((trade) => trade.market_pnl)),
      marketOutcome: firstDefined(sorted.map((trade) => trade.market_outcome)),
      marketPosition: firstDefined(sorted.map((trade) => trade.market_position)),
      lastActivity: last.timestamp,
      rationale: rationaleTrade?.rationale ?? null,
      model: firstDefined(sorted.map((trade) => trade.model)),
      modelConfidence: firstDefined(sorted.map((trade) => trade.model_confidence))
    });
  });

  return groups;
}

function isSettled(group: MarketGroup): boolean {
  return (
    group.marketPosition === "settled"
    || group.marketPosition === "closed"
    || group.marketOutcome !== null
  );
}

function buildRunningPositions(trades: TradeRecord[]): RunningPosition[] {
  const inventory = new Map<string, number>();
  let cash = 0;

  return trades.map((trade) => {
    cash += trade.action === "BUY" ? -trade.cost : trade.cost;
    cash -= trade.fee ?? 0;

    const key = trade.side.trim() || "N/A";
    inventory.set(key, (inventory.get(key) ?? 0) + (trade.action === "BUY" ? trade.shares : -trade.shares));

    return {
      inventory: Object.fromEntries(Array.from(inventory.entries()).filter(([, value]) => Math.abs(value) >= 1e-6)),
      cash
    };
  });
}

function formatInventory(inventory: Record<string, number>): string {
  const entries = Object.entries(inventory).filter(([, value]) => Math.abs(value) >= 1e-6);

  if (entries.length === 0) {
    return "flat";
  }

  return entries.map(([label, value]) => `${value.toFixed(0)} ${label}`).join(" / ");
}

function inventorySize(inventory: Record<string, number>): number {
  return Object.values(inventory).reduce((sum, value) => sum + Math.abs(value), 0);
}

function buildRoiPoints(data: SnapshotData) {
  const sortedNav = [...data.nav_series].sort(
    (a, b) => Date.parse(`${dateKey(a[0])}T00:00:00Z`) - Date.parse(`${dateKey(b[0])}T00:00:00Z`)
  );
  const navByDate = new Map(sortedNav.map(([date, nav]) => [dateKey(date), nav]));
  const changedDates = new Set<string>();
  let lastNav: number | null = null;

  for (const [date, nav] of sortedNav) {
    if (lastNav === null || Math.abs(nav - lastNav) > 1e-6) {
      changedDates.add(dateKey(date));
    }
    lastNav = nav;
  }

  const tradeDates = new Set(data.trades.map((trade) => dateKey(trade.timestamp)));
  const allDates = Array.from(new Set([...changedDates, ...tradeDates])).sort();
  const rows: Array<{ date: string; nav: number }> = [];

  for (const date of allDates) {
    let nav = navByDate.get(date);
    if (nav === undefined) {
      const candidates = sortedNav.filter(([candidate]) => dateKey(candidate) <= date);
      if (candidates.length === 0) {
        continue;
      }
      nav = candidates[candidates.length - 1]![1];
    }
    rows.push({ date, nav });
  }

  const firstDate = rows[0]?.date ?? null;
  const points: Array<{ date: string; roi: number }> = [];

  if (firstDate) {
    points.push({ date: firstDate, roi: 0 });
    for (const row of rows) {
      if (row.date === firstDate) {
        continue;
      }
      points.push({
        date: row.date,
        roi: ((row.nav - data.summary.starting_capital) / data.summary.starting_capital) * 100
      });
    }
  }

  if (data.summary.ending_nav !== undefined && data.summary.last_trade) {
    points.push({
      date: dateKey(data.summary.last_trade),
      roi: ((data.summary.ending_nav - data.summary.starting_capital) / data.summary.starting_capital) * 100
    });
  }

  const deduped: Array<{ date: string; roi: number }> = [];
  for (const point of points) {
    if (deduped.length && deduped[deduped.length - 1]!.date === point.date) {
      deduped[deduped.length - 1] = point;
    } else {
      deduped.push(point);
    }
  }

  return deduped.map((point, index) => ({
    ...point,
    day: index + 1
  }));
}

function pathFromPoints(points: CanvasPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function areaFromPoints(points: CanvasPoint[], zeroY: number): string {
  if (points.length === 0) {
    return "";
  }
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${pathFromPoints(points)} L ${last.x.toFixed(2)} ${zeroY.toFixed(2)} L ${first.x.toFixed(2)} ${zeroY.toFixed(2)} Z`;
}

function buildChartSegments(points: CanvasPoint[], zeroY: number): ChartSegments {
  const positive: CanvasPoint[][] = [];
  const negative: CanvasPoint[][] = [];

  function pushSegment(target: CanvasPoint[][], segment: CanvasPoint[]) {
    if (segment.length >= 2) {
      target.push(segment);
    }
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]!;
    const next = points[index + 1]!;
    const currentSign = current.roi < 0 ? "negative" : "positive";
    const nextSign = next.roi < 0 ? "negative" : "positive";

    if (currentSign === nextSign) {
      pushSegment(currentSign === "positive" ? positive : negative, [current, next]);
      continue;
    }

    const ratio = -current.roi / (next.roi - current.roi);
    const zero: CanvasPoint = {
      x: current.x + ratio * (next.x - current.x),
      y: zeroY,
      roi: 0
    };

    pushSegment(currentSign === "positive" ? positive : negative, [current, zero]);
    pushSegment(nextSign === "positive" ? positive : negative, [zero, next]);
  }

  return {
    positiveLines: positive.map(pathFromPoints),
    negativeLines: negative.map(pathFromPoints),
    positiveAreas: positive.map((segment) => areaFromPoints(segment, zeroY)),
    negativeAreas: negative.map((segment) => areaFromPoints(segment, zeroY))
  };
}

function StatCard({
  label,
  value,
  sub,
  valueClass,
  highlight
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cx(styles.statCard, highlight && styles.statCardHighlight)}>
      <div className={styles.statLabel}>{label}</div>
      <div className={cx(styles.statValue, valueClass)}>{value}</div>
      {sub ? <div className={styles.statSub}>{sub}</div> : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  emphasize,
  emphasizeClass
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  emphasizeClass?: string;
}) {
  return (
    <div className={styles.detailRow}>
      <dt>{label}</dt>
      <dd className={cx(emphasize && (emphasizeClass ?? styles.textStrong))}>{value}</dd>
    </div>
  );
}

function FilterButton({
  active,
  tone,
  children,
  onClick
}: {
  active: boolean;
  tone?: "green" | "red";
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cx(
        styles.filterButton,
        active && styles.filterButtonActive,
        active && tone === "green" && styles.filterButtonGreen,
        active && tone === "red" && styles.filterButtonRed
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  asc,
  align = "left",
  onSort
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  asc: boolean;
  align?: "left" | "right";
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeKey;

  return (
    <th className={cx(styles.sortHeader, align === "right" && styles.alignRight, active && styles.sortHeaderActive)}>
      <button className={styles.sortButton} onClick={() => onSort(sortKey)} type="button">
        {label}
        <span className={styles.sortGlyph}>{active ? (asc ? "▲" : "▼") : "·"}</span>
      </button>
    </th>
  );
}

function RoiChart({ data }: { data: SnapshotData }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const points = useMemo(() => buildRoiPoints(data), [data]);
  const summary = data.summary;
  const displayRoi = summary.roi_pct;

  if (points.length === 0) {
    return null;
  }

  const minRoi = Math.min(0, ...points.map((point) => point.roi));
  const maxRoi = Math.max(0, ...points.map((point) => point.roi));
  const padding = Math.max(4, (maxRoi - minRoi) * 0.1);
  const yMin = minRoi - padding;
  const yMax = maxRoi + padding;
  const dayCount = points.length;
  const width = 960;
  const height = 300;
  const left = 56;
  const right = 24;
  const top = 12;
  const bottom = 44;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const zeroY = yToCanvas(0);
  const xTicks = buildXTicks(dayCount);
  const yTicks = buildYTicks(yMin, yMax);

  function xToCanvas(day: number): number {
    const domain = Math.max(1, dayCount - 1);
    return left + ((day - 1) / domain) * plotWidth;
  }

  function yToCanvas(roi: number): number {
    const range = Math.max(0.01, yMax - yMin);
    return top + plotHeight - ((roi - yMin) / range) * plotHeight;
  }

  const canvasPoints = points.map((point) => ({
    x: xToCanvas(point.day),
    y: yToCanvas(point.roi),
    roi: point.roi
  }));
  const segments = buildChartSegments(canvasPoints, zeroY);
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverCanvasPoint = hoverIndex !== null ? canvasPoints[hoverIndex] : null;

  return (
    <section className={styles.chartPanel}>
      <div className={styles.chartHeader}>
        <h2>ROI over trading days</h2>
        <span style={{ color: displayRoi >= 0 ? POSITIVE : NEGATIVE }}>{formatPct(displayRoi)}</span>
      </div>
      <div className={styles.chartBox}>
        <svg
          className={styles.chartSvg}
          onMouseLeave={() => setHoverIndex(null)}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="ROI over trading days"
        >
          <defs>
            <linearGradient id="pp-roi-fill-positive" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={POSITIVE} stopOpacity="0.22" />
              <stop offset="100%" stopColor={POSITIVE} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="pp-roi-fill-negative" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0%" stopColor={NEGATIVE} stopOpacity="0.22" />
              <stop offset="100%" stopColor={NEGATIVE} stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={yToCanvas(tick)} y2={yToCanvas(tick)} className={styles.gridLine} />
              <text x={left - 10} y={yToCanvas(tick) + 4} textAnchor="end" className={styles.axisText}>
                {tick === 0 ? "0%" : `${tick > 0 ? "+" : "−"}${Math.abs(Math.round(tick))}%`}
              </text>
            </g>
          ))}

          <line x1={left} x2={width - right} y1={zeroY} y2={zeroY} className={styles.zeroLine} />
          {segments.positiveAreas.map((path, index) => <path key={`positive-area-${index}`} d={path} fill="url(#pp-roi-fill-positive)" />)}
          {segments.negativeAreas.map((path, index) => <path key={`negative-area-${index}`} d={path} fill="url(#pp-roi-fill-negative)" />)}
          {segments.negativeLines.map((path, index) => <path key={`negative-line-${index}`} d={path} fill="none" stroke={NEGATIVE} strokeWidth="2" />)}
          {segments.positiveLines.map((path, index) => <path key={`positive-line-${index}`} d={path} fill="none" stroke={POSITIVE} strokeWidth="2" />)}
          {canvasPoints.map((point, index) => (
            <circle
              key={`hover-target-${points[index]!.day}`}
              cx={point.x}
              cy={point.y}
              r="10"
              fill="transparent"
              onMouseEnter={() => setHoverIndex(index)}
            />
          ))}

          {xTicks.map((tick) => (
            <text key={tick} x={xToCanvas(tick)} y={height - 20} textAnchor="middle" className={styles.axisText}>
              {tick}
            </text>
          ))}

          <text x={(left + width - right) / 2} y={height - 2} textAnchor="middle" className={styles.axisLabel}>
            Trading day
          </text>
          <text transform={`translate(14 ${(top + height - bottom) / 2}) rotate(-90)`} textAnchor="middle" className={styles.axisLabel}>
            ROI (%)
          </text>
        </svg>
        {hoverPoint && hoverCanvasPoint ? (
          <div
            className={styles.chartTooltip}
            style={{
              left: `${(hoverCanvasPoint.x / width) * 100}%`,
              top: `${(hoverCanvasPoint.y / height) * 100}%`
            }}
          >
            <div>Day {hoverPoint.day} · {hoverPoint.date}</div>
            <strong>{formatPct(hoverPoint.roi)} ROI</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function buildXTicks(dayCount: number): number[] {
  const ticks: number[] = [];
  for (let tick = 5; tick <= dayCount; tick += 5) {
    ticks.push(tick);
  }
  if (ticks[0] !== 1) {
    ticks.unshift(1);
  }
  if (dayCount - ticks[ticks.length - 1]! >= 3) {
    ticks.push(dayCount);
  }
  return Array.from(new Set(ticks));
}

function buildYTicks(min: number, max: number): number[] {
  const candidates = [-25, 0, 5, 35, 90];
  const visible = candidates.filter((tick) => tick >= min - 0.5 && tick <= max + 0.5);
  if (!visible.includes(0)) {
    visible.push(0);
  }
  return visible.sort((a, b) => a - b);
}

function MarketRows({
  group,
  expanded,
  onToggle
}: {
  group: MarketGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    for (let index = group.trades.length - 1; index >= 0; index -= 1) {
      if (group.trades[index]?.rationale) {
        return index;
      }
    }
    return Math.max(0, group.trades.length - 1);
  });
  const running = useMemo(() => buildRunningPositions(group.trades), [group.trades]);
  const lastRunning = running[running.length - 1] ?? { inventory: {}, cash: 0 };
  const fees = group.trades.reduce((sum, trade) => sum + (trade.fee ?? 0), 0);
  const marketPnlClass = group.marketPnl === null
    ? styles.textMutedDark
    : group.marketPnl > 0
      ? styles.textPositive
      : group.marketPnl < 0
        ? styles.textNegative
        : styles.textMuted;
  const settled = isSettled(group);
  const outcomeLabel = group.marketOutcome ? `Resolved ${group.marketOutcome}` : group.marketPosition ?? "—";
  const buyCount = group.trades.filter((trade) => trade.action === "BUY").length;
  const sellCount = group.trades.length - buyCount;
  const netQty = group.totalBuyQty - group.totalSellQty;
  const selectedTrade = group.trades[selectedIndex] ?? group.trades[group.trades.length - 1]!;

  return (
    <>
      <tr className={styles.marketRow} onClick={onToggle}>
        <td className={styles.chevronCell}>
          <span className={cx(styles.chevron, expanded && styles.chevronExpanded)}>▶</span>
        </td>
        <td className={styles.timeCell}>{formatTimestamp(group.lastActivity)}</td>
        <td>
          <div className={styles.marketTitle} title={group.title}>{group.title}</div>
          <div className={styles.marketTicker}>{group.ticker}</div>
        </td>
        <td className={styles.tableNumber}>
          {group.trades.length}
          <span className={styles.fillsMeta}>({buyCount}B{sellCount > 0 ? ` / ${sellCount}S` : ""})</span>
        </td>
        <td className={styles.tableNumber}>{netQty.toFixed(0)}</td>
        <td className={styles.tableNumber}>{formatUsd(group.netCost)}</td>
        <td className={styles.outcomeCell}>
          <span
            className={cx(
              styles.outcomePill,
              settled && group.marketOutcome === "YES" && styles.outcomeYes,
              settled && group.marketOutcome === "NO" && styles.outcomeNo,
              settled && !group.marketOutcome && styles.outcomeClosed,
              !settled && styles.outcomeOpen
            )}
          >
            {outcomeLabel}
          </span>
        </td>
        <td className={cx(styles.tableNumber, styles.pnlCell, marketPnlClass)}>
          {group.marketPnl === null ? "—" : formatSignedUsd(group.marketPnl)}
        </td>
      </tr>

      {expanded ? (
        <tr className={styles.expandedRow}>
          <td colSpan={8}>
            <div className={styles.expandedGrid}>
              <div className={styles.marketMeta}>
                <MiniMeta label="Close time" value={formatTimestamp(group.closeTime)} />
                {group.marketPosition ? <MiniMeta label="Position state" value={group.marketPosition} /> : null}
                {group.category ? <MiniMeta label="Category" value={group.category} /> : null}

                <div className={styles.pnlBreakdown}>
                  <div className={styles.miniHeading}>P&L breakdown</div>
                  <BreakdownRow label="Gross cash flow" value={formatSignedUsd(lastRunning.cash + fees)} />
                  {fees > 1e-6 ? <BreakdownRow label="Fees" value={formatSignedUsd(-fees)} /> : null}
                  <BreakdownRow label="Net cash flow" value={formatSignedUsd(lastRunning.cash)} />
                  <BreakdownRow label="Open inventory" value={formatInventory(lastRunning.inventory)} />
                  {group.marketPnl !== null ? (
                    <BreakdownRow label="Market P&L" value={formatSignedUsd(group.marketPnl)} strong className={marketPnlClass} />
                  ) : null}
                  {group.marketPnl !== null && inventorySize(lastRunning.inventory) > 1e-6 ? (
                    <p className={styles.pnlNote}>= net cash flow + live mark on open inventory.</p>
                  ) : null}
                </div>
              </div>

              <div className={styles.fillPanel}>
                <div>
                  <div className={styles.fillHeading}>Fills ({group.trades.length}) — click a row to read its rationale</div>
                  <div className={styles.fillTableWrap}>
                    <table className={styles.fillTable}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Action</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Cost</th>
                          <th>Fee</th>
                          <th>Position after</th>
                          <th>Cum. cash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.trades.map((trade, index) => (
                          <TradeFillRow
                            key={`${trade.timestamp}-${index}`}
                            trade={trade}
                            running={running[index]!}
                            positionLabel={formatInventory(running[index]!.inventory)}
                            selected={selectedIndex === index}
                            onSelect={() => setSelectedIndex(index)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className={styles.rationaleHeading}>
                    <span>
                      Rationale —{" "}
                      <span>
                        {formatTimestamp(selectedTrade.timestamp)} · {selectedTrade.action} {selectedTrade.side}{" "}
                        {selectedTrade.shares.toFixed(0)} @ {(selectedTrade.price * 100).toFixed(0)}¢
                      </span>
                    </span>
                    <span>
                      {selectedTrade.model ?? "—"}
                      {selectedTrade.model_confidence != null
                        ? ` · P(${selectedTrade.side})=${(selectedTrade.model_confidence * 100).toFixed(0)}%`
                        : ""}
                    </span>
                  </div>
                  <div className={styles.rationaleBox}>
                    {selectedTrade.rationale || <span className={styles.italicMuted}>Rationale not given.</span>}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.miniMeta}>
      <div>{label}</div>
      <span>{value}</span>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  strong,
  className
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cx(styles.breakdownRow, strong && styles.breakdownStrong)}>
      <span>{label}</span>
      <span className={cx(className)}>{value}</span>
    </div>
  );
}

function TradeFillRow({
  trade,
  running,
  positionLabel,
  selected,
  onSelect
}: {
  trade: TradeRecord;
  running: RunningPosition;
  positionLabel: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const normalizedSide = trade.side.toUpperCase();
  const actionClass = trade.action === "BUY"
    ? normalizedSide === "YES"
      ? styles.textYesBuy
      : normalizedSide === "NO"
        ? styles.textNoBuy
        : styles.textMutedLight
    : normalizedSide === "YES"
      ? styles.textYesSell
      : normalizedSide === "NO"
        ? styles.textNoSell
        : styles.textMutedLight;
  const cashChange = trade.action === "BUY" ? -trade.cost : trade.cost;

  return (
    <tr className={cx(styles.fillRow, selected && styles.fillRowSelected)} onClick={(event) => {
      event.stopPropagation();
      onSelect();
    }}>
      <td>{formatTimestamp(trade.timestamp)}</td>
      <td className={cx(styles.fillAction, actionClass)}>{trade.action} {trade.side}</td>
      <td>{trade.shares.toFixed(0)}</td>
      <td>{(trade.price * 100).toFixed(0)}¢</td>
      <td className={cashChange >= 0 ? styles.textPositiveLight : styles.textMutedLight}>{formatSignedUsd(cashChange)}</td>
      <td>{trade.fee && trade.fee > 0 ? `-${formatUsd(trade.fee)}` : "—"}</td>
      <td>{positionLabel}</td>
      <td className={running.cash >= 0 ? styles.textPositiveLight : styles.textMutedLight}>{formatSignedUsd(running.cash)}</td>
    </tr>
  );
}

export function ProphetsProfitSnapshot({
  as: Container = "main",
  variant = "original"
}: {
  as?: SnapshotContainerElement;
  variant?: SnapshotStyleVariant;
}) {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const variantClass = VARIANT_CLASS[variant];
  const variantLabel = VARIANT_LABEL[variant];

  useEffect(() => {
    let active = true;

    fetch("/api/public/trading-snapshot")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load: ${response.status}`);
        }
        return response.json() as Promise<SnapshotData>;
      })
      .then((payload) => {
        if (active) {
          setData(payload);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(String(reason));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => data ? buildMarketGroups(data.trades) : [], [data]);

  const visibleGroups = useMemo(() => {
    let rows = groups;

    if (filter !== "all") {
      rows = rows.filter((group) => {
        const settled = isSettled(group);
        const pnl = group.marketPnl ?? 0;

        if (filter === "settled") {
          return settled;
        }
        if (filter === "open") {
          return !settled;
        }
        if (filter === "won") {
          return settled && pnl > 0;
        }
        return settled && pnl < 0;
      });
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      rows = rows.filter((group) => (
        group.ticker.toLowerCase().includes(normalizedQuery)
        || group.title.toLowerCase().includes(normalizedQuery)
        || group.trades.some((trade) => (trade.rationale ?? "").toLowerCase().includes(normalizedQuery))
      ));
    }

    return [...rows].sort((a, b) => {
      let left: number;
      let right: number;

      if (sortKey === "time") {
        left = Date.parse(a.lastActivity);
        right = Date.parse(b.lastActivity);
      } else if (sortKey === "pnl") {
        left = a.marketPnl ?? Number.NEGATIVE_INFINITY;
        right = b.marketPnl ?? Number.NEGATIVE_INFINITY;
      } else {
        left = Math.abs(a.netCost);
        right = Math.abs(b.netCost);
      }

      return sortAsc ? left - right : right - left;
    });
  }, [filter, groups, query, sortAsc, sortKey]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortAsc((current) => !current);
    } else {
      setSortKey(nextKey);
      setSortAsc(false);
    }
  }

  function toggleExpanded(ticker: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(ticker)) {
        next.delete(ticker);
      } else {
        next.add(ticker);
      }
      return next;
    });
  }

  if (error) {
    return (
      <Container className={cx(styles.page, variantClass, styles.statePage)}>
        <h1>Error</h1>
        <pre>{error}</pre>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container className={cx(styles.page, variantClass, styles.loadingPage)}>
        <div>Loading trade ledger…</div>
      </Container>
    );
  }

  const summary = data.summary;
  const pnlClass = summary.net_pnl >= 0 ? styles.textPositive : styles.textNegative;
  const tradedDays = summary.days_traded ?? summary.trading_days ?? 0;
  const calendarDays = summary.calendar_days ?? tradedDays;

  return (
    <Container className={cx(styles.page, variantClass)}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.titleBlock}>
              <h1>Live Trading Snapshot</h1>
              {variantLabel ? <span className={styles.previewBadge}>{variantLabel}</span> : null}
            </div>
            <span>
              {formatDate(summary.first_trade)} → {formatDate(summary.last_trade)} · traded {tradedDays} of {calendarDays} days
            </span>
          </div>
          <p>
            Ledger of public wallet fills executed on {summary.venue}. P&L combines realised closes with the live
            Polymarket mark on still-open positions. Each row is one market — click it to read the Pulse rationale
            when a matching review artifact is available.
          </p>
          <p className={styles.forecaster}>Forecaster: {summary.agent}</p>
        </header>

        <section className={styles.statsGrid}>
          <StatCard label="Starting capital" value={formatUsd(summary.starting_capital)} />
          <StatCard label="Ending NAV" value={formatUsd(summary.ending_nav)} valueClass={pnlClass} />
          <StatCard label="Net P&L" value={formatSignedUsd(summary.net_pnl)} valueClass={pnlClass} highlight />
          <StatCard label="ROI" value={formatPct(summary.roi_pct)} valueClass={pnlClass} highlight />
          <StatCard
            label="Sharpe (√365)"
            value={summary.sharpe_daily !== null ? summary.sharpe_daily.toFixed(2) : "—"}
            sub={
              summary.mean_daily_return_pct !== undefined && summary.daily_volatility_pct !== undefined
                ? `μ ${summary.mean_daily_return_pct.toFixed(2)}% · σ ${summary.daily_volatility_pct.toFixed(2)}%`
                : undefined
            }
          />
          <StatCard label="Orders" value={`${summary.n_trades}`} sub={`${summary.n_markets} markets`} />
          <StatCard
            label="Win rate"
            value={summary.win_rate_pct !== null ? `${summary.win_rate_pct.toFixed(1)}%` : "—"}
            sub="settled markets"
          />
          <StatCard
            label="Peak deployed"
            value={summary.peak_deployed_dollars !== undefined ? formatUsd(summary.peak_deployed_dollars) : "—"}
            sub="capital"
          />
        </section>

        <RoiChart data={data} />

        <section className={styles.infoGrid}>
          <div className={styles.infoPanel}>
            <h3>Calibration vs. Market</h3>
            <dl>
              <DetailRow
                label="ΔS (skill differential)"
                value={summary.score_differential !== undefined ? `${summary.score_differential >= 0 ? "+" : ""}${(100 * summary.score_differential).toFixed(2)}%` : "—"}
                emphasize={summary.score_differential !== undefined && summary.score_differential > 0}
                emphasizeClass={styles.textPositive}
              />
              <DetailRow
                label="D (Bregman divergence)"
                value={summary.bregman_divergence !== undefined ? `${summary.bregman_divergence >= 0 ? "+" : ""}${(100 * summary.bregman_divergence).toFixed(2)}%` : "—"}
                emphasize={summary.bregman_divergence !== undefined && summary.bregman_divergence > 0}
                emphasizeClass={styles.textPositive}
              />
              {summary.score_differential !== undefined && summary.bregman_divergence !== undefined ? (
                <DetailRow
                  label="ΔS + D (≈ ROI)"
                  value={`${((summary.score_differential + summary.bregman_divergence) * 100).toFixed(2)}%`}
                />
              ) : null}
            </dl>
            <p>
              When calibration artifacts are bundled, ΔS and D split profit (% of starting capital) into the gain
              from outscoring the market on reviewed questions and the divergence between Pulse and market
              probabilities. Otherwise this panel stays blank rather than inventing a probability metric.
            </p>
          </div>

          <div className={styles.infoPanel}>
            <h3>Eligibility Filters (ex-ante)</h3>
            <ul className={styles.filterList}>
              {summary.filters.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <span>·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <div className={styles.ledgerToolbar}>
            <div className={styles.ledgerTitleGroup}>
              <h2>Ledger</h2>
              <span>
                {visibleGroups.length} market{visibleGroups.length === 1 ? "" : "s"}
                {visibleGroups.length !== groups.length ? ` of ${groups.length}` : ""} · {data.trades.length} fills
              </span>
            </div>

            <div className={styles.ledgerControls}>
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All</FilterButton>
              <FilterButton active={filter === "settled"} onClick={() => setFilter("settled")}>Settled</FilterButton>
              <FilterButton active={filter === "open"} onClick={() => setFilter("open")}>Open</FilterButton>
              <FilterButton active={filter === "won"} tone="green" onClick={() => setFilter("won")}>Won</FilterButton>
              <FilterButton active={filter === "lost"} tone="red" onClick={() => setFilter("lost")}>Lost</FilterButton>
              <input
                aria-label="Search ticker, title, or rationale"
                className={styles.searchInput}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ticker / title / rationale…"
                type="text"
                value={query}
              />
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.ledgerTable}>
              <thead>
                <tr>
                  <th className={styles.chevronHeader} />
                  <SortHeader label="Last activity" sortKey="time" activeKey={sortKey} asc={sortAsc} onSort={handleSort} />
                  <th>Market</th>
                  <th className={styles.alignRight}>Fills</th>
                  <th className={styles.alignRight}>Net qty</th>
                  <SortHeader label="Net cost" sortKey="cost" activeKey={sortKey} asc={sortAsc} align="right" onSort={handleSort} />
                  <th className={styles.alignRight}>Outcome</th>
                  <SortHeader label="P&L" sortKey="pnl" activeKey={sortKey} asc={sortAsc} align="right" onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map((group) => (
                  <MarketRows
                    key={group.ticker}
                    group={group}
                    expanded={expanded.has(group.ticker)}
                    onToggle={() => toggleExpanded(group.ticker)}
                  />
                ))}
                {visibleGroups.length === 0 ? (
                  <tr>
                    <td className={styles.emptyCell} colSpan={8}>No markets match the current filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <p className={styles.tableNote}>
            One row per market. Click a row to expand the individual fills and the model rationale captured at signal
            time. P&L is the cumulative market figure where public data exposes it (realized + live mark on opens).
          </p>
        </section>
      </div>
    </Container>
  );
}
