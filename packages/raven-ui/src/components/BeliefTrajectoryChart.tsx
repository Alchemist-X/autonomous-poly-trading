import * as React from "react";
import { pct } from "../lib/format";

export interface TrajectoryPoint {
  /** Running P(YES) after a source was applied (0..1). */
  prob: number;
  /** Which iteration this point belongs to (1-based). */
  round: number;
}

export interface BeliefTrajectoryChartProps {
  /** Base-rate prior P(YES) the trajectory starts from (0..1). */
  prior: number;
  /** Each source's running probability, in order across all iterations. */
  points: TrajectoryPoint[];
  /** SVG viewBox width (default 1000). */
  width?: number;
  /** SVG viewBox height (default 416). */
  height?: number;
}

/**
 * The belief-trajectory chart: how P(YES) moved from the prior across every
 * source and iteration. Up segments are green, down segments red; the y-axis
 * auto-scales to the data and iterations are labelled IT1, IT2, …
 */
export const BeliefTrajectoryChart: React.FC<BeliefTrajectoryChartProps> = ({
  prior,
  points,
  width = 1000,
  height = 416,
}) => {
  const SEQ: TrajectoryPoint[] = [{ prob: prior, round: 0 }, ...points];
  const N = SEQ.length;
  const L = 56, Rp = 70, Tp = 42, Bp = 42;
  const pw = width - L - Rp, ph = height - Tp - Bp;
  const maxP = Math.max(prior, ...SEQ.map((p) => p.prob));
  let ymax = Math.max(0.2, Math.ceil((maxP * 1.12) / 0.1) * 0.1);
  if (ymax > 1) ymax = 1;
  const step = ymax <= 0.3 ? 0.05 : ymax <= 0.6 ? 0.1 : 0.2;
  const ticks: number[] = [];
  for (let t = 0; t <= ymax + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  const x = (i: number) => L + (N <= 1 ? 0 : (i / (N - 1)) * pw);
  const y = (p: number) => Tp + (1 - p / ymax) * ph;

  const roundsX: Array<{ round: number; i0: number; i1: number }> = [];
  SEQ.forEach((p, i) => {
    if (p.round === 0) return;
    const g = roundsX.find((r) => r.round === p.round);
    if (g) g.i1 = i;
    else roundsX.push({ round: p.round, i0: i, i1: i });
  });

  let area = `M ${x(0)} ${height - Bp}`;
  for (let i = 0; i < N; i++) area += ` L ${x(i)} ${y(SEQ[i].prob)}`;
  area += ` L ${x(N - 1)} ${height - Bp} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="rvArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--rv-orange)" stopOpacity={0.2} />
          <stop offset="100%" stopColor="var(--rv-orange)" stopOpacity={0} />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={`tick-${t}`}>
          <line x1={L} x2={width - Rp} y1={y(t)} y2={y(t)} stroke="var(--rv-grid)" strokeWidth={1} />
          <text x={L - 10} y={y(t) + 4} textAnchor="end" fontSize={13} fill="var(--rv-ink3)" fontFamily="var(--rv-font-mono)">
            {Math.round(t * 100)}%
          </text>
        </g>
      ))}

      {roundsX.map((rg, idx) => {
        const cx = (x(rg.i0) + x(rg.i1)) / 2;
        const sx = idx > 0 ? (x(roundsX[idx - 1].i1) + x(rg.i0)) / 2 : 0;
        return (
          <g key={`rd-${rg.round}`}>
            <text x={cx} y={Tp - 18} textAnchor="middle" fontSize={12} letterSpacing={1} fill="var(--rv-ink3)" fontFamily="var(--rv-font-mono)">
              IT{rg.round}
            </text>
            {idx > 0 && (
              <line x1={sx} x2={sx} y1={Tp - 8} y2={height - Bp} stroke="var(--rv-line)" strokeWidth={1} strokeDasharray="2 5" />
            )}
          </g>
        );
      })}

      <path d={area} fill="url(#rvArea)" />

      {SEQ.slice(1).map((p, k) => {
        const i = k + 1;
        const up = SEQ[i].prob >= SEQ[i - 1].prob;
        return (
          <line
            key={`seg-${i}`}
            x1={x(i - 1)}
            y1={y(SEQ[i - 1].prob)}
            x2={x(i)}
            y2={y(SEQ[i].prob)}
            stroke={up ? "var(--rv-yes)" : "var(--rv-no)"}
            strokeWidth={3}
            strokeLinecap="round"
          />
        );
      })}

      {SEQ.map((p, i) => {
        const isLast = i === N - 1;
        if (i === 0) {
          return (
            <g key="d0">
              <circle cx={x(0)} cy={y(p.prob)} r={5} fill="var(--rv-bg3)" stroke="var(--rv-orange)" strokeWidth={2} />
              <text x={x(0)} y={y(p.prob) - 14} textAnchor="middle" fontSize={11} fill="var(--rv-ink2)" fontFamily="var(--rv-font-mono)">
                prior {Math.round(p.prob * 100)}%
              </text>
            </g>
          );
        }
        return (
          <g key={`d-${i}`}>
            <circle cx={x(i)} cy={y(p.prob)} r={isLast ? 6 : 3.5} fill={isLast ? "var(--rv-orange)" : "var(--rv-bg3)"} stroke="var(--rv-orange)" strokeWidth={2} />
            {isLast && (
              <text x={x(i) - 12} y={y(p.prob) - 13} textAnchor="end" fontSize={17} fontWeight={600} fill="var(--rv-orange)" fontFamily="var(--rv-font-sans)">
                {pct(p.prob)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
