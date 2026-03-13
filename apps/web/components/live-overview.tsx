"use client";

import type { OverviewResponse } from "@autopoly/contracts";
import { EquityChart } from "./equity-chart";
import { formatDate, formatPct, formatUsd } from "../lib/format";
import { usePollingJson } from "../lib/use-polling";

function StatCard(props: { label: string; value: string; accent?: string }) {
  return (
    <div className={`stat-card ${props.accent ?? ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

export function LiveOverview({ initialData }: { initialData: OverviewResponse }) {
  const { data, error } = usePollingJson("/api/public/overview", initialData);

  return (
    <>
      <section className="stats-grid">
        <StatCard label="System status" value={data.status.toUpperCase()} accent={`status-${data.status}`} />
        <StatCard label="Total equity" value={formatUsd(data.total_equity_usd)} />
        <StatCard label="Cash balance" value={formatUsd(data.cash_balance_usd)} />
        <StatCard label="High water mark" value={formatUsd(data.high_water_mark_usd)} />
        <StatCard label="Drawdown" value={formatPct(data.drawdown_pct)} />
        <StatCard label="Open positions" value={String(data.open_positions)} />
      </section>

      <EquityChart points={data.equity_curve} />

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Risk Tape</p>
            <h2>Live operating context</h2>
          </div>
          <span className="badge">5s polling</span>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Last agent run</dt>
            <dd>{formatDate(data.last_run_at)}</dd>
          </div>
          <div>
            <dt>Latest risk event</dt>
            <dd>{data.latest_risk_event ?? "No recent risk event."}</dd>
          </div>
          <div>
            <dt>Refresh status</dt>
            <dd>{error ? `Polling degraded: ${error}` : "Healthy"}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

