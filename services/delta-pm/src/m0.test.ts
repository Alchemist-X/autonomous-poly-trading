import { describe, expect, it } from "vitest";
import type { Candle } from "./hyperliquid.js";
import {
  computeAtr,
  computeBeta,
  computeExcessMove,
  computeMaxDailyMovePct,
  computeVolumeZ,
  nearestCloseAt,
  rthDailyCloses,
  sessionBucketOf
} from "./m0.js";

function candle(t: number, c: number, v = 100): Candle {
  return { t, o: c, h: c * 1.01, l: c * 0.99, c, v, n: 10 };
}

// 2026-08-19 is a Wednesday. 15:00 UTC = 11:00 ET → RTH.
const WED_15_UTC = Date.parse("2026-08-19T15:00:00Z");

describe("sessionBucketOf (fixed EDT approximation)", () => {
  it("classifies weekday RTH / off-hours / weekend", () => {
    expect(sessionBucketOf(WED_15_UTC)).toBe("rth");
    expect(sessionBucketOf(Date.parse("2026-08-19T02:00:00Z"))).toBe("offhours"); // 22:00 ET Tue
    expect(sessionBucketOf(Date.parse("2026-08-22T15:00:00Z"))).toBe("weekend"); // Saturday
    expect(sessionBucketOf(Date.parse("2026-08-23T15:00:00Z"))).toBe("weekend"); // Sunday
    // 13:00 UTC = 09:00 ET → pre-market, 20:30 UTC = 16:30 ET → post-market
    expect(sessionBucketOf(Date.parse("2026-08-19T13:00:00Z"))).toBe("offhours");
    expect(sessionBucketOf(Date.parse("2026-08-19T20:30:00Z"))).toBe("offhours");
  });
});

// Build synthetic 1h series across weekdays with a 19:00 UTC bar per day.
function series1h(days: number, priceAt: (dayIdx: number) => number): Candle[] {
  const out: Candle[] = [];
  const start = Date.parse("2026-03-02T00:00:00Z"); // a Monday
  let dayIdx = 0;
  for (let d = 0; dayIdx < days; d++) {
    const dayStart = start + d * 86_400_000;
    if (sessionBucketOf(dayStart + 19 * 3600_000) !== "rth") continue;
    out.push(candle(dayStart + 19 * 3600_000, priceAt(dayIdx)));
    dayIdx++;
  }
  return out;
}

describe("computeBeta (RTH-aligned, winsorized)", () => {
  it("recovers a known beta from correlated synthetic series", () => {
    // benchmark random walk; asset = 2x benchmark moves.
    const benchMoves: number[] = [];
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31 - 0.5) * 0.02;
    for (let i = 0; i < 120; i++) benchMoves.push(rand());
    let bp = 100;
    const benchPrices = benchMoves.map((m) => (bp *= 1 + m));
    let ap = 50;
    const assetPrices = benchMoves.map((m) => (ap *= 1 + 2 * m));
    const bench = series1h(120, (i) => benchPrices[i]);
    const asset = series1h(120, (i) => assetPrices[i]);
    const r = computeBeta(asset, bench);
    expect(r.quality).toBe("ok");
    expect(r.beta).toBeGreaterThan(1.8);
    expect(r.beta).toBeLessThan(2.2);
    expect(r.corr).toBeGreaterThan(0.95);
  });

  it("degrades to beta=1 when the sample is too small", () => {
    const bench = series1h(10, (i) => 100 + i);
    const asset = series1h(10, (i) => 50 + i);
    expect(computeBeta(asset, bench).quality).toBe("degraded");
  });

  it("flags weak_fit on uncorrelated series and floors beta at 0", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31 - 0.5) * 0.02;
    let bp = 100;
    const bench = series1h(120, () => (bp *= 1 + rand()));
    let seed2 = 1234567;
    const rand2 = () => ((seed2 = (seed2 * 1103515245 + 12345) % 2 ** 31) / 2 ** 31 - 0.5) * 0.02;
    let ap = 100;
    const asset = series1h(120, () => (ap *= 1 + rand2()));
    const r = computeBeta(asset, bench);
    expect(r.quality).toBe("weak_fit");
    expect(r.beta).toBeGreaterThanOrEqual(0);
  });
});

