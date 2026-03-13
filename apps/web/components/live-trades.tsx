"use client";

import type { PublicTrade } from "@autopoly/contracts";
import { formatDate, formatUsd } from "../lib/format";
import { usePollingJson } from "../lib/use-polling";

export function LiveTrades({ initialData }: { initialData: PublicTrade[] }) {
  const { data } = usePollingJson("/api/public/trades", initialData);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Trade Tape</p>
          <h2>Execution history</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Market</th>
              <th>Side</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Filled</th>
              <th>Avg price</th>
              <th>Order ID</th>
            </tr>
          </thead>
          <tbody>
            {data.map((trade) => (
              <tr key={trade.id}>
                <td>{formatDate(trade.timestamp_utc)}</td>
                <td>{trade.market_slug}</td>
                <td>{trade.side}</td>
                <td>{trade.status}</td>
                <td>{formatUsd(trade.requested_notional_usd)}</td>
                <td>{formatUsd(trade.filled_notional_usd)}</td>
                <td>{trade.avg_price?.toFixed(3) ?? "N/A"}</td>
                <td>{trade.order_id ?? "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

