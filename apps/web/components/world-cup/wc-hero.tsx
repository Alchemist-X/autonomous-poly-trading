import { getGeneratedAt } from "../../lib/world-cup/forecast-store";
import { t, type Lang, type StrKey } from "../../lib/world-cup/i18n";
import { TabNav } from "./tab-nav";
import styles from "./world-cup.module.css";

// Shared hero + tab switcher for the three forecast views.
export function WcHero({ lang, subKey, wide }: { lang: Lang; subKey: StrKey; wide?: boolean }) {
  return (
    <section className={styles.hero}>
      <h1 className={styles.heroTitle}>{t(lang, "heroTitle")}</h1>
      <p className={styles.heroSub} style={wide ? { maxWidth: "none" } : undefined}>
        {t(lang, subKey)}
      </p>
      <p className={styles.heroMeta}>
        {t(lang, "heroMeta")} {getGeneratedAt().slice(0, 16).replace("T", " ")} UTC
      </p>
      <TabNav />
    </section>
  );
}
