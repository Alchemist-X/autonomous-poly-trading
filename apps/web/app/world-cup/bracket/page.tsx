import Link from "next/link";
import { DISCLAIMER_SHORT } from "../../../lib/legal-copy";
import { getByFamily, sortedOutcomes } from "../../../lib/world-cup/forecast-store";
import { resolveTeam } from "../../../lib/world-cup/team-meta";
import { langOf, t, tierLabel, withLang, type Lang } from "../../../lib/world-cup/i18n";
import { WcHero } from "../../../components/world-cup/wc-hero";
import bracketData from "../../../lib/world-cup/generated/bracket.generated.json";
import styles from "../../../components/world-cup/world-cup.module.css";

// 出线名单 tab — knockout tree with real connector lines between rounds and
// escalating card framing toward the final. Feeder ties are ordered adjacently
// so each connector joins exactly the two ties that produce the next round.

interface Tie {
  match: number;
  a: string;
  b: string;
  winner: string;
  p_winner: number;
}

interface StandingRow {
  team: string;
  pos: number;
  p_r32: number;
  status: "晋级" | "出局";
}

interface BracketFile {
  R32: Tie[];
  R16: Tie[];
  QF: Tie[];
  SF: Tie[];
  F: Tie[];
  champion: string;
  standings: Record<string, StandingRow[]>;
}

const bracket = bracketData as unknown as BracketFile;

// Bracket-adjacent ordering (upper half feeds SF1, lower half feeds SF2).
const ORDER: Record<"R32" | "R16" | "QF" | "SF", number[]> = {
  R32: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  R16: [89, 90, 93, 94, 91, 92, 95, 96],
  QF: [97, 98, 99, 100],
  SF: [101, 102]
};

function orderedTies(round: "R32" | "R16" | "QF" | "SF"): Tie[] {
  const byMatch = new Map(bracket[round].map((t) => [t.match, t]));
  return ORDER[round].map((m) => byMatch.get(m)).filter((t): t is Tie => Boolean(t));
}

function TieCardView({ tie, tier, lang }: { tie: Tie; tier?: string; lang: Lang }) {
  const rows = [tie.a, tie.b].map((team) => {
    const meta = resolveTeam(team);
    const isWin = team === tie.winner;
    return (
      <div key={team} className={`${styles.tieRow} ${isWin ? styles.tieWin : ""}`}>
        <span className={styles.teamFlag}>{meta.flag}</span>
        <span className={styles.tieName}>{lang === "en" ? meta.en : meta.cn}</span>
        <span className={`${styles.tiePct} ${isWin ? "" : styles.tiePctDim}`}>
          {Math.round((isWin ? tie.p_winner : 1 - tie.p_winner) * 100)}%
        </span>
      </div>
    );
  });
  return <div className={`${styles.tieCard} ${tier ?? ""}`}>{rows}</div>;
}

