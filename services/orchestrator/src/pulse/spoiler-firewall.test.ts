import { describe, expect, it } from "vitest";
import {
  filterSpoilerSources,
  isSpoilerSource,
  normalizeHost,
  queryMentionsSpoiler,
  stripSpoilerQueries
} from "./spoiler-firewall.js";

describe("spoiler firewall — independent-forecasting guard", () => {
  it("normalizes hosts (scheme, path, leading www)", () => {
    expect(normalizeHost("https://www.Polymarket.com/event/x")).toBe("polymarket.com");
    expect(normalizeHost("CLOB.polymarket.com/book")).toBe("clob.polymarket.com");
    expect(normalizeHost("reuters.com")).toBe("reuters.com");
    expect(normalizeHost("  ")).toBe("");
  });

  it("blocks prediction markets, sportsbooks, and odds aggregators (incl. subdomains)", () => {
    expect(isSpoilerSource("https://polymarket.com/event/us-iran-nuclear-deal")).toBe(true);
    expect(isSpoilerSource("clob.polymarket.com")).toBe(true);
    expect(isSpoilerSource("https://www.oddschecker.com/politics")).toBe(true);
    expect(isSpoilerSource("kalshi.com")).toBe(true);
    expect(isSpoilerSource("metaculus.com")).toBe(true);
  });

  it("allows legitimate news / official / research sources", () => {
    expect(isSpoilerSource("https://www.reuters.com/world/iran")).toBe(false);
    expect(isSpoilerSource("state.gov")).toBe(false);
    expect(isSpoilerSource("")).toBe(false);
  });

  it("filters spoiler sources out of an evidence list", () => {
    const records = [
      { recordId: "a", sourceUrl: "https://reuters.com/x", sourceHost: "reuters.com" },
      { recordId: "b", sourceUrl: "https://polymarket.com/event/x", sourceHost: "polymarket.com" }
    ];
    expect(filterSpoilerSources(records).map((r) => r.recordId)).toEqual(["a"]);
  });

  it("flags and strips queries that name a market / odds source", () => {
    expect(queryMentionsSpoiler("US Iran nuclear deal polymarket odds")).toBe(true);
    expect(queryMentionsSpoiler("Iran nuclear talks Reuters June")).toBe(false);
    expect(stripSpoilerQueries(["kalshi US Iran deal", "Iran foreign ministry statement"])).toEqual([
      "Iran foreign ministry statement"
    ]);
  });
});
