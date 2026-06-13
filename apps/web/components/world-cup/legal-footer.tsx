import Link from "next/link";
import { DISCLAIMER_FULL } from "../../lib/legal-copy";
import { DEFAULT_LOCALE, t, type Locale } from "../../lib/world-cup/i18n";
import styles from "./world-cup.module.css";

// Compliance footer mounted on every World Cup / legal surface. The full
// disclaimer must be present on all public-facing pages (plan §8). `locale` is
// optional so the non-localized /terms and /privacy pages can reuse it (they
// default to English); the locale-prefixed routes pass their actual locale.
export function LegalFooter({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p className={styles.disclaimer}>{DISCLAIMER_FULL.zh}</p>
        <p className={styles.disclaimer} style={{ marginTop: 8 }}>
          {DISCLAIMER_FULL.en}
        </p>
        <div className={styles.badgeRow}>
          <Link className={styles.badge} href="/terms">
            {t(locale, "footerTerms")}
          </Link>
          <Link className={styles.badge} href="/privacy">
            {t(locale, "footerPrivacy")}
          </Link>
          <span className={styles.badge}>{t(locale, "footerResearchTag")}</span>
          <span className={styles.badge}>{t(locale, "footerAgeGate")}</span>
        </div>
      </div>
    </footer>
  );
}
