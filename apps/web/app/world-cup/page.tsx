import { DISCLAIMER_SHORT } from "../../lib/legal-copy";
import {
  getAllForecasts,
  getByFamily,
  getGeneratedAt,
  matchesByDate,
  sortedOutcomes,
  type Forecast
} from "../../lib/world-cup/forecast-store";
import { ForecastCard } from "../../components/world-cup/forecast-card";
import styles from "../../components/world-cup/world-cup.module.css";

// Market-blind public forecast hub. Every number on this page comes from the
// Elo/Monte-Carlo harness plus bounded evidence adjustments — by policy no
// market price is read, cited, or displayed anywhere in this product.

function matchTitle(f: Forecast): string {
  const fromQuestion = f.question_en.split(": ")[1]?.split(" — ")[0];
  return fromQuestion ?? f.event_slug;
}

function groupOf(f: Forecast): string {
  return f.question_cn.match(/（([A-L]) 组）/)?.[1] ?? f.question_cn.match(/([A-L]) 组/)?.[1] ?? "";
}

export default function WorldCupHubPage() {
  const all = getAllForecasts();
  const champion = getByFamily("champion")[0] ?? null;
  const sf = getByFamily("reach_semifinal")[0] ?? null;
  const qf = getByFamily("reach_quarterfinal")[0] ?? null;
  const groupWinners = getByFamily("group_winner");
  const days = matchesByDate();

  return (
    <div>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>2026 世界杯 · 盲测概率研究</h1>
        <p className={styles.heroSub}>
          独立 AI 超级预测器，对全部 {all.length} 个赛事问题公开预测：每场小组赛、各组头名、八强、四强与最终冠军。
          预测全程<strong>市场盲测</strong>——不读取、不参考任何博彩或预测市场价格，只用 Elo / Monte-Carlo
          统计模型加上有来源的证据调整。每条预测都附主要理由与完整推理报告，赛后用 Brier 公开记分，错了照记。
        </p>
        <p className={styles.muted}>
          最近更新：{getGeneratedAt().slice(0, 16).replace("T", " ")} UTC
        </p>
        <p className={styles.disclaimer} style={{ marginTop: 12 }}>
          {DISCLAIMER_SHORT.zh}
        </p>
      </section>

      {all.length === 0 ? (
        <div className={styles.panel}>
          <p className={styles.muted}>
            预测生成中。运行 <code>pnpm tsx scripts/world-cup/import-predictions.ts</code> 导入最新结果。
          </p>
        </div>
      ) : null}

      {champion || sf || qf ? (
        <>
          <h2 className={styles.sectionTitle}>锦标赛级预测</h2>
          <div className={styles.gridWide}>
            {champion ? (
              <ForecastCard forecast={champion} title="谁是 2026 世界杯冠军？" meta="冠军 · 48 队" topN={5} />
            ) : null}
            {sf ? (
              <ForecastCard forecast={sf} title="哪 4 支球队进入四强？" meta="四强名单 · 48 队" topN={6} />
            ) : null}
            {qf ? (
              <ForecastCard forecast={qf} title="哪 8 支球队进入八强？" meta="八强名单 · 48 队" topN={8} />
            ) : null}
          </div>
        </>
      ) : null}

      {groupWinners.length > 0 ? (
        <>
          <h2 className={styles.sectionTitle}>小组头名（{groupWinners.length} 组）</h2>
          <div className={styles.grid}>
            {groupWinners.map((g) => {
              const top = sortedOutcomes(g)[0];
              return (
                <ForecastCard
                  key={g.id}
                  forecast={g}
                  title={`${g.question_cn.slice(0, 1)} 组头名：${top?.label_cn ?? ""}？`}
                  meta={`小组第一 · 4 队`}
                  topN={4}
                />
              );
            })}
          </div>
        </>
      ) : null}

      {days.length > 0 ? (
        <>
          <h2 className={styles.sectionTitle}>小组赛逐场预测（{days.reduce((n, d) => n + d.matches.length, 0)} 场）</h2>
          {days.map((day) => (
            <section key={day.date}>
              <h3 className={styles.dayTitle}>{day.date}</h3>
              <div className={styles.grid}>
                {day.matches.map((m) => (
                  <ForecastCard
                    key={m.id}
                    forecast={m}
                    title={matchTitle(m)}
                    meta={`小组赛 ${groupOf(m) ? `· ${groupOf(m)} 组` : ""}`}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      ) : null}
    </div>
  );
}
