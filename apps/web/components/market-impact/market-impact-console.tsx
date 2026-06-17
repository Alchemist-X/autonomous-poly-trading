"use client";

// Market Impact Engine — To-C demo console (sibling to the Forecasting Engine
// /research console). Owns the page shell, a locale toggle, and a progressive
// reveal: click "Run forecast" → the analysis pipeline streams stage-by-stage →
// a decision-first verdict per stock across three horizons, with an open
// evidence pool. Self-contained: deterministic demo data, no backend.

import { useEffect, useState } from "react";
import styles from "./market-impact.module.css";
import { GLM4_DEMO } from "../../lib/market-impact/glm4-demo";
import { pick, type Direction, type HorizonForecast, type Locale, type TickerForecast } from "../../lib/market-impact/types";
import {
  DIRECTION_GLYPH,
  DIRECTION_LABEL,
  flipLocale,
  HORIZON_LABEL,
  HORIZON_SUB,
  STANCE_LABEL,
  UI
} from "../../lib/market-impact/i18n";

type Phase = "idle" | "running" | "complete";

const STAGE_MS = 620;

export function MarketImpactConsole() {
  const run = GLM4_DEMO;
  const [locale, setLocale] = useState<Locale>("en");
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealed, setRevealed] = useState(0); // stages completed so far

  const L = (en: string, zh: string) => pick(locale, en, zh);

  // Progressive reveal: advance one stage per tick while running, then complete.
  useEffect(() => {
    if (phase !== "running") return;
    if (revealed >= run.stages.length) {
      const t = setTimeout(() => setPhase("complete"), 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealed((r) => r + 1), STAGE_MS);
    return () => clearTimeout(t);
  }, [phase, revealed, run.stages.length]);

  const start = () => {
    setRevealed(0);
    setPhase("running");
  };
  const reset = () => {
    setPhase("idle");
    setRevealed(0);
  };

  const started = phase !== "idle";
  const running = phase === "running";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandDot} aria-hidden />
          <span className={styles.brandName}>{L(UI.brand.en, UI.brand.zh)}</span>
          <span className={styles.beta}>DEMO</span>
        </div>
        <button
          type="button"
          className={styles.localeToggle}
          onClick={() => setLocale(flipLocale(locale))}
          aria-label="Toggle language"
        >
          {locale === "en" ? "中文" : "EN"}
        </button>
      </header>

      <p className={styles.tagline}>{L(UI.tagline.en, UI.tagline.zh)}</p>

      {/* Composer — the catalyst card + run button */}
      <section className={styles.composer}>
        <div className={styles.composerRow}>
          <span className={styles.fieldLabel}>{L(UI.eventLabel.en, UI.eventLabel.zh)}</span>
          <span className={styles.eventDate}>{run.eventDate}</span>
        </div>
        <p className={styles.eventText}>{L(run.event_en, run.event_zh)}</p>
        <div className={styles.composerRow}>
          <span className={styles.fieldLabel}>{L(UI.tickersLabel.en, UI.tickersLabel.zh)}</span>
          <span className={styles.tickerChips}>
            {run.tickers.map((t) => (
              <span key={t.ticker} className={styles.tickerChip}>
                {t.ticker}
              </span>
            ))}
          </span>
        </div>
        <button type="button" className={styles.runButton} onClick={started ? reset : start} disabled={running}>
          {running ? L(UI.running.en, UI.running.zh) : started ? L(UI.rerun.en, UI.rerun.zh) : L(UI.run.en, UI.run.zh)}
        </button>
      </section>

      {/* Pipeline — progressive stage reveal */}
      {started && (
        <section className={styles.pipeline} aria-live="polite">
          <h2 className={styles.sectionTitle}>{L(UI.pipeline.en, UI.pipeline.zh)}</h2>
          <ol className={styles.stages}>
            {run.stages.map((s, i) => {
              const status = i < revealed ? "done" : i === revealed && running ? "active" : "pending";
              return (
                <li key={s.id} className={`${styles.stage} ${styles[status]}`}>
                  <span className={styles.stageMark} aria-hidden>
                    {status === "done" ? "✓" : status === "active" ? "" : ""}
                  </span>
                  <span className={styles.stageBody}>
                    <span className={styles.stageTitle}>{L(s.title_en, s.title_zh)}</span>
                    <span className={styles.stageSummary}>{L(s.summary_en, s.summary_zh)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Results — decision-first verdict + per-horizon grid */}
      {phase === "complete" && (
        <section className={styles.results}>
          <div className={styles.summaryCard}>
            <span className={styles.verdictTag}>{L(UI.verdictHeading.en, UI.verdictHeading.zh)}</span>
            <p className={styles.summaryText}>{L(run.summary_en, run.summary_zh)}</p>
          </div>

          {run.tickers.map((t) => (
            <TickerBlock key={t.ticker} t={t} locale={locale} L={L} />
          ))}

          {/* Evidence pool */}
          <div className={styles.evidencePool}>
            <h2 className={styles.sectionTitle}>{L(UI.evidencePool.en, UI.evidencePool.zh)}</h2>
            <div className={styles.evidenceGrid}>
              {run.evidence.map((e) => (
                <div key={e.id} className={`${styles.evidenceCard} ${styles[`stance_${e.stance}`]}`}>
                  <div className={styles.evidenceTop}>
                    <span className={styles.sourceBadge}>{e.sourceType}</span>
                    <span className={styles.stanceBadge}>{L(STANCE_LABEL[e.stance].en, STANCE_LABEL[e.stance].zh)}</span>
                    <span className={styles.evidenceDate}>{e.date}</span>
                  </div>
                  <p className={styles.evidenceTitle}>{L(e.title_en, e.title_zh)}</p>
                  <p className={styles.evidenceExcerpt}>{L(e.excerpt_en, e.excerpt_zh)}</p>
                  <div className={styles.evidenceMeta}>
                    <span>
                      {L(UI.weight.en, UI.weight.zh)} {e.weightPct}%
                    </span>
                    <span>
                      {L(UI.reliability.en, UI.reliability.zh)} {Math.round(e.reliability * 100)}%
                    </span>
                    {e.url && (
                      <a className={styles.evidenceLink} href={e.url} target="_blank" rel="noopener noreferrer">
                        source ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <span className={styles.notAdvice}>{L(UI.notAdvice.en, UI.notAdvice.zh)}</span>
        <span className={styles.disclaimer}>{L(run.disclaimer_en, run.disclaimer_zh)}</span>
      </footer>
    </div>
  );
}

function TickerBlock({ t, locale, L }: { t: TickerForecast; locale: Locale; L: (en: string, zh: string) => string }) {
  return (
    <div className={styles.tickerBlock}>
      <div className={styles.tickerHead}>
        <span className={styles.tickerSymbol}>{t.ticker}</span>
        <span className={styles.tickerName}>{L(t.name_en, t.name_zh)}</span>
      </div>
      <p className={styles.tickerVerdict}>{L(t.verdict_en, t.verdict_zh)}</p>
      <div className={styles.horizonGrid}>
        {t.horizons.map((h) => (
          <HorizonCell key={h.horizon} h={h} L={L} />
        ))}
      </div>
    </div>
  );
}

function HorizonCell({ h, L }: { h: HorizonForecast; L: (en: string, zh: string) => string }) {
  const dir: Direction = h.direction;
  return (
    <div className={`${styles.horizonCell} ${styles[`dir_${dir}`]}`}>
      <div className={styles.horizonHead}>
        <span className={styles.horizonLabel}>{L(HORIZON_LABEL[h.horizon].en, HORIZON_LABEL[h.horizon].zh)}</span>
        <span className={styles.horizonSub}>{L(HORIZON_SUB[h.horizon].en, HORIZON_SUB[h.horizon].zh)}</span>
      </div>
      <div className={styles.dirRow}>
        <span className={`${styles.dirChip} ${styles[`chip_${dir}`]}`}>
          <span className={styles.dirGlyph} aria-hidden>
            {DIRECTION_GLYPH[dir]}
          </span>
          {L(DIRECTION_LABEL[dir].en, DIRECTION_LABEL[dir].zh)}
        </span>
        <span className={styles.confidence}>{Math.round(h.confidence * 100)}%</span>
      </div>
      <div className={styles.magnitude}>{L(h.magnitude_en, h.magnitude_zh)}</div>
      <p className={styles.thesis}>{L(h.thesis_en, h.thesis_zh)}</p>
      <ul className={styles.drivers}>
        {h.drivers.map((d, i) => (
          <li key={i} className={styles.driver}>
            {L(d.en, d.zh)}
          </li>
        ))}
      </ul>
    </div>
  );
}
