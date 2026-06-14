import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIER,
  NORN_TIERS,
  isNornTier,
  normalizeTier,
  resolveModelAlias,
  resolveNornModel
} from "./index";

describe("norns tier mapping", () => {
  it("maps every tier to a concrete model per family", () => {
    for (const tier of NORN_TIERS) {
      expect(resolveNornModel(tier, "anthropic")).toMatch(/^claude/);
      expect(resolveNornModel(tier, "openai")).toMatch(/^gpt/);
    }
  });

  it("alias passes raw model ids and empty defaults through unchanged (non-breaking)", () => {
    expect(resolveModelAlias("claude-opus-4-8", "anthropic")).toBe("claude-opus-4-8");
    expect(resolveModelAlias("gpt-4o", "openai")).toBe("gpt-4o");
    expect(resolveModelAlias("some-custom-model", "anthropic")).toBe("some-custom-model");
    expect(resolveModelAlias("", "anthropic")).toBe("");
    expect(resolveModelAlias(null, "openai")).toBe("");
    expect(resolveModelAlias(undefined, "anthropic")).toBe("");
  });

  it("alias resolves tier names case- and space-insensitively", () => {
    expect(resolveModelAlias("skuld", "anthropic")).toBe(resolveNornModel("skuld", "anthropic"));
    expect(resolveModelAlias("  Urd ", "openai")).toBe(resolveNornModel("urd", "openai"));
    expect(resolveModelAlias("VERDANDI", "anthropic")).toBe(resolveNornModel("verdandi", "anthropic"));
  });

  it("isNornTier and normalizeTier behave", () => {
    expect(isNornTier("verdandi")).toBe(true);
    expect(isNornTier("opus")).toBe(false);
    expect(isNornTier(42)).toBe(false);
    expect(normalizeTier("SKULD")).toBe("skuld");
    expect(normalizeTier(undefined)).toBe(DEFAULT_TIER);
    expect(normalizeTier("nonsense")).toBe(DEFAULT_TIER);
  });
});
