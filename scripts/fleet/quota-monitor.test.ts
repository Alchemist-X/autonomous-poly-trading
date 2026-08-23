import { describe, expect, it } from "vitest";
import {
  extractLatestRateLimits,
  extractPercentFields,
  parseCreditAnchor,
  projectDaysToEmpty,
  scanForQuotaErrors,
  shouldAlert,
  sumLedgerAfter,
  type BalancePoint
} from "./quota-monitor";

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

describe("extractLatestRateLimits", () => {
  it("finds the last snapshot in a codex session rollout", () => {
    // Line shape captured from a real codex-cli 0.148 rollout on 2026-08-23.
    const jsonl = [
      `{"timestamp":"t1","type":"event_msg","payload":{"type":"token_count","rate_limits":{"primary":{"used_percent":0.5,"window_minutes":10080,"resets_at":1787846000},"secondary":null}}}`,
      `{"timestamp":"t2","type":"other"}`,
      `{"timestamp":"t3","payload":{"rate_limits":{"primary":{"used_percent":1.0,"window_minutes":10080,"resets_at":1787846698},"secondary":{"used_percent":3.2,"window_minutes":300,"resets_at":1787500000}}}}`,
      `garbage line`
    ].join("\n");
    const rl = extractLatestRateLimits(jsonl);
    expect(rl?.primary).toEqual({ usedPercent: 1.0, windowMinutes: 10080, resetsAt: 1787846698 });
    expect(rl?.secondary?.usedPercent).toBe(3.2);
  });

  it("returns null when no snapshot exists", () => {
    expect(extractLatestRateLimits(`{"a":1}\nnot json`)).toBeNull();
  });
});

describe("exa metering", () => {
  it("parses the anchor format and rejects malformed ones", () => {
    expect(parseCreditAnchor("12.5@2026-08-23T08:00:00Z")).toEqual({ usd: 12.5, atMs: Date.parse("2026-08-23T08:00:00Z") });
    expect(parseCreditAnchor("nope")).toBeNull();
    expect(parseCreditAnchor("x@2026-08-23T08:00:00Z")).toBeNull();
    expect(parseCreditAnchor(undefined)).toBeNull();
  });

  it("sums only entries after the anchor and tolerates junk lines", () => {
    const ledger = [
      `{"atUtc":"2026-08-20T00:00:00Z","costDollars":1.0}`,
      `{"atUtc":"2026-08-23T01:00:00Z","costDollars":0.007}`,
      `{"atUtc":"2026-08-23T02:00:00Z","costDollars":0.005}`,
      `broken`,
      `{"atUtc":"bad","costDollars":9}`
    ].join("\n");
    const sums = sumLedgerAfter(ledger, Date.parse("2026-08-22T00:00:00Z"));
    expect(sums.entries).toBe(2);
    expect(sums.totalUsd).toBeCloseTo(0.012, 5);
  });
});

describe("extractPercentFields", () => {
  it("walks nested payloads for percent-like numerics only", () => {
    const body = {
      five_hour: { utilization: 42.5, resets_at: "x" },
      seven_day: { used_percent: 88, tokens: 1234567 },
      note: "text",
      weird: { percent: 250 }
    };
    expect(extractPercentFields(body)).toEqual([
      { label: "five_hour.utilization", percent: 42.5 },
      { label: "seven_day.used_percent", percent: 88 }
    ]);
  });
});
