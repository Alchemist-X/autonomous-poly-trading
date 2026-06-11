import type { Metadata } from "next";
import Link from "next/link";
import { WorldCupHeader } from "../../components/world-cup/wc-header";
import { LegalFooter } from "../../components/world-cup/legal-footer";
import { FormulaCard } from "../../components/world-cup/formula-card";
import { SampleRun, type SampleView } from "../../components/world-cup/sample-run";
import { getPredictionAccessState } from "../../lib/prediction-access";
import { contentFor, getAllForecasts, sortedOutcomes } from "../../lib/world-cup/forecast-store";
import { resolveTeam } from "../../lib/world-cup/team-meta";
import { langOf, localePe, localeSteps, t, teamLabel, tierLabel, withLang, type Lang } from "../../lib/world-cup/i18n";
import styles from "../../components/world-cup/world-cup.module.css";

export const metadata: Metadata = {
  title: "本地部署 · Self-host — Predict Raven",
  description:
    "Run the forecasting agent yourself: layered evidence, Elo prior, 100k Monte-Carlo simulations, Bayesian updates from key evidence — never a market price."
};

export const dynamic = "force-dynamic";

interface BiText {
  zh: string;
  en: string;
}

// Pipeline steps mirror the published methodology (data layering → statistical
// model → Bayesian dynamic update → confidence tiers → public scoring).
const STEPS: ReadonlyArray<{ n: string; title: BiText; copy: BiText; tag: BiText }> = [
  {
    n: "01",
    title: { zh: "选一个问题", en: "Pick a question" },
    copy: {
      zh: "任意一场比赛、小组头名或夺冠概率。提出问题，剩下交给 forecasting agent。",
      en: "Any match, group winner, or title odds. You ask; the forecasting agent does the rest."
    },
    tag: { zh: "输入", en: "Input" }
  },
  {
    n: "02",
    title: { zh: "分层证据收集", en: "Layered evidence" },
    copy: {
      zh: "按优先级收集公开数据：近期国家队战绩、俱乐部状态、伤停与首发、环境因素（场地 / 海拔 / 天气）。每条带日期与来源；赔率页面一律丢弃。",
      en: "Public data gathered by priority: recent national-team results, club form, injuries and lineups, environment (venue, altitude, weather). Every fact dated and sourced; odds pages discarded on sight."
    },
    tag: { zh: "数据分层 · 市场盲测", en: "Data layers · market-blind" }
  },
  {
    n: "03",
    title: { zh: "统计基线", en: "Statistical baseline" },
    copy: {
      zh: "实时 Elo 评级进入 Davidson 三路模型，得出单场胜 / 平 / 负；晋级与夺冠类问题在官方对阵树上跑 10 万次蒙特卡洛锦标赛模拟。",
      en: "Live Elo feeds a Davidson three-way model for matches; qualification and title questions run 100,000 Monte-Carlo tournament simulations on the official bracket."
    },
    tag: { zh: "Elo · Monte Carlo", en: "Elo · Monte Carlo" }
  },
  {
    n: "04",
    title: { zh: "贝叶斯更新", en: "Bayesian update" },
    copy: {
      zh: "把关键证据折算成对先验的有界修正：单场最多 ±8 个百分点，没有证据就不动数；每个输出附置信分档（高 / 中 / 低）。",
      en: "Key evidence becomes a bounded shift on the prior: at most ±8 points per match, nothing moves without evidence; every output carries a confidence tier."
    },
    tag: { zh: "±8pp · 置信分档", en: "±8pp · confidence tiers" }
  },
  {
    n: "05",
    title: { zh: "报告与公开记分", en: "Report & public scoring" },
    copy: {
      zh: "多语言报告带全部来源与方法附录；赛后逐题公开记 Brier 分数，错了也留档。",
      en: "Multilingual reports with full sources and methods; every question Brier-scored in public after settlement — wrong calls stay on record."
    },
    tag: { zh: "可追溯", en: "Traceable" }
  }
];

const SAMPLE_IDS = ["match:fifwc-mex-rsa-2026-06-11", "group-winner:e", "champion"] as const;

