import { describe, expect, it } from "vitest";
import { enQuestion, enTimelineLabel } from "./labels";
import { localizeSnapshot } from "./localize";
import { PAPER_SNAPSHOT } from "./snapshot";

describe("localizeSnapshot", () => {
  it("is the identity in zh mode (the Chinese page must not change)", () => {
    expect(localizeSnapshot(PAPER_SNAPSHOT, "zh")).toBe(PAPER_SNAPSHOT);
  });

  it("maps market titles back to the raw English the VM sends", () => {
    const en = localizeSnapshot(PAPER_SNAPSHOT, "en");
    expect(en.openPositions[0]?.question).toBe("Putin out as President of Russia by December 31, 2026?");
    expect(en.brier.rows.map((r) => r.question)).toContain("China x Philippines military clash before 2027?");
  });

  it("carries the round-trip suffixes on hand-labeled repeat entries", () => {
    const en = localizeSnapshot(PAPER_SNAPSHOT, "en");
    const mou = en.closedTrades.filter((t) => t.slug.includes("withdrawal-from-mou"));
    expect(mou[0]?.question).toBe("Will Iran announce withdrawal from MOU negotiations by July 17? (1st entry)");
    expect(mou[1]?.question).toBe("Will Iran announce withdrawal from MOU negotiations by July 17? (2nd entry)");
  });

  it("translates exit styles, reasons, trade notes, and the synthetic curve dates", () => {
    const en = localizeSnapshot(PAPER_SNAPSHOT, "en");
    expect(en.exitAlpha.rows[0]?.exitStyle).toBe("market + limit legs");
    expect(en.exitAlpha.rows[0]?.reason).toBe("negative-edge exit");
    expect(en.equityCurve[0]?.date).toBe("start");
    expect(en.equityCurve[en.equityCurve.length - 1]?.date).toBe("now");
    const meeting = en.closedTrades.find(
      (t) => t.slug === "us-x-iran-diplomatic-meeting-by-july-31-2026-20260622191708361"
    );
    expect(meeting?.note).toContain("settled NO");
    expect(meeting?.note).toContain("α +$594");
  });

  it("leaves numbers and unknown strings untouched", () => {
    const en = localizeSnapshot(PAPER_SNAPSHOT, "en");
    expect(en.equityUsd).toBe(PAPER_SNAPSHOT.equityUsd);
    expect(en.closedTrades[0]?.pnlUsd).toBe(PAPER_SNAPSHOT.closedTrades[0]?.pnlUsd);
    expect(enQuestion("Some brand new market?")).toBe("Some brand new market?");
    expect(enQuestion("some-unknown-slug")).toBe("some-unknown-slug");
  });
});

describe("horizon bucket labels", () => {
  it("translates the VM's Chinese bucket labels in en mode", () => {
    const withHorizon = {
      ...PAPER_SNAPSHOT,
      brier: {
        ...PAPER_SNAPSHOT.brier,
        horizon: {
          atEntry: null,
          atLast: null,
          weighted: null,
          buckets: [
            {
              label: "≤1 天",
              minDays: 0,
              maxDays: 1,
              n: 3,
              brierAgent: 0.1,
              brierMarket: 0.1,
              skill: 0,
              medianHorizonDays: 1
            },
            {
              label: "7–30 天",
              minDays: 7,
              maxDays: 30,
              n: 5,
              brierAgent: 0.1,
              brierMarket: 0.1,
              skill: 0.2,
              medianHorizonDays: 12
            },
            {
              label: "30 天以上",
              minDays: 30,
              maxDays: null,
              n: 2,
              brierAgent: 0.1,
              brierMarket: 0.1,
              skill: 0.1,
              medianHorizonDays: 45
            }
          ]
        }
      }
    };
    const en = localizeSnapshot(withHorizon, "en");
    expect(en.brier.horizon?.buckets.map((b) => b.label)).toEqual(["≤1d", "7–30d", ">30d"]);
    expect(localizeSnapshot(withHorizon, "zh").brier.horizon?.buckets.map((b) => b.label)).toEqual([
      "≤1 天",
      "7–30 天",
      "30 天以上"
    ]);
  });
});

describe("enTimelineLabel", () => {
  it("translates the VM's known decision-log labels", () => {
    expect(enTimelineLabel("市价买入 1785.7 股 @ 0.280")).toBe("market buy 1785.7 sh @ 0.280");
    expect(enTimelineLabel("市价卖出 2045.5 股 @ 0.113")).toBe("market sell 2045.5 sh @ 0.113");
    expect(enTimelineLabel("复审：继续持有")).toBe("review: hold");
    expect(enTimelineLabel("触发止损")).toBe("stop-loss triggered");
    expect(enTimelineLabel("市场结算：我方获胜")).toBe("settled: our side won");
  });

  it("passes unknown labels through", () => {
    expect(enTimelineLabel("some future label")).toBe("some future label");
  });
});
