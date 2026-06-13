import Link from "next/link";
import { DISCLAIMER_SHORT } from "../../../lib/legal-copy";
import { getByFamily, getResult, sortedOutcomes, type Forecast } from "../../../lib/world-cup/forecast-store";
import { resolveTeam } from "../../../lib/world-cup/team-meta";
import { langOf, t, teamLabel, withLang } from "../../../lib/world-cup/i18n";
import { GroupMatchRow } from "../../../components/world-cup/group-match-row";
import { WcHero } from "../../../components/world-cup/wc-hero";
import styles from "../../../components/world-cup/world-cup.module.css";

// 小组赛 tab — 12 group cards; every fixture as a tri-segment 胜/平/负 bar
// with the model's pick, expandable into sourced reasons.

function teamOf(f: Forecast, key: "a" | "b") {
  const o = f.outcomes.find((x) => x.key === key);
  const meta = resolveTeam(o?.label_en ?? o?.label_cn ?? "");
  return { flag: meta.flag, cn: meta.cn, en: meta.en, group: meta.group };
}

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = langOf((await searchParams).lang);
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
      <WcHero lang={lang} wide subKey="subGroups" />

      <div className={styles.groupGrid}>
        {groups.map(([g, ms]) => {
          const winner = winners.get(g);
          const top = winner ? sortedOutcomes(winner)[0] : null;
          const topMeta = top ? resolveTeam(top.key) : null;
          return (
            <section key={g} className={styles.groupCard}>
              <div className={styles.groupHead}>
                <span className={styles.groupName}>{lang === "zh" ? `${g} 组` : `${t(lang, "group")} ${g}`}</span>
                {winner && top && topMeta ? (
                  <Link href={withLang(`/world-cup/forecast/${winner.dir}`, lang)} className={styles.winnerStrip}>
                    {t(lang, "winnerPick")} {topMeta.flag} {teamLabel(topMeta, lang)}{" "}
                    {Math.round(top.p * 100)}%
                  </Link>
                ) : null}
              </div>
              {[...ms]
                .sort((a, b) => (a.kickoff_utc ?? "").localeCompare(b.kickoff_utc ?? ""))
                .map((m) => (
                  <GroupMatchRow
                    key={m.id}
                    forecast={m}
                    home={teamOf(m, "a")}
                    away={teamOf(m, "b")}
                    lang={lang}
                    result={getResult(m.event_slug)}
                  />
                ))}
            </section>
          );
        })}
      </div>

      <p className={styles.disclaimer} style={{ marginTop: 28 }}>
        {lang === "zh" ? DISCLAIMER_SHORT.zh : DISCLAIMER_SHORT.en}
      </p>
    </div>
  );
}
