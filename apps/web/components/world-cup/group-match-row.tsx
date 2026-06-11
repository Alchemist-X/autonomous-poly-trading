"use client";

import Link from "next/link";
import { useState } from "react";
import type { Forecast } from "../../lib/world-cup/forecast-store";
import styles from "./world-cup.module.css";

// One group-stage fixture: 队旗 + tri-segment W/D/L bar + pick chip.
// Clicking the row reveals the one-line view and 2-3 sourced reasons.

interface TeamView {
  flag: string;
  cn: string;
}

export function GroupMatchRow({
  forecast,
  home,
  away
}: {
  forecast: Forecast;
  home: TeamView;
  away: TeamView;
}) {
  const [open, setOpen] = useState(false);
  const byKey = Object.fromEntries(forecast.outcomes.map((o) => [o.key, o.p]));
  const pA = byKey.a ?? 0;
  const pD = byKey.draw ?? 0;
  const pB = byKey.b ?? 0;
  const top = Math.max(pA, pD, pB);
  const pick =
    top === pA ? `${home.cn}胜 ${Math.round(pA * 100)}%` : top === pB ? `${away.cn}胜 ${Math.round(pB * 100)}%` : `平局 ${Math.round(pD * 100)}%`;
  const date = forecast.event_slug.match(/(\d{2}-\d{2})$/)?.[1]?.replace("-", "/") ?? "";

  return (
    <div className={styles.matchRow}>
      <button type="button" className={styles.matchTop} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.teamSide}>
          <span className={styles.teamFlag}>{home.flag}</span>
          {home.cn}
        </span>
        <span className={styles.matchMid}>
          <span className={styles.matchDate}>6/{date.split("/")[1] ?? date}</span>
          <span className={styles.triBar} aria-hidden>
            <span className={`${styles.triW} ${top !== pA ? styles.triDim : ""}`} style={{ width: `${pA * 100}%` }} />
            <span className={`${styles.triD} ${top !== pD ? styles.triDim : ""}`} style={{ width: `${pD * 100}%` }} />
            <span className={`${styles.triL} ${top !== pB ? styles.triDim : ""}`} style={{ width: `${pB * 100}%` }} />
          </span>
          <span className={styles.triLabels}>
            <span>{Math.round(pA * 100)}</span>
            <span>平 {Math.round(pD * 100)}</span>
            <span>{Math.round(pB * 100)}</span>
          </span>
          <span className={styles.pickChip}>{pick}</span>
        </span>
        <span className={`${styles.teamSide} ${styles.teamSideAway}`}>
          {away.cn}
          <span className={styles.teamFlag}>{away.flag}</span>
        </span>
      </button>
      {open ? (
        <div className={styles.matchDetail}>
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
            <Link className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} href={`/world-cup/forecast/${forecast.dir}`}>
              完整推理报告 →
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