describe("rthDailyCloses", () => {
  it("keeps only weekday 19:00 UTC bars", () => {
    const cs = [
      candle(Date.parse("2026-08-19T19:00:00Z"), 100), // Wed → keep
      candle(Date.parse("2026-08-19T18:00:00Z"), 99), // wrong hour
      candle(Date.parse("2026-08-23T19:00:00Z"), 98) // Sunday
    ];
    const m = rthDailyCloses(cs);
    expect([...m.keys()]).toEqual(["2026-08-19"]);
  });
});

describe("computeExcessMove", () => {
  const t0 = WED_15_UTC;
  const t1 = t0 + 60 * 60_000;
  const assetCs = [candle(t0, 100), candle(t1, 105)]; // +5%
  const benchCs = [candle(t0, 200), candle(t1, 204)]; // +2%

  it("subtracts beta-scaled benchmark move", () => {
    const excess = computeExcessMove(assetCs, benchCs, 1.5, t0, t1);
    expect(excess).toBeCloseTo(0.05 - 1.5 * 0.02, 6);
  });

  it("returns raw move when benchmark is null (pre-IPO)", () => {
    expect(computeExcessMove(assetCs, null, 1, t0, t1)).toBeCloseTo(0.05, 6);
  });

  it("returns null when prices are missing near the timestamps", () => {
    expect(computeExcessMove(assetCs, benchCs, 1, t0 - 3 * 3600_000, t1)).toBeNull();
  });
});

describe("nearestCloseAt", () => {
  it("respects the tolerance window", () => {
    const cs = [candle(1_000_000, 42)];
    expect(nearestCloseAt(cs, 1_000_000 + 5 * 60_000)).toBe(42);
    expect(nearestCloseAt(cs, 1_000_000 + 20 * 60_000)).toBeNull();
  });
});

describe("computeVolumeZ", () => {
  it("computes z against same-minute-of-day baselines in the same bucket", () => {
    const t0 = WED_15_UTC;
    const windowCs = Array.from({ length: 30 }, (_, i) => candle(t0 + i * 60_000, 100, 50)); // 1500 total
    // Baselines: prior weekdays, same window, ~10±d volume/min (~300/window)
    // — varied so the baseline has nonzero variance (sd=0 → null by design).
    const baselineDays: Candle[][] = [];
    for (let d = 1; d <= 10; d++) {
      const dayT0 = t0 - d * 86_400_000;
      if (sessionBucketOf(dayT0) !== "rth") continue;
      baselineDays.push(
        Array.from({ length: 24 * 60 }, (_, i) => candle(dayT0 - (dayT0 % 86_400_000) + i * 60_000, 100, 10 + (d % 3)))
      );
    }
    const z = computeVolumeZ(windowCs, baselineDays, t0, t0 + 30 * 60_000);
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(3); // 1500 vs mean 300 — a real spike
  });

  it("returns null with too few baseline samples", () => {
    const t0 = WED_15_UTC;
    const windowCs = [candle(t0, 100, 50)];
    expect(computeVolumeZ(windowCs, [], t0, t0 + 60_000)).toBeNull();
  });
});

describe("ATR / max daily move", () => {
  const daily = Array.from({ length: 30 }, (_, i) => {
    const t = Date.parse("2026-06-01T00:00:00Z") + i * 86_400_000;
    return { t, o: 100, h: 102, l: 98, c: 100 + (i % 2 ? 1 : -1), v: 1000, n: 100 } satisfies Candle;
  });

  it("computes ATR over weekday bars", () => {
    const atr = computeAtr(daily, 14);
    expect(atr).not.toBeNull();
    expect(atr!).toBeGreaterThan(3.9); // TR = h-l = 4 dominates
  });

  it("computeMaxDailyMovePct has a 5% floor", () => {
    expect(computeMaxDailyMovePct(daily)).toBeGreaterThanOrEqual(0.05);
  });
});
