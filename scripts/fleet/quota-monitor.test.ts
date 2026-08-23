import { describe, expect, it } from "vitest";
import { projectDaysToEmpty, scanForQuotaErrors, shouldAlert, type BalancePoint } from "./quota-monitor";

function pts(pairs: Array<[string, number]>): BalancePoint[] {
  return pairs.map(([atUtc, balance]) => ({ atUtc, balance }));
}

describe("projectDaysToEmpty", () => {
  it("projects a steady drain to zero", () => {
    // 10 CNY/day burn from 100 → ~8 days left as of the last point.
    const h = pts([
      ["2026-08-20T00:00:00Z", 100],
      ["2026-08-21T00:00:00Z", 90],
      ["2026-08-22T00:00:00Z", 80]
    ]);
    const days = projectDaysToEmpty(h, new Date("2026-08-22T00:00:00Z"));
    expect(days).not.toBeNull();
    expect(days!).toBeGreaterThan(7);
    expect(days!).toBeLessThan(9);
  });

  it("returns null for flat, refilled, or short histories", () => {
    const now = new Date("2026-08-22T00:00:00Z");
    expect(projectDaysToEmpty(pts([["2026-08-21T00:00:00Z", 50]]), now)).toBeNull();
    expect(projectDaysToEmpty(pts([["2026-08-20T00:00:00Z", 50], ["2026-08-21T00:00:00Z", 50], ["2026-08-22T00:00:00Z", 50]]), now)).toBeNull();
    expect(projectDaysToEmpty(pts([["2026-08-20T00:00:00Z", 20], ["2026-08-21T00:00:00Z", 60], ["2026-08-22T00:00:00Z", 100]]), now)).toBeNull();
  });
});

describe("scanForQuotaErrors", () => {
  it("catches each vendor's phrasing and tags the pattern", () => {
    const text = [
      "[2026-08-23T10:00:00Z] ERR engine run failed: HTTP 429 Too Many Requests",
      "Error: insufficient balance for deepseek account",
      "codex: usage limit reached for your plan, resets at 18:00",
      "claude: rate_limited — retry later",
      "a perfectly normal INFO line about positions"
    ].join("\n");
    const hits = scanForQuotaErrors(text);
    expect(hits.map((h) => h.patternId)).toEqual(["http-429", "balance", "usage-limit", "rate-limit"]);
  });

  it("returns nothing on clean logs", () => {
    expect(scanForQuotaErrors("INFO scheduler armed\nINFO book root: /x")).toEqual([]);
  });
});

describe("shouldAlert cooldown", () => {
  it("first alert passes, repeats inside cooldown mute, repeats after cooldown pass", () => {
    const state = { lastSentUtc: {} as Record<string, string> };
    const t0 = new Date("2026-08-23T00:00:00Z");
    expect(shouldAlert(state, "deepseek-balance", t0, 6)).toBe(true);
    state.lastSentUtc["deepseek-balance"] = t0.toISOString();
    expect(shouldAlert(state, "deepseek-balance", new Date("2026-08-23T03:00:00Z"), 6)).toBe(false);
    expect(shouldAlert(state, "deepseek-balance", new Date("2026-08-23T06:00:01Z"), 6)).toBe(true);
    expect(shouldAlert(state, "other-topic", t0, 6)).toBe(true);
  });
});
