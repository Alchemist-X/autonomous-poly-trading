// Fee model. Source of truth = LIVE per-market fee metadata from the CLOB
// (`/markets/<conditionId>` → taker_base_fee / maker_base_fee in bps,
// minimum_tick_size) — Gamma no longer exposes a category field, so static
// category tables are dead on arrival (adversarial-review finding 2026-07-03).
// Fee params are captured on the position at entry and refreshed best-effort
// at exit time, so a transient CLOB outage falls back to the stored values.
//
// Formula (Polymarket CLOB fee schedule): the fee is charged on the cheaper
// side of the pair, symmetric for buys and sells:
//   fee_usd = shares × (rate_bps / 10000) × min(price, 1 − price)

export interface MarketFeeParams {
  takerBps: number;
  makerBps: number;
  tickSize: number;
}

export const DEFAULT_FEES: MarketFeeParams = { takerBps: 0, makerBps: 0, tickSize: 0.01 };

export function feeUsd(shares: number, price: number, rateBps: number): number {
  if (shares <= 0 || price <= 0 || price >= 1 || rateBps <= 0) return 0;
  return shares * (rateBps / 10_000) * Math.min(price, 1 - price);
}

export function takerFeeUsd(shares: number, price: number, fees: MarketFeeParams): number {
  return feeUsd(shares, price, fees.takerBps);
}

export function makerFeeUsd(shares: number, price: number, fees: MarketFeeParams): number {
  return feeUsd(shares, price, fees.makerBps);
}

export async function fetchMarketFees(conditionId: string): Promise<MarketFeeParams | null> {
  if (!conditionId) return null;
  try {
    const res = await fetch(`https://clob.polymarket.com/markets/${encodeURIComponent(conditionId)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000)
    });
    if (!res.ok) return null;
    const m = (await res.json()) as { taker_base_fee?: number; maker_base_fee?: number; minimum_tick_size?: number };
    return {
      takerBps: Number.isFinite(m.taker_base_fee) ? Number(m.taker_base_fee) : 0,
      makerBps: Number.isFinite(m.maker_base_fee) ? Number(m.maker_base_fee) : 0,
      tickSize: Number.isFinite(m.minimum_tick_size) && Number(m.minimum_tick_size) > 0 ? Number(m.minimum_tick_size) : 0.01
    };
  } catch {
    return null;
  }
}
