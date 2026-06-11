import type { Metadata } from "next";
import Link from "next/link";
import { PredictionEngineDemo } from "../../components/prediction-engine-demo";
import { WorldCupHeader } from "../../components/world-cup/wc-header";
import { LegalFooter } from "../../components/world-cup/legal-footer";
import { buildPredictionDemoRun, DEFAULT_PREDICTION_EVENT } from "../../lib/prediction-engine-demo";
import { getPredictionAccessState } from "../../lib/prediction-access";
import styles from "../../components/world-cup/world-cup.module.css";

export const metadata: Metadata = {
  title: "自己跑一次盲测预测 — Prediction Engine",
  description:
    "Run the same market-blind forecasting pipeline we publish: sourced evidence, Elo/Monte-Carlo baseline, bounded adjustment, public scoring."
};

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "选一个问题",
    copy: "任意一场世界杯比赛，或一个晋级 / 夺冠问题。引擎接管之后的所有步骤——你只需要提出问题。",
    tag: "输入"
  },
  {
    n: "02",
    title: "证据收集",
    copy: "检索带日期与出处的公开信息：伤停、首发、状态、天气、动机。每一条都必须有来源链接；任何赔率或盘口页面都会被直接丢弃。",
    tag: "盲测纪律"
  },
  {
    n: "03",
    title: "统计基线",
    copy: "实时 Elo 评级进入 Davidson 三路模型，晋级类问题走十万次蒙特卡洛模拟。这是概率的承重墙——可复算、可审计。",
    tag: "Elo · Monte Carlo"
  },
  {
    n: "04",
    title: "有界修正",
    copy: "只有引用得出的证据才允许移动基线，单场最多 ±8 个百分点。没有证据，就没有调整——模型不允许凭感觉改数。",
    tag: "±8pp 上限"
  },
  {
    n: "05",
    title: "报告与公开记分",
    copy: "输出带完整来源清单与方法附录的双语报告。赛后用 Brier 分数公开记账，预测错了也照样记录在案。",
    tag: "可追溯"
  }
] as const;

function Intro({ cta }: { cta: { href: string; label: string } | null }) {
  return (
    <>
      <section className={styles.peHero}>
        <p className={styles.peKicker}>Prediction Engine · 邀请制 Beta</p>
        <h1 className={styles.peTitle}>亲手跑一次盲测预测。</h1>
        <p className={styles.peSub}>
          和我们发布 87 个世界杯预测用的是同一条管线：不看任何市场价格，只用证据和统计模型说话。
        </p>
        {cta ? (
          <div className={styles.ctaRow} style={{ justifyContent: "center" }}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href={cta.href}>
              {cta.label}
            </Link>
            <Link className={`${styles.btn} ${styles.btnGhost}`} href="/world-cup">
              先看我们的预测
            </Link>
          </div>
        ) : null}
      </section>
      <div className={styles.peSteps}>
        {STEPS.map((s) => (
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
    </>
  );
}

export default async function PredictionEnginePage() {
  const access = await getPredictionAccessState();

  let cta: { href: string; label: string } | null = null;
  let notice: string | null = null;
  if (access.mode === "unauthenticated") {
    cta = { href: access.signInUrl ?? "/sign-in", label: "登录开始运行" };
  } else if (access.mode === "pending_invite") {
    cta = { href: access.inviteUrl ?? "/invite", label: "输入邀请码激活" };
  } else if (access.mode === "ready" || access.mode === "disabled") {
    cta = { href: "#run", label: "开始运行 ↓" };
  } else if (access.mode === "suspended") {
    notice = "这个账号当前不能运行预测任务。";
  } else {
    notice = "Prediction auth is required for this deployment, but required settings are missing.";
  }

  return (
    <div className={styles.shell}>
      <WorldCupHeader />
      <div className={styles.container}>
        <Intro cta={cta} />
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
