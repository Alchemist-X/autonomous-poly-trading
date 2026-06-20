import { getPerformance, type LegKey, type PerfLeg, type PerfMatch } from "../../lib/world-cup/performance";
import { resolveTeam } from "../../lib/world-cup/team-meta";
import { t, teamLabel, type Locale } from "../../lib/world-cup/i18n";
import styles from "./world-cup.module.css";

// 预测效果 / track-record detail: four headline metrics, one plain-language
// betting rule, then the full per-match read (collapsed by default) of our
// win/draw/loss probabilities vs the market at forecast time. Percentages only —
// no money is shown.

const SEG_CLASS = [styles.perfSegA, styles.perfSegD, styles.perfSegB] as const;
const WIDX: Record<LegKey, number> = { a: 0, draw: 1, b: 2 };

function Bar({ probs, winIdx }: { probs: readonly number[]; winIdx: number }) {
  return (
    <span className={styles.perfBar} aria-hidden>
      {probs.map((p, i) => (
        <span key={i} className={`${SEG_CLASS[i]} ${i === winIdx ? styles.perfSegWin : ""}`} style={{ width: `${p * 100}%` }}>
          {p >= 0.15 ? <span className={styles.perfSegPct}>{Math.round(p * 100)}</span> : null}
        </span>
      ))}
    </span>
  );
}

function legName(leg: LegKey, locale: Locale): string {
  return t(locale, leg === "a" ? "perfHome" : leg === "draw" ? "perfDraw" : "perfAway");
}

function LegChip({ leg, locale }: { leg: PerfLeg; locale: Locale }) {
  if (leg.side === "skip") {
    return <span className={`${styles.perfLegChip} ${styles.perfChipSkip}`}>{legName(leg.leg, locale)} · {t(locale, "perfSkip")}</span>;
  }
  const act = t(locale, leg.side === "yes" ? "perfBuy" : "perfFade");
  const ret = `${(leg.retPct ?? 0) >= 0 ? "+" : "−"}${Math.abs(leg.retPct ?? 0)}%`;
  return (
    <span className={`${styles.perfLegChip} ${leg.win ? styles.perfChipWin : styles.perfChipLoss}`}>
      {legName(leg.leg, locale)} {act} {ret}
    </span>
  );
}

function MatchRow({ m, locale }: { m: PerfMatch; locale: Locale }) {
  const home = resolveTeam(m.homeEn);
  const away = resolveTeam(m.awayEn);
  // Most fixtures carry an exact score; a few settle winner-only (the exact-score
  // feed had no result). Show the outcome (主胜/平/客胜) rather than an empty dash.
  const score = m.score ? m.score.replace("-", " – ") : legName(m.winner, locale);
  return (
    <div className={styles.perfMatch}>
      <div className={styles.perfMatchHead}>
        <span className={`${styles.perfTeamHome} ${m.winner === "a" ? styles.perfTeamWin : ""}`}>
          {home.flag} {teamLabel(home, locale)}
        </span>
        <span className={`${styles.perfScore} ${m.score ? "" : styles.perfScoreOutcome}`}>{score}</span>
        <span className={`${styles.perfTeamAway} ${m.winner === "b" ? styles.perfTeamWin : ""}`}>
          {teamLabel(away, locale)} {away.flag}
        </span>
      </div>
      <div className={styles.perfBars}>
        <span className={styles.perfBarLabel}>{t(locale, "perfOurs")}</span>
        <Bar probs={m.our} winIdx={WIDX[m.winner]} />
        <span className={styles.perfBarLabel}>{t(locale, "perfMkt")}</span>
        <Bar probs={m.mkt} winIdx={WIDX[m.winner]} />
      </div>
      <div className={styles.perfLegs}>
        {m.legs.map((l) => (
          <LegChip key={l.leg} leg={l} locale={locale} />
        ))}
      </div>
    </div>
  );
}

export function PerformanceDetail({ locale }: { locale: Locale }) {
  const { agg, matches, bins } = getPerformance();
  const sign = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}%`;
  const cards = [
    { label: t(locale, "perfHitRate"), value: `${agg.bestPickPct}%`, sub: `${agg.bestPickHit} / ${agg.settled} ${t(locale, "perfHitRateNote")}`, cls: styles.perfNeutral },
    { label: t(locale, "perfPnl"), value: sign(agg.roiPct), sub: `${agg.bets} ${t(locale, "perfBetsWord")}`, cls: agg.roiPct >= 0 ? styles.perfPos : styles.perfNeg },
    { label: t(locale, "perfSkill"), value: sign(agg.bssPct), sub: t(locale, "perfSkillNote"), cls: agg.bssPct >= 0 ? styles.perfPos : styles.perfNeg },
    { label: t(locale, "perfEce"), value: `${agg.ecePct}%`, sub: t(locale, "perfEceNote"), cls: styles.perfNeutral }
  ];
  return (
    <div>
      <div className={styles.perfCards}>
        {cards.map((c) => (
          <div key={c.label} className={styles.perfCard}>
            <span className={styles.perfCardLabel}>{c.label}</span>
            <span className={`${styles.perfCardValue} ${c.cls}`}>{c.value}</span>
            <span className={styles.perfCardSub}>{c.sub}</span>
          </div>
        ))}
      </div>

      <div className={styles.perfRule}>
        <p className={styles.perfRuleLine}>{t(locale, "perfRule")}</p>
        <p className={styles.perfRuleTerms}>{t(locale, "perfRuleTerms")}</p>
      </div>

      <details className={styles.perfAll}>
        <summary className={styles.perfAllSummary}>
          {t(locale, "perfAllToggle")} · {matches.length}
        </summary>
        <p className={styles.perfLegend}>{t(locale, "perfLegendNote")}</p>
        <div className={styles.perfList}>
          {matches.map((m) => (
            <MatchRow key={m.slug} m={m} locale={locale} />
          ))}
        </div>
      </details>

      <h2 className={styles.perfCalibTitle}>{t(locale, "perfCalibTitle")}</h2>
      <p className={styles.perfCalibNote}>{t(locale, "perfCalibNote")}</p>
      <div className={styles.perfCalib}>
        {bins.map((b) => (
          <div key={b.lo} className={styles.perfCalibRow}>
            <span className={styles.perfCalibBucket}>
              {Math.round(b.lo * 100)}–{Math.round(b.hi * 100)}%
            </span>
            <span className={styles.perfCalibTrack} aria-hidden>
              <span className={styles.perfCalibPred} style={{ width: `${b.predPct}%` }} />
              <span className={styles.perfCalibObs} style={{ width: `${b.obsPct}%` }} />
            </span>
            <span className={styles.perfCalibVals}>
              {t(locale, "perfPredicted")} {b.predPct}% · {t(locale, "perfObserved")} {b.obsPct}%
            </span>
          </div>
        ))}
      </div>

      <p className={styles.perfDisclaimer}>{t(locale, "perfDisclaimer")}</p>
    </div>
  );
}
