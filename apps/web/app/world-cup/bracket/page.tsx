import Link from "next/link";
import { DISCLAIMER_SHORT } from "../../../lib/legal-copy";
import { getByFamily, sortedOutcomes } from "../../../lib/world-cup/forecast-store";
import { resolveTeam } from "../../../lib/world-cup/team-meta";
import { WcHero } from "../../../components/world-cup/wc-hero";
import bracketData from "../../../lib/world-cup/generated/bracket.generated.json";
import styles from "../../../components/world-cup/world-cup.module.css";

// 出线名单 tab — Polymarket-style horizontal bracket built from the modal
// path (Elo favourite advances at every node), plus marginal reach-QF/SF
// probabilities from the 100k-sim Monte Carlo.

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

function TieCardView({ tie }: { tie: Tie }) {
  const rows = [tie.a, tie.b].map((team) => {
    const meta = resolveTeam(team);
    const isWin = team === tie.winner;
    return (
      <div key={team} className={`${styles.tieRow} ${isWin ? styles.tieWin : ""}`}>
        <span className={styles.teamFlag}>{meta.flag}</span>
        <span className={styles.tieName}>{meta.cn}</span>
        <span className={`${styles.tiePct} ${isWin ? "" : styles.tiePctDim}`}>
          {Math.round((isWin ? tie.p_winner : 1 - tie.p_winner) * 100)}%
        </span>
      </div>
    );
  });
  return <div className={styles.tieCard}>{rows}</div>;
}

function RoundCol({ title, ties, center }: { title: string; ties: Tie[]; center?: boolean }) {
  return (
    <div className={styles.roundCol}>
      <div className={styles.roundTitle}>{title}</div>
      <div className={`${styles.roundBody} ${center ? styles.roundBodyCenter : ""}`}>
        {ties.map((t) => (
          <TieCardView key={t.match} tie={t} />
        ))}
      </div>
    </div>
  );
}

function PoolList({ id, title, note }: { id: "reach-qf" | "reach-sf"; title: string; note: string }) {
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
          <Link key={o.key} href={`/world-cup/forecast/${pool.dir}`} className={styles.rankRow}>
            <span className={styles.rankIdx}>{i + 1}</span>
            <span className={styles.rankFlag}>{meta.flag}</span>
            <span className={styles.rankName}>
              <span className={styles.rankNameCn}>{meta.cn}</span>
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

export default function BracketPage() {
  const groups = Object.entries(bracket.standings).sort(([a], [b]) => a.localeCompare(b));
  const champMeta = resolveTeam(bracket.champion);
  const final = bracket.F[0];

  return (
    <div>
      <WcHero sub="从 12 个小组的出线名单到决赛的完整对阵推演：小组栏给出每支球队的出线概率，淘汰赛每个节点取最可能的结果并旁标该场胜率。" />

      <div className={styles.bracketScroll}>
        <div className={styles.bracketCols}>
          <div className={`${styles.roundCol} ${styles.roundColGroups}`}>
            <div className={styles.roundTitle}>小组出线 · 含出线概率</div>
            <div className={styles.groupsGrid}>
              {groups.map(([g, rows]) => (
                <div key={g} className={styles.groupMini}>
                  <div className={styles.groupMiniTitle}>{g} 组</div>
                  {rows.map((r) => {
                    const meta = resolveTeam(r.team);
                    const out = r.status === "出局";
                    return (
                      <div key={r.team} className={`${styles.groupMiniRow} ${out ? styles.groupMiniOut : ""}`}>
                        <span className={styles.groupMiniPos}>{r.pos}</span>
                        <span className={styles.teamFlag}>{meta.flag}</span>
                        <span className={styles.groupMiniName}>{meta.cn}</span>
                        {out ? <span className={styles.groupMiniTagOut}>出局</span> : null}
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
          <RoundCol title="32 强" ties={bracket.R32} />
          <RoundCol title="16 强" ties={bracket.R16} />
          <RoundCol title="八强" ties={bracket.QF} />
          <RoundCol title="四强" ties={bracket.SF} center />
          <div className={styles.roundCol}>
            <div className={styles.roundTitle}>决赛 · 7 月 19 日</div>
            <div className={`${styles.roundBody} ${styles.roundBodyCenter}`}>
              {final ? <TieCardView tie={final} /> : null}
              <div className={styles.champCard}>
                <div className={styles.champCardFlag}>{champMeta.flag}</div>
                <div className={styles.champCardName}>预测冠军 · {champMeta.cn}</div>
                <div className={styles.champCardPct}>决赛胜率 {Math.round((final?.p_winner ?? 0) * 100)}% · MC 夺冠概率 37.8%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>边际概率（每队独立计算，与上方单一剧本互补）</h2>
      <div className={styles.gridWide}>
        <PoolList id="reach-qf" title="八强概率榜" note="48 队概率之和 ≈ 8" />
        <PoolList id="reach-sf" title="四强概率榜" note="48 队概率之和 ≈ 4" />
      </div>

      <p className={styles.disclaimer} style={{ marginTop: 28 }}>
        {DISCLAIMER_SHORT.zh}
      </p>
    </div>
  );
}
