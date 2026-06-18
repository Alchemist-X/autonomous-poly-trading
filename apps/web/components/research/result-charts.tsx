"use client";

// Final visualisation, revealed when the run completes. Strong visual emphasis
// on the headline probability + 80% confidence interval; supporting charts for
// the conditional model, prior→posterior path, and the evidence ledger. All
// chrome is localized via the console locale; the streamed content arrives
// already in the requested language.

import { Fragment } from "react";
import styles from "./research.module.css";
import { pct, pp, signedPoints } from "../../lib/research/format";
import { c, stanceLabel } from "../../lib/research/i18n";
import { callFromProbability, callLabel } from "../../lib/research/call";
import type { ConsoleLocale } from "../../lib/research/locale";
import type { ResearchState } from "../../lib/research/state-machine";
import type { PredictionEvidence } from "../../lib/prediction-engine-demo";

const STANCE_CLASS: Record<PredictionEvidence["stance"], string | undefined> = {
  support: styles.stanceSupport,
  oppose: styles.stanceOppose,
  mixed: styles.stanceMixed,
  neutral: styles.stanceNeutral
};

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value * 100));
}

// Split the verdict on its first sentence terminator so the lead clause (which
// restates the call) can be bolded — the call then echoes in prose weight.
// Handles both the English ". " and Chinese "。" terminators.
function splitVerdict(verdict: string): { lead: string; rest: string } {
  const zhIdx = verdict.indexOf("。");
  const enIdx = verdict.indexOf(". ");
  let cut = -1;
  if (zhIdx >= 0 && (enIdx < 0 || zhIdx < enIdx)) {
    cut = zhIdx + 1;
  } else if (enIdx >= 0) {
    cut = enIdx + 1;
  }
  if (cut < 0) {
    return { lead: verdict, rest: "" };
  }
  return { lead: verdict.slice(0, cut), rest: verdict.slice(cut) };
}

// Whole days between two YYYY-MM-DD dates (null if either is unparseable).
function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return null;
  }
  return Math.round((b - a) / 86_400_000);
}

// "Research snapshot <date> · <N days> to the <deadline> deadline" (localized).
function snapshotLine(locale: ConsoleLocale, asOf: string, deadline?: string, days?: number | null): string {
  const prefix = c(locale, "snapshotPrefix") + asOf;
  if (!deadline) {
    return prefix;
  }
  if (locale === "zh") {
    return `${prefix} · 距 ${deadline} 截止${days != null ? `约 ${days} 天` : ""}`;
  }
  return `${prefix} · ${days != null ? `${days} days to ` : ""}the ${deadline} deadline`;
}

