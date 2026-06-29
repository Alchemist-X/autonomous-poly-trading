"use client";

import { useState } from "react";
import type { Fifa8Fixture, ForecasterMeta, Pick, Tier } from "../../lib/world-cup/fifa8-store";
import { resolveTeam } from "../../lib/world-cup/team-meta";
import { t, teamLabel, type Locale, type StrKey } from "../../lib/world-cup/i18n";
import styles from "./world-cup.module.css";

// One Round-of-32 fixture, market-blind: the multi-calibrated headline call
// (favoured side + win %, plain-language verdict, confidence chip), a per-model
// comparison of all nine forecasters' win / draw / loss splits, and an
// expandable list of the headline drivers. No prices anywhere on this surface.

function tierClass(tier: Tier) {
  if (tier === "high") return styles.tierHigh;
  if (tier === "medium") return styles.tierMedium;
  return styles.tierLow;
}

const TIER_LABEL_KEY: Record<Tier, StrKey> = {
  high: "tierHigh",
  medium: "tierMedium",
  low: "tierLow"
};

// Plain-language verdict, templated in the web per locale so prose stays
// jargon-free regardless of locale. `{team}` / `{pct}` filled from the data.
function verdict(locale: Locale, pick: Pick, favouredName: string, pct: number): string {
  const key: StrKey = pick === "draw" ? "knTplDraw" : "knTplPick";
  return t(locale, key).replace("{team}", favouredName).replace("{pct}", String(pct));
}

function Splits({ a, draw, b }: { a: number; draw: number; b: number }) {
  return (
    <span className={styles.knBar} aria-hidden>
      <span className={styles.knSegA} style={{ width: `${a * 100}%` }} />
      <span className={styles.knSegD} style={{ width: `${draw * 100}%` }} />
      <span className={styles.knSegB} style={{ width: `${b * 100}%` }} />
    </span>
  );
}

export function Fifa8MatchCard({
  fixture,
  meta,
  headlineId,
  locale
}: {
  fixture: Fifa8Fixture;
  meta: readonly ForecasterMeta[];
  headlineId: string;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);

  const headline = fixture.headline;
  const teamA = resolveTeam(fixture.teamA);
  const teamB = resolveTeam(fixture.teamB);
  const favouredMeta = headline.pick === "b" ? teamB : teamA;
  const favouredName = teamLabel(favouredMeta, locale);
  const nameA = teamLabel(teamA, locale);
  const nameB = teamLabel(teamB, locale);

  const metaById = new Map(meta.map((m) => [m.id, m]));

  return (
    <section className={styles.knCard}>
      <div className={styles.knCardTop}>
        <span className={styles.knMatchNo}>{t(locale, "knMatch").replace("{n}", String(fixture.matchNo))}</span>
        <span className={`${styles.knTierChip} ${tierClass(headline.tier)}`}>
          {t(locale, "confidence")} · {t(locale, TIER_LABEL_KEY[headline.tier])}
        </span>
      </div>

      <div className={styles.knMatchup}>
        <span className={styles.knTeam}>
          <span className={styles.knFlag}>{teamA.flag}</span>
          <span className={styles.knTeamName}>{nameA}</span>
        </span>
        <span className={styles.knVs}>{t(locale, "knVs")}</span>
        <span className={`${styles.knTeam} ${styles.knTeamAway}`}>
          <span className={styles.knTeamName}>{nameB}</span>
          <span className={styles.knFlag}>{teamB.flag}</span>
        </span>
      </div>

      <p className={styles.knVerdict}>{verdict(locale, headline.pick, favouredName, headline.pickPct)}</p>

      <div className={styles.knHeadlineSplits}>
        <Splits a={headline.a} draw={headline.draw} b={headline.b} />
        <span className={styles.knSplitLabels}>
          <span className={styles.knSplitA}>{nameA} {Math.round(headline.a * 100)}%</span>
          <span className={styles.knSplitD}>{t(locale, "draw")} {Math.round(headline.draw * 100)}%</span>
          <span className={styles.knSplitB}>{nameB} {Math.round(headline.b * 100)}%</span>
        </span>
      </div>

      <div className={styles.knModels}>
        <div className={styles.knModelsHead}>{t(locale, "knModelsTitle")}</div>
        <div className={styles.knModelGrid}>
          {fixture.forecasters.map((row) => {
            const m = metaById.get(row.id);
            const isHeadline = row.id === headlineId;
            return (
              <div
                key={row.id}
                className={`${styles.knModelRow} ${isHeadline ? styles.knModelRowLead : ""}`}
              >
                <span className={styles.knModelName} title={m?.name ?? row.id}>
                  {m?.name ?? row.id}
                  {isHeadline ? <span className={styles.knLeadBadge}>{t(locale, "knPublished")}</span> : null}
                </span>
                <Splits a={row.a} draw={row.draw} b={row.b} />
                <span className={styles.knModelNums}>
                  <span className={styles.knNumA}>{Math.round(row.a * 100)}</span>
                  <span className={styles.knNumD}>{Math.round(row.draw * 100)}</span>
                  <span className={styles.knNumB}>{Math.round(row.b * 100)}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className={styles.knLegend}>
          <span><span className={`${styles.knDot} ${styles.knDotA}`} />{nameA}</span>
          <span><span className={`${styles.knDot} ${styles.knDotD}`} />{t(locale, "draw")}</span>
          <span><span className={`${styles.knDot} ${styles.knDotB}`} />{nameB}</span>
        </div>
      </div>

      <button
        type="button"
        className={styles.knToggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? t(locale, "knHideWhy") : t(locale, "knWhy")}
      </button>

      {open ? (
        <div className={styles.knDrivers}>
          <ul className={styles.knDriverList}>
            {headline.drivers.map((d) => (
              <li key={d.label} className={styles.knDriverItem}>
                <span className={styles.knDriverLabel}>{d.label}</span>
                <span className={styles.knDriverDetail}>{d.detail}</span>
              </li>
            ))}
          </ul>
          <p className={styles.knMethodNote}>{t(locale, "knMarketBlindNote")}</p>
        </div>
      ) : null}
    </section>
  );
}
