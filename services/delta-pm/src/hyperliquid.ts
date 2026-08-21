// Read-only Hyperliquid public info client for the trade.xyz builder dex.
// This module is the ONLY exchange-facing network surface of delta-pm, every
// call is an unauthenticated POST to /info, and no signing code exists in
// this service — real order placement is structurally impossible (Phase 0
// shadow mode; the exchange adapter with signing arrives in Phase 1/2 behind
// user-approved credentials).
//
// Measured constraints baked in (2026-08-22 recon):
// - candleSnapshot retains ~5000 bars/interval (1m ≈ 3.6 days) — the archive
//   sweeper in market.ts must run from day one.
// - REST budget 1200 weight/min/IP; metaAndAssetCtxs is ONE weight-20 call
//   for all 115 dex assets — poll that, never per-coin candle loops.

import { config } from "./config.js";

async function info<T>(body: Record<string, unknown>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(config.hlInfoUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000)
      });
      if (!res.ok) throw new Error(`POST /info ${JSON.stringify(body.type)} → ${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export interface AssetMeta {
  name: string; // normalized coin form, e.g. "xyz:AAPL"
  maxLeverage: number;
  onlyIsolated: boolean;
  isDelisted: boolean;
  growthMode: boolean;
}

// Universe names come back ALREADY dex-prefixed in some info responses
// ("xyz:AAPL") and bare in others — normalize to the prefixed coin form.
function toCoin(name: string): string {
  return name.includes(":") ? name : `${config.hlDex}:${name}`;
}

export async function fetchMeta(): Promise<AssetMeta[]> {
  const raw = await info<{ universe: Array<Record<string, unknown>> }>({ type: "meta", dex: config.hlDex });
  return (raw.universe ?? []).map((u) => ({
    name: toCoin(String(u.name ?? "")),
    maxLeverage: Number(u.maxLeverage ?? 0),
    onlyIsolated: Boolean(u.onlyIsolated),
    isDelisted: Boolean(u.isDelisted),
    growthMode: u.growthMode === "enabled" || u.growthMode === true
  }));
}

export interface AssetCtx {
  coin: string; // "xyz:AAPL"
  markPx: number | null;
  oraclePx: number | null;
  midPx: number | null;
  funding: number | null; // hourly rate
  openInterest: number | null; // in units
  dayNtlVlm: number | null; // 24h notional volume USD
  impactBidPx: number | null;
  impactAskPx: number | null;
}

// One weight-20 call returns [meta, ctxs] aligned by index.
export async function fetchAssetCtxs(): Promise<Map<string, AssetCtx>> {
  const raw = await info<[{ universe: Array<{ name: string }> }, Array<Record<string, unknown>>]>({
    type: "metaAndAssetCtxs",
    dex: config.hlDex
  });
  const [meta, ctxs] = raw;
  const out = new Map<string, AssetCtx>();
  (meta?.universe ?? []).forEach((u, i) => {
    const c = ctxs?.[i] ?? {};
    const numOrNull = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const impact = Array.isArray(c.impactPxs) ? (c.impactPxs as unknown[]) : [];
    const coin = toCoin(u.name);
    out.set(coin, {
      coin,
      markPx: numOrNull(c.markPx),
      oraclePx: numOrNull(c.oraclePx),
      midPx: numOrNull(c.midPx),
      funding: numOrNull(c.funding),
      openInterest: numOrNull(c.openInterest),
      dayNtlVlm: numOrNull(c.dayNtlVlm),
      impactBidPx: numOrNull(impact[0]),
      impactAskPx: numOrNull(impact[1])
    });
  });
  return out;
}

export interface Candle {
  t: number; // open time ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number; // volume in units
  n: number; // trade count
}

export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export async function fetchCandles(coin: string, interval: CandleInterval, startMs: number, endMs: number): Promise<Candle[]> {
  const raw = await info<Array<Record<string, unknown>>>({
    type: "candleSnapshot",
    req: { coin, interval, startTime: Math.floor(startMs), endTime: Math.floor(endMs) }
  });
  return (raw ?? [])
    .map((r) => ({
      t: Number(r.t),
      o: Number(r.o),
      h: Number(r.h),
      l: Number(r.l),
      c: Number(r.c),
      v: Number(r.v),
      n: Number(r.n)
    }))
    .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.c))
    .sort((a, b) => a.t - b.t);
}

export interface BookLevel {
  px: number;
  sz: number;
}

export interface L2Book {
  bids: BookLevel[]; // best first
  asks: BookLevel[]; // best first
}

export async function fetchL2Book(coin: string): Promise<L2Book> {
  const raw = await info<{ levels?: [Array<{ px: string; sz: string }>, Array<{ px: string; sz: string }>] }>({
    type: "l2Book",
    coin
  });
  const toLevels = (rows: Array<{ px: string; sz: string }> | undefined): BookLevel[] =>
    (rows ?? [])
      .map((r) => ({ px: Number(r.px), sz: Number(r.sz) }))
      .filter((l) => Number.isFinite(l.px) && Number.isFinite(l.sz) && l.sz > 0);
  const [bids, asks] = raw.levels ?? [[], []];
  return { bids: toLevels(bids), asks: toLevels(asks) };
}
