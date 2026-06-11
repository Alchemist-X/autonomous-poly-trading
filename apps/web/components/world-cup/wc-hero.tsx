import { getGeneratedAt } from "../../lib/world-cup/forecast-store";
import { TabNav } from "./tab-nav";
import styles from "./world-cup.module.css";

// Shared hero + tab switcher for the three forecast views.
export function WcHero({ sub }: { sub: string }) {
  return (
    <section className={styles.hero}>
      <p className={styles.heroKicker}>Predict Ravens · 盲测概率研究</p>
      <h1 className={styles.heroTitle}>世界杯</h1>
      <p className={styles.heroSub}>{sub}</p>
      <p className={styles.heroMeta}>
        87 个问题公开预测 · 不读取任何市场价格 · Brier 公开记分 · 更新于 {getGeneratedAt().slice(0, 16).replace("T", " ")} UTC
      </p>
      <TabNav />
    </section>
  );
}
