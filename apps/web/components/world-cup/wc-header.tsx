import Link from "next/link";
import styles from "./world-cup.module.css";

// Independent header for the World Cup product — deliberately NOT the AutoPoly
// trading-agent topbar (compliance R1). Brand wording is research-framed.
export function WorldCupHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <Link className={styles.brand} href="/world-cup">
            World Cup Forecast
            <span className={styles.brandTag}>AI · 概率研究 · 公开记分</span>
          </Link>
          <nav className={styles.headerNav}>
            <Link href="/world-cup">Matches</Link>
            <Link href="/world-cup/leaderboard">Scoreboard</Link>
            <Link href="/prediction-engine">Run your own</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
