"use client";

import Link from "next/link";
import type { PublicRunSummary } from "@autopoly/contracts";
import { formatDate, formatUsd } from "../lib/format";
import { usePollingJson } from "../lib/use-polling";

export function LiveRuns({ initialData }: { initialData: PublicRunSummary[] }) {
  const { data } = usePollingJson("/api/public/runs", initialData);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Runs</p>
          <h2>Decision cycles</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Generated</th>
              <th>Runtime</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Bankroll</th>
              <th>Decisions</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {data.map((run) => (
              <tr key={run.id}>
                <td>{formatDate(run.generated_at_utc)}</td>
                <td>{run.runtime}</td>
                <td>{run.mode}</td>
                <td>{run.status}</td>
                <td>{formatUsd(run.bankroll_usd)}</td>
                <td>{run.decision_count}</td>
                <td>
                  <Link href={`/runs/${run.id}`} className="action-link">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

