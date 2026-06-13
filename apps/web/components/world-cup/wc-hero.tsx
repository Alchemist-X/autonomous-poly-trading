import { getGeneratedAt } from "../../lib/world-cup/forecast-store";
import { t, type Locale, type StrKey } from "../../lib/world-cup/i18n";
import { TabNav } from "./tab-nav";
import styles from "./world-cup.module.css";

// Shared hero + tab switcher for the three forecast views.
export function WcHero({ locale, subKey, wide }: { locale: Locale; subKey: StrKey; wide?: boolean }) {
  return (
    <section className={styles.hero}>
      <h1 className={styles.heroTitle}>{t(locale, "heroTitle")}</h1>
      <p className={styles.heroSub} style={wide ? { maxWidth: "none" } : undefined}>
        {t(locale, subKey)}
      </p>
      <p className={styles.heroMeta}>
        {t(locale, "heroMeta")} {getGeneratedAt().slice(0, 16).replace("T", " ")} UTC
      </p>
      <TabNav />
    </section>
  );
}
