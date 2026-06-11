import { describe, expect, it } from "vitest";
import {
  bayesianUpdate,
  betaBinomialPosterior,
  invLogit,
  logit,
  normalCredibleInterval,
} from "./bayesian.js";

describe("logit / invLogit", () => {
  it("invLogit is the inverse of logit (round-trip)", () => {
    expect(invLogit(logit(0.3))).toBeCloseTo(0.3, 12);
    expect(invLogit(logit(0.5))).toBeCloseTo(0.5, 12);
    expect(invLogit(logit(0.92))).toBeCloseTo(0.92, 12);
  });

  it("logit(0.5) = 0 and invLogit(0) = 0.5", () => {
    expect(logit(0.5)).toBeCloseTo(0, 12);
    expect(invLogit(0)).toBeCloseTo(0.5, 12);
  });

  it("logit of a 3:1 odds probability equals ln(3)", () => {
    // p = 0.75 -> odds 3 -> logit = ln(3)
    expect(logit(0.75)).toBeCloseTo(Math.log(3), 12);
  });

  it("clamps 0 and 1 to finite values", () => {
    expect(Number.isFinite(logit(0))).toBe(true);
    expect(Number.isFinite(logit(1))).toBe(true);
  });
});

describe("bayesianUpdate", () => {
  it("returns the prior unchanged with no evidence", () => {
    expect(bayesianUpdate(0.4, [])).toBeCloseTo(0.4, 12);
  });

  it("multiplies odds by the likelihood ratio in odds space", () => {
    // prior 0.5 (odds 1), one LLR of ln(3) -> odds 3 -> p = 0.75
    expect(bayesianUpdate(0.5, [Math.log(3)])).toBeCloseTo(0.75, 12);
  });

  it("accumulates multiple evidence pieces additively in log-odds", () => {
    // prior 0.5 (odds 1), ln(2) + ln(2) -> odds 4 -> p = 0.8
    expect(bayesianUpdate(0.5, [Math.log(2), Math.log(2)])).toBeCloseTo(0.8, 12);
  });

  it("negative LLR pushes the belief down", () => {
    // prior 0.75 (odds 3), LLR ln(1/3) -> odds 1 -> p = 0.5
    expect(bayesianUpdate(0.75, [Math.log(1 / 3)])).toBeCloseTo(0.5, 12);
  });
});

describe("betaBinomialPosterior", () => {
  it("updates shape parameters and computes mean from counts", () => {
    // Beta(1,1) + 8 successes, 2 failures -> Beta(9,3), mean 9/12 = 0.75
    const post = betaBinomialPosterior(1, 1, 8, 2);
    expect(post.alpha).toBe(9);
    expect(post.beta).toBe(3);
    expect(post.mean).toBeCloseTo(0.75, 12);
  });

  it("computes the variance from the closed form", () => {
    // Beta(9,3): var = (9*3) / (12^2 * 13) = 27 / 1872 = 0.0144230769...
    const post = betaBinomialPosterior(1, 1, 8, 2);
    expect(post.variance).toBeCloseTo(27 / 1872, 12);
  });

  it("Beta(1,1) with no data is the uniform prior (mean 0.5)", () => {
    const post = betaBinomialPosterior(1, 1, 0, 0);
    expect(post.mean).toBeCloseTo(0.5, 12);
  });
});

describe("normalCredibleInterval", () => {
  it("is symmetric around the mean with z=1.2816 for level 0.8", () => {
    const [lo, hi] = normalCredibleInterval(0.5, 0.1, 0.8);
    // 0.5 ± 1.2816 * 0.1 = [0.37184, 0.62816]
    expect(lo).toBeCloseTo(0.37184, 5);
    expect(hi).toBeCloseTo(0.62816, 5);
  });

  it("contains the mean and stays within [0, 1]", () => {
    const mean = 0.95;
    const [lo, hi] = normalCredibleInterval(mean, 0.2, 0.95);
    expect(lo).toBeLessThanOrEqual(mean);
    expect(hi).toBeGreaterThanOrEqual(mean);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
  });

  it("a zero-sd interval collapses to the mean", () => {
    const [lo, hi] = normalCredibleInterval(0.42, 0, 0.8);
    expect(lo).toBeCloseTo(0.42, 12);
    expect(hi).toBeCloseTo(0.42, 12);
  });
});
