// M0 — the event-study service: β, benchmarks, sessions, excess returns,
// volume baselines. THE single implementation system-wide (PRD §4): M1's
// priced-in gate, M3's edge recheck, and the retrospectives must all call
// this module — never reimplement the math locally.
//
// Design notes:
// - Pure math cores take candle arrays so tests inject synthetic series;
//   thin impure wrappers do the fetching (archive first, API fallback).
// - Sessions use a fixed UTC−4 (EDT) approximation of US/Eastern. Good
//   enough for Phase 0 (calibration data spans summer); revisit before the
//   November DST switch. // TODO(dst): proper tz calendar
// - β regresses weekday close-to-close daily returns vs the benchmark
//   (XYZ100/SP500 perp), min 40 obs, capped 250; young/thin series degrade
//   to β=1 with a flag rather than fail.

import type { CandleInterval, Candle } from "./hyperliquid.js";
import { fetchCandles } from "./hyperliquid.js";
import { read1mRange } from "./market.js";

export type SessionBucket = "rth" | "offhours" | "weekend";

const ET_OFFSET_MS = 4 * 3600_000; // fixed EDT approximation

export function sessionBucketOf(ms: number): SessionBucket {
  const et = new Date(ms - ET_OFFSET_MS);
  const dow = et.getUTCDay(); // 0=Sun
  if (dow === 0 || dow === 6) return "weekend";
  const mins = et.getUTCHours() * 60 + et.getUTCMinutes();
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return "rth";
  return "offhours";
}

export function isWeekdayUtcDay(ms: number): boolean {
  const bucket = sessionBucketOf(ms + 12 * 3600_000); // midday probe of that day
  return bucket !== "weekend";
}

// --- pure cores ------------------------------------------------------------

export function closeToCloseReturns(candles: Candle[]): Array<{ t: number; r: number }> {
  const out: Array<{ t: number; r: number }> = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].c;
    if (prev > 0) out.push({ t: candles[i].t, r: candles[i].c / prev - 1 });
  }
  return out;
}

export interface BetaResult {
  beta: number;
  n: number;
  corr: number;
  // "ok"        — usable β
  // "weak_fit"  — |corr| < 0.3: benchmark explains little; excess ≈ raw move,
  //               callers should treat the residual as mostly idiosyncratic
  // "degraded"  — sample too small → β forced to 1
  quality: "ok" | "weak_fit" | "degraded";
}

// RTH-aligned daily closes from 1h candles: the 19:00-UTC bar's close
// (≈ the 16:00 ET cash close during EDT) on weekday RTH days only.
//
// WHY (measured 2026-08-22): the venue's 00:00-UTC daily candle closes at
// 20:00 ET in the thin off-hours book, and weekend perp prints (bounded but
// wild — an AAPL −6.7% Sunday bar was observed) poison close-to-close
// returns. β estimated on raw daily candles came out 0.21 for AAPL~XYZ100;
// RTH alignment plus winsorization is the fix mandated by PRD §11.
export function rthDailyCloses(candles1h: Candle[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of candles1h) {
    if (new Date(c.t).getUTCHours() === 19 && sessionBucketOf(c.t) === "rth") {
      out.set(new Date(c.t).toISOString().slice(0, 10), c.c);
    }
  }
  return out;
}

function dailyReturnsFromCloses(closes: Map<string, number>): Map<string, number> {
  const days = [...closes.keys()].sort();
  const out = new Map<string, number>();
  for (let i = 1; i < days.length; i++) {
    const p0 = closes.get(days[i - 1])!;
    const p1 = closes.get(days[i])!;
    if (p0 > 0) out.set(days[i], p1 / p0 - 1);
  }
  return out;
}

export function computeBeta(asset1h: Candle[], benchmark1h: Candle[], minObs = 40, maxObs = 250): BetaResult {
  const ra = dailyReturnsFromCloses(rthDailyCloses(asset1h));
  const rb = dailyReturnsFromCloses(rthDailyCloses(benchmark1h));
  let pairs: Array<[number, number]> = [];
  for (const [day, b] of rb) {
    const a = ra.get(day);
    if (a !== undefined) pairs.push([a, b]);
  }
  pairs = pairs.slice(-maxObs);
  if (pairs.length < minObs) return { beta: 1, n: pairs.length, corr: 0, quality: "degraded" };
  // Winsorize both legs at ±3σ so single outlier bars can't own the slope.
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const sd = (xs: number[]) => {
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  };
  const winsorize = (xs: number[]) => {
    const m = mean(xs);
    const s = sd(xs);
    const lo = m - 3 * s;
    const hi = m + 3 * s;
    return xs.map((x) => Math.min(hi, Math.max(lo, x)));
  };
  const av = winsorize(pairs.map((p) => p[0]));
  const bv = winsorize(pairs.map((p) => p[1]));
  const am = mean(av);
  const bm = mean(bv);
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < pairs.length; i++) {
    cov += (av[i] - am) * (bv[i] - bm);
    varA += (av[i] - am) ** 2;
    varB += (bv[i] - bm) ** 2;
  }
  if (varB === 0) return { beta: 1, n: pairs.length, corr: 0, quality: "degraded" };
  const corr = cov / Math.sqrt(varA * varB);
  // Negative β on a broad benchmark is estimation noise here — floor at 0 so
  // the "excess" frame never ADDS benchmark exposure to a raw move.
  const beta = Math.max(0, cov / varB);
  return { beta, n: pairs.length, corr, quality: Math.abs(corr) < 0.3 ? "weak_fit" : "ok" };
}

