"use client";

import type { PublicRunDetail } from "@autopoly/contracts";
import { formatDate, formatPct, formatUsd } from "../lib/format";
import { usePollingJson } from "../lib/use-polling";

export function RunDetail({ runId, initialData }: { runId: string; initialData: PublicRunDetail }) {
  const { data } = usePollingJson(`/api/public/runs/${runId}`, initialData);

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Run Detail</p>
            <h2>{data.runtime}</h2>
          </div>
          <span className="badge">{data.mode}</span>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Generated</dt>
            <dd>{formatDate(data.generated_at_utc)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{data.status}</dd>
          </div>
          <div>
            <dt>Bankroll</dt>
            <dd>{formatUsd(data.bankroll_usd)}</dd>
          </div>
          <div>
            <dt>Prompt summary</dt>
            <dd>{data.prompt_summary}</dd>
          </div>
        </dl>
      </section>

      <section className="panel prose-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Reasoning</p>
            <h2>Decision log</h2>
          </div>
        </div>
        <pre>{data.reasoning_md}</pre>
        <pre>{data.logs_md}</pre>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Decisions</p>
            <h2>Trade set</h2>
          </div>
        </div>
        <div className="decision-grid">
          {data.decisions.map((decision, index) => (
            <article key={`${decision.market_slug}-${index}`} className="decision-card">
              <span className="badge">{decision.action}</span>
              <h3>{decision.market_slug}</h3>
              <p>{decision.thesis_md}</p>
              <dl>
                <div>
                  <dt>Side</dt>
                  <dd>{decision.side}</dd>
                </div>
                <div>
                  <dt>Notional</dt>
                  <dd>{formatUsd(decision.notional_usd)}</dd>
                </div>
                <div>
                  <dt>Market prob</dt>
                  <dd>{formatPct(decision.market_prob)}</dd>
                </div>
                <div>
                  <dt>AI prob</dt>
                  <dd>{formatPct(decision.ai_prob)}</dd>
                </div>
                <div>
                  <dt>Edge</dt>
                  <dd>{formatPct(decision.edge)}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{decision.confidence}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

