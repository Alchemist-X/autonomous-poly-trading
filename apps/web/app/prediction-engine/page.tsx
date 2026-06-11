import type { Metadata } from "next";
import Link from "next/link";
import { PredictionEngineDemo } from "../../components/prediction-engine-demo";
import { WorldCupHeader } from "../../components/world-cup/wc-header";
import { LegalFooter } from "../../components/world-cup/legal-footer";
import { buildPredictionDemoRun, DEFAULT_PREDICTION_EVENT } from "../../lib/prediction-engine-demo";
import { getPredictionAccessState } from "../../lib/prediction-access";
import { langOf, type Lang } from "../../lib/world-cup/i18n";
import styles from "../../components/world-cup/world-cup.module.css";

export const metadata: Metadata = {
  title: "本地部署 · Self-host — Predict Raven",
  description:
    "Run the same market-blind forecasting pipeline we publish: sourced evidence, Elo/Monte-Carlo baseline, bounded adjustment, public scoring."
};

export const dynamic = "force-dynamic";

interface BiText {
  zh: string;
  en: string;
}

const STEPS: ReadonlyArray<{ n: string; title: BiText; copy: BiText; tag: BiText }> = [
  {
    n: "01",
    title: { zh: "选一个问题", en: "Pick a question" },
    copy: {
      zh: "任意一场世界杯比赛，或一个晋级 / 夺冠问题。引擎接管之后的所有步骤——你只需要提出问题。",
      en: "Any World Cup match, or any qualification / title question. The engine takes over from there — you only ask."
    },
    tag: { zh: "输入", en: "Input" }
  },
  {
    n: "02",
    title: { zh: "证据收集", en: "Evidence gathering" },
    copy: {
      zh: "检索带日期与出处的公开信息：伤停、首发、状态、天气、动机。每一条都必须有来源链接；任何赔率或盘口页面都会被直接丢弃。",
      en: "Dated, sourced public information: injuries, lineups, form, weather, stakes. Every fact carries a source link; any odds or betting page is discarded on sight."
    },
    tag: { zh: "盲测纪律", en: "Market-blind discipline" }
  },
  {
    n: "03",
    title: { zh: "统计基线", en: "Statistical baseline" },
    copy: {
      zh: "实时 Elo 评级进入 Davidson 三路模型，晋级类问题走十万次蒙特卡洛模拟。这是概率的承重墙——可复算、可审计。",
      en: "Live Elo ratings feed a Davidson three-way model; qualification questions run 100,000 Monte-Carlo tournament simulations. This is the load-bearing wall — reproducible and auditable."
    },
    tag: { zh: "Elo · Monte Carlo", en: "Elo · Monte Carlo" }
  },
  {
    n: "04",
    title: { zh: "有界修正", en: "Bounded adjustment" },
    copy: {
      zh: "只有引用得出的证据才允许移动基线，单场最多 ±8 个百分点。没有证据，就没有调整——模型不允许凭感觉改数。",
      en: "Only cited evidence may move the baseline, capped at ±8 percentage points per match. No evidence, no adjustment — vibes don't get to edit numbers."
    },
    tag: { zh: "±8pp 上限", en: "±8pp cap" }
  },
  {
    n: "05",
    title: { zh: "报告与公开记分", en: "Report & public scoring" },
    copy: {
      zh: "输出带完整来源清单与方法附录的双语报告。赛后用 Brier 分数公开记账，预测错了也照样记录在案。",
      en: "A bilingual report with a full source list and methods appendix. After each match we book the Brier score in public — wrong calls stay on the record."
    },
    tag: { zh: "可追溯", en: "Traceable" }
  }
];

function Intro({ cta, lang }: { cta: { href: string; label: string } | null; lang: Lang }) {
  return (
    <>
      <section className={styles.peHero}>
        <p className={styles.peKicker}>
          {lang === "en" ? "Prediction Engine · Invite-only beta" : "Prediction Engine · 邀请制 Beta"}
        </p>
        <h1 className={styles.peTitle}>
          {lang === "en" ? "Run a market-blind forecast yourself." : "亲手跑一次盲测预测。"}
        </h1>
        <p className={styles.peSub}>
          {lang === "en"
            ? "The exact pipeline behind our 87 published World Cup forecasts: no market prices, just evidence and statistics."
            : "和我们发布 87 个世界杯预测用的是同一条管线：不看任何市场价格，只用证据和统计模型说话。"}
        </p>
        {cta ? (
          <div className={styles.ctaRow} style={{ justifyContent: "center" }}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href={cta.href}>
              {cta.label}
            </Link>
            <Link
              className={`${styles.btn} ${styles.btnGhost}`}
              href={lang === "en" ? "/world-cup?lang=en" : "/world-cup"}
            >
              {lang === "en" ? "See our forecasts first" : "先看我们的预测"}
            </Link>
          </div>
        ) : null}
      </section>
      <div className={styles.peSteps}>
        {STEPS.map((s) => (
          <section key={s.n} className={styles.peStep}>
            <span className={styles.peStepNum}>{s.n}</span>
            <div>
              <h2 className={styles.peStepTitle}>{s.title[lang]}</h2>
              <p className={styles.peStepCopy}>{s.copy[lang]}</p>
              <span className={styles.peStepTag}>{s.tag[lang]}</span>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default async function PredictionEnginePage({
  searchParams
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = langOf((await searchParams).lang);
  const access = await getPredictionAccessState();

  let cta: { href: string; label: string } | null = null;
  let notice: string | null = null;
  if (access.mode === "unauthenticated") {
    cta = {
      href: access.signInUrl ?? "/sign-in",
      label: lang === "en" ? "Sign in to run" : "登录开始运行"
    };
  } else if (access.mode === "pending_invite") {
    cta = {
      href: access.inviteUrl ?? "/invite",
      label: lang === "en" ? "Enter invite code" : "输入邀请码激活"
    };
  } else if (access.mode === "ready" || access.mode === "disabled") {
    cta = { href: "#run", label: lang === "en" ? "Start running ↓" : "开始运行 ↓" };
  } else if (access.mode === "suspended") {
    notice = lang === "en" ? "This account cannot run forecasts right now." : "这个账号当前不能运行预测任务。";
  } else {
    notice = "Prediction auth is required for this deployment, but required settings are missing.";
  }

  return (
    <div className={styles.shell}>
      <WorldCupHeader />
      <div className={styles.container}>
        <Intro cta={cta} lang={lang} />
        {notice ? (
          <div className={styles.panel} style={{ marginBottom: 48 }}>
            <p className={styles.muted}>{notice}</p>
          </div>
        ) : null}
        {access.mode === "ready" || access.mode === "disabled" ? (
          <section id="run" style={{ marginBottom: 64 }}>
            <PredictionEngineDemo
              initialRun={buildPredictionDemoRun({ eventText: DEFAULT_PREDICTION_EVENT, marketPrice: 30 })}
              access={access}
            />
          </section>
        ) : null}
        {cta && access.mode !== "ready" && access.mode !== "disabled" ? (
          <div className={styles.peCtaBand}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href={cta.href}>
              {cta.label}
            </Link>
          </div>
        ) : null}
      </div>
      <LegalFooter />
    </div>
  );
}
