"use client";

// Decision-first report: attention verdict leads, then mechanism, then the
// 0-5 impacted stocks with reasoning/evidence/action, then plan + receipts.

import type { DeltaRun } from "../lib/analyzer/schema";
import { freshnessRead } from "../lib/analyzer/timing";
import { useLocale, useT, valueLabel } from "../lib/i18n";

function movePctText(range: { min: number; max: number }): string {
  const sign = (value: number) => `${value > 0 ? "+" : ""}${value}%`;
  return `${sign(range.min)} … ${sign(range.max)}`;
}

export function ReportView({ run }: { run: DeltaRun }) {
  const t = useT();
  const { locale } = useLocale();
  const analysis = run.analysis;
  const attention = analysis.attention;
  // Freshness is anchored to the run's generation time so the banner stays
  // stable (and server/client render identically).
  const fresh = freshnessRead(analysis.timing.firstSeenUtc, run.generatedAtUtc, locale);

  return (
    <div className="dl-report">
      <div className={`dl-fresh ${fresh.staleWarning ? "dl-fresh-stale" : ""} ${!fresh.known ? "dl-fresh-unknown" : ""}`}>
        <span className="dl-fresh-label">⏱ {fresh.label}</span>
        {fresh.staleWarning ? <span className="dl-fresh-warn">{t("staleWarning")}</span> : null}
        <span className="dl-fresh-basis">
          {t("timingBasisLabel")}: {analysis.timing.basis}
        </span>
      </div>

      <section className="dl-verdict" aria-labelledby="dl-verdict-title">
        <div className="dl-verdict-row">
          <span className={`dl-attention-pill ${attention.worthAttention ? "dl-attention-yes" : "dl-attention-no"}`}>
            {attention.worthAttention ? t("attentionYes") : t("attentionNo")}
          </span>
          <span className="dl-attention-score">
            {t("attentionScore")} {attention.score}/100
          </span>
          <span className="dl-chip">
            {t("newsTypeLabel")}: {attention.newsType}
          </span>
          <span className="dl-chip">
            {t("engineLabel")}: {run.engine}
          </span>
        </div>
        <h2 id="dl-verdict-title">{attention.verdict}</h2>
        <p>{attention.credibilityNote}</p>
        <p className="dl-source-row">
          {t("originalLink")}:{" "}
          {run.news.url ? (
            <a href={run.news.url} target="_blank" rel="noopener noreferrer">
              {run.news.url}
            </a>
          ) : (
            t("noUrl")
          )}
        </p>
        {run.engineFallbackReason && run.engine === "rules" ? (
          <p className="dl-fallback-note">
            {t("engineFallbackNote")} {run.engineFallbackReason}
          </p>
        ) : null}
      </section>

      <section className="dl-panel dl-section" aria-labelledby="dl-mechanism-title">
        <h3 id="dl-mechanism-title">{t("mechanismTitle")}</h3>
        <p>{analysis.marketReadout}</p>
      </section>

      <section className="dl-panel dl-section" aria-labelledby="dl-impacted-title">
        <h3 id="dl-impacted-title">
          {t("impactedTitle")} · {analysis.impactedStocks.length}/5
        </h3>
        {analysis.impactedStocks.length === 0 ? <p>{t("impactedNone")}</p> : null}
        {analysis.impactedStocks.map((stock) => (
          <article key={stock.ticker} className="dl-stock">
            <div className="dl-stock-head">
              <span className="dl-ticker">{stock.ticker}</span>
              <span className="dl-company">{stock.company}</span>
              <span className={`dl-pill dl-dir-${stock.direction}`}>{valueLabel(locale, "directionValues", stock.direction)}</span>
              {!stock.inUniverse ? <span className="dl-universe-flag">{t("outOfUniverse")}</span> : null}
            </div>

            <dl className="dl-stock-grid">
              <div className="dl-stat">
                <dt>{t("actionLabel")}</dt>
                <dd className="dl-action-cell">{valueLabel(locale, "actionValues", stock.action)}</dd>
              </div>
              <div className="dl-stat">
                <dt>{t("expectedMoveLabel")}</dt>
                <dd>{movePctText(stock.expectedMovePct)}</dd>
              </div>
              <div className="dl-stat">
                <dt>{t("magnitudeLabel")}</dt>
                <dd>{valueLabel(locale, "magnitudeValues", stock.magnitude)}</dd>
              </div>
              <div className="dl-stat">
                <dt>{t("confidenceLabel")}</dt>
                <dd>{valueLabel(locale, "confidenceValues", stock.confidence)}</dd>
              </div>
              <div className="dl-stat">
                <dt>{t("horizonLabel")}</dt>
                <dd>{stock.horizon}</dd>
              </div>
            </dl>

            <div className="dl-stock-block">
              <h4>{t("reasoningLabel")}</h4>
              <p>
                {stock.reasoning} <em>{stock.actionRationale}</em>
              </p>
            </div>

            {stock.evidence.length > 0 ? (
              <div className="dl-stock-block">
                <h4>{t("evidenceLabel")}</h4>
                <ul className="dl-evidence">
                  {stock.evidence.map((item, index) => (
                    <li key={index}>
                      {item.point}
                      {item.source ? <> — {item.source}</> : null}
                      {item.url ? (
                        <>
                          {" "}
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            ↗
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {stock.risks.length > 0 ? (
              <div className="dl-stock-block">
                <h4>{t("risksLabel")}</h4>
                <ul className="dl-risks">
                  {stock.risks.map((risk, index) => (
                    <li key={index}>{risk}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="dl-panel dl-section" aria-labelledby="dl-plan-title">
        <h3 id="dl-plan-title">{t("planTitle")}</h3>
        <p>{analysis.tradingPlan}</p>
      </section>

      <section className="dl-panel dl-section" aria-labelledby="dl-delivery-title">
        <h3 id="dl-delivery-title">{t("deliveryTitle")}</h3>
        <ul className="dl-receipts">
          {run.delivery.map((item) => (
            <li key={`${item.channel}-${item.timestampUtc}`}>
              <span className="dl-receipt-head">
                <strong>{item.channel}</strong>
                <span className={`dl-receipt-status dl-receipt-${item.status}`}>{item.status}</span>
                <span>{item.provider}</span>
              </span>
              <p>
                {item.target} — {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="dl-panel dl-section" aria-labelledby="dl-limits-title">
        <h3 id="dl-limits-title">{t("limitationsTitle")}</h3>
        <ul className="dl-limits">
          {analysis.limitations.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
