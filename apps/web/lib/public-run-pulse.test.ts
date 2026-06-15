import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractDecisionEventSlug,
  extractDecisionSide,
  extractDecisionSources,
  extractPulseExcerpt,
  isExecutedTrade,
  toDisplayPath
} from "./public-run-pulse.js";

// Cast helper: these transforms accept the loose artifact-decision shape.
const dec = (obj: unknown) => obj as never;

describe("public-run-pulse transforms", () => {
  describe("toDisplayPath (must not leak absolute server paths)", () => {
    it("slices from the runtime-artifacts/ marker", () => {
      expect(toDisplayPath("/Users/someone/repo/runtime-artifacts/pulse/x.json")).toBe("runtime-artifacts/pulse/x.json");
    });
    it("makes a cwd-absolute path repo-relative", () => {
      const abs = path.join(process.cwd(), "some/where.json");
      expect(toDisplayPath(abs)).toBe("some/where.json");
    });
    it("passes a relative path through and maps null to null", () => {
      expect(toDisplayPath("docs/notes.md")).toBe("docs/notes.md");
      expect(toDisplayPath(null)).toBeNull();
      expect(toDisplayPath(undefined)).toBeNull();
    });
  });

  describe("extractPulseExcerpt (bounds exposed content)", () => {
    it("drops blank lines and caps at maxLines", () => {
      expect(extractPulseExcerpt("a\n\n b \n\nc", 2)).toBe("a\n b ");
    });
    it("trims surrounding whitespace and keeps order", () => {
      expect(extractPulseExcerpt("\n\nfirst\nsecond\n\n", 14)).toBe("first\nsecond");
    });
    it("returns empty string for blank content", () => {
      expect(extractPulseExcerpt("   \n  \n")).toBe("");
    });
  });

  describe("isExecutedTrade", () => {
    it("is true when notional filled > 0 regardless of status", () => {
      expect(isExecutedTrade("pending", 5)).toBe(true);
    });
    it("is true for filled/matched statuses (case-insensitive) even at 0 notional", () => {
      expect(isExecutedTrade("filled", 0)).toBe(true);
      expect(isExecutedTrade("MATCHED", 0)).toBe(true);
    });
    it("is false for a non-terminal status with 0 notional", () => {
      expect(isExecutedTrade("pending", 0)).toBe(false);
    });
  });

  describe("extractDecisionSide", () => {
    it("only SELL maps to SELL; everything else defaults to BUY", () => {
      expect(extractDecisionSide(dec({ side: "SELL" }))).toBe("SELL");
      expect(extractDecisionSide(dec({ side: "BUY" }))).toBe("BUY");
      expect(extractDecisionSide(dec({}))).toBe("BUY");
      expect(extractDecisionSide(null)).toBe("BUY");
    });
  });

  describe("extractDecisionEventSlug", () => {
    it("prefers eventSlug, then event_slug, then falls back to the market slug", () => {
      expect(extractDecisionEventSlug(dec({ eventSlug: "e", marketSlug: "m" }))).toBe("e");
      expect(extractDecisionEventSlug(dec({ event_slug: "e2", marketSlug: "m" }))).toBe("e2");
      expect(extractDecisionEventSlug(dec({ marketSlug: "m" }))).toBe("m");
      expect(extractDecisionEventSlug(dec({}))).toBe("");
    });
  });

  describe("extractDecisionSources (sanitizes outbound sources)", () => {
    it("drops sources without a url and defaults a missing title", () => {
      const out = extractDecisionSources(
        dec({
          sources: [
            { title: "Reuters", url: "https://r.com", retrieved_at_utc: "2026-01-01", note: "n" },
            { url: "https://nourl-title.com" },
            { title: "no url here" }
          ]
        })
      );
      expect(out).toHaveLength(2);
      expect(out[0]).toEqual({ title: "Reuters", url: "https://r.com", retrieved_at_utc: "2026-01-01", note: "n" });
      expect(out[1]).toEqual({ title: "Untitled source", url: "https://nourl-title.com", retrieved_at_utc: null, note: null });
    });
    it("returns [] when sources is missing or not an array", () => {
      expect(extractDecisionSources(dec({}))).toEqual([]);
      expect(extractDecisionSources(dec({ sources: "nope" }))).toEqual([]);
      expect(extractDecisionSources(null)).toEqual([]);
    });
  });
});