function RoundCol({ title, ties, tier, lang }: { title: string; ties: Tie[]; tier?: string; lang: Lang }) {
  return (
    <div className={styles.roundCol}>
      <div className={styles.roundTitle}>{title}</div>
      <div className={styles.slotCol}>
        {ties.map((tie) => (
          <div key={tie.match} className={styles.slot}>
            <TieCardView tie={tie} tier={tier} lang={lang} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Joiner({ count }: { count: number }) {
  return (
    <div className={styles.connectorCol} aria-hidden>
      <div className={styles.connectorHead} />
      <div className={styles.connectorBody}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={styles.connector} />
        ))}
      </div>
    </div>
  );
}

function PoolList({ id, title, note, lang }: { id: "reach-qf" | "reach-sf"; title: string; note: string; lang: Lang }) {
  const pool = getByFamily(id === "reach-qf" ? "reach_quarterfinal" : "reach_semifinal")[0];
  if (!pool) return null;
  const top = sortedOutcomes(pool).slice(0, 12);
  const max = top[0]?.p ?? 1;
  return (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>
        {title} <span className={styles.muted}>· {note}</span>
      </h3>
      {top.map((o, i) => {
        const meta = resolveTeam(o.key);
        return (
          <Link key={o.key} href={withLang(`/world-cup/forecast/${pool.dir}`, lang)} className={styles.rankRow}>
            <span className={styles.rankIdx}>{i + 1}</span>
            <span className={styles.rankFlag}>{meta.flag}</span>
            <span className={styles.rankName}>
              <span className={styles.rankNameCn}>{lang === "en" ? meta.en : meta.cn}</span>
              <span className={styles.rankTrack}>
                <span className={styles.rankFill} style={{ width: `${(o.p / max) * 100}%` }} />
              </span>
            </span>
            <span className={styles.rankPct}>{Math.round(o.p * 100)}%</span>
          </Link>
        );
      })}
    </div>
  );
}

export default async function BracketPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = langOf((await searchParams).lang);
  const groups = Object.entries(bracket.standings).sort(([a], [b]) => a.localeCompare(b));
  const champMeta = resolveTeam(bracket.champion);
  const final = bracket.F[0];

  return (
    <div>
      <WcHero lang={lang} subKey="subKnockout" />

      <p className={styles.ruleNote}>{t(lang, "ruleNote")}</p>

      <div className={styles.bracketScroll}>
        <div className={styles.bracketCols}>
          <div className={`${styles.roundCol} ${styles.roundColGroups}`}>
            <div className={styles.roundTitle}>{t(lang, "groupsCol")}</div>
            <div className={styles.groupsGrid}>
              {groups.map(([g, rows]) => (
                <div key={g} className={styles.groupMini}>
                  <div className={styles.groupMiniTitle}>{lang === "en" ? `Group ${g}` : `${g} 组`}</div>
                  {rows.map((r) => {
                    const meta = resolveTeam(r.team);
                    const out = r.status === "出局";
                    return (
                      <div key={r.team} className={`${styles.groupMiniRow} ${out ? styles.groupMiniOut : ""}`}>
                        <span className={styles.groupMiniPos}>{r.pos}</span>
                        <span className={styles.teamFlag}>{meta.flag}</span>
                        <span className={styles.groupMiniName}>{lang === "en" ? meta.en : meta.cn}</span>
                        {out ? <span className={styles.groupMiniTagOut}>{t(lang, "out")}</span> : null}
                        <span className={`${styles.groupMiniPct} ${out ? styles.groupMiniPctOut : ""}`}>
                          {Math.round(r.p_r32 * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <RoundCol title={t(lang, "r32")} ties={orderedTies("R32")} lang={lang} />
          <Joiner count={8} />
          <RoundCol title={t(lang, "r16")} ties={orderedTies("R16")} tier={styles.tierR16} lang={lang} />
          <Joiner count={4} />
          <RoundCol title={t(lang, "qf")} ties={orderedTies("QF")} tier={styles.tierQF} lang={lang} />
          <Joiner count={2} />
          <RoundCol title={t(lang, "sf")} ties={orderedTies("SF")} tier={styles.tierSF} lang={lang} />
          <Joiner count={1} />
          <div className={styles.roundCol}>
            <div className={styles.roundTitle}>{t(lang, "finalCol")}</div>
            <div className={styles.slotCol}>
              <div className={styles.slot}>
                <div className={styles.finalStack}>
                  {final ? <TieCardView tie={final} tier={styles.tierFinal} lang={lang} /> : null}
                  <div className={styles.champCard}>
                    <div className={styles.champCardFlag}>{champMeta.flag}</div>
                    <div className={styles.champCardName}>{t(lang, "predictedChampion")} · {lang === "en" ? champMeta.en : champMeta.cn}</div>
                    <div className={styles.champCardPct}>{t(lang, "finalWinProb")} {Math.round((final?.p_winner ?? 0) * 100)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>{t(lang, "marginalTitle")}</h2>
      <div className={styles.gridWide}>
        <PoolList id="reach-qf" title={t(lang, "qfBoard")} note={t(lang, "sumQf")} lang={lang} />
        <PoolList id="reach-sf" title={t(lang, "sfBoard")} note={t(lang, "sumSf")} lang={lang} />
      </div>

      <p className={styles.disclaimer} style={{ marginTop: 28 }}>
        {lang === "en" ? DISCLAIMER_SHORT.en : DISCLAIMER_SHORT.zh}
      </p>
    </div>
  );
}
