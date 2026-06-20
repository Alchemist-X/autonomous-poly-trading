import { describe, expect, it } from "vitest";
import {
  applyLlrs,
  clamp,
  credibleInterval,
  effectiveLlr,
  invLogit,
  logit,
} from "./bayes";
import { canonicalizeUrl } from "./url";
import { extractJsonObject, validateRoundOutput } from "./claude-agent";
import { validateFraming } from "./framing";

describe("bayes log-odds", () => {
  it("logit/invLogit round-trip", () => {
    for (const p of [0.1, 0.37, 0.5, 0.82]) {
      expect(invLogit(logit(p))).toBeCloseTo(p, 6);
    }
  });

  it("positive LLR raises, negative lowers", () => {
    expect(applyLlrs(0.5, [1.0]).post).toBeGreaterThan(0.5);
    expect(applyLlrs(0.5, [-1.0]).post).toBeLessThan(0.5);
    expect(applyLlrs(0.5, []).post).toBeCloseTo(0.5, 6);
  });

  it("steps are continuous: each step's after equals the next step's before", () => {
    const { steps } = applyLlrs(0.4, [0.5, -0.3, 0.8]);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].probBefore).toBeCloseTo(steps[i - 1].probAfter, 9);
    }
  });

  it("final posterior is order-independent (additive in log-odds)", () => {
    const a = applyLlrs(0.5, [0.4, -0.9, 1.2]).post;
    const b = applyLlrs(0.5, [1.2, 0.4, -0.9]).post;
    expect(a).toBeCloseTo(b, 9);
  });

  it("probability stays within floor/ceil under extreme evidence", () => {
    const { post } = applyLlrs(0.5, [2, 2, 2, 2, 2, 2]);
    expect(post).toBeLessThanOrEqual(0.99);
    expect(post).toBeGreaterThan(0.9);
  });

  it("effectiveLlr takes sign from stance and clamps magnitude", () => {
    expect(effectiveLlr("supports_yes", 0.5)).toBeCloseTo(0.5, 9);
    expect(effectiveLlr("supports_no", 0.5)).toBeCloseTo(-0.5, 9);
    expect(effectiveLlr("neutral", 5)).toBe(0);
    // magnitude clamp at MAX_ABS_LLR=2 regardless of agent-supplied sign
    expect(effectiveLlr("supports_yes", -9)).toBeCloseTo(2, 9);
    expect(effectiveLlr("supports_no", 9)).toBeCloseTo(-2, 9);
  });

  it("credible interval narrows with more sources", () => {
    const few = credibleInterval(0.5, 1, "medium");
    const many = credibleInterval(0.5, 25, "medium");
    expect(many[1] - many[0]).toBeLessThan(few[1] - few[0]);
  });

  it("clamp bounds", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
  });
});

describe("url canonicalization (dedupe key)", () => {
  it("treats www/scheme/trailing-slash/query/fragment variants as the same source", () => {
    const a = canonicalizeUrl("https://www.macrumors.com/guide/foldable-iphone/");
    const b = canonicalizeUrl("http://macrumors.com/guide/foldable-iphone?utm=x#frag");
    const c = canonicalizeUrl("macrumors.com/guide/foldable-iphone");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("different paths are distinct", () => {
    expect(canonicalizeUrl("https://x.com/a")).not.toBe(canonicalizeUrl("https://x.com/b"));
  });

  it("empty input is empty", () => {
    expect(canonicalizeUrl("")).toBe("");
  });
});

describe("extractJsonObject", () => {
  it("parses a bare object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses a fenced object", () => {
    expect(extractJsonObject('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it("parses an object embedded in prose", () => {
    expect(extractJsonObject('Here it is: {"a":{"b":3}} done')).toEqual({ a: { b: 3 } });
  });
  it("handles braces inside strings", () => {
    expect(extractJsonObject('{"a":"}{"}')).toEqual({ a: "}{" });
  });
  it("returns null when no object present", () => {
    expect(extractJsonObject("no json here")).toBeNull();
  });
});

describe("validateRoundOutput (fail-closed)", () => {
  const good = {
    round_summary: "ok",
    new_evidence: [
      {
        claim: "x",
        source_url: "https://a.com",
        source_title: "A",
        stance: "supports_yes",
        strength: "moderate",
        llr: 0.5,
        rationale: "r",
      },
    ],
    agent_holistic_probability: 0.5,
    confidence: "medium",
    found_new_information: true,
    notes: "",
  };

  it("accepts a well-formed output", () => {
    expect(() => validateRoundOutput(good)).not.toThrow();
  });
  it("rejects invalid stance", () => {
    expect(() => validateRoundOutput({ ...good, new_evidence: [{ ...good.new_evidence[0], stance: "bull" }] })).toThrow();
  });
  it("rejects out-of-range probability", () => {
    expect(() => validateRoundOutput({ ...good, agent_holistic_probability: 1.7 })).toThrow();
  });
  it("rejects non-finite llr", () => {
    expect(() => validateRoundOutput({ ...good, new_evidence: [{ ...good.new_evidence[0], llr: "high" }] })).toThrow();
  });
  it("rejects missing source_url", () => {
    const e = { ...good.new_evidence[0] } as Record<string, unknown>;
    delete e.source_url;
    expect(() => validateRoundOutput({ ...good, new_evidence: [e] })).toThrow();
  });
  it("accepts an empty-evidence no-new-info round", () => {
    expect(() => validateRoundOutput({ ...good, new_evidence: [], found_new_information: false })).not.toThrow();
  });
});

describe("validateFraming (Round 0)", () => {
  const good = {
    normalized_question: "Will X ship before 2027-01-01?",
    resolution_criteria: "YES iff X ships to consumers before 2027-01-01.",
    resolution_date: "2026-12-31",
    settlement_source: "Official vendor announcement.",
    assumptions: "Calendar year, UTC.",
    forecastable: true,
    clarification_needed: "",
  };

  it("accepts a well-formed frame", () => {
    const f = validateFraming(good);
    expect(f.normalizedQuestion).toContain("Will X");
    expect(f.resolutionDate).toBe("2026-12-31");
    expect(f.forecastable).toBe(true);
  });
  it("coerces a null/empty/'null' resolution_date to null", () => {
    expect(validateFraming({ ...good, resolution_date: "null" }).resolutionDate).toBeNull();
    expect(validateFraming({ ...good, resolution_date: "" }).resolutionDate).toBeNull();
    expect(validateFraming({ ...good, resolution_date: null }).resolutionDate).toBeNull();
  });
  it("preserves a not-forecastable verdict with clarification", () => {
    const f = validateFraming({ ...good, forecastable: false, clarification_needed: "need a date" });
    expect(f.forecastable).toBe(false);
    expect(f.clarificationNeeded).toBe("need a date");
  });
  it("rejects missing normalized_question or non-boolean forecastable", () => {
    expect(() => validateFraming({ ...good, normalized_question: "" })).toThrow();
    expect(() => validateFraming({ ...good, forecastable: "yes" })).toThrow();
  });
});
