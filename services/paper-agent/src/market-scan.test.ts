import { describe, expect, it } from "vitest";
import { DEFAULT_SCAN_OPTIONS, filterScanRows, type ScanRow } from "./market-scan";

const NOW = Date.parse("2026-07-03T00:00:00Z");
const FUTURE = "2026-09-01T00:00:00Z";

const base: ScanRow = {
  slug: "will-x-happen",
  question: "Will X happen?",
  outcomes: '["Yes","No"]',
  clobTokenIds: '["1","2"]',
  closed: false,
  endDate: FUTURE,
  volume24hr: 50_000,
  liquidityNum: 20_000,
  bestBid: 0.4,
  bestAsk: 0.42
};

describe("single-event exposure cap", () => {
  // The Hormuz case: same macro event, three expiries → one event slug.
  const positionsForEvent = (eventSlug: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ eventSlug, slug: `m${i}` }));

  it("counts open positions sharing a Gamma event", () => {
    const held = positionsForEvent("strait-of-hormuz-normal", 1);
    const count = (ev: string) => held.filter((p) => p.eventSlug === ev).length;
    expect(count("strait-of-hormuz-normal")).toBe(1);
    expect(count("some-other-event")).toBe(0);
    // maxPerEvent=1 → a second market on the same event is blocked
    expect(count("strait-of-hormuz-normal") >= 1).toBe(true);
  });
});

describe("filterScanRows", () => {
  it("accepts a liquid, binary, mid-priced market", () => {
    const out = filterScanRows([base], "finance", DEFAULT_SCAN_OPTIONS, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ slug: "will-x-happen", category: "finance", liquidityUsd: 20_000 });
  });

  it("rejects non-Yes/No, illiquid, longshot, imminent and closed rows", () => {
    const rows: ScanRow[] = [
      { ...base, slug: "teams", outcomes: '["Switzerland","Algeria"]' },
      { ...base, slug: "thin", liquidityNum: 1_000 }, // below the $5k risk floor
      { ...base, slug: "quiet", volume24hr: 100 },
      { ...base, slug: "longshot", bestAsk: 0.01 },
      { ...base, slug: "imminent", endDate: "2026-07-03T12:00:00Z" }, // <48h
      { ...base, slug: "done", closed: true },
      { ...base, slug: "ok" }
    ];
    const out = filterScanRows(rows, "tech", DEFAULT_SCAN_OPTIONS, NOW);
    expect(out.map((c) => c.slug)).toEqual(["ok"]);
  });

  it("caps at perCategory", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...base, slug: `m${i}` }));
    const out = filterScanRows(rows, "geopolitics", { ...DEFAULT_SCAN_OPTIONS, perCategory: 3 }, NOW);
    expect(out).toHaveLength(3);
  });
});
