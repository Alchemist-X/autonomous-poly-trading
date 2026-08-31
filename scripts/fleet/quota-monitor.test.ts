import { describe, expect, it } from "vitest";
import {
  aggregateBurn,
  bar,
  burnCeilingAlertEnabled,
  burnStatsTokenOnly,
  buildDailyCard,
  digestDue,
  extractLatestRateLimits,
  extractPercentFields,
  fmtTokens,
  parseTranscriptLine,
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

describe("burn ceiling alert configuration", () => {
  it("can mute Claude's empirical ceiling without muting Kimi", () => {
    const disabled = "claudeBurn";
    expect(burnCeilingAlertEnabled("claudeBurn", disabled)).toBe(false);
    expect(burnCeilingAlertEnabled("kimiBurn", disabled)).toBe(true);
  });

  it("accepts a comma-separated list and defaults to enabled", () => {
    expect(burnCeilingAlertEnabled("claudeBurn", "")).toBe(true);
    expect(burnCeilingAlertEnabled("kimiBurn", " claudeBurn, kimiBurn ")).toBe(false);
  });
});

describe("burn statistics presentation", () => {
  it("can reduce Claude to raw token counts without changing Kimi", () => {
    const tokenOnly = "claudeBurn";
    expect(burnStatsTokenOnly("claudeBurn", tokenOnly)).toBe(true);
    expect(burnStatsTokenOnly("kimiBurn", tokenOnly)).toBe(false);
  });

  it("accepts a comma-separated list and defaults to detailed output", () => {
    expect(burnStatsTokenOnly("claudeBurn", "")).toBe(false);
    expect(burnStatsTokenOnly("kimiBurn", " claudeBurn, kimiBurn ")).toBe(true);
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

describe("daily digest card", () => {
  it("renders bars proportionally and clamps", () => {
    expect(bar(0)).toBe("░░░░░░░░░░");
    expect(bar(50)).toBe("▓▓▓▓▓░░░░░");
    expect(bar(100)).toBe("▓▓▓▓▓▓▓▓▓▓");
    expect(bar(250)).toBe("▓▓▓▓▓▓▓▓▓▓");
    expect(bar(-5)).toBe("░░░░░░░░░░");
  });

  it("digestDue fires once per UTC day at/after the hour", () => {
    expect(digestDue(undefined, new Date("2026-08-24T01:30:00Z"), 1)).toBe(true);
    expect(digestDue("2026-08-24", new Date("2026-08-24T02:30:00Z"), 1)).toBe(false);
    expect(digestDue("2026-08-23", new Date("2026-08-24T00:30:00Z"), 1)).toBe(false);
    expect(digestDue("2026-08-23", new Date("2026-08-24T01:00:00Z"), 1)).toBe(true);
  });

  it("builds a green all-clear card with bars, book table, and human copy", () => {
    const card = buildDailyCard(
      {
        deepseek: { balance: 194.83, currency: "CNY", runwayDays: 23.4 },
        codex: { windows: [{ name: "primary", usedPercent: 1.0, windowMinutes: 10080, resetsAt: 1787846698 }], snapshotAgeHours: 0.2 },
        claude: { status: "rate-limited" },
        exa: { spentUsd: 0.12, entries: 17, anchorUsd: 10, remainingUsd: 9.88, perDayUsd: 0.04, runwayDays: 247 },
        books: [
          { name: "fable", alive: true, quotaHits: 0 },
          { name: "gpt-sol", alive: false, quotaHits: 2 }
        ]
      },
      [],
      new Date("2026-08-24T01:00:00Z")
    ) as { msg_type: string; card: { header: { template: string }; elements: Array<Record<string, unknown>> } };

    expect(card.msg_type).toBe("interactive");
    expect(card.card.header.template).toBe("green");
    const blob = JSON.stringify(card);
    expect(blob).toContain("Raven API 服务水位监控");
    expect(blob).toContain("░░░░░░░░░░` 已用 1.0%"); // codex bar: 1% rounds to zero filled blocks
    expect(blob).toContain("¥".replace("¥", "CNY")); // currency shown as CNY
    expect(blob).toContain("约剩 $9.88 / $10");
    expect(blob).toContain("✅ fable");
    expect(blob).toContain("🔴 gpt-sol · 2 次配额报错");
    expect(blob).toContain("今日无异常");
  });

  it("turns the header red when a critical finding exists", () => {
    const card = buildDailyCard(
      { books: [] },
      [{ topic: "x", severity: "critical", message: "boom" }],
      new Date("2026-08-24T01:00:00Z")
    ) as { card: { header: { template: string } } };
    expect(card.card.header.template).toBe("red");
  });
});

describe("transcript burn accounting", () => {
  it("parses a claude-code transcript line and sums the non-cache-read tokens", () => {
    const line = JSON.stringify({
      timestamp: "2026-08-23T08:57:19.585Z",
      message: {
        model: "claude-fable-5",
        usage: { input_tokens: 2, cache_creation_input_tokens: 12428, cache_read_input_tokens: 19391, output_tokens: 575 }
      }
    });
    expect(parseTranscriptLine(line)).toEqual({ tsMs: Date.parse("2026-08-23T08:57:19.585Z"), model: "claude-fable-5", tokens: 2 + 12428 + 575 });
    expect(parseTranscriptLine(`{"timestamp":"2026-08-23T00:00:00Z","message":{"role":"user"}}`)).toBeNull();
    expect(parseTranscriptLine("garbage")).toBeNull();
  });

  it("aggregates 5h/7d windows per vendor bucket", () => {
    const now = Date.parse("2026-08-23T12:00:00Z");
    const mk = (iso: string, model: string, tokens: number) => ({ tsMs: Date.parse(iso), model, tokens });
    const entries = [
      mk("2026-08-23T10:00:00Z", "claude-fable-5", 1000),   // inside 5h
      mk("2026-08-23T01:00:00Z", "claude-opus-5", 2000),    // 7d only
      mk("2026-08-20T00:00:00Z", "kimi-k3", 500),           // kimi, 7d only
      mk("2026-08-10T00:00:00Z", "claude-fable-5", 9999)    // outside 7d
    ];
    const claude = aggregateBurn(entries, now, (m) => m.startsWith("claude"));
    expect(claude).toEqual({ fiveHourTokens: 1000, fiveHourCalls: 1, sevenDayTokens: 3000, sevenDayCalls: 2 });
    const kimi = aggregateBurn(entries, now, (m) => m.includes("kimi"));
    expect(kimi.sevenDayTokens).toBe(500);
  });

  it("formats token counts for humans", () => {
    expect(fmtTokens(532)).toBe("532");
    expect(fmtTokens(53_200)).toBe("53k");
    expect(fmtTokens(5_320_000)).toBe("5.3M");
  });

  it("Claude burn stats render as token counts only", () => {
    const card = buildDailyCard(
      {
        claude: { fields: [{ label: "five_hour", percent: 94 }] },
        claudeBurn: {
          fiveHourTokens: 1_200_000,
          fiveHourCalls: 40,
          sevenDayTokens: 9_800_000,
          sevenDayCalls: 300,
          ceilingTokens: 1_276_596,
          usedPercent: 94
        },
        kimiBurn: { fiveHourTokens: 0, fiveHourCalls: 0, sevenDayTokens: 350_000, sevenDayCalls: 12 },
        books: []
      },
      [],
      new Date("2026-08-24T01:00:00Z")
    );
    const blob = JSON.stringify(card);
    expect(blob).toContain("按本机实测消耗");
    expect(blob).toContain("近 5 小时 1.2M tokens · 近 7 天 9.8M tokens");
    expect(blob).not.toContain("40 条消息");
    expect(blob).not.toContain("撞限水位");
    expect(blob).not.toContain("94%");
    expect(blob).toContain("Kimi Code（kimi-k3 书）");
    expect(blob).toContain("近 7 天 350k tokens");
  });
});
