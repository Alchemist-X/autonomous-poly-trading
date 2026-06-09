import { describe, expect, it } from "vitest";
import type { MatchResult, OneXTwo } from "./types.js";
import {
  brierBinary,
  brierMulticlass,
  expectedCalibrationError,
  logLoss,
} from "./calibration.js";

describe("brierBinary", () => {
  it("is 0 for perfect, fully-confident forecasts", () => {
    expect(brierBinary([1, 0, 1], [1, 0, 1])).toBeCloseTo(0, 12);
  });

  it("is 0.25 for a 0.5 forecast regardless of outcome", () => {
    // ((0.5-1)^2 + (0.5-0)^2) / 2 = (0.25 + 0.25)/2 = 0.25
    expect(brierBinary([0.5, 0.5], [1, 0])).toBeCloseTo(0.25, 12);
  });

  it("is 1 for a fully-confident wrong forecast", () => {
    expect(brierBinary([1], [0])).toBeCloseTo(1, 12);
  });
});

describe("brierMulticlass", () => {
  it("is 0 when the actual class is predicted with probability 1", () => {
    const forecasts: OneXTwo[] = [
      { home: 1, draw: 0, away: 0 },
      { home: 0, draw: 0, away: 1 },
    ];
    const results: MatchResult[] = ["home", "away"];
    expect(brierMulticlass(forecasts, results)).toBeCloseTo(0, 12);
  });

  it("matches the hand-computed value for a uniform forecast", () => {
    // p = (1/3,1/3,1/3), actual home:
    // (1/3-1)^2 + (1/3)^2 + (1/3)^2 = 4/9 + 1/9 + 1/9 = 6/9 = 0.6667
    const forecasts: OneXTwo[] = [{ home: 1 / 3, draw: 1 / 3, away: 1 / 3 }];
    const results: MatchResult[] = ["home"];
    expect(brierMulticlass(forecasts, results)).toBeCloseTo(2 / 3, 12);
  });

  it("reaches its max of 2 for a confident wrong forecast", () => {
    // predict home=1, actual away: (1-0)^2 + 0 + (0-1)^2 = 2
    const forecasts: OneXTwo[] = [{ home: 1, draw: 0, away: 0 }];
    const results: MatchResult[] = ["away"];
    expect(brierMulticlass(forecasts, results)).toBeCloseTo(2, 12);
  });
});

describe("logLoss", () => {
  it("is ~0 for perfect forecasts", () => {
    expect(logLoss([1, 0], [1, 0])).toBeCloseTo(0, 10);
  });

  it("matches -ln(p) for a single forecast", () => {
    // single sample, o=1, p=0.5 -> -ln(0.5) = ln(2)
    expect(logLoss([0.5], [1])).toBeCloseTo(Math.log(2), 12);
  });

  it("is large but finite for a confident wrong forecast", () => {
    const loss = logLoss([1], [0]);
    expect(Number.isFinite(loss)).toBe(true);
    expect(loss).toBeGreaterThan(10);
  });
});

describe("expectedCalibrationError", () => {
  it("is ~0 for perfectly-calibrated extreme forecasts", () => {
    // p=1 always realised, p=0 never realised -> conf == acc per bin -> ECE 0
    const forecasts = [1, 1, 0, 0];
    const outcomes: (0 | 1)[] = [1, 1, 0, 0];
    expect(expectedCalibrationError(forecasts, outcomes)).toBeCloseTo(0, 12);
  });

  it("is 0 when each bucket's frequency matches its confidence", () => {
    // bucket [0.5,0.6): four 0.5 forecasts, two realised -> acc 0.5 = conf 0.5
    const forecasts = [0.5, 0.5, 0.5, 0.5];
    const outcomes: (0 | 1)[] = [1, 0, 1, 0];
    expect(expectedCalibrationError(forecasts, outcomes, 10)).toBeCloseTo(0, 12);
  });

  it("matches the hand-computed gap for a miscalibrated bucket", () => {
    // all forecasts 0.9 (bucket conf 0.9) but only half realised (acc 0.5)
    // single non-empty bucket holding all N -> ECE = |0.5 - 0.9| = 0.4
    const forecasts = [0.9, 0.9, 0.9, 0.9];
    const outcomes: (0 | 1)[] = [1, 1, 0, 0];
    expect(expectedCalibrationError(forecasts, outcomes, 10)).toBeCloseTo(0.4, 12);
  });
});
