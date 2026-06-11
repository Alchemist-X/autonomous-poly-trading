import Link from "next/link";
import { DISCLAIMER_SHORT } from "../../lib/legal-copy";
import { getByFamily, sortedOutcomes } from "../../lib/world-cup/forecast-store";
import { resolveTeam } from "../../lib/world-cup/team-meta";
import { WcHero } from "../../components/world-cup/wc-hero";
import styles from "../../components/world-cup/world-cup.module.css";

// 冠军 tab — flag-cloud display of champion probabilities + full 48-team
// ranking. Visual reference: Polymarket's World Cup map view; every number
// here is our own market-blind model output.

// Hand-tuned cloud slots (percent coordinates), ordered by rank: the
// favourite sits center-stage, the rest spiral outward.
const CLOUD_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [50, 36], [27, 28], [71, 30], [38, 58], [62, 56],
  [18, 50], [83, 52], [30, 78], [55, 79], [74, 74],
  [12, 71], [88, 73], [20, 13], [44, 14], [66, 12], [86, 16]
];

function pct(p: number): string {
  return p >= 0.095 ? `${Math.round(p * 100)}%` : `${(p * 100).toFixed(1)}%`;
}

export default function ChampionPage() {
  const champion = getByFamily("champion")[0];
  const outcomes = champion ? sortedOutcomes(champion) : [];
  const cloud = outcomes.slice(0, CLOUD_SLOTS.length);

  return (
    <div>
      <WcHero sub="谁会捧起 2026 年 7 月 19 日的大力神杯？48 支球队的夺冠概率，来自 10 万次纯 Elo 蒙特卡洛模拟与逐队证据修正——全程没有看过任何盘口。" />

      {champion ? (
        <div className={styles.champLayout}>
          <div className={styles.flagCloud}>
            {cloud.map((o, i) => {
              const meta = resolveTeam(o.key);
              const size = Math.round(30 + Math.sqrt(o.p) * 110);
              const [x, y] = CLOUD_SLOTS[i] ?? [50, 50];
              return (
                <Link
                  key={o.key}
                  href={`/world-cup/forecast/${champion.dir}`}
                  className={styles.cloudTile}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${meta.cn} ${pct(o.p)}`}
                >
                  <span className={styles.cloudFlag} style={{ fontSize: size }}>
                    {meta.flag}
                  </span>
                  <span className={styles.cloudPct}>{pct(o.p)}</span>
                  <span className={styles.cloudName}>{meta.cn}</span>
                </Link>
              );
            })}
            <span className={styles.cloudNote}>旗帜大小 ∝ 夺冠概率 · 点击查看完整推理</span>
          </div>

          <div className={styles.rankList}>
            {outcomes.map((o, i) => {
              const meta = resolveTeam(o.key);
              return (
                <Link key={o.key} href={`/world-cup/forecast/${champion.dir}`} className={styles.rankRow}>
                  <span className={styles.rankIdx}>{i + 1}</span>
                  <span className={styles.rankFlag}>{meta.flag}</span>
                  <span className={styles.rankName}>
                    <span className={styles.rankNameCn}>{meta.cn}</span>
                    <span className={styles.rankTrack}>
                      <span
                        className={styles.rankFill}
                        style={{ width: `${Math.max(o.p / (outcomes[0]?.p ?? 1), 0.012) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className={styles.rankPct}>{pct(o.p)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.panel}>
          <p className={styles.muted}>预测数据导入中。</p>
        </div>
      )}

      {champion ? (
        <>
          <h2 className={styles.sectionTitle}>我们的观点</h2>
          <div className={styles.panel}>
            <p className={styles.oneLiner}>{champion.one_liner_cn}</p>
            <ul className={styles.reasonList}>
              {champion.key_reasons.map((r) => (
                <li key={r.source_url + r.source_date} className={styles.reasonItem}>
                  {r.cn}{" "}
                  <a href={r.source_url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                    来源 · {r.source_date}
                  </a>
                </li>
              ))}
            </ul>
            <div className={styles.cardActions}>
              <Link className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} href={`/world-cup/forecast/${champion.dir}`}>
                查看完整推理 →
              </Link>
              <span className={styles.muted}>
                {champion.n_sources} 个来源 · 置信 {champion.confidence_tier}
              </span>
            </div>
          </div>
        </>
      ) : null}

      <p className={styles.disclaimer} style={{ marginTop: 28 }}>
        {DISCLAIMER_SHORT.zh}
      </p>
    </div>
  );
}
