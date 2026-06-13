"use client";

import Link from "next/link";
import { useState } from "react";
import { contentFor, type Forecast, type MatchResult } from "../../lib/world-cup/forecast-store";
import { t, teamLabel, tierLabel, withLocale, type Locale } from "../../lib/world-cup/i18n";
import styles from "./world-cup.module.css";

// One group-stage fixture: 队旗 + tri-segment W/D/L bar + pick chip.
// Clicking the row reveals the one-line view and 2-3 sourced reasons.

interface TeamView {
  flag: string;
  cn: string;
  en: string;
}

export function GroupMatchRow({
  forecast,
  home,
  away,
  locale,
  result
}: {
  forecast: Forecast;
  home: TeamView;
  away: TeamView;
  locale: Locale;
  result?: MatchResult | null;
}) {
  const [open, setOpen] = useState(false);
  const byKey = Object.fromEntries(forecast.outcomes.map((o) => [o.key, o.p]));
  const pA = byKey.a ?? 0;
  const pD = byKey.draw ?? 0;
  const pB = byKey.b ?? 0;
  const top = Math.max(pA, pD, pB);
  const pickKey = top === pA ? "a" : top === pB ? "b" : "draw";
  const name = (team: TeamView) => teamLabel(team, locale);
  const content = contentFor(forecast, locale);
  // Split into a shrinkable name part and a fixed percent so the chip can
  // ellipsize long team names on phones without ever clipping the number.
  const pickName =
    pickKey === "a"
      ? `${name(home)}${t(locale, "winSuffix")}`
      : pickKey === "b"
        ? `${name(away)}${t(locale, "winSuffix")}`
        : t(locale, "draw");
  const pickPct = pickKey === "a" ? pA : pickKey === "b" ? pB : pD;
  const date = forecast.event_slug.match(/(\d{2}-\d{2})$/)?.[1]?.replace("-", "/") ?? "";

  // Settled fixture: show the final score and a green ✅ when reality matched
  // the model's best pick (market-blind settlement mapping — no prices).
  const settled = result?.status === "resolved";
  const hit = settled && result?.winner === pickKey;

  return (
    <div className={styles.matchRow}>
      <button type="button" className={styles.matchTop} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.teamSide}>
          <span className={styles.teamFlag}>{home.flag}</span>
          <span className={styles.teamName}>{name(home)}</span>
        </span>
        <span className={styles.matchMid}>
          {settled ? (
            <span className={styles.scoreRow}>
              <span className={styles.scoreBadge}>
                {result?.score ? result.score.replace("-", " – ") : "—"}
              </span>
              <span className={styles.finalTag}>{t(locale, "finalTag")}</span>
            </span>
          ) : (
            <span className={styles.matchDate}>6/{date.split("/")[1] ?? date}</span>
          )}
          <span className={styles.triBar} aria-hidden>
            <span className={`${styles.triW} ${top !== pA ? styles.triDim : ""}`} style={{ width: `${pA * 100}%` }} />
            <span className={`${styles.triD} ${top !== pD ? styles.triDim : ""}`} style={{ width: `${pD * 100}%` }} />
            <span className={`${styles.triL} ${top !== pB ? styles.triDim : ""}`} style={{ width: `${pB * 100}%` }} />
          </span>
          <span className={styles.triLabels}>
            <span>{Math.round(pA * 100)}</span>
            <span>
              {t(locale, "drawShort")} {Math.round(pD * 100)}
            </span>
            <span>{Math.round(pB * 100)}</span>
          </span>
          <span className={`${styles.pickChip} ${settled ? (hit ? styles.pickHit : styles.pickMiss) : ""}`}>
            <span className={styles.pickName}>{pickName}</span>
            <span className={styles.pickPct}>{Math.round(pickPct * 100)}%</span>
            {settled ? (
              <span className={styles.pickMark} title={t(locale, hit ? "pickHit" : "pickMiss")} aria-label={t(locale, hit ? "pickHit" : "pickMiss")}>
                {hit ? "✅" : "✕"}
              </span>
            ) : null}
          </span>
        </span>
        <span className={`${styles.teamSide} ${styles.teamSideAway}`}>
          <span className={styles.teamName}>{name(away)}</span>
          <span className={styles.teamFlag}>{away.flag}</span>
        </span>
      </button>
      {open ? (
        <div className={styles.matchDetail}>
          <p className={styles.oneLiner}>{content.oneLiner}</p>
          <ul className={styles.reasonList}>
            {forecast.key_reasons.map((r, i) => (
              <li key={r.source_url + r.source_date} className={styles.reasonItem}>
                {content.reasons[i]}{" "}
                <a href={r.source_url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                  {t(locale, "source")} · {r.source_date}
                </a>
              </li>
            ))}
          </ul>
          <div className={styles.cardActions}>
            <Link
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              href={withLocale(`/world-cup/forecast/${forecast.dir}`, locale)}
            >
              {t(locale, "fullReport")}
            </Link>
            <span className={styles.muted}>
              {forecast.n_sources} {t(locale, "sources")} · {t(locale, "confidence")}{" "}
              {tierLabel(locale, forecast.confidence_tier)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
