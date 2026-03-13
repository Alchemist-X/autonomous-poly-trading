"use client";

import type { OverviewPoint } from "@autopoly/contracts";
import { formatUsd } from "../lib/format";

function buildPath(points: OverviewPoint[], width: number, height: number) {
  if (points.length === 0) {
    return "";
  }
  const values = points.map((point) => point.total_equity_usd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  return points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * width;
      const y = height - ((point.total_equity_usd - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function EquityChart({ points }: { points: OverviewPoint[] }) {
  const values = points.map((point) => point.total_equity_usd);
  const high = values.length > 0 ? Math.max(...values) : 0;
  const low = values.length > 0 ? Math.min(...values) : 0;

  return (
    <section className="panel chart-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Equity Curve</p>
          <h2>5 second spectator refresh</h2>
        </div>
        <div className="chart-stats">
          <span>High {formatUsd(high)}</span>
          <span>Low {formatUsd(low)}</span>
        </div>
      </div>
      <svg viewBox="0 0 640 260" className="chart" role="img" aria-label="equity curve">
        <defs>
          <linearGradient id="equity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(201, 76, 76, 0.5)" />
            <stop offset="100%" stopColor="rgba(201, 76, 76, 0)" />
          </linearGradient>
        </defs>
        <path d={`${buildPath(points, 640, 220)} L 640 260 L 0 260 Z`} fill="url(#equity-fill)" />
        <path d={buildPath(points, 640, 220)} fill="none" stroke="#b73e3e" strokeWidth="4" />
      </svg>
    </section>
  );
}

