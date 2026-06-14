"use client";

// Top-level client orchestrator for the Forecasting Engine page. Owns the page
// shell (header + language toggle + footer), the input composer, the SSE stream,
// and the live visualisation: state-machine legend → staged timeline → final
// charts. Conversational and progressive — nothing below the composer exists
// until a run starts. Locale lives here so chrome, streamed content, and footer
// all switch together; English is the default to match the public-site apex.

import { useState } from "react";
import Link from "next/link";
import { DEFAULT_TIER, NORN_TIER_LIST, type NornTier } from "@autopoly/norns";
import styles from "./research.module.css";
import { useResearchStream } from "../../lib/research/use-research-stream";
import { c } from "../../lib/research/i18n";
import { DEFAULT_CONSOLE_LOCALE, type ConsoleLocale } from "../../lib/research/locale";
import { StateMachineLegend } from "./state-machine-legend";
import { StageTimeline } from "./stage-timeline";
import { ResultCharts } from "./result-charts";
import { SAMPLE_CASES, type SampleCase } from "../../lib/research/sample-cases";
import { LegalFooter } from "../world-cup/legal-footer";
import type { Locale as WorldCupLocale } from "../../lib/world-cup/i18n";

const DRIVER_LABEL: Record<string, string> = {
  mock: "MOCK",
  api: "API · Chain B",
  vps: "VPS · Chain A"
};

// tier id → display label, derived from the canonical Norns table.
const TIER_LABEL: Record<string, string> = Object.fromEntries(
  NORN_TIER_LIST.map((spec) => [spec.tier, spec.label])
);

// Console locale → the World Cup footer's locale (it carries the shared
// compliance footer; it has no "zh" so we map to the simplified variant).
const FOOTER_LOCALE: Record<ConsoleLocale, WorldCupLocale> = { en: "en", zh: "zh-CN" };

export function ResearchConsole() {
  const { state, start, reset } = useResearchStream();
  const [locale, setLocale] = useState<ConsoleLocale>(DEFAULT_CONSOLE_LOCALE);
  const [eventText, setEventText] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [tier, setTier] = useState<NornTier>(DEFAULT_TIER);

  const running = state.phase === "running";
  const started = state.phase !== "idle";

  const submit = () => {
    const trimmed = eventText.trim();
    if (!trimmed || running) {
      return;
    }
    const parsedMarket = marketPrice.trim() === "" ? null : Number(marketPrice);
    void start({
      eventText: trimmed,
      marketPrice: Number.isFinite(parsedMarket as number) ? parsedMarket : null,
      tier,
      locale
    });
  };

  // Cached example: populate the composer for transparency, then run it right
  // away so one click goes input → streamed steps → charts with no extra step.
  const runSample = (sample: SampleCase) => {
    if (running) {
      return;
    }
    const runTier = sample.tier ?? tier;
    const sampleText = sample.eventText[locale];
    setEventText(sampleText);
    setMarketPrice(String(sample.marketPrice));
    if (sample.tier) {
      setTier(sample.tier);
    }
    void start({ eventText: sampleText, marketPrice: sample.marketPrice, tier: runTier, locale });
  };

  const onComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <Link href="/research" className={styles.brand}>
            Predict Raven
            <span className={styles.brandTag}>Forecasting Engine</span>
          </Link>
          <div className={styles.headerRight}>
            <div className={styles.langToggle} role="radiogroup" aria-label={c(locale, "langLabel")}>
              <button
                type="button"
                role="radio"
                aria-checked={locale === "en"}
                className={`${styles.langBtn} ${locale === "en" ? styles.langBtnActive : ""}`}
                onClick={() => setLocale("en")}
                disabled={running}
              >
                EN
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={locale === "zh"}
                className={`${styles.langBtn} ${locale === "zh" ? styles.langBtnActive : ""}`}
                onClick={() => setLocale("zh")}
                disabled={running}
              >
                中文
              </button>
            </div>
            <Link href="/world-cup" className={styles.brandTag} style={{ textDecoration: "none" }}>
              {c(locale, "navWorldCup")}
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.heroKicker}>Forecasting Engine</p>
          <h1 className={styles.heroTitle}>{c(locale, "heroTitle")}</h1>
          <p className={styles.heroSub}>{c(locale, "heroSub")}</p>
        </section>

        <div className={styles.composer}>
          <textarea
            className={styles.composerInput}
            placeholder={c(locale, "composerPlaceholder")}
            value={eventText}
            onChange={(event) => setEventText(event.target.value)}
            onKeyDown={onComposerKeyDown}
            rows={2}
            disabled={running}
          />
          <div className={styles.tierRow}>
            <span className={styles.tierRowLabel}>{c(locale, "tierRowLabel")}</span>
            <div className={styles.tierGroup} role="radiogroup" aria-label={c(locale, "tierAria")}>
              {NORN_TIER_LIST.map((spec) => (
                <button
                  key={spec.tier}
                  type="button"
                  role="radio"
                  aria-checked={tier === spec.tier}
                  className={`${styles.tierChip} ${tier === spec.tier ? styles.tierChipActive : ""}`}
                  onClick={() => setTier(spec.tier)}
                  disabled={running}
                  title={spec.blurb}
                >
                  {spec.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.composerRow}>
            <label className={styles.marketField}>
              {c(locale, "marketLabel")}
              <input
                className={styles.marketInput}
                inputMode="decimal"
                placeholder={c(locale, "marketPlaceholder")}
                value={marketPrice}
                onChange={(event) => setMarketPrice(event.target.value)}
                disabled={running}
              />
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {started && !running ? (
                <button type="button" className={styles.secondaryBtn} onClick={reset}>
                  {c(locale, "resetBtn")}
                </button>
              ) : null}
              <button type="button" className={styles.runBtn} onClick={submit} disabled={running || !eventText.trim()}>
                {running ? c(locale, "runBtnBusy") : c(locale, "runBtnIdle")}
              </button>
            </div>
          </div>
          {!started ? (
            <div className={styles.examples}>
              <span className={styles.examplesHint}>{c(locale, "examplesHint")}</span>
              {SAMPLE_CASES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className={styles.exampleChip}
                  onClick={() => runSample(sample)}
                  title={sample.eventText[locale]}
                >
                  {sample.label[locale]}
                  <span className={styles.exampleChipSub}>{sample.blurb[locale]}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {started ? (
          <>
            <div className={styles.questionBubble}>
              <span className={styles.questionBubbleInner}>{state.eventText}</span>
            </div>

            {state.driver ? (
              <div className={styles.runMeta}>
                {state.tier ? <span className={styles.tierPill}>{TIER_LABEL[state.tier] ?? state.tier}</span> : null}
                <span className={styles.driverPill}>{DRIVER_LABEL[state.driver] ?? state.driver}</span>
              </div>
            ) : null}

            {state.notices.map((notice, index) => (
              <div
                key={`${index}-${notice.message.slice(0, 16)}`}
                className={`${styles.notice} ${notice.level === "warn" ? styles.noticeWarn : styles.noticeInfo}`}
              >
                {notice.message}
              </div>
            ))}

            <StateMachineLegend phase={state.phase} stages={state.stages} locale={locale} />

            {state.error ? (
              <div className={styles.errorBox}>
                {c(locale, "errorPrefix")}
                {state.error}
              </div>
            ) : null}

            <StageTimeline state={state} locale={locale} />
            <ResultCharts state={state} locale={locale} />
          </>
        ) : null}
      </main>

      <LegalFooter locale={FOOTER_LOCALE[locale]} />
    </div>
  );
}
