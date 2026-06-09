import Link from "next/link";
import { getAllSummaries } from "../../lib/world-cup/report-store";
import { DISCLAIMER_SHORT } from "../../lib/legal-copy";
import styles from "../../components/world-cup/world-cup.module.css";

export const dynamic = "force-dynamic";

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function outcomeText(summary: { headlineOutcome: string; homeTeam: string; awayTeam: string }): string {
  if (summary.headlineOutcome === "home") return `${summary.homeTeam} 胜`;
  if (summary.headlineOutcome === "away") return `${summary.awayTeam} 胜`;
  return "平局";
}

export default async function WorldCupHubPage() {
  const summaries = await getAllSummaries();

  return (
    <div>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>2026 世界杯 · AI 概率研究</h1>
        <p className={styles.heroSub}>
          独立 AI 超级预测器，公开记分。每场比赛给出胜/平/负概率、80% 置信区间，并对比 Polymarket
          市场价格给出研究偏差信号——用 Brier 公开记分，输了也照记。
        </p>
        <div className={styles.ctaRow}>
          <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/prediction-engine">
            自己跑一个预测
          </Link>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href="/world-cup/leaderboard">
            看公开记分牌
          </Link>
        </div>
        <p className={styles.disclaimer} style={{ marginTop: 16 }}>
          {DISCLAIMER_SHORT.zh}
        </p>
      </section>

      <h2 className={styles.sectionTitle}>赛程预测（{summaries.length} 场）</h2>
      {summaries.length === 0 ? (
        <div className={styles.panel}>
          <p className={styles.muted}>
            暂无缓存报告。运行 <code>pnpm tsx scripts/world-cup/generate-reports.ts</code> 生成。
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {summaries.map((summary) => (
            <Link key={summary.matchId} className={styles.card} href={`/world-cup/${summary.matchId}`}>
              <div className={styles.cardMeta}>
                <span>{summary.stage}</span>
                <span>{summary.kickoffUtc ? summary.kickoffUtc.slice(0, 10) : "日期待定"}</span>
              </div>
              <div className={styles.matchup}>
                {summary.homeTeam} vs {summary.awayTeam}
              </div>
              <div className={styles.headline}>
                <span>
                  <span className={styles.prob}>{pct(summary.headlineProbability)}</span>{" "}
                  <span className={styles.muted}>{outcomeText(summary)}</span>
                </span>
                {summary.headlineEdge != null ? (
                  <span className={`${styles.chip} ${summary.headlineEdge > 0 ? styles.chipPos : styles.chipNeg}`}>
                    {summary.headlineEdge > 0 ? "+" : ""}
                    {(summary.headlineEdge * 100).toFixed(1)}pp
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