function buildSamples(lang: Lang): SampleView[] {
  const all = getAllForecasts();
  const chipKey = { "match:fifwc-mex-rsa-2026-06-11": "tabGroups", "group-winner:e": "winnerPick", champion: "tabChampion" } as const;
  return SAMPLE_IDS.flatMap((id) => {
    const f = all.find((x) => x.id === id);
    if (!f) return [];
    const content = contentFor(f, lang);
    const outcomes = sortedOutcomes(f)
      .slice(0, f.family === "group_match" ? 3 : 4)
      .map((o) => ({
        label: o.key === "draw" ? t(lang, "draw") : teamLabel(resolveTeam(o.label_en || o.key), lang),
        p: o.p
      }));
    return [
      {
        id,
        chip: t(lang, chipKey[id]),
        question: content.question,
        outcomes,
        oneLiner: content.oneLiner,
        reasons: content.reasons.slice(0, 2),
        reportHref: withLang(`/world-cup/forecast/${f.dir}`, lang),
        meta: `${f.n_sources} ${t(lang, "sources")} · ${t(lang, "confidence")} ${tierLabel(lang, f.confidence_tier)}`,
        reportLabel: t(lang, "fullReport")
      }
    ];
  });
}

export default async function PredictionEnginePage({
  searchParams
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = langOf((await searchParams).lang);
  const access = await getPredictionAccessState();
  const pe = localePe(lang);
  const bi = (x: BiText) => (lang === "zh" ? x.zh : x.en);
  const steps = localeSteps(lang) ?? STEPS.map((x) => ({ n: x.n, title: bi(x.title), copy: bi(x.copy), tag: bi(x.tag) }));
  const samples = buildSamples(lang);

  let cta: { href: string; label: string } | null = null;
  if (access.mode === "unauthenticated") {
    cta = { href: access.signInUrl ?? "/sign-in", label: pe.ctaSignin ?? (lang === "zh" ? "登录开始运行" : "Sign in to run") };
  } else if (access.mode === "pending_invite") {
    cta = { href: access.inviteUrl ?? "/invite", label: pe.ctaInvite ?? (lang === "zh" ? "输入邀请码激活" : "Enter invite code") };
  }
  const isReady = access.mode === "ready" || access.mode === "disabled";

  return (
    <div className={styles.shell}>
      <WorldCupHeader />
      <div className={styles.container}>
        <section className={styles.peHero}>
          <p className={styles.peKicker}>
            {lang === "zh" ? "Forecasting Agent" : "Forecasting Agent"}
          </p>
          <h1 className={styles.peTitle}>
            {pe.title ?? (lang === "zh" ? "亲手运行一次 forecasting agent。" : "Run the forecasting agent yourself.")}
          </h1>
          <p className={styles.peSub}>
            {pe.sub ??
              (lang === "zh"
                ? "87 个公开世界杯预测背后的同一条管线：Elo 先验 + 10 万次蒙特卡洛模拟 + 关键证据的贝叶斯更新——全程不看任何市场价格。"
                : "The same pipeline behind our 87 published forecasts: an Elo prior, 100,000 Monte-Carlo simulations, and Bayesian updates from key evidence — never a single market price.")}
          </p>
          {cta ? (
            <div className={styles.ctaRow} style={{ justifyContent: "center" }}>
              <Link className={`${styles.btn} ${styles.btnPrimary}`} href={cta.href}>
                {cta.label}
              </Link>
              <Link className={`${styles.btn} ${styles.btnGhost}`} href={withLang("/world-cup", lang)}>
                {pe.seeFirst ?? (lang === "zh" ? "先看我们的预测" : "See our forecasts first")}
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

        <FormulaCard lang={lang} />

        {isReady ? (
          <section className={styles.wbCard}>
            <div className={styles.wbHead}>
              <h2 className={styles.panelTitle} style={{ margin: 0 }}>
                {t(lang, "workbench")}
              </h2>
              <span className={styles.wbStatus}>{t(lang, "wbReady")}</span>
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
              {t(lang, "wbSoon")}
            </p>
          </section>
        ) : null}

        <SampleRun samples={samples} title={t(lang, "sampleTitle")} hint={t(lang, "sampleHint")} />

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
      <LegalFooter />
    </div>
  );
}
