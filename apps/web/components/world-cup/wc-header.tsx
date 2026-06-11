import Link from "next/link";
import styles from "./world-cup.module.css";

// Product header — research-framed branding (compliance R1), no trading copy.
export function WorldCupHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <Link className={styles.brand} href="/world-cup">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/raven-mark.svg" alt="Predict Ravens" className={styles.brandLogo} />
            Predict Ravens<span className={styles.brandEd}>世界杯版</span>
            <span className={styles.brandTag}>Market-blind · 公开记分</span>
          </Link>
          <nav className={styles.headerNav}>
            <Link href="/world-cup">预测</Link>
            <Link href="/world-cup/bracket">对阵</Link>
            <Link href="/prediction-engine">自己跑一个</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
