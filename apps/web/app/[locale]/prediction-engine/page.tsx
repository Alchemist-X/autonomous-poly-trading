import type { Metadata } from "next";
import Link from "next/link";
import { WorldCupHeader } from "../../../components/world-cup/wc-header";
import { FormulaCard } from "../../../components/world-cup/formula-card";
import { SampleRun, type SampleView } from "../../../components/world-cup/sample-run";
// Beta gate to the Deep Research console — disabled for now (see hero below).
// import { BetaAccess } from "../../../components/world-cup/beta-access";
import { getPredictionAccessState } from "../../../lib/prediction-access";
import { contentFor, getAllForecasts, sortedOutcomes } from "../../../lib/world-cup/forecast-store";
import { resolveTeam } from "../../../lib/world-cup/team-meta";
import { localeOf, t, teamLabel, tierLabel, withLocale, type Locale, type StrKey } from "../../../lib/world-cup/i18n";
import styles from "../../../components/world-cup/world-cup.module.css";

export const metadata: Metadata = {
  title: "本地部署 · Self-host — Predict Raven",
  description:
    "Run the forecasting agent yourself: layered evidence, Elo prior, 100k Monte-Carlo simulations, Bayesian updates from key evidence — never a market price."
};

export const dynamic = "force-dynamic";

// Pipeline steps mirror the published methodology (data layering → statistical
// model → Bayesian dynamic update → confidence tiers → public scoring). Copy
// lives in the message resource files (peStepN*).
const STEP_NUMS = [1, 2, 3, 4, 5] as const;

const SAMPLE_IDS = ["match:fifwc-mex-rsa-2026-06-11", "group-winner:e", "champion"] as const;
const CHIP_KEY: Record<(typeof SAMPLE_IDS)[number], StrKey> = {
  "match:fifwc-mex-rsa-2026-06-11": "tabGroups",
  "group-winner:e": "winnerPick",
  champion: "tabChampion"
};

function buildSamples(locale: Locale): SampleView[] {
  const all = getAllForecasts();
  return SAMPLE_IDS.flatMap((id) => {
    const f = all.find((x) => x.id === id);
    if (!f) return [];
    const content = contentFor(f, locale);
    const outcomes = sortedOutcomes(f)
      .slice(0, f.family === "group_match" ? 3 : 4)
      .map((o) => ({
        label: o.key === "draw" ? t(locale, "draw") : teamLabel(resolveTeam(o.label_en || o.key), locale),
        p: o.p
      }));
    return [
      {
        id,
        chip: t(locale, CHIP_KEY[id]),
        question: content.question,
        outcomes,
        oneLiner: content.oneLiner,
        reasons: content.reasons.slice(0, 2),
        reportHref: withLocale(`/world-cup/forecast/${f.dir}`, locale),
        meta: `${f.n_sources} ${t(locale, "sources")} · ${t(locale, "confidence")} ${tierLabel(locale, f.confidence_tier)}`,
        reportLabel: t(locale, "fullReport")
      }
    ];
  });
}

export default async function PredictionEnginePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = localeOf((await params).locale);
  const access = await getPredictionAccessState();
  const steps = STEP_NUMS.map((n) => ({
    n: String(n).padStart(2, "0"),
    title: t(locale, `peStep${n}Title` as StrKey),
    copy: t(locale, `peStep${n}Copy` as StrKey),
    tag: t(locale, `peStep${n}Tag` as StrKey)
  }));
  const samples = buildSamples(locale);

  let cta: { href: string; label: string } | null = null;
  if (access.mode === "unauthenticated") {
    cta = { href: access.signInUrl ?? withLocale("/sign-in", locale), label: t(locale, "peCtaSignin") };
  } else if (access.mode === "pending_invite") {
    cta = { href: access.inviteUrl ?? "/invite", label: t(locale, "peCtaInvite") };
  }
  const isReady = access.mode === "ready" || access.mode === "disabled";

  return (
    <div className={styles.shell}>
      <WorldCupHeader />
      <div className={styles.container}>
        <section className={styles.peHero}>
          <p className={styles.peKicker}>{t(locale, "peKicker")}</p>
          <div className={styles.peTitleRow}>
            <h1 className={styles.peTitle}>{t(locale, "peTitle")}</h1>
            {/* Beta access to the Deep Research console (/research) — folded into
                the codebase but disabled for now; re-enable by uncommenting this
                block and the BetaAccess import above.
            <BetaAccess
              target="/research"
              labels={{
                button: t(locale, "betaButton"),
                title: t(locale, "betaTitle"),
                desc: t(locale, "betaDesc"),
                placeholder: t(locale, "betaPlaceholder"),
                enter: t(locale, "betaEnter"),
                cancel: t(locale, "betaCancel"),
                wrong: t(locale, "betaWrong")
              }}
            /> */}
          </div>
          <p className={styles.peSub}>{t(locale, "peSub")}</p>
          {cta ? (
            <div className={styles.ctaRow} style={{ justifyContent: "center" }}>
              <Link className={`${styles.btn} ${styles.btnPrimary}`} href={cta.href}>
                {cta.label}
              </Link>
              <Link className={`${styles.btn} ${styles.btnGhost}`} href={withLocale("/world-cup", locale)}>
                {t(locale, "peSeeFirst")}
              </Link>
            </div>
          ) : null}
        </section>

        <div className={styles.peSteps}>
          {steps.map((s) => (
            <section key={s.n} className={styles.peStep}>
              <span className={styles.peStepNum}>{s.n}</span>
              <div>
                <h2 className={styles.peStepTitle}>{s.title}</h2>
                <p className={styles.peStepCopy}>{s.copy}</p>
                <span className={styles.peStepTag}>{s.tag}</span>
              </div>
            </section>
          ))}
        </div>

        <FormulaCard locale={locale} />

        {isReady ? (
          <section className={styles.wbCard}>
            <div className={styles.wbHead}>
              <h2 className={styles.panelTitle} style={{ margin: 0 }}>
                {t(locale, "workbench")}
              </h2>
              <span className={styles.wbStatus}>{t(locale, "wbReady")}</span>
            </div>
            <div className={styles.wbStages}>
              {steps.map((s, i) => (
                <span key={s.n} className={styles.wbStage}>
                  <i className={styles.wbDot} />
                  {s.title}
                  {i < steps.length - 1 ? <span className={styles.wbArrow}>→</span> : null}
                </span>
              ))}
            </div>
            <p className={styles.muted} style={{ fontSize: 13, margin: "10px 0 0" }}>
              {t(locale, "wbSoon")}
            </p>
          </section>
        ) : null}

        <SampleRun samples={samples} title={t(locale, "sampleTitle")} hint={t(locale, "sampleHint")} />

        {cta ? (
          <div className={styles.peCtaBand}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href={cta.href}>
              {cta.label}
            </Link>
          </div>
        ) : (
          <div style={{ height: 48 }} />
        )}
      </div>
    </div>
  );
}
