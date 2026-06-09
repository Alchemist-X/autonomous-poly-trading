import type { WorldCupReport } from "../../lib/world-cup/types";
import styles from "./world-cup.module.css";

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function signedPp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const pp = value * 100;
  return `${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp`;
}

function tierClass(tier: WorldCupReport["confidenceTier"]): string {
  if (tier === "high") return styles.tierHigh ?? "";
  if (tier === "medium") return styles.tierMedium ?? "";
  return styles.tierLow ?? "";
}

export function ReportView({ report }: { report: WorldCupReport }) {
  const { run, outcomes, meta } = report;
  return (
    <div>
      <section className={styles.hero}>
        <p className={styles.muted}>
          {meta.stage} · {meta.kickoffUtc ? new Date(meta.kickoffUtc).toISOString().slice(0, 10) : "日期待定"}
        </p>
        <h1 className={styles.heroTitle}>
          {meta.homeTeam} vs {meta.awayTeam}
        </h1>
        <p className={styles.heroSub}>{run.conclusion.verdict}</p>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>
            置信度 <span className={tierClass(report.confidenceTier)}>{report.confidenceTier}</span>
          </span>
          <span className={styles.badge}>
            主概率 80% CI {pct(report.confidenceInterval[0])} – {pct(report.confidenceInterval[1])}
          </span>
          <span className={styles.badge}>{report.modelSource.statistical ? "stat+llm+market" : "llm+market (MVP)"}</span>
        </div>
      </section>

      <h2 className={styles.sectionTitle}>1X2 概率与市场偏差</h2>
      <div className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>结果</th>
              <th>模型</th>
              <th>市场 (Polymarket)</th>
              <th>偏差信号 (research)</th>
            </tr>
          </thead>
          <tbody>
            {outcomes.map((o) => (
              <tr key={o.outcome}>
                <td>{o.label}</td>
                <td>{pct(o.modelProbability)}</td>
                <td>{pct(o.marketProbability)}</td>
                <td className={(o.edge ?? 0) > 0 ? styles.tierHigh : styles.muted}>{signedPp(o.edge)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={styles.sectionTitle}>三方对照记分牌</h2>
      <div className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>来源</th>
              <th>说明</th>
              <th>赛后 Brier</th>
            </tr>
          </thead>
          <tbody>
            {report.scoreboard.map((entry) => (
              <tr key={entry.source}>
                <td>{entry.label}</td>
                <td className={styles.muted}>{entry.note}</td>
                <td>{entry.brier == null ? "待结算" : entry.brier.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={styles.sectionTitle}>结构化模型节点</h2>
      <div className={styles.panel}>
        {run.model.map((node) => (
          <div key={node.id} className={styles.evidence}>
            <div className={styles.evidenceHead}>
              {node.label} — {pct(node.probability)}
            </div>
            <div className={styles.evidenceBody}>{node.rationale}</div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>证据（看多 / 看空）</h2>
      <div className={styles.panel}>
        {run.evidence.map((e) => (
          <div
            key={e.id}
            className={`${styles.evidence} ${e.stance === "support" ? styles.evidenceSupport : e.stance === "oppose" ? styles.evidenceOppose : ""}`}
          >
            <div className={styles.evidenceHead}>
              [{e.sourceType}] {e.title}
            </div>
            <div className={styles.evidenceBody}>{e.excerpt}</div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>7 阶段推理过程</h2>
      <div className={styles.panel}>
        {run.stages.map((stage) => (
          <div key={stage.id} className={styles.stage}>
            <div className={styles.stageNum}>{stage.order}</div>
            <div>
              <div className={styles.evidenceHead}>{stage.title}</div>
              <div className={styles.evidenceBody}>{stage.summary}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>局限性</h2>
      <div className={styles.panel}>
        <ul className={styles.muted} style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          {run.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
