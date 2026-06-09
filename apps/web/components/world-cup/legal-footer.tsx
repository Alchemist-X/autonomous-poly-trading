import Link from "next/link";
import { DISCLAIMER_FULL } from "../../lib/legal-copy";
import styles from "./world-cup.module.css";

// Compliance footer mounted on every World Cup / legal surface. The full
// disclaimer must be present on all public-facing pages (plan §8).
export function LegalFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p className={styles.disclaimer}>{DISCLAIMER_FULL.zh}</p>
        <p className={styles.disclaimer} style={{ marginTop: 8 }}>
          {DISCLAIMER_FULL.en}
        </p>
        <div className={styles.badgeRow}>
          <Link className={styles.badge} href="/terms">
            Terms
          </Link>
          <Link className={styles.badge} href="/privacy">
            Privacy
          </Link>
          <span className={styles.badge}>Probability research · 概率研究</span>
          <span className={styles.badge}>18+ where required</span>
        </div>
      </div>
    </footer>
  );
}
