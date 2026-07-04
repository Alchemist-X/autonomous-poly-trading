import { describe, expect, it } from "vitest";
import {
  applyLlrs,
  bandStable,
  capRoundLlrs,
  clamp,
  clampReflection,
  clampUnverified,
  clusterFactors,
  clusterFactorsWithHistory,
  confirmationRatio,
  credibilityFactor,
  credibleInterval,
  effectiveLlr,
  independentClusterCount,
  invLogit,
  logit,
  ROUND_MAX_ABS_LLR_SUM,
  shrinkTowardAnchor,
} from "./bayes";
import { canonicalizeUrl } from "./url";
import { extractJsonObject, extractToolUrls, validateRoundOutput } from "./claude-agent";
import { validateFraming, validateAudit } from "./framing";
import { validateSummary } from "./summary";
import { newForecastState } from "./engine";
import type { EventFraming } from "./types";

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

  it("clampUnverified caps magnitude at 0.2 and keeps sign (P0-4)", () => {
    expect(clampUnverified(1.5)).toBeCloseTo(0.2, 9);
    expect(clampUnverified(-1.5)).toBeCloseTo(-0.2, 9);
    expect(clampUnverified(0.1)).toBeCloseTo(0.1, 9); // below cap, unchanged
    expect(clampUnverified(0)).toBe(0);
  });

  it("clampReflection caps magnitude at 1.0 and keeps sign (a)", () => {
    expect(clampReflection(2.5)).toBeCloseTo(1, 9);
    expect(clampReflection(-2.5)).toBeCloseTo(-1, 9);
    expect(clampReflection(-0.6)).toBeCloseTo(-0.6, 9); // below cap, unchanged
    expect(clampReflection(NaN)).toBe(0);
  });

  it("confirmationRatio measures share reinforcing the lean (P0-5)", () => {
    // lean YES (prior>0.5): all-positive evidence => 100% confirming
    expect(confirmationRatio(0.78, [1, 0.5, 0.3])).toBeCloseTo(1, 9);
    // balanced => 50%
    expect(confirmationRatio(0.78, [1, -1])).toBeCloseTo(0.5, 9);
    // lean NO (prior<0.5): negative reinforces, positive opposes
    expect(confirmationRatio(0.2, [-1, -1, 0.5])).toBeCloseTo(2 / 2.5, 9);
    // no lean / no evidence => null
    expect(confirmationRatio(0.5, [1, -1])).toBeNull();
    expect(confirmationRatio(0.7, [])).toBeNull();
  });

  it("clusterFactorsWithHistory keeps damping clusters that already have ledger members", () => {
    // one prior member in cluster "a": the strongest NEW a-source starts at ×0.5
    expect(clusterFactorsWithHistory(["a", "a", "b"], [1.0, 0.5, 0.9], ["a"])).toEqual([0.5, 0.25, 1]);
    // two prior members: ×0.25
    expect(clusterFactorsWithHistory(["a"], [1.0], ["a", "a"])).toEqual([0.25]);
    // engine-internal ids in the ledger never form a cross-round cluster
    expect(clusterFactorsWithHistory(["", "x"], [1, 1], ["__solo_0", "__reflection"])).toEqual([1, 1]);
    // no prior members: identical to within-round clusterFactors
    expect(clusterFactorsWithHistory(["a", "a"], [1.0, 0.5], [])).toEqual(clusterFactors(["a", "a"], [1.0, 0.5]));
  });

  it("clusterFactors damps correlated same-cluster sources (P0-3)", () => {
    // same cluster: strongest keeps full weight, each next ×0.5^rank
    expect(clusterFactors(["a", "a", "a"], [1.0, 0.8, 0.6])).toEqual([1, 0.5, 0.25]);
    // strongest is picked regardless of input order
    expect(clusterFactors(["a", "a"], [0.5, 1.0])).toEqual([0.5, 1]);
    // different clusters => all independent (full weight)
    expect(clusterFactors(["a", "b", "c"], [1, 1, 1])).toEqual([1, 1, 1]);
    // blank/missing ids => each treated as its own cluster (no damping)
    expect(clusterFactors(["", ""], [1, 1])).toEqual([1, 1]);
    // mixed: a-cluster damped, b independent
    expect(clusterFactors(["a", "a", "b"], [1.0, 0.5, 0.9])).toEqual([1, 0.5, 1]);
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

  it("credibilityFactor: high full weight, medium/low progressively damped", () => {
    expect(credibilityFactor("high")).toBe(1);
    expect(credibilityFactor("medium")).toBeLessThan(1);
    expect(credibilityFactor("low")).toBeLessThan(credibilityFactor("medium"));
    // unknown values behave like medium (lenient, never zero out evidence)
    expect(credibilityFactor("certain")).toBe(credibilityFactor("medium"));
  });

  it("capRoundLlrs: under the cap is untouched; over the cap scales all entries proportionally (#8)", () => {
    expect(capRoundLlrs([0.5, -0.3])).toEqual([0.5, -0.3]);
    const capped = capRoundLlrs([2, 2, 1]); // |sum|=5 > cap
    const sum = capped.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum)).toBeCloseTo(ROUND_MAX_ABS_LLR_SUM, 9);
    // relative attribution preserved
    expect(capped[0] / capped[2]).toBeCloseTo(2, 9);
    // sign-symmetric
    const neg = capRoundLlrs([-2, -2, -1]);
    expect(neg.reduce((a, b) => a + b, 0)).toBeCloseTo(-ROUND_MAX_ABS_LLR_SUM, 9);
    // offsetting evidence with a small net sum is NOT scaled
    expect(capRoundLlrs([2, -1.9])).toEqual([2, -1.9]);
    expect(capRoundLlrs([])).toEqual([]);
  });

  it("independentClusterCount: distinct ids count once, blanks are their own cluster", () => {
    expect(independentClusterCount(["a", "a", "b"])).toBe(2);
    expect(independentClusterCount(["", "", "a"])).toBe(3);
    expect(independentClusterCount([])).toBe(0);
  });

  it("shrinkTowardAnchor: no evidence returns the anchor; more clusters shrink less (#6)", () => {
    // n=0 => fully back to the base-rate anchor
    expect(shrinkTowardAnchor(0.9, 0.3, 0, "medium")).toBeCloseTo(0.3, 6);
    // shrunk value lies strictly between anchor and posterior
    const one = shrinkTowardAnchor(0.9, 0.3, 1, "medium");
    expect(one).toBeGreaterThan(0.3);
    expect(one).toBeLessThan(0.9);
    // more independent clusters => closer to the raw posterior
    const many = shrinkTowardAnchor(0.9, 0.3, 8, "medium");
    expect(many).toBeGreaterThan(one);
    // higher confidence => less shrink
    expect(shrinkTowardAnchor(0.9, 0.3, 2, "high")).toBeGreaterThan(shrinkTowardAnchor(0.9, 0.3, 2, "low"));
    // idempotent anchor: posterior == anchor stays put
    expect(shrinkTowardAnchor(0.4, 0.4, 3, "medium")).toBeCloseTo(0.4, 6);
  });

  it("bandStable: k trailing posteriors within the corridor => stable (#7)", () => {
    // last 3 within 6pp corridor
    expect(bandStable([0.31, 0.336, 0.387, 0.36], 3, 0.03)).toBe(true);
    // spread wider than the corridor
    expect(bandStable([0.31, 0.336, 0.42], 3, 0.03)).toBe(false);
    // not enough rounds yet
    expect(bandStable([0.5, 0.51], 3, 0.03)).toBe(false);
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

describe("extractToolUrls (fabrication-guard capture, P0-4)", () => {
  const webfetch = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "WebFetch", input: { url: "https://en.wikipedia.org/wiki/Bitcoin" } }] },
  });
  const websearch = JSON.stringify({
    type: "user",
    message: { content: [{ type: "tool_result", content: [{ title: "Foo", url: "https://example.com/foo" }] }] },
  });
  // a bare url with no title and not under tool_use (e.g. a link embedded in page text) must NOT be captured
  const pageLink = JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", content: [{ url: "https://random.com/embedded" }] }] } });

  it("captures WebFetch tool_use.input.url (the prior false-negative)", () => {
    const urls = extractToolUrls([webfetch, "noise line", websearch].join("\n"));
    expect(urls.has("https://en.wikipedia.org/wiki/Bitcoin")).toBe(true);
  });
  it("captures WebSearch {title,url} result links", () => {
    expect(extractToolUrls(websearch).has("https://example.com/foo")).toBe(true);
  });
  it("does NOT over-capture bare page-embedded links (no title, not a tool_use)", () => {
    expect(extractToolUrls(pageLink).has("https://random.com/embedded")).toBe(false);
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
  it("defaults reflection to [] when absent (a)", () => {
    expect(validateRoundOutput(good).reflection).toEqual([]);
  });
  it("parses valid reflection entries and drops malformed ones (a)", () => {
    const out = validateRoundOutput({
      ...good,
      reflection: [
        { target_url: "https://a.com", llr_adjustment: -0.6, reason: "stale", new_source_url: "https://b.com" },
        { target_url: "https://a.com", llr_adjustment: -0.6, reason: "no new source" }, // missing new_source_url
        { target_url: "https://a.com", llr_adjustment: "lots", reason: "bad adj", new_source_url: "https://c.com" }, // non-finite
      ],
    });
    expect(out.reflection).toHaveLength(1);
    expect(out.reflection[0].new_source_url).toBe("https://b.com");
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
    prior_probability: 0.55,
    prior_rationale: "Pre-announced products ship on time ~half the time.",
  };

  it("accepts a well-formed frame and parses the prior", () => {
    const f = validateFraming(good);
    expect(f.normalizedQuestion).toContain("Will X");
    expect(f.resolutionDate).toBe("2026-12-31");
    expect(f.forecastable).toBe(true);
    expect(f.priorProbability).toBeCloseTo(0.55, 6);
  });
  it("clamps prior into [0,1] and defaults to 0.5 when missing/invalid", () => {
    expect(validateFraming({ ...good, prior_probability: 1.7 }).priorProbability).toBe(1);
    expect(validateFraming({ ...good, prior_probability: -3 }).priorProbability).toBe(0);
    const noPrior = { ...good } as Record<string, unknown>;
    delete noPrior.prior_probability;
    expect(validateFraming(noPrior).priorProbability).toBe(0.5);
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
  it("validateAudit carries caveats + confidence and corrects the frame", () => {
    const a = validateAudit({
      ...good,
      resolution_criteria: "YES iff X ships, intraday touch counts (corrected).",
      framing_caveats: "original bar was ambiguous on touch-vs-close",
      framing_confidence: "high",
    });
    expect(a.framingCaveats).toContain("ambiguous");
    expect(a.framingConfidence).toBe("high");
    expect(a.resolutionCriteria).toContain("corrected");
  });
  it("validateAudit defaults confidence to medium on bad value", () => {
    expect(validateAudit({ ...good, framing_confidence: "certain" }).framingConfidence).toBe("medium");
  });
});

describe("newForecastState prior seeding (P0-2)", () => {
  const framing = (priorProbability: number): EventFraming => ({
    normalizedQuestion: "q",
    resolutionCriteria: "c",
    resolutionDate: "2026-12-31",
    settlementSource: "s",
    assumptions: "",
    forecastable: true,
    clarificationNeeded: "",
    priorProbability,
    priorRationale: "r",
    framingCaveats: "",
    framingConfidence: "medium",
  });

  it("seeds currentProb from the base-rate prior, not 0.5", () => {
    expect(newForecastState({ eventId: "e", eventText: "t", framing: framing(0.55) }).currentProb).toBeCloseTo(0.55, 6);
  });
  it("keeps rare/near-certain priors, clamped only to [0.01, 0.99]", () => {
    // an M9-quake-style ~0.03% prior must NOT be flattened toward 0.5
    expect(newForecastState({ eventId: "e", eventText: "t", framing: framing(0.0003) }).currentProb).toBeCloseTo(0.01, 6);
    expect(newForecastState({ eventId: "e", eventText: "t", framing: framing(0.999) }).currentProb).toBeCloseTo(0.99, 6);
  });
});

describe("validateSummary (final synthesis)", () => {
  const good = {
    verdict: "P(YES) landed low because the balance of evidence is against it.",
    key_factors_yes: ["one supportive signal", ""],
    key_factors_no: ["strong opposing evidence"],
    main_uncertainties: "the resolution date is far off",
    calibration_note: "",
  };
  it("accepts a well-formed summary and filters empty factor strings", () => {
    const s = validateSummary(good);
    expect(s.verdict).toContain("balance of evidence");
    expect(s.keyFactorsYes).toEqual(["one supportive signal"]); // empty dropped
    expect(s.keyFactorsNo).toHaveLength(1);
  });
  it("requires a non-empty verdict", () => {
    expect(() => validateSummary({ ...good, verdict: "" })).toThrow();
    expect(() => validateSummary({})).toThrow();
  });
  it("tolerates missing optional arrays/fields", () => {
    const s = validateSummary({ verdict: "ok" });
    expect(s.keyFactorsYes).toEqual([]);
    expect(s.mainUncertainties).toBe("");
  });
});
