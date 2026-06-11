import Link from "next/link";
import { DISCLAIMER_SHORT } from "../../../lib/legal-copy";
import { getByFamily, sortedOutcomes, type Forecast } from "../../../lib/world-cup/forecast-store";
import { resolveTeam } from "../../../lib/world-cup/team-meta";
import { GroupMatchRow } from "../../../components/world-cup/group-match-row";
import { WcHero } from "../../../components/world-cup/wc-hero";
import styles from "../../../components/world-cup/world-cup.module.css";

// 小组赛 tab — 12 group cards; every fixture gets a tri-segment 胜/平/负 bar
// with the model's pick, expandable into sourced reasons.

function teamOf(f: Forecast, key: "a" | "b") {
  const o = f.outcomes.find((x) => x.key === key);
  const meta = resolveTeam(o?.label_en ?? o?.label_cn ?? "");
  return { flag: meta.flag, cn: meta.cn, en: meta.en, group: meta.group };
}

export default function GroupsPage() {
  const matches = getByFamily("group_match");
  const winners = new Map(getByFamily("group_winner").map((g) => [g.id.slice(-1).toUpperCase(), g]));

  const byGroup = new Map<string, Forecast[]>();
  for (const m of matches) {
    const g = teamOf(m, "a").group;
    byGroup.set(g, [...(byGroup.get(g) ?? []), m]);
  }
  const groups = [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <WcHero wide sub="72 场小组赛逐场预测：每一场给出胜 / 平 / 负三路概率与模型判断。点开任意一场看主要理由与完整推理。" />

      <div className={styles.groupGrid}>
        {groups.map(([g, ms]) => {
          const winner = winners.get(g);
          const top = winner ? sortedOutcomes(winner)[0] : null;
          const topMeta = top ? resolveTeam(top.key) : null;
          return (
            <section key={g} className={styles.groupCard}>
              <div className={styles.groupHead}>
                <span className={styles.groupName}>{g} 组</span>
                {winner && top && topMeta ? (
                  <Link href={`/world-cup/forecast/${winner.dir}`} className={styles.winnerStrip}>
                    头名预测 {topMeta.flag} {topMeta.cn} {Math.round(top.p * 100)}%
                  </Link>
                ) : null}
              </div>
              {[...ms]
                .sort((a, b) => (a.kickoff_utc ?? "").localeCompare(b.kickoff_utc ?? ""))
                .map((m) => (
                  <GroupMatchRow key={m.id} forecast={m} home={teamOf(m, "a")} away={teamOf(m, "b")} />
                ))}
            </section>
          );
        })}
      </div>

      <p className={styles.disclaimer} style={{ marginTop: 28 }}>
        {DISCLAIMER_SHORT.zh}
      </p>
    </div>
  );
}
