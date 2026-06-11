"use client";

import Link from "next/link";
import { useState } from "react";
import type { Forecast, ForecastOutcome } from "../../lib/world-cup/forecast-store";
import styles from "./world-cup.module.css";

// Expandable forecast card: headline probability up front, 2-3 key reasons on
// click, and a link to the full forecasting workflow report. Market-blind by
// policy — this card never shows market prices.

const BAR_COLORS = ["#3b82f6", "#64748b", "#f59e0b", "#10b981", "#a855f7"];

function pct(p: number): string {
  return `${(p * 100).toFixed(p >= 0.1 ? 0 : 1)}%`;
}

function fmtKickoff(utc: string | null): string {
  if (!utc) return "";
  return `${utc.slice(5, 10).replace("-", "/")} ${utc.slice(11, 16)} UTC`;
}

function StackedBar({ outcomes }: { outcomes: readonly ForecastOutcome[] }) {
  return (
    <div className={styles.probBar} aria-hidden>
      {outcomes.map((o, i) => (
        <span
          key={o.key}
          className={styles.probSeg}
          style={{ width: `${Math.max(o.p * 100, 1.5)}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
          title={`${o.label_cn} ${pct(o.p)}`}
        />
      ))}
    </div>
  );
}

export function ForecastCard({
  forecast,
  title,
  meta,
  topN = 3
}: {
  forecast: Forecast;
  title: string;
  meta: string;
  topN?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...forecast.outcomes].sort((a, b) => b.p - a.p);
  const top = sorted.slice(0, topN);
  const favourite = sorted[0] ?? { key: "na", label_cn: "—", label_en: "—", p: 0 };
  const isMatch = forecast.family === "group_match";
  const barOutcomes = isMatch ? forecast.outcomes : top;

  return (
    <div className={`${styles.card} ${styles.cardStatic}`}>
      <button
        type="button"
        className={styles.cardToggle}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className={styles.cardMeta}>
          <span>{meta}</span>
          <span>{fmtKickoff(forecast.kickoff_utc) || `置信 ${forecast.confidence_tier}`}</span>
        </div>
        <div className={styles.matchup}>{title}</div>
        <StackedBar outcomes={barOutcomes} />
        <div className={styles.headline}>
          <span>
            <span className={styles.prob}>{pct(favourite.p)}</span>{" "}
            <span className={styles.muted}>{favourite.label_cn}</span>
          </span>
          <span className={styles.expandHint}>{expanded ? "收起 ▲" : "理由 ▼"}</span>
        </div>
        {!isMatch ? (
          <div className={styles.topList}>
            {top.map((o, i) => (
              <span key={o.key} className={styles.topItem}>
                <i className={styles.topDot} style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                {o.label_cn} {pct(o.p)}
              </span>
            ))}
          </div>
        ) : (
          <div className={styles.topList}>
            {forecast.outcomes.map((o, i) => (
              <span key={o.key} className={styles.topItem}>
                <i className={styles.topDot} style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                {o.label_cn} {pct(o.p)}
              </span>
            ))}
          </div>
        )}
      </button>

      {expanded ? (
        <div className={styles.cardBody}>
          <p className={styles.oneLiner}>{forecast.one_liner_cn}</p>
          <ul className={styles.reasonList}>
            {forecast.key_reasons.map((r) => (
              <li key={r.source_url + r.source_date} className={styles.reasonItem}>
                {r.cn}{" "}
                <a href={r.source_url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                  来源 · {r.source_date}
                </a>
              </li>
            ))}
          </ul>
          <div className={styles.cardActions}>
            <Link className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} href={`/world-cup/forecast/${forecast.dir}`}>
              查看完整推理 →
            </Link>
            <span className={styles.muted}>
              {forecast.n_sources} 个来源 · 置信 {forecast.confidence_tier}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
