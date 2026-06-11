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

interface BracketFile {
  R32: Tie[];
  R16: Tie[];
  QF: Tie[];
  SF: Tie[];
  F: Tie[];
  champion: string;
  standings: Record<string, { "1st": string; "2nd": string; "3rd": string }>;
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

function RoundCol({ title, ties }: { title: string; ties: Tie[] }) {
  return (
    <div className={styles.roundCol}>
      <div className={styles.roundTitle}>{title}</div>
      <div className={styles.roundBody}>
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
      <WcHero sub="从 12 个小组的出线名单到决赛的完整对阵推演：每个节点取模型最可能的结果（旁标该场胜率）。这是单一最可能剧本——边际概率见下方八强 / 四强榜单。" />

      <div className={styles.bracketScroll}>
        <div className={styles.bracketCols}>
          <div className={styles.roundCol}>
            <div className={styles.roundTitle}>小组出线</div>
            <div className={styles.roundBody}>
              {groups.map(([g, s]) => (
                <div key={g} className={styles.groupMini}>
                  <div className={styles.groupMiniTitle}>{g} 组</div>
                  {(["1st", "2nd", "3rd"] as const).map((pos) => {
                    const raw = s[pos];
                    const out = raw.includes("出局");
                    const name = raw.replace(/ \((晋级|出局)\)/, "");
                    const meta = resolveTeam(name);
                    return (
                      <div key={pos} className={`${styles.groupMiniRow} ${out ? styles.groupMiniOut : ""}`}>
                        <span className={styles.groupMiniPos}>{pos === "1st" ? "1" : pos === "2nd" ? "2" : "3"}</span>
                        <span className={styles.teamFlag}>{meta.flag}</span>
                        {meta.cn}
                        {pos === "3rd" && !out ? <span className={styles.muted}>晋级</span> : null}
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
          <RoundCol title="四强" ties={bracket.SF} />
          <div className={styles.roundCol}>
            <div className={styles.roundTitle}>决赛 · 7 月 19 日</div>
            <div className={styles.roundBody}>
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
