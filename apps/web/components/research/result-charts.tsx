"use client";

// Final visualisation, revealed when the run completes. Strong visual emphasis
// on the headline probability + 80% confidence interval; supporting charts for
// the conditional model, prior→posterior path, and the evidence ledger.

import { Fragment } from "react";
import styles from "./research.module.css";
import { pct, pp, signedPoints } from "../../lib/research/format";
import type { ResearchState } from "../../lib/research/state-machine";
import type { PredictionEvidence } from "../../lib/prediction-engine-demo";

const STANCE_CLASS: Record<PredictionEvidence["stance"], string | undefined> = {
  support: styles.stanceSupport,
  oppose: styles.stanceOppose,
  mixed: styles.stanceMixed,
  neutral: styles.stanceNeutral
};

const STANCE_LABEL: Record<PredictionEvidence["stance"], string> = {
  support: "支持",
  oppose: "反对",
  mixed: "中性",
  neutral: "边界"
};

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value * 100));
}

function ConfidenceBar({
  yes,
  interval,
  market
}: {
  yes: number;
  interval: [number, number];
  market: number | null;
}) {
  const lo = clampPct(interval[0]);
  const hi = clampPct(interval[1]);
  const point = clampPct(yes);
  return (
    <div>
      <div className={styles.ciTrack}>
        <span className={styles.ciBand} style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 0.5)}%` }} />
        {market != null ? <span className={styles.ciMarket} style={{ left: `${clampPct(market)}%` }} /> : null}
        <span className={styles.ciPoint} style={{ left: `${point}%` }} />
      </div>
      <div className={styles.ciScale}>
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      <p className={styles.ciText}>
        80% 置信区间：{pct(interval[0])} – {pct(interval[1])}
        {market != null ? <> · 市场隐含 <span style={{ color: "#c0392b" }}>{pct(market)}</span></> : null}
      </p>
    </div>
  );
}

function ConclusionCard({ state }: { state: ResearchState }) {
  const conclusion = state.conclusion;
  if (!conclusion) {
    return null;
  }
  const edge = conclusion.edge;
  return (
    <section className={styles.conclusionCard}>
      <div className={styles.conclusionTop}>
        <div>
          <div className={styles.bigProbLabel}>Yes 概率</div>
          <div className={styles.bigProb}>{pct(conclusion.yesProbability)}</div>
        </div>
      </div>
      <ConfidenceBar
        yes={conclusion.yesProbability}
        interval={conclusion.confidenceInterval}
        market={conclusion.marketProbability}
      />
      <p className={styles.verdict}>{conclusion.verdict}</p>
      {conclusion.marketProbability != null ? (
        <div className={styles.edgeRow}>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>市场隐含</div>
            <div className={styles.metricValue}>{pct(conclusion.marketProbability)}</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Edge</div>
            <div
              className={`${styles.metricValue} ${
                edge != null && edge > 0 ? styles.metricPos : edge != null && edge < 0 ? styles.metricNeg : ""
              }`}
            >
              {pp(edge)}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ConditionalTree({ state }: { state: ResearchState }) {
  if (state.model.length === 0) {
    return null;
  }
  const product = state.model.reduce((acc, node) => acc * node.probability, 1);
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>条件概率模型 · P(Yes) = 各节点乘积</h3>
      <div className={styles.tree}>
        {state.model.map((node, index) => (
          <Fragment key={node.id}>
            <div className={styles.treeNode}>
              <div className={styles.treeNodeLabel}>{node.label}</div>
              <div className={styles.treeNodeProb}>{pct(node.probability, 0)}</div>
              <div className={styles.treeNodeRationale}>{node.rationale}</div>
            </div>
            {index < state.model.length - 1 ? <div className={styles.treeOp}>×</div> : null}
          </Fragment>
        ))}
        <div className={styles.treeOp}>=</div>
        <div className={styles.treeResult}>
          <div className={styles.treeNodeLabel} style={{ color: "#9ec0ff" }}>
            模型基线
          </div>
          <div className={styles.treeResultProb}>{pct(product, 0)}</div>
        </div>
      </div>
    </section>
  );
}

// Prior → posterior path as a small SVG step chart.
function UpdateWaterfall({ state }: { state: ResearchState }) {
  if (state.updates.length === 0) {
    return null;
  }
  const width = 640;
  const height = 180;
  const padX = 48;
  const padY = 28;
  const points = state.updates.map((update, index) => {
    const x = padX + (index / Math.max(state.updates.length - 1, 1)) * (width - padX * 2);
    const y = height - padY - update.to * (height - padY * 2);
    return { x, y, update };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>贝叶斯更新路径 · 先验 → 后验</h3>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="prior to posterior update path">
        {[0, 0.5, 1].map((tick) => {
          const y = height - padY - tick * (height - padY * 2);
          return (
            <g key={tick}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#eef1f6" strokeWidth={1} />
              <text x={8} y={y + 4} fontSize={11} fill="#aab1be">
                {(tick * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p) => (
          <g key={p.update.label}>
            <circle cx={p.x} cy={p.y} r={5} fill="#2563eb" stroke="#fff" strokeWidth={2} />
            <text x={p.x} y={p.y - 12} fontSize={11} fill="#3f4651" textAnchor="middle" fontWeight={700}>
              {(p.update.to * 100).toFixed(0)}%
            </text>
            <text x={p.x} y={height - 8} fontSize={10.5} fill="#8a93a6" textAnchor="middle">
              {p.update.label}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}

function EvidenceLedger({ state }: { state: ResearchState }) {
  if (state.evidence.length === 0) {
    return null;
  }
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>证据账本 · {state.evidence.length} 条</h3>
      <table className={styles.ledger}>
        <thead>
          <tr>
            <th>立场</th>
            <th>证据</th>
            <th className={styles.num}>权重</th>
            <th className={styles.num}>可信度</th>
            <th>节点</th>
          </tr>
        </thead>
        <tbody>
          {state.evidence.map((item) => (
            <tr key={item.id}>
              <td>
                <span className={`${styles.stance} ${STANCE_CLASS[item.stance]}`}>{STANCE_LABEL[item.stance]}</span>
              </td>
              <td>
                <div className={styles.ledgerTitle}>{item.title}</div>
                <div className={styles.ledgerSource}>
                  {item.sourceType} · {item.date}
                </div>
              </td>
              <td className={`${styles.num} ${item.weightPct >= 0 ? styles.weightPos : styles.weightNeg}`}>
                {signedPoints(item.weightPct)}
              </td>
              <td className={styles.num}>{item.reliability.toFixed(2)}</td>
              <td>{item.node}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Limitations({ state }: { state: ResearchState }) {
  const limitations = state.finalRun?.limitations ?? [];
  if (limitations.length === 0) {
    return null;
  }
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>边界与免责</h3>
      <ul className={styles.limitList}>
        {limitations.map((limit) => (
          <li key={limit.slice(0, 30)}>{limit}</li>
        ))}
      </ul>
    </section>
  );
}

export function ResultCharts({ state }: { state: ResearchState }) {
  if (state.phase !== "complete") {
    return null;
  }
  return (
    <div className={styles.result}>
      <ConclusionCard state={state} />
      <ConditionalTree state={state} />
      <UpdateWaterfall state={state} />
      <EvidenceLedger state={state} />
      <Limitations state={state} />
    </div>
  );
}
