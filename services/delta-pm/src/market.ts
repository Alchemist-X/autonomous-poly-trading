// Self-built candle archive + live market state.
//
// WHY THIS EXISTS: Hyperliquid retains only ~5000 candles per interval
// (1m ≈ 3.6 days). Minute-of-day volume baselines and any backtest of the
// reaction window need more history than the API will ever return, so we
// sweep 1m candles into a local archive from day one (PRD §11 mandate 2).
//
// Layout: <artifacts>/delta-pm/market/1m/<COIN>/<YYYY-MM-DD>.json
//   { "<openTimeMs>": [o,h,l,c,v,n], ... }  — atomic-rewritten per sweep.
// Coarser intervals (1h/1d) are fetched on demand — the API keeps full
// listing history for those.

import path from "node:path";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { config } from "./config.js";
import { fetchAssetCtxs, fetchCandles, type AssetCtx, type Candle } from "./hyperliquid.js";
import { paths, readJson, writeJsonAtomic } from "./store.js";

type PackedCandle = [number, number, number, number, number, number]; // o,h,l,c,v,n

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function coinDir(coin: string): string {
  // "xyz:AAPL" → "xyz_AAPL" (colon is unfriendly on some filesystems)
  return path.join(paths.marketDir(), "1m", coin.replace(":", "_"));
}

function dayFile(coin: string, day: string): string {
  return path.join(coinDir(coin), `${day}.json`);
}

export function upsert1m(coin: string, candles: Candle[]): number {
  const byDay = new Map<string, Candle[]>();
  for (const c of candles) {
    const day = dayKey(c.t);
    const arr = byDay.get(day) ?? [];
    arr.push(c);
    byDay.set(day, arr);
  }
  let written = 0;
  for (const [day, arr] of byDay) {
    const file = dayFile(coin, day);
    const existing = readJson<Record<string, PackedCandle>>(file) ?? {};
    for (const c of arr) {
      existing[String(c.t)] = [c.o, c.h, c.l, c.c, c.v, c.n];
      written++;
    }
    writeJsonAtomic(file, existing);
  }
  return written;
}

export function read1mRange(coin: string, fromMs: number, toMs: number): Candle[] {
  const out: Candle[] = [];
  const dir = coinDir(coin);
  if (!existsSync(dir)) return out;
  // Walk day files overlapping the range.
  for (let ms = fromMs - (fromMs % 86_400_000); ms <= toMs; ms += 86_400_000) {
    const rec = readJson<Record<string, PackedCandle>>(dayFile(coin, dayKey(ms)));
    if (!rec) continue;
    for (const [t, p] of Object.entries(rec)) {
      const tMs = Number(t);
      if (tMs >= fromMs && tMs <= toMs) out.push({ t: tMs, o: p[0], h: p[1], l: p[2], c: p[3], v: p[4], n: p[5] });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export function archivedDayCount(coin: string): number {
  const dir = coinDir(coin);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}

// ---------------------------------------------------------------------------
// Live state kept warm by the pollers (index.ts owns the timers).

export interface MarketState {
  ctxs: Map<string, AssetCtx>;
  lastCtxSweepUtc: string | null;
  lastCandleSweepUtc: string | null;
  lastError: string | null;
}

export const marketState: MarketState = {
  ctxs: new Map(),
  lastCtxSweepUtc: null,
  lastCandleSweepUtc: null,
  lastError: null
};

export async function sweepCtxs(): Promise<void> {
  marketState.ctxs = await fetchAssetCtxs();
  marketState.lastCtxSweepUtc = new Date().toISOString();
}

// One sweep pulls the last ~20 minutes of 1m candles per tracked coin.
// Rate math: N coins × (weight 20 + ~1) per candleSnapshot, spread over the
// sweep interval — at 22 coins / 5 min that is ~92 weight/min of the 1200
// budget. Coins are fetched sequentially with a small gap to stay polite.
export async function sweepCandles(coins: string[]): Promise<number> {
  const now = Date.now();
  let total = 0;
  for (const coin of coins) {
    const candles = await fetchCandles(coin, "1m", now - 20 * 60_000, now);
    total += upsert1m(coin, candles);
    await new Promise((r) => setTimeout(r, 250));
  }
  marketState.lastCandleSweepUtc = new Date().toISOString();
  return total;
}

export function markPx(coin: string): number | null {
  return marketState.ctxs.get(coin)?.markPx ?? null;
}
