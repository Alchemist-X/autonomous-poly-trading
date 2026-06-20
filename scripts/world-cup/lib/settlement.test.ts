import { describe, expect, it } from "vitest";
import { fetchResult } from "./settlement.ts";

// Build a resolved 1x2 moneyline leg. `yes` marks the winning leg (outcomePrices
// [Yes, No] settled to 1/0). Polymarket lists legs in an arbitrary order — the
// regression these tests guard is that the winner maps to home(a)/away(b) by
// NAME, never by leg position.
function leg(title: string, yes: boolean) {
  return {
    groupItemTitle: title,
    outcomes: '["Yes", "No"]',
    outcomePrices: yes ? '["1", "0"]' : '["0", "1"]',
    umaResolutionStatus: "resolved",
    closed: true
  };
}

// A fetch stub that answers Gamma `events?slug=...` from a fixture map.
function stubFetch(events: Record<string, unknown[]>): typeof fetch {
  return (async (url: string | URL) => {
    const slug = decodeURIComponent(new URL(String(url)).searchParams.get("slug") ?? "");
    return { ok: true, json: async () => events[slug] ?? [] } as Response;
  }) as unknown as typeof fetch;
}

describe("resultFromMoneyline (via fetchResult): map winner by name, not position", () => {
  it("home wins even when the away leg is listed first (the eng-hrv bug)", async () => {
    const f = stubFetch({
      "fifwc-eng-hrv-2026-06-17-exact-score": [],
      "fifwc-eng-hrv-2026-06-17": [
        { markets: [leg("Croatia", false), leg("England", true), leg("Draw (England vs. Croatia)", false)] }
      ]
    });
    const r = await fetchResult("fifwc-eng-hrv-2026-06-17", f);
    expect(r.winner).toBe("a"); // England = home = team a
    expect(r.source).toBe("moneyline");
    expect(r.score).toBeNull();
  });

  it("is order-independent: home wins when its leg is listed first", async () => {
    const f = stubFetch({
      "fifwc-eng-hrv-2026-06-17-exact-score": [],
      "fifwc-eng-hrv-2026-06-17": [
        { markets: [leg("England", true), leg("Croatia", false), leg("Draw (England vs. Croatia)", false)] }
      ]
    });
    expect((await fetchResult("fifwc-eng-hrv-2026-06-17", f)).winner).toBe("a");
  });

  it("away wins, with an 'and' vs '-' spelling mismatch on the team name", async () => {
    const f = stubFetch({
      "fifwc-che-bih-2026-06-18-exact-score": [],
      "fifwc-che-bih-2026-06-18": [
        {
          markets: [
            leg("Switzerland", false),
            leg("Bosnia-Herzegovina", true),
            leg("Draw (Switzerland vs. Bosnia and Herzegovina)", false)
          ]
        }
      ]
    });
    expect((await fetchResult("fifwc-che-bih-2026-06-18", f)).winner).toBe("b"); // Bosnia = away = team b
  });

  it("draw leg winning resolves to draw", async () => {
    const f = stubFetch({
      "fifwc-eng-hrv-2026-06-17-exact-score": [],
      "fifwc-eng-hrv-2026-06-17": [
        { markets: [leg("England", false), leg("Croatia", false), leg("Draw (England vs. Croatia)", true)] }
      ]
    });
    expect((await fetchResult("fifwc-eng-hrv-2026-06-17", f)).winner).toBe("draw");
  });
});

describe("resultFromExactScore (via fetchResult): home-first score string", () => {
  it("reads winner + score from the resolved exact-score bucket", async () => {
    const f = stubFetch({
      "fifwc-eng-hrv-2026-06-17-exact-score": [
        {
          markets: [
            { groupItemTitle: "England 1 - 0 Croatia", outcomePrices: '["0", "1"]', umaResolutionStatus: "resolved", closed: true },
            { groupItemTitle: "England 2 - 1 Croatia", outcomePrices: '["1", "0"]', umaResolutionStatus: "resolved", closed: true }
          ]
        }
      ]
    });
    const r = await fetchResult("fifwc-eng-hrv-2026-06-17", f);
    expect(r.winner).toBe("a");
    expect(r.score).toBe("2-1");
    expect(r.source).toBe("exact_score");
  });
});
