"use client";

import type { PublicPosition } from "@autopoly/contracts";
import { formatDate, formatPct, formatUsd } from "../lib/format";
import { usePollingJson } from "../lib/use-polling";

export function LivePositions({ initialData }: { initialData: PublicPosition[] }) {
  const { data } = usePollingJson("/api/public/positions", initialData);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Positions</p>
          <h2>Current live inventory</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Outcome</th>
              <th>Size</th>
              <th>Avg cost</th>
              <th>Current price</th>
              <th>Value</th>
              <th>PnL</th>
              <th>Stop loss</th>
              <th>Opened</th>
            </tr>
          </thead>
          <tbody>
            {data.map((position) => (
              <tr key={position.id}>
                <td>{position.market_slug}</td>
                <td>{position.outcome_label}</td>
                <td>{position.size.toFixed(2)}</td>
                <td>{position.avg_cost.toFixed(3)}</td>
                <td>{position.current_price.toFixed(3)}</td>
                <td>{formatUsd(position.current_value_usd)}</td>
                <td className={position.unrealized_pnl_pct >= 0 ? "positive" : "negative"}>
                  {formatPct(position.unrealized_pnl_pct)}
                </td>
                <td>{formatPct(position.stop_loss_pct)}</td>
                <td>{formatDate(position.opened_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

