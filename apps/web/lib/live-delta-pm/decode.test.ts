import { describe, expect, it } from "vitest";
import { parseAuditPayload } from "./decode";
import fixture from "./fixture.json";

describe("live-delta-pm lenient decoder", () => {
  const payload = parseAuditPayload(fixture);

  it("decodes the baked fixture (real run data)", () => {
    expect(payload).not.toBeNull();
    expect(payload!.cases).toHaveLength(30);
    expect(payload!.generatedAtUtc).toBe("2026-08-23T08:57:06.731Z");
    expect(payload!.bookStartedUtc).toBe("2026-08-21T18:53:20.930Z");
  });

  it("sorts cases newest-first by seenAtUtc", () => {
    const times = payload!.cases.map((c) => Date.parse(c.news.seenAtUtc));
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
    }
  });

  it("decodes the full audit arithmetic of the SNDK open decision", () => {
    const sndk = payload!.cases.find((c) => c.decision?.action === "open");
    expect(sndk).toBeDefined();
    const d = sndk!.decision!;
    expect(d.ticker).toBe("SNDK");
    expect(d.audit).not.toBeNull();
    expect(d.audit!.vetoedBy).toBeNull();
    expect(d.audit!.edge).toEqual({ conservativePct: 6, pointPct: 13, realizedPct: 0.1, residualPct: 5.9 });
    expect(d.audit!.threshold!.thresholdPct).toBeCloseTo(5.642843237781729, 10);
    expect(d.audit!.threshold!.costFloorPct).toBeCloseTo(0.579, 10);
    expect(d.audit!.stopMenu!.chosenPx).toBe(1585);
    expect(d.audit!.stopMenu!.hardFloorPx).toBe(1274.96);
    const sizing = d.audit!.sizing!;
    expect(sizing.equityUsd).toBe(10000);
    expect(sizing.intendedNotionalUsd).toBe(18318);
    expect(sizing.finalNotionalUsd).toBe(3000);
    expect(sizing.guards).toHaveLength(6);
    const tier1 = sizing.guards.find((g) => g.name === "tier1_cap");
    expect(tier1).toEqual({ name: "tier1_cap", capUsd: 3000, notionalAfterUsd: 3000, clipped: true });
    expect(sizing.leverage!.chosen).toBeCloseTo(1.4657, 6);
    expect(d.bindingConstraint).toBe("tier1_cap");
    // Downstream book state came through too.
    expect(sndk!.execution!.fillPx).toBeCloseTo(1603.4013, 4);
    expect(sndk!.positionNow!.stopPx).toBe(1580.4);
    expect(sndk!.positionNow!.markPx).toBeNull(); // absent in feed — page shows "—"
  });

  it("keeps older decisions without an audit block (audit stays null)", () => {
    const nvda = payload!.cases.find(
      (c) => c.decision !== null && c.decision.action === "no_trade" && c.thesis?.provider === "rules"
    );
    expect(nvda).toBeDefined();
    expect(nvda!.decision!.audit).toBeNull();
    expect(nvda!.decision!.reason).toContain("residual edge");
  });

  it("keeps cases whose chain stopped early (null signal / null thesis)", () => {
    const noSignal = payload!.cases.filter((c) => c.signal === null);
    expect(noSignal.length).toBeGreaterThan(0);
    const gatedOut = payload!.cases.find((c) => c.signal?.materiality?.tradeable === false);
    expect(gatedOut).toBeDefined();
    expect(gatedOut!.thesis).toBeNull();
  });

  it("decodes portfolio and reflection blocks", () => {
    expect(payload!.portfolio!.initialCapitalUsd).toBe(10000);
    expect(payload!.portfolio!.halted).toBe(false);
    expect(payload!.portfolio!.positions).toHaveLength(1);
    const r = payload!.latestReflection!;
    expect(r.funnel!.newsSeen).toBe(30);
    expect(r.funnel!.archivedNoTicker).toBe(21);
    expect(r.contamination!.rate).toBe(0.5);
    expect(r.engines).toEqual([
      { name: "rules", count: 19 },
      { name: "claude-cli", count: 12 }
    ]);
    expect(r.noTradeReasons).toHaveLength(1);
    expect(r.book!.equityUsd).toBeCloseTo(9992.887681954606, 6);
    expect(r.m1Calibration!.forwarded!.hitRate).toBeNull();
  });

  it("rejects only payloads without a cases array", () => {
    expect(parseAuditPayload(null)).toBeNull();
    expect(parseAuditPayload("nonsense")).toBeNull();
    expect(parseAuditPayload({})).toBeNull();
    expect(parseAuditPayload({ cases: "nope" })).toBeNull();
    expect(parseAuditPayload({ cases: [] })).not.toBeNull();
  });

  it("is lenient on minimal and malformed cases", () => {
    const decoded = parseAuditPayload({
      cases: [
        { news: { title: "bare headline" } }, // everything else missing
        { news: {} }, // no title — dropped, unrenderable
        "garbage", // not an object — dropped
        {
          news: { title: "drifted enums", kind: "podcast", prefix: "rumor", seenAtUtc: "2026-08-22T00:00:00Z" },
          signal: { materiality: { score: "84", tradeable: "yes" } }, // wrong scalar types → null
          decision: { action: "hedge", audit: { vetoedBy: "halted" } }
        }
      ]
    });
    expect(decoded).not.toBeNull();
    expect(decoded!.cases).toHaveLength(2);
    const bare = decoded!.cases.find((c) => c.news.title === "bare headline")!;
    expect(bare.signal).toBeNull();
    expect(bare.thesis).toBeNull();
    expect(bare.postEvents).toEqual([]);
    const drifted = decoded!.cases.find((c) => c.news.title === "drifted enums")!;
    // Unknown enums survive verbatim; wrong scalar types decode to null.
    expect(drifted.news.kind).toBe("podcast");
    expect(drifted.signal!.materiality!.score).toBeNull();
    expect(drifted.signal!.materiality!.tradeable).toBeNull();
    expect(drifted.decision!.action).toBe("hedge");
    expect(drifted.decision!.audit!.vetoedBy).toBe("halted");
    expect(drifted.decision!.audit!.edge).toBeNull();
  });

  it("collects unknown post-event fields as verbatim extras", () => {
    const decoded = parseAuditPayload({
      cases: [
        {
          news: { title: "with events", seenAtUtc: "2026-08-22T00:00:00Z" },
          postEvents: [
            { ts: "2026-08-22T01:00:00Z", type: "stop_loss", pnlUsd: -42.5, fillPx: 99.1, note: "gap down" },
            null
          ]
        }
      ]
    });
    const events = decoded!.cases[0]!.postEvents;
    expect(events).toHaveLength(1);
    expect(events[0]!.pnlUsd).toBe(-42.5);
    expect(events[0]!.extras).toEqual([
      { key: "fillPx", value: "99.1" },
      { key: "note", value: "gap down" }
    ]);
  });
});
