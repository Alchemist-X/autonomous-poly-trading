import Link from "next/link";
import { getAllReports } from "../../../lib/world-cup/report-store";
import styles from "../../../components/world-cup/world-cup.module.css";

export const dynamic = "force-dynamic";

// Public Brier scoreboard. MVP: matches are listed "awaiting resolution"; once
// resolved_outcome is backfilled (Phase 1), each row shows the three-way Brier
// (us vs Kimi's published value vs market). Transparency is the trust flywheel.
export default async function WorldCupLeaderboardPage() {
  const reports = await getAllReports();
  const resolved = reports.filter((r) => r.resolvedOutcome != null);
  const pending = reports.filter((r) => r.resolvedOutcome == null);

  return (
    <div>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>公开记分牌 / Public Scoreboard</h1>
        <p className={styles.heroSub}>
          我们逐场用 Brier 公开记分——对照 Polymarket 市场，以及 Kimi 公布的预测（注明出处）。输了也照记，这是可信度的来源。
          Every match is scored with Brier, in public — against the Polymarket market and against Kimi's published
          forecasts (with attribution). We record our misses too; that is where credibility comes from.
        </p>
      </section>

      <h2 className={styles.sectionTitle}>已结算 ({resolved.length})</h2>
      <div className={styles.panel}>
        {resolved.length === 0 ? (
          <p className={styles.muted}>赛事尚未开始，暂无已结算比赛。揭幕战 6/11 后开始回填。</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>比赛</th>
                <th>实际结果</th>
                <th>我们 Brier</th>
                <th>市场 Brier</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((r) => {
                const us = r.scoreboard.find((s) => s.source === "us");
                const market = r.scoreboard.find((s) => s.source === "market");
                return (
                  <tr key={r.meta.matchId}>
                    <td>
                      <Link href={`/world-cup/${r.meta.matchId}`} style={{ color: "#cdd9f0" }}>
                        {r.meta.homeTeam} vs {r.meta.awayTeam}
                      </Link>
                    </td>
                    <td>{r.resolvedOutcome}</td>
                    <td>{us?.brier?.toFixed(3) ?? "—"}</td>
                    <td>{market?.brier?.toFixed(3) ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <h2 className={styles.sectionTitle}>待结算 ({pending.length})</h2>
      <div className={styles.grid}>
        {pending.slice(0, 12).map((r) => (
          <Link key={r.meta.matchId} className={styles.card} href={`/world-cup/${r.meta.matchId}`}>
            <div className={styles.cardMeta}>
              <span>{r.meta.stage}</span>
              <span>{r.meta.kickoffUtc ? r.meta.kickoffUtc.slice(0, 10) : "日期待定"}</span>
            </div>
            <div className={styles.matchup}>
              {r.meta.homeTeam} vs {r.meta.awayTeam}
            </div>
            <div className={styles.muted}>待赛后回填 Brier</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
