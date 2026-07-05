import { afterEach, describe, expect, it, vi } from "vitest";
import { filterRecipients, sendEmail } from "./email";
import { renderHtml, renderPlainText } from "./report-email";
import type { DeltaRun } from "../analyzer/schema";

const RUN: DeltaRun = {
  id: "delta_test0001",
  mode: "demo_read_only",
  engine: "rules",
  engineFallbackReason: null,
  generatedAtUtc: "2026-07-05T12:00:00.000Z",
  universeVersion: "2026-07-05",
  news: {
    headline: "Line one\r\nLine two smuggles headers",
    text: "Line one\r\nLine two smuggles headers",
    url: "https://example.com/original-story",
    publishedAtUtc: "2026-07-05T12:00:00.000Z"
  },
  analysis: {
    attention: {
      worthAttention: true,
      score: 70,
      verdict: "Worth a look.",
      newsType: "AI capex",
      credibilityNote: "Single source."
    },
    timing: {
      firstSeenUtc: "2026-07-05T11:30:00.000Z",
      basis: "caller timestamp"
    },
    marketReadout: "Capacity commitments reprice AI compute demand.",
    impactedStocks: [
      {
        ticker: "NVDA",
        company: "NVIDIA",
        inUniverse: true,
        direction: "bullish",
        magnitude: "medium",
        expectedMovePct: { min: 1.5, max: 4 },
        confidence: "medium",
        horizon: "1-5 trading days",
        reasoning: "Direct beneficiary of GPU demand.",
        evidence: [{ point: "Named in the agreement." }],
        action: "watch",
        actionRationale: "Confirm with a second source.",
        risks: ["Already priced in premarket."]
      }
    ],
    tradingPlan: "Watch NVDA into the open.",
    limitations: ["Deterministic rules demo."]
  },
  stages: [],
  delivery: []
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("filterRecipients", () => {
  it("passes valid recipients for full trust, dropping invalid and duplicates", () => {
    const { allowed, rejected } = filterRecipients(["A@x.com", "a@x.com", "not-an-email", " b@y.io "], { trust: "full" });
    expect(allowed).toEqual(["a@x.com", "b@y.io"]);
    expect(rejected).toEqual([]);
  });

  it("restricts public callers to the allowlist", () => {
    vi.stubEnv("DELTA_EMAIL_ALLOWLIST", "pm@raven.dev, desk@raven.dev");
    const { allowed, rejected } = filterRecipients(["pm@raven.dev", "attacker@evil.com"], { trust: "public" });
    expect(allowed).toEqual(["pm@raven.dev"]);
    expect(rejected).toEqual(["attacker@evil.com"]);
  });

  it("rejects everyone for public callers when no allowlist is configured", () => {
    vi.stubEnv("DELTA_EMAIL_ALLOWLIST", "");
    const { allowed } = filterRecipients(["pm@raven.dev"], { trust: "public" });
    expect(allowed).toEqual([]);
  });
});

describe("sendEmail", () => {
  it("returns a simulated receipt when no provider env is configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("DELTA_EMAIL_WEBHOOK_URL", "");
    const result = await sendEmail(RUN, ["pm@raven.dev"], { trust: "full" }, "en");
    expect(result.status).toBe("simulated");
  });

  it("returns skipped when nothing passes the gate", async () => {
    const result = await sendEmail(RUN, [], { trust: "full" }, "en");
    expect(result.status).toBe("skipped");
  });

  it("sends via Resend with a header-safe subject", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("DELTA_EMAIL_FROM", "delta@raven.dev");
    const calls: Array<{ url: string; body: string }> = [];
    vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      return new Response("{}", { status: 200 });
    });

    const result = await sendEmail(RUN, ["pm@raven.dev"], { trust: "full" }, "en");
    expect(result.status).toBe("sent");
    expect(result.provider).toBe("resend");
    const payload = JSON.parse(calls[0]!.body) as { subject: string };
    expect(payload.subject).not.toMatch(/[\r\n]/);
    expect(payload.subject).toContain("Line one Line two");
  });

  it("maps a Resend failure to a generic failed receipt", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("DELTA_EMAIL_FROM", "delta@raven.dev");
    vi.stubGlobal("fetch", async () => new Response("secret internal detail", { status: 422 }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await sendEmail(RUN, ["pm@raven.dev"], { trust: "full" }, "en");
    expect(result.status).toBe("failed");
    expect(result.detail).not.toContain("secret internal detail");
    expect(result.detail).toContain("422");
    errorSpy.mockRestore();
  });
});

describe("report rendering", () => {
  const SENT_AT = "2026-07-05T12:00:00.000Z"; // 30 min after firstSeen

  it("localizes scaffolding for zh runs", () => {
    const text = renderPlainText(RUN, "zh", SENT_AT);
    expect(text).toContain("要做的操作");
    expect(text).toContain("局限性");
  });

  it("always carries the three required items: original link, elapsed time, action", () => {
    const text = renderPlainText(RUN, "en", SENT_AT);
    expect(text).toContain("https://example.com/original-story"); // #1 original link
    expect(text).toContain("30 min had passed"); // #2 elapsed since first seen
    expect(text).toContain("WATCH NVDA"); // #3 the action to take
    const html = renderHtml(RUN, "en", SENT_AT);
    expect(html).toContain("https://example.com/original-story");
    expect(html).toContain("30 min");
    expect(html).toContain("WATCH");
  });

  it("stays honest when first-seen could not be verified", () => {
    const run = { ...RUN, analysis: { ...RUN.analysis, timing: { firstSeenUtc: null, basis: "cannot verify" } } };
    const text = renderPlainText(run, "en", SENT_AT);
    expect(text).toContain("could not be verified");
  });

  it("flags stale news (>24h) in the HTML banner", () => {
    const run = { ...RUN, analysis: { ...RUN.analysis, timing: { firstSeenUtc: "2026-07-03T12:00:00.000Z", basis: "caller timestamp" } } };
    const html = renderHtml(run, "en", SENT_AT);
    expect(html).toContain("likely priced in");
  });
});
