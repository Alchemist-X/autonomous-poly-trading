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

// The published (multi-calibrated) headline exposes a small fixed set of driver
// labels; map them to i18n keys so the "why" panel is localized rather than
// showing the engine's raw English. (The headline forecaster only ever emits
// these labels, so the English fallback below is a safety net, not a live path.)
const DRIVER_KEY: Record<string, StrKey> = {
  "Consensus of all models": "knDriverConsensus",
  "Bias correction": "knDriverBias"
};

// Round three probabilities to integer percents that sum to exactly 100
// (largest-remainder), so a displayed split never reads 99% or 101%.
function pct3(a: number, draw: number, b: number): [number, number, number] {
  const raw = [a * 100, draw * 100, b * 100] as const;
  const out: [number, number, number] = [Math.floor(raw[0]), Math.floor(raw[1]), Math.floor(raw[2])];
  let remainder = Math.max(0, Math.min(3, 100 - out[0] - out[1] - out[2]));
  // Award each remaining point to the largest fractional part, highest first.
  const fracs: Array<[number, number]> = [
    [0, raw[0] - out[0]],
    [1, raw[1] - out[1]],
    [2, raw[2] - out[2]]
  ];
  fracs.sort((x, y) => y[1] - x[1]);
  for (const [idx] of fracs) {
    if (remainder <= 0) break;
    if (idx === 0) out[0] += 1;
    else if (idx === 1) out[1] += 1;
    else out[2] += 1;
    remainder -= 1;
  }
  return out;
}

// Plain-language verdict, templated in the web per locale so prose stays
// jargon-free regardless of locale. `{team}` / `{pct}` filled from the data.
function verdict(locale: Locale, pick: Pick, favouredName: string, pct: number): string {
  const key: StrKey = pick === "draw" ? "knTplDraw" : "knTplPick";
  return t(locale, key).replace("{team}", favouredName).replace("{pct}", String(pct));
}

// One localized driver line: which way the factor leaned, and by how much.
function driverDetail(locale: Locale, contributionPp: number, nameA: string, nameB: string): string {
  const fav = contributionPp >= 0 ? nameA : nameB;
  const sign = contributionPp >= 0 ? "+" : "−";
  return t(locale, "knDriverPp")
    .replace("{sign}", sign)
    .replace("{pp}", Math.abs(contributionPp).toFixed(1))
    .replace("{team}", fav);
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

  // Sum-to-100 percents drive BOTH the verdict number and the split labels, so
  // the headline % and the bar labels can never disagree.
  const [pa, pd, pb] = pct3(headline.a, headline.draw, headline.b);
  const headlinePct = headline.pick === "b" ? pb : headline.pick === "draw" ? pd : pa;

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

      <p className={styles.knVerdict}>{verdict(locale, headline.pick, favouredName, headlinePct)}</p>

      <div className={styles.knHeadlineSplits}>
        <Splits a={headline.a} draw={headline.draw} b={headline.b} />
        <span className={styles.knSplitLabels}>
          <span className={styles.knSplitA}>{nameA} {pa}%</span>
          <span className={styles.knSplitD}>{t(locale, "draw")} {pd}%</span>
          <span className={styles.knSplitB}>{nameB} {pb}%</span>
        </span>
      </div>

      <div className={styles.knModels}>
        <div className={styles.knModelsHead}>{t(locale, "knModelsTitle")}</div>
        <div className={styles.knModelGrid}>
          {fixture.forecasters.map((row) => {
            const m = metaById.get(row.id);
            const isHeadline = row.id === headlineId;
            const [ra, rd, rb] = pct3(row.a, row.draw, row.b);
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
                  <span className={styles.knNumA}>{ra}</span>
                  <span className={styles.knNumD}>{rd}</span>
                  <span className={styles.knNumB}>{rb}</span>
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
            {headline.drivers.map((d, i) => {
              const labelKey = DRIVER_KEY[d.label];
              return (
                <li key={i} className={styles.knDriverItem}>
                  <span className={styles.knDriverLabel}>{labelKey ? t(locale, labelKey) : d.label}</span>
                  <span className={styles.knDriverDetail}>{driverDetail(locale, d.contributionPp, nameA, nameB)}</span>
                </li>
              );
            })}
          </ul>
          <p className={styles.knMethodNote}>{t(locale, "knMarketBlindNote")}</p>
        </div>
      ) : null}
    </section>
  );
}
