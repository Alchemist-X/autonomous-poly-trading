import { describe, expect, it } from "vitest";
import { callFromProbability, callLabel } from "./call.js";

describe("research/call", () => {
  describe("callFromProbability", () => {
    it("maps the Yes probability to one of five directional bands", () => {
      expect(callFromProbability(0.7).labelKey).toBe("callStrongYes");
      expect(callFromProbability(0.6).labelKey).toBe("callLeanYes");
      expect(callFromProbability(0.5).labelKey).toBe("callTossup");
      expect(callFromProbability(0.4).labelKey).toBe("callLeanNo");
      expect(callFromProbability(0.1).labelKey).toBe("callStrongNo");
    });

    it("is symmetric at the band boundaries", () => {
      // >= 0.65 strong yes, >= 0.55 lean yes
      expect(callFromProbability(0.65).labelKey).toBe("callStrongYes");
      expect(callFromProbability(0.55).labelKey).toBe("callLeanYes");
      // (0.45, 0.55) toss-up; the lower bound itself is already lean-no
      expect(callFromProbability(0.451).labelKey).toBe("callTossup");
      expect(callFromProbability(0.45).labelKey).toBe("callLeanNo");
      // <= 0.35 is strong no
      expect(callFromProbability(0.35).labelKey).toBe("callStrongNo");
    });

    it("assigns a directional color per band (green yes / red no / amber toss-up)", () => {
      expect(callFromProbability(0.8).direction).toBe("yes");
      expect(callFromProbability(0.8).color).toBe("#15803d");
      expect(callFromProbability(0.5).direction).toBe("tossup");
      expect(callFromProbability(0.5).color).toBe("#b45309");
      expect(callFromProbability(0.1).direction).toBe("no");
      expect(callFromProbability(0.1).color).toBe("#c0392b");
    });

    it("carries a tinted background, border, and shadow for each call", () => {
      const call = callFromProbability(0.1);
      expect(call.soft).toBe("#fdecea");
      expect(call.border).toBe("#f3c9c4");
      expect(call.shadow).toContain("rgba(192");
    });
  });

  describe("callLabel", () => {
    it("localizes the call label in both console locales", () => {
      const strongNo = callFromProbability(0.1);
      expect(callLabel("en", strongNo)).toBe("Likely No");
      expect(callLabel("zh", strongNo)).toBe("大概率不会");

      const strongYes = callFromProbability(0.9);
      expect(callLabel("en", strongYes)).toBe("Likely Yes");
      expect(callLabel("zh", strongYes)).toBe("大概率会");
    });
  });
});