export function nearestCloseAt(candles: Candle[], ms: number, toleranceMs = 10 * 60_000): number | null {
  let best: Candle | null = null;
  let bestDist = Infinity;
  for (const c of candles) {
    const dist = Math.abs(c.t - ms);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best && bestDist <= toleranceMs ? best.c : null;
}

// Excess move between t0 and tEval: asset return − β × benchmark return.
export function computeExcessMove(
  assetCandles: Candle[],
  benchmarkCandles: Candle[] | null,
  beta: number,
  t0Ms: number,
  tEvalMs: number
): number | null {
  const a0 = nearestCloseAt(assetCandles, t0Ms);
  const a1 = nearestCloseAt(assetCandles, tEvalMs);
  if (a0 === null || a1 === null || a0 <= 0) return null;
  const assetRet = a1 / a0 - 1;
  if (!benchmarkCandles) return assetRet; // pre-IPO: raw reaction
  const b0 = nearestCloseAt(benchmarkCandles, t0Ms);
  const b1 = nearestCloseAt(benchmarkCandles, tEvalMs);
  if (b0 === null || b1 === null || b0 <= 0) return assetRet; // benchmark gap → raw, caller downgrades confidence
  return assetRet - beta * (b1 / b0 - 1);
}

// Volume z: total volume in [t0, tEval] vs a baseline built from windows of
// the same length at the same minute-of-day in the same session bucket.
export function computeVolumeZ(
  windowCandles: Candle[],
  baselineDays: Candle[][], // one array of 1m candles per prior day
  t0Ms: number,
  tEvalMs: number
): number | null {
  const windowLen = tEvalMs - t0Ms;
  if (windowLen <= 0) return null;
  const sumVol = (cs: Candle[], from: number, to: number) =>
    cs.filter((c) => c.t >= from && c.t < to).reduce((s, c) => s + c.v, 0);
  const observed = sumVol(windowCandles, t0Ms, tEvalMs);
  const msIntoDay = t0Ms % 86_400_000;
  const samples: number[] = [];
  for (const day of baselineDays) {
    if (!day.length) continue;
    const dayStart = day[0].t - (day[0].t % 86_400_000);
    const from = dayStart + msIntoDay;
    if (sessionBucketOf(from) !== sessionBucketOf(t0Ms)) continue;
    samples.push(sumVol(day, from, from + windowLen));
  }
  if (samples.length < 5) return null;
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  const sd = Math.sqrt(samples.reduce((s, x) => s + (x - mean) ** 2, 0) / samples.length);
  if (sd === 0) return null;
  return (observed - mean) / sd;
}

export function computeAtr(daily: Candle[], period = 20): number | null {
  const cs = daily.filter((c) => isWeekdayUtcDay(c.t)).slice(-(period + 1));
  if (cs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < cs.length; i++) {
    const prevClose = cs[i - 1].c;
    trs.push(Math.max(cs[i].h - cs[i].l, Math.abs(cs[i].h - prevClose), Math.abs(cs[i].l - prevClose)));
  }
  return trs.reduce((s, x) => s + x, 0) / trs.length;
}

export function computeDailyVolPct(daily: Candle[], lookback = 20): number | null {
  const rs = closeToCloseReturns(daily.filter((c) => isWeekdayUtcDay(c.t))).slice(-lookback);
  if (rs.length < 10) return null;
  const mean = rs.reduce((s, x) => s + x.r, 0) / rs.length;
  return Math.sqrt(rs.reduce((s, x) => s + (x.r - mean) ** 2, 0) / rs.length);
}

// Max single-day |move| over the lookback — feeds the leverage cap
// min(3x, 1/(2×maxDailyMove)) and the margin-buffer check.
export function computeMaxDailyMovePct(daily: Candle[], lookback = 120): number {
  const rs = closeToCloseReturns(daily.filter((c) => isWeekdayUtcDay(c.t))).slice(-lookback);
  let max = 0.05;
  for (const { r } of rs) max = Math.max(max, Math.abs(r));
  return max;
}

// --- impure wrappers (archive first, API fallback) -------------------------

export async function candles1m(coin: string, fromMs: number, toMs: number): Promise<Candle[]> {
  const archived = read1mRange(coin, fromMs, toMs);
  // The API keeps ~3.6 days of 1m — fill from it when the archive is thin.
  const spanCovered = archived.length >= Math.min(30, Math.max(1, (toMs - fromMs) / 60_000) * 0.5);
  if (spanCovered) return archived;
  try {
    return await fetchCandles(coin, "1m", fromMs, toMs);
  } catch {
    return archived;
  }
}

export async function candlesDaily(coin: string, days = 300): Promise<Candle[]> {
  return fetchCandles(coin, "1d", Date.now() - days * 86_400_000, Date.now());
}

export async function candlesInterval(coin: string, interval: CandleInterval, fromMs: number, toMs: number): Promise<Candle[]> {
  return fetchCandles(coin, interval, fromMs, toMs);
}