function ConfidenceBar({
  yes,
  interval,
  market,
  locale
}: {
  yes: number;
  interval: [number, number];
  market: number | null;
  locale: ConsoleLocale;
}) {
  const lo = clampPct(interval[0]);
  const hi = clampPct(interval[1]);
  const point = clampPct(yes);
  const marketPct = market != null ? clampPct(market) : null;
  // The model↔market gap IS the edge — draw it as a tinted connector so the
  // mispricing reads geometrically, not just as a number.
  const gapLeft = marketPct != null ? Math.min(point, marketPct) : null;
  const gapWidth = marketPct != null ? Math.abs(point - marketPct) : null;
  const gapColor = marketPct != null && point < marketPct ? "#c0392b" : "#15803d";
  return (
    <div>
      <div className={styles.ciTrack}>
        <span className={styles.ciBand} style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 0.5)}%` }} />
        {gapLeft != null && gapWidth != null ? (
          <span className={styles.ciGap} style={{ left: `${gapLeft}%`, width: `${gapWidth}%`, background: gapColor }} />
        ) : null}
        {marketPct != null ? (
          <span className={styles.ciMarketTag} style={{ left: `${marketPct}%` }}>
            {c(locale, "ciMarketMarker")} {pct(market, 0)}
          </span>
        ) : null}
        {marketPct != null ? <span className={styles.ciMarket} style={{ left: `${marketPct}%` }} /> : null}
        <span className={styles.ciPoint} style={{ left: `${point}%` }} />
        <span className={styles.ciModelTag} style={{ left: `${point}%` }}>
          {c(locale, "ciModelMarker")} {pct(yes, 0)}
        </span>
      </div>
      <div className={styles.ciScale}>
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      {marketPct != null ? (
        <p
          className={styles.ciMarketRead}
          style={{ color: marketPct < lo || marketPct > hi ? "#c0392b" : "#5b6472" }}
        >
          {c(locale, marketPct < lo || marketPct > hi ? "ciMarketOutside" : "ciMarketInside")}
        </p>
      ) : null}
      <p className={styles.ciNote}>{c(locale, "ciNote")}</p>
    </div>
  );
}

function ConclusionCard({ state, locale }: { state: ResearchState; locale: ConsoleLocale }) {
  const conclusion = state.conclusion;
  if (!conclusion) {
    return null;
  }
  const edge = conclusion.edge;
  const asOf = state.finalRun?.asOf;
  const deadline = state.finalRun?.deadline;
  const daysToDeadline = asOf && deadline ? daysBetween(asOf, deadline) : null;
  const call = callFromProbability(conclusion.yesProbability);
  const interval = conclusion.confidenceInterval;
  const edgeColor = edge != null && edge > 0 ? "#15803d" : edge != null && edge < 0 ? "#c0392b" : "#5b6472";
  return (
    <section
      className={styles.conclusionCard}
      style={{ borderLeft: `5px solid ${call.color}`, boxShadow: `0 14px 44px ${call.shadow}` }}
    >
      <div className={styles.decisionEyebrow}>
        <span
          className={styles.verdictPill}
          style={{ background: call.soft, color: call.color, boxShadow: `inset 0 0 0 1px ${call.border}` }}
        >
          {callLabel(locale, call)}
        </span>
        {edge != null ? (
          <div className={styles.eyebrowMetrics}>
            <span className={styles.eyebrowEdge} style={{ color: edgeColor }}>
              {pp(edge, 0)}
            </span>
            <span className={styles.eyebrowEdgeCaption}>
              {c(locale, edge < 0 ? "edgeBelowMarket" : "edgeAboveMarket")}
            </span>
          </div>
        ) : null}
      </div>
      <div className={styles.conclusionTop}>
        <div>
          <div className={styles.bigProbLabel}>{c(locale, "bigProbLabel")}</div>
          <div className={styles.bigProb}>{pct(conclusion.yesProbability)}</div>
        </div>
        <div className={styles.bigProbCi}>
          {c(locale, "ciInlineLabel")}
          {pct(interval[0], 0)} – {pct(interval[1], 0)}
        </div>
      </div>
      {asOf ? <p className={styles.snapshotLine}>{snapshotLine(locale, asOf, deadline, daysToDeadline)}</p> : null}
      <ConfidenceBar
        yes={conclusion.yesProbability}
        interval={conclusion.confidenceInterval}
        market={conclusion.marketProbability}
        locale={locale}
      />
      {(() => {
        const { lead, rest } = splitVerdict(conclusion.verdict);
        return (
          <p className={styles.verdict}>
            <strong className={styles.verdictLead}>{lead}</strong>
            {rest}
          </p>
        );
      })()}
      {conclusion.marketProbability != null && edge != null ? (
        <div className={styles.edgeRow}>
          <div
            className={styles.edgePrimary}
            style={{
              background: edge < 0 ? "#fdf4f3" : edge > 0 ? "#f1f9f4" : "#f6f7f9",
              borderColor: edge < 0 ? "#f3c9c4" : edge > 0 ? "#bfe3cc" : "#e3e6ee"
            }}
          >
            <div className={styles.edgeLabel}>{c(locale, "edgeLabel")}</div>
            <div
              className={`${styles.edgeValue} ${edge > 0 ? styles.metricPos : edge < 0 ? styles.metricNeg : ""}`}
            >
              {pp(edge)}
            </div>
            <div
              className={styles.edgeRead}
              style={{ color: edge < 0 ? "#c0392b" : edge > 0 ? "#15803d" : "#5b6472" }}
            >
              {c(locale, edge < 0 ? "edgeReadBelow" : "edgeReadAbove")}
            </div>
          </div>
          <div className={styles.metricGhost}>
            <div className={styles.metricLabel}>{c(locale, "marketImplied")}</div>
            <div className={styles.metricGhostValue}>{pct(conclusion.marketProbability)}</div>
          </div>
        </div>
      ) : null}
      {conclusion.marketProbability != null ? <p className={styles.edgeCaveat}>{c(locale, "edgeCaveat")}</p> : null}
    </section>
  );
}

function ConditionalTree({ state, locale }: { state: ResearchState; locale: ConsoleLocale }) {
  if (state.model.length === 0) {
    return null;
  }
  const product = state.model.reduce((acc, node) => acc * node.probability, 1);
  const finalProb = state.conclusion?.yesProbability ?? null;
  const calibrated = finalProb != null && Math.abs(finalProb - product) >= 0.01;
  // The lowest-probability node is the bottleneck driving the call — flag it so
  // a decision-maker sees *where* the case breaks, not just the product.
  const minProbability = Math.min(...state.model.map((node) => node.probability));
  const bottleneckIdx = state.model.findIndex((node) => node.probability === minProbability);
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{c(locale, "treeTitle")}</h3>
      <div className={styles.tree}>
        {state.model.map((node, index) => {
          const isBottleneck = index === bottleneckIdx;
          return (
            <Fragment key={node.id}>
              <div className={`${styles.treeNode} ${isBottleneck ? styles.treeNodeBottleneck : ""}`}>
                <div className={`${styles.treeNodeLabel} ${isBottleneck ? styles.treeNodeLabelBottleneck : ""}`}>
                  {node.label}
                  {isBottleneck ? " ⚠" : ""}
                </div>
                <div className={`${styles.treeNodeProb} ${isBottleneck ? "" : styles.treeNodeProbMuted}`}>
                  {pct(node.probability, 0)}
                </div>
                <div className={styles.treeNodeRationale}>{node.rationale}</div>
              </div>
              {index < state.model.length - 1 ? <div className={styles.treeOp}>×</div> : null}
            </Fragment>
          );
        })}
        <div className={styles.treeOp}>=</div>
        <div className={styles.treeResult}>
          <div className={styles.treeNodeLabel} style={{ color: "#9ec0ff" }}>
            {c(locale, "treeProduct")}
          </div>
          <div className={styles.treeResultProb}>{pct(product, 0)}</div>
          {calibrated ? (
            <div className={styles.treeResultNote}>
              {c(locale, "treeCalibratedPrefix")}
              {pct(finalProb!, 0)}
            </div>
          ) : null}
        </div>
      </div>
      {calibrated ? (
        <p className={styles.treeNote}>
          {c(locale, "treeNotePre")}
          {pct(finalProb!, 0)}
          {c(locale, "treeNotePost")}
        </p>
      ) : null}
    </section>
  );
}

// Prior → posterior path as a small SVG step chart.
function UpdateWaterfall({ state, locale }: { state: ResearchState; locale: ConsoleLocale }) {
  if (state.updates.length === 0) {
    return null;
  }
  const width = 640;
  const height = 180;
  const padX = 48;
  const padY = 28;
  // Scale the y-axis to the data (anchored at 0) so small probability moves are
  // legible instead of squished at the bottom of a fixed 0–100% axis.
  const maxTo = Math.max(...state.updates.map((u) => u.to));
  const domainMax = Math.min(1, Math.max(0.1, Math.ceil(maxTo / 0.75 / 0.05) * 0.05));
  const yOf = (value: number) => height - padY - (value / domainMax) * (height - padY * 2);
  const points = state.updates.map((update, index) => {
    const x = padX + (index / Math.max(state.updates.length - 1, 1)) * (width - padX * 2);
    return { x, y: yOf(update.to), update };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  // Land the terminal posterior dot in the call's direction color so the path
  // visibly resolves to the headline verdict.
  const posteriorColor = state.conclusion ? callFromProbability(state.conclusion.yesProbability).color : "#2563eb";

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{c(locale, "waterfallTitle")}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="prior to posterior update path">
        {[0, domainMax / 2, domainMax].map((tickVal) => {
          const y = yOf(tickVal);
          return (
            <g key={tickVal}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#eef1f6" strokeWidth={1} />
              <text x={8} y={y + 4} fontSize={11} fill="#aab1be">
                {(tickVal * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, index) => {
          // The terminal point is the posterior — the payload. Enlarge it and
          // ink its value so the eye lands on where the path settles.
          const isLast = index === points.length - 1;
          return (
            <g key={p.update.label}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isLast ? 7 : 5}
                fill={isLast ? posteriorColor : "#2563eb"}
                stroke="#fff"
                strokeWidth={isLast ? 2.5 : 2}
              />
              <text
                x={p.x}
                y={p.y - (isLast ? 15 : 12)}
                fontSize={isLast ? 13.5 : 11}
                fill={isLast ? posteriorColor : "#8a93a6"}
                textAnchor="middle"
                fontWeight={isLast ? 800 : 700}
              >
                {(p.update.to * 100).toFixed(0)}%
              </text>
              <text
                x={p.x}
                y={height - 8}
                fontSize={10}
                fill={isLast ? "#3f4651" : "#8a93a6"}
                textAnchor={index === 0 ? "start" : isLast ? "end" : "middle"}
                fontWeight={isLast ? 700 : 400}
              >
                <title>{p.update.label}</title>
                {p.update.label.length > 18 ? `${p.update.label.slice(0, 17)}…` : p.update.label}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function EvidenceLedger({ state, locale }: { state: ResearchState; locale: ConsoleLocale }) {
  if (state.evidence.length === 0) {
    return null;
  }
  // Most impactful first, so the load-bearing evidence is scannable up top.
  const rows = [...state.evidence].sort((a, b) => Math.abs(b.weightPct) - Math.abs(a.weightPct));
  // Scale the impact bars to the heaviest item so magnitude is pre-attentive.
  const maxAbs = Math.max(...rows.map((item) => Math.abs(item.weightPct)), 1);
  // The top-3 load-bearing rows get a stance-colored rail + bolder title.
  const KEY_ROWS = 3;
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>
        {c(locale, "ledgerTitlePre")}
        {state.evidence.length}
        {c(locale, "ledgerTitlePost")}
      </h3>
      <table className={styles.ledger}>
        <thead>
          <tr>
            <th>{c(locale, "ledgerColStance")}</th>
            <th>{c(locale, "ledgerColEvidence")}</th>
            <th className={styles.num}>{c(locale, "ledgerColImpact")}</th>
            <th className={styles.num}>{c(locale, "ledgerColReliability")}</th>
            <th>{c(locale, "ledgerColNode")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => {
            const positive = item.weightPct >= 0;
            const isKey = index < KEY_ROWS;
            const railColor = positive ? "#15803d" : "#c0392b";
            const barWidth = Math.max((Math.abs(item.weightPct) / maxAbs) * 64, 4);
            return (
              <tr
                key={item.id}
                className={isKey ? styles.ledgerRowKey : undefined}
                style={isKey ? { background: positive ? "#f5fbf6" : "#fffafa" } : undefined}
              >
                <td style={isKey ? { boxShadow: `inset 3px 0 0 ${railColor}` } : undefined}>
                  <span className={`${styles.stance} ${STANCE_CLASS[item.stance]}`}>{stanceLabel(locale, item.stance)}</span>
                </td>
                <td>
                  <div className={`${styles.ledgerTitle} ${isKey ? styles.ledgerTitleKey : ""}`}>{item.title}</div>
                  <div className={styles.ledgerSource}>
                    {item.sourceType} · {item.date}
                  </div>
                </td>
                <td className={styles.num}>
                  <span className={styles.impactCell}>
                    <span
                      className={styles.impactBar}
                      style={{ width: `${barWidth}px`, background: railColor }}
                    />
                    <span className={positive ? styles.weightPos : styles.weightNeg}>{signedPoints(item.weightPct)}</span>
                  </span>
                </td>
                <td className={`${styles.num} ${styles.ledgerReliability}`}>{item.reliability.toFixed(2)}</td>
                <td className={styles.ledgerNode}>{item.node}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.ledgerCaption}>{c(locale, "ledgerCaption")}</p>
    </section>
  );
}

function Limitations({ state, locale }: { state: ResearchState; locale: ConsoleLocale }) {
  const limitations = state.finalRun?.limitations ?? [];
  if (limitations.length === 0) {
    return null;
  }
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{c(locale, "limitationsTitle")}</h3>
      <ul className={styles.limitList}>
        {limitations.map((limit) => (
          <li key={limit.slice(0, 30)}>{limit}</li>
        ))}
      </ul>
    </section>
  );
}

export function ResultCharts({ state, locale }: { state: ResearchState; locale: ConsoleLocale }) {
  if (state.phase !== "complete") {
    return null;
  }
  return (
    <div className={styles.result}>
      <ConclusionCard state={state} locale={locale} />
      <ConditionalTree state={state} locale={locale} />
      <UpdateWaterfall state={state} locale={locale} />
      <EvidenceLedger state={state} locale={locale} />
      <Limitations state={state} locale={locale} />
    </div>
  );
}
