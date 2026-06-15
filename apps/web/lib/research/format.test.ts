import { describe, expect, it } from "vitest";
import { formatDuration, pct, pp, signedPoints } from "./format.js";

describe("research/format", () => {
  describe("pct", () => {
    it("formats a 0-1 probability as a percentage with 1 decimal by default", () => {
      expect(pct(0.1)).toBe("10.0%");
      expect(pct(0.6667)).toBe("66.7%");
      expect(pct(1)).toBe("100.0%");
      expect(pct(0)).toBe("0.0%");
    });
    it("respects the digits argument", () => {
      expect(pct(0.1234, 0)).toBe("12%");
      expect(pct(0.1234, 2)).toBe("12.34%");
    });
    it("returns N/A for null / undefined / non-finite", () => {
      expect(pct(null)).toBe("N/A");
      expect(pct(undefined)).toBe("N/A");
      expect(pct(Number.NaN)).toBe("N/A");
      expect(pct(Number.POSITIVE_INFINITY)).toBe("N/A");
    });
  });

  describe("pp", () => {
    it("formats a signed percentage-point delta", () => {
      expect(pp(0.045)).toBe("+4.5pp");
      expect(pp(-0.032)).toBe("-3.2pp");
      expect(pp(-0.57)).toBe("-57.0pp");
    });
    it("does not prefix + for zero", () => {
      expect(pp(0)).toBe("0.0pp");
    });
    it("returns N/A for null / undefined / non-finite", () => {
      expect(pp(null)).toBe("N/A");
      expect(pp(undefined)).toBe("N/A");
      expect(pp(Number.NaN)).toBe("N/A");
    });
  });

  describe("signedPoints", () => {
    it("signs already-in-points weights", () => {
      expect(signedPoints(4)).toBe("+4.0pp");
      expect(signedPoints(-14)).toBe("-14.0pp");
      expect(signedPoints(0)).toBe("0.0pp");
    });
    it("respects digits", () => {
      expect(signedPoints(3.25, 2)).toBe("+3.25pp");
    });
  });

  describe("formatDuration", () => {
    it("renders sub-second as ms and >=1s as seconds", () => {
      expect(formatDuration(420)).toBe("420ms");
      expect(formatDuration(999)).toBe("999ms");
      expect(formatDuration(1000)).toBe("1.0s");
      expect(formatDuration(1500)).toBe("1.5s");
    });
    it("returns empty string for 0 / undefined / negative", () => {
      expect(formatDuration(0)).toBe("");
      expect(formatDuration(undefined)).toBe("");
      expect(formatDuration(-5)).toBe("");
    });
  });
});
