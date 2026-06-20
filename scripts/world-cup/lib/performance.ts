/**
 * Forecast-performance metrics for the World Cup "预测效果 / performance" page.
 *
 * Pure + deterministic (no network): given our forecasts, the settled results,
 * and the captured prediction-time Polymarket prices, it derives four metrics —
 *   • Mock PNL  : per match, bet $5 on EACH of the 3 markets (home/draw/away)
 *                 where our prob differs from the market price by > 3% (buy Yes
 *                 if we're higher, No if lower); aggregate as a return %.
 *   • Brier skill vs market ("相对市场水平"): 1 − Brier(ours)/Brier(market).
 *   • Calibration (ECE)   : decile reliability of our outcome probabilities.
 *   • Best-pick hit rate  : our top outcome matched the result.
 * All money is internal; only percentages are surfaced.
 */

export interface BaselinePrice {
  readonly a: number;
  readonly draw: number;
  readonly b: number;
}
export interface PerfOutcome {
  readonly key: string;
  readonly label_en: string;
  readonly p: number;
}
export interface PerfFixture {
  readonly event_slug: string;
  readonly outcomes: readonly PerfOutcome[];
}
export interface PerfResult {
  readonly status: string;
  readonly winner: "a" | "draw" | "b" | null;
  readonly score: string | null;
}

export type Side = "yes" | "no" | "skip";
export interface PerfLeg {
  readonly leg: "a" | "draw" | "b";
  readonly side: Side;
  readonly retPct: number | null; // per-$5-bet return %, null when skipped
  readonly win: boolean;
}
export interface PerfMatch {
  readonly slug: string;
  readonly homeEn: string;
  readonly awayEn: string;
  readonly score: string | null;
  readonly winner: "a" | "draw" | "b";
  readonly our: readonly [number, number, number]; // a, draw, b
  readonly mkt: readonly [number, number, number]; // market implied, vig-normalized
  readonly legs: readonly PerfLeg[];
}
export interface PerfBin {
  readonly lo: number;
  readonly hi: number;
  readonly n: number;
  readonly predPct: number;
  readonly obsPct: number;
}
export interface PerfAgg {
  readonly settled: number;
  readonly bestPickHit: number;
  readonly bestPickPct: number;
  readonly roiPct: number; // Mock PNL return %
  readonly bets: number;
  readonly wins: number;
  readonly skips: number;
  readonly bssPct: number; // Brier skill vs market, as %
  readonly ecePct: number;
}
export interface Performance {
  readonly agg: PerfAgg;
  readonly matches: readonly PerfMatch[];
  readonly bins: readonly PerfBin[];
}

const EDGE = 0.03;
const STAKE = 5;
const KEYS = ["a", "draw", "b"] as const;
type Key = (typeof KEYS)[number];

function brier(P: Record<Key, number>, w: Key): number {
  return KEYS.reduce((s, k) => s + (P[k] - (w === k ? 1 : 0)) ** 2, 0);
}
const r2 = (x: number) => Math.round(x * 100) / 100;
const r1 = (x: number) => Math.round(x * 10) / 10;

export function computePerformance(
  fixtures: readonly PerfFixture[],
  results: Record<string, PerfResult | undefined>,
  baseline: Record<string, BaselinePrice | null | undefined>
): Performance {
  const matches: PerfMatch[] = [];
  const calib: Array<{ p: number; hit: number }> = [];
  let ob = 0, bb = 0, pnl = 0, staked = 0, bets = 0, wins = 0, bpHit = 0, n = 0;

  for (const f of fixtures) {
    const res = results[f.event_slug];
    const mkt = baseline[f.event_slug];
    if (!res || res.status !== "resolved" || res.winner == null || !mkt) continue;
    n += 1;
    const oc = Object.fromEntries(f.outcomes.map((o) => [o.key, o]));
    const our = { a: oc.a.p, draw: oc.draw.p, b: oc.b.p } as Record<Key, number>;
    const sum = mkt.a + mkt.draw + mkt.b;
    const base = { a: mkt.a / sum, draw: mkt.draw / sum, b: mkt.b / sum } as Record<Key, number>;
    ob += brier(our, res.winner);
    bb += brier(base, res.winner);
    for (const k of KEYS) calib.push({ p: our[k], hit: res.winner === k ? 1 : 0 });
    const bestPick = KEYS.reduce((x, k) => (our[k] > our[x] ? k : x), "a" as Key);
    if (bestPick === res.winner) bpHit += 1;

    const legs: PerfLeg[] = [];
    for (const k of KEYS) {
      const m0 = mkt[k]; // RAW market price is the entry cost
      const edge = our[k] - m0;
      const hap = res.winner === k ? 1 : 0;
      if (Math.abs(edge) <= EDGE) {
        legs.push({ leg: k, side: "skip", retPct: null, win: false });
        continue;
      }
      let profit: number, side: Side;
      if (edge > 0) {
        side = "yes";
        profit = (STAKE / m0) * hap - STAKE;
      } else {
        side = "no";
        profit = (STAKE / (1 - m0)) * (1 - hap) - STAKE;
      }
      pnl += profit;
      staked += STAKE;
      bets += 1;
      const win = profit > 0;
      if (win) wins += 1;
      legs.push({ leg: k, side, retPct: r1((profit / STAKE) * 100), win });
    }

    matches.push({
      slug: f.event_slug,
      homeEn: oc.a.label_en,
      awayEn: oc.b.label_en,
      score: res.score ?? null,
      winner: res.winner,
      our: [r2(our.a), r2(our.draw), r2(our.b)],
      mkt: [r2(base.a), r2(base.draw), r2(base.b)],
      legs
    });
  }

  const bins: PerfBin[] = [];
  for (let i = 0; i < 10; i += 1) {
    const lo = i / 10, hi = (i + 1) / 10;
    const inb = calib.filter((c) => c.p >= lo && (i === 9 ? c.p <= hi : c.p < hi));
    if (!inb.length) continue;
    bins.push({
      lo, hi, n: inb.length,
      predPct: Math.round((inb.reduce((s, c) => s + c.p, 0) / inb.length) * 100),
      obsPct: Math.round((inb.reduce((s, c) => s + c.hit, 0) / inb.length) * 100)
    });
  }
  const ece = calib.length ? bins.reduce((s, x) => s + (x.n / calib.length) * Math.abs(x.predPct - x.obsPct), 0) : 0;

  return {
    agg: {
      settled: n,
      bestPickHit: bpHit,
      bestPickPct: n ? Math.round((bpHit / n) * 100) : 0,
      roiPct: staked ? r1((pnl / staked) * 100) : 0,
      bets,
      wins,
      skips: n * 3 - bets,
      bssPct: bb ? r1((1 - ob / bb) * 100) : 0,
      ecePct: r1(ece)
    },
    matches,
    bins
  };
}
