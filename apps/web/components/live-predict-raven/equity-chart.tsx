import type { EquityPoint } from "../../lib/live-predict-raven/snapshot";

// Server-rendered SVG line chart of the paper book's equity curve.
// Marks follow the house chart spec: 2px round line, ~10% area wash, hairline
// solid gridlines, selective direct labels (peak / trough / endpoint only),
// native <title> tooltips on enlarged invisible hit targets. A full data table
// fallback is rendered next to this chart by the report component.

const VIEW_W = 720;
const VIEW_H = 300;
const MARGIN = { top: 34, right: 82, bottom: 36, left: 62 };
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;
const X_TICK_EVERY = 4;

interface YScale {
  min: number;
  max: number;
  ticks: readonly number[];
}

// Domain follows the data (the curve is live now): pad to clean $100 bounds
// and pick the smallest step from a fixed menu that yields ≤ 6 gridlines.
function yScaleFor(values: readonly number[]): YScale {
  const lo = Math.floor((Math.min(...values) - 50) / 100) * 100;
  const hi = Math.ceil((Math.max(...values) + 50) / 100) * 100;
  const step = [100, 200, 500, 1000, 2000].find((s) => (hi - lo) / s <= 6) ?? 5000;
  const ticks = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  return { min: lo, max: hi, ticks };
}

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});
const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
});

interface PlacedPoint extends EquityPoint {
  x: number;
  y: number;
  index: number;
}

function placePoints(curve: readonly EquityPoint[], scale: YScale): readonly PlacedPoint[] {
  const step = curve.length > 1 ? PLOT_W / (curve.length - 1) : 0;
  return curve.map((point, index) => ({
    ...point,
    index,
    x: MARGIN.left + index * step,
    y: MARGIN.top + ((scale.max - point.equityUsd) / (scale.max - scale.min)) * PLOT_H
  }));
}

function linePath(points: readonly PlacedPoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

function areaPath(points: readonly PlacedPoint[], first: PlacedPoint, last: PlacedPoint): string {
  const bottom = MARGIN.top + PLOT_H;
  return `${linePath(points)} L${last.x.toFixed(1)},${bottom} L${first.x.toFixed(1)},${bottom} Z`;
}

export function EquityChart({ curve, bankrollUsd }: { curve: readonly EquityPoint[]; bankrollUsd: number }) {
  if (curve.length === 0) {
    return null;
  }
  const scale = yScaleFor([...curve.map((p) => p.equityUsd), bankrollUsd]);
  const points = placePoints(curve, scale);
  const first = points[0];
  const end = points[points.length - 1];
  if (!first || !end) {
    return null;
  }
  const peak = points.reduce((best, p) => (p.equityUsd > best.equityUsd ? p : best), first);
  const trough = points.reduce(
    (worst, p) => (p.index > peak.index && p.equityUsd < worst.equityUsd ? p : worst),
    end
  );
  const bankrollY = MARGIN.top + ((scale.max - bankrollUsd) / (scale.max - scale.min)) * PLOT_H;
  const featured = [peak, trough, end].filter((p, i, arr) => arr.indexOf(p) === i);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={`权益曲线：7 月 3 日 $10,000 起步，7 月 14 日最高 ${usd0.format(peak.equityUsd)}，7 月 16 日回落到 ${usd0.format(trough.equityUsd)}，最新 ${usd0.format(end.equityUsd)}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {scale.ticks.map((tick) => {
        const y = MARGIN.top + ((scale.max - tick) / (scale.max - scale.min)) * PLOT_H;
        return (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + PLOT_W}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize={12.5}
              fill="var(--muted)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {usd0.format(tick)}
            </text>
          </g>
        );
      })}

      <line
        x1={MARGIN.left}
        x2={MARGIN.left + PLOT_W}
        y1={bankrollY}
        y2={bankrollY}
        stroke="var(--line-strong)"
        strokeWidth={1}
      />
      <text x={MARGIN.left + 4} y={bankrollY - 5} fontSize={11.5} fill="var(--muted)">
        本金 $10,000
      </text>

      {points
        .filter(
          // Periodic ticks, but never one adjacent to the always-shown last
          // tick (their labels would overlap).
          (p) => (p.index % X_TICK_EVERY === 1 && p.index < points.length - 2) || p.index === points.length - 1
        )
        .map((p) => (
          <text key={p.index} x={p.x} y={VIEW_H - 12} textAnchor="middle" fontSize={12.5} fill="var(--muted)">
            {p.date.replace("开盘", "")}
          </text>
        ))}

      <path d={areaPath(points, first, end)} fill="var(--accent)" opacity={0.1} />
      <path
        d={linePath(points)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {featured.map((p) => (
        <circle key={p.index} cx={p.x} cy={p.y} r={5} fill="var(--accent)" stroke="var(--paper)" strokeWidth={2} />
      ))}
      <text x={peak.x} y={peak.y - 12} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)">
        峰值 {usd0.format(peak.equityUsd)}
      </text>
      <text x={trough.x} y={trough.y + 22} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)">
        {usd0.format(trough.equityUsd)}
      </text>
      <text x={end.x + 10} y={end.y + 4} textAnchor="start" fontSize={13} fontWeight={600} fill="var(--ink)">
        {usd0.format(end.equityUsd)}
      </text>

      {points.map((p) => (
        <circle key={`hit-${p.index}`} cx={p.x} cy={p.y} r={12} fill="transparent">
          <title>{`${p.date} · ${usd2.format(p.equityUsd)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
