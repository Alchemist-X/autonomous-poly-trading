import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport } from "../../../lib/world-cup/report-store";
import styles from "../../../components/world-cup/world-cup.module.css";

export const dynamic = "force-dynamic";

function pct(value: number | null): string {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

export default async function WorldCupMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const report = await getReport(matchId);
  if (!report) notFound();

  const headline = report.outcomes.find((o) => o.outcome === report.headlineOutcome);

  return (
    <div>
      <section className={styles.hero}>
        <p className={styles.muted}>
          <Link href="/world-cup" style={{ color: "#8fa3c8" }}>
            ← 全部赛程
          </Link>{" "}
          · {report.meta.stage} · {report.meta.kickoffUtc ? report.meta.kickoffUtc.slice(0, 10) : "日期待定"}
        </p>
        <h1 className={styles.heroTitle}>
          {report.meta.homeTeam} vs {report.meta.awayTeam}
        </h1>
        <p className={styles.heroSub}>
          主判断：<strong>{headline?.label}</strong> {pct(headline?.modelProbability ?? null)}（置信度 {report.confidenceTier}）。
          {report.run.conclusion.verdict}
        </p>
        <div className={styles.ctaRow}>
          <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/world-cup/${matchId}/report`}>
            看完整报告
          </Link>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href={`/prediction-engine?event=${matchId}`}>
            自己跑一个
          </Link>
        </div>
      </section>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>胜 / 平 / 负</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>结果</th>
              <th>模型</th>
              <th>市场</th>
              <th>偏差信号</th>
            </tr>
          </thead>
          <tbody>
            {report.outcomes.map((o) => (
              <tr key={o.outcome}>
                <td>{o.label}</td>
                <td>{pct(o.modelProbability)}</td>
                <td>{pct(o.marketProbability)}</td>
                <td className={(o.edge ?? 0) > 0 ? styles.tierHigh : styles.muted}>
                  {o.edge == null ? "—" : `${o.edge > 0 ? "+" : ""}${(o.edge * 100).toFixed(1)}pp`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
