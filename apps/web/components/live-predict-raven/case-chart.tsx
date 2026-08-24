import type { CaseTimelineEvent, PaperCase } from "../../lib/live-predict-raven/cases";
import type { Lang } from "../../lib/live-predict-raven/i18n";
import styles from "./report.module.css";

// Belief-vs-price chart for one case: what the engine thought our side was
// worth (from the dossier's round history) against what the market was paying
// for it (the bid recorded at each review), with the harness's own actions
// marked on the time axis.
//
// Everything is expressed for the side we HELD, not for YES — "we said 88%,
// the market paid 22¢" is the comparison the position was taken on. The
// dossier stores P(YES), so a NO position's curve is mirrored on the way in.

const VIEW_W = 720;
const VIEW_H = 260;
const MARGIN = { top: 20, right: 108, bottom: 34, left: 46 };
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;

interface Pt {
  t: number;
  v: number;
}

const MARKERS: Record<Lang, Record<string, { glyph: string; label: string }>> = {
  zh: {
    buy: { glyph: "▲", label: "买入" },
    sell: { glyph: "▼", label: "卖出" },
    stop_loss: { glyph: "✕", label: "止损" },
    resolution: { glyph: "◆", label: "结算" },
    screen_enter: { glyph: "◇", label: "选中" }
  },
  en: {
    buy: { glyph: "▲", label: "buy" },
    sell: { glyph: "▼", label: "sell" },
    stop_loss: { glyph: "✕", label: "stop" },
    resolution: { glyph: "◆", label: "settled" },
    screen_enter: { glyph: "◇", label: "screened" }
  }
};

function toPath(points: readonly Pt[], t0: number, t1: number): string {
  if (points.length === 0) return "";
  const span = t1 - t0 || 1;
  return points
    .map((p, i) => {
      const x = MARGIN.left + ((p.t - t0) / span) * PLOT_W;
      const y = MARGIN.top + (1 - Math.min(1, Math.max(0, p.v))) * PLOT_H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

const dayLabel = (ms: number): string => new Date(ms).toISOString().slice(5, 10);

export function CaseChart({ paperCase, lang }: { paperCase: PaperCase; lang: Lang }): React.ReactElement | null {
  const isNo = paperCase.side === "NO";
  // Dossier probabilities are P(YES); mirror them onto the held side.
  const belief: Pt[] = (paperCase.dossier?.beliefCurve ?? []).flatMap((p) => {
    const t = Date.parse(p.ts);
    return Number.isFinite(t) ? [{ t, v: isNo ? 1 - p.prob : p.prob }] : [];
  });
  const price: Pt[] = paperCase.marketCurve.flatMap((p) => {
    const t = Date.parse(p.ts);
    return Number.isFinite(t) ? [{ t, v: p.price }] : [];
  });
  const markers = paperCase.timeline.flatMap((e: CaseTimelineEvent) => {
    const marker = MARKERS[lang][e.kind];
    const t = Date.parse(e.ts);
    return marker && Number.isFinite(t) ? [{ ...e, t, marker }] : [];
  });

  const all = [...belief, ...price];
  if (all.length < 2) return null;
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t), ...markers.map((m) => m.t));
  const span = t1 - t0 || 1;
  const xOf = (t: number): number => MARGIN.left + ((t - t0) / span) * PLOT_W;
  const yOf = (v: number): number => MARGIN.top + (1 - Math.min(1, Math.max(0, v))) * PLOT_H;

  const lastBelief = belief[belief.length - 1];
  const lastPrice = price[price.length - 1];
  const gridlines = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => t0 + f * span);

  return (
    <div className={styles.chartWrap}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        role="img"
        aria-label={
          lang === "zh"
            ? `${paperCase.question}：引擎对我方方向的概率判断与市场报价随时间的对比`
            : `${paperCase.question}: the engine's probability for our side vs. the market's quote over time`
        }
      >
        {gridlines.map((g) => (
          <g key={g}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + PLOT_W}
              y1={yOf(g)}
              y2={yOf(g)}
              stroke="var(--line)"
              strokeWidth="1"
            />
            <text x={MARGIN.left - 8} y={yOf(g) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {`${g * 100}%`}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={xOf(t)} y={MARGIN.top + PLOT_H + 20} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {dayLabel(t)}
          </text>
        ))}

        <path d={toPath(price, t0, t1)} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 4" />
        <path
          d={toPath(belief, t0, t1)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {markers.map((m, i) => (
          <g key={`${m.ts}-${i}`}>
            <line
              x1={xOf(m.t)}
              x2={xOf(m.t)}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_H}
              stroke="var(--line-strong)"
              strokeWidth="1"
            />
            <text x={xOf(m.t)} y={MARGIN.top - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {m.marker.glyph}
              <title>{`${m.ts.slice(5, 16)} ${m.label}`}</title>
            </text>
          </g>
        ))}

        {lastBelief ? (
          <text x={MARGIN.left + PLOT_W + 8} y={yOf(lastBelief.v) + 4} fontSize="12" fill="var(--accent)">
            {lang === "zh" ? `引擎 ${(lastBelief.v * 100).toFixed(0)}%` : `engine ${(lastBelief.v * 100).toFixed(0)}%`}
          </text>
        ) : null}
        {lastPrice ? (
          <text x={MARGIN.left + PLOT_W + 8} y={yOf(lastPrice.v) + 4} fontSize="12" fill="var(--muted)">
            {lang === "zh" ? `市场 ${(lastPrice.v * 100).toFixed(0)}¢` : `market ${(lastPrice.v * 100).toFixed(0)}¢`}
          </text>
        ) : null}
      </svg>
      {lang === "zh" ? (
        <p className={styles.chartLegend}>
          实线 = 引擎认为「{paperCase.side}」这一边成立的概率（每轮研究后更新）；虚线 = 市场当时愿意为这一边出的价。
          竖线标记依次是{" "}
          {markers
            .map((m) => `${m.marker.glyph} ${m.marker.label}`)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join("、") || "无"}
          。
        </p>
      ) : (
        <p className={styles.chartLegend}>
          Solid = the engine&apos;s probability that the {paperCase.side} side is right (updated after each research
          round); dashed = what the market was paying for that side. Vertical markers:{" "}
          {markers
            .map((m) => `${m.marker.glyph} ${m.marker.label}`)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", ") || "none"}
          .
        </p>
      )}
    </div>
  );
}
