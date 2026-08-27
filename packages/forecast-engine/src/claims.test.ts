import { describe, expect, it } from "vitest";
import { canonicalClaimKey, claimQualityScore, crossCheckWeight, rankClaimSources } from "./claims";
import type { ClaimSource } from "./types";

const source = (overrides: Partial<ClaimSource>): ClaimSource => ({
  url: "https://example.com",
  title: "Example",
  sourceType: "secondary",
  credibility: "medium",
  relation: "supports",
  supportQuality: "partial",
  publishedAt: null,
  isPrimary: false,
  independenceGroup: "example",
  verifiedInSearchTrace: true,
  ...overrides
});

describe("claim evidence quality", () => {
  it("ranks direct verified primary evidence above secondary commentary", () => {
    const ranked = rankClaimSources([
      source({ url: "https://commentary.example", title: "Commentary" }),
      source({
        url: "https://official.example",
        title: "Official record",
        sourceType: "official",
        credibility: "high",
        supportQuality: "direct",
        isPrimary: true,
        independenceGroup: "issuer"
      })
    ]);
    expect(ranked[0].url).toBe("https://official.example");
    expect(ranked[0].qualityScore).toBeGreaterThan(ranked[1].qualityScore ?? 0);
  });

  it("ranks direct original reporting above an official page that is only contextual", () => {
    const ranked = rankClaimSources([
      source({
        url: "https://official.example/context",
        sourceType: "official",
        credibility: "high",
        relation: "context",
        supportQuality: "context",
        isPrimary: true
      }),
      source({
        url: "https://reporting.example/direct",
        sourceType: "original_reporting",
        credibility: "high",
        supportQuality: "direct"
      })
    ]);
    expect(ranked[0].url).toBe("https://reporting.example/direct");
  });

  it("rewards independent confirmation and downweights contested or unverified claims", () => {
    const sources = [
      source({ sourceType: "official", credibility: "high", isPrimary: true, independenceGroup: "issuer" }),
      source({
        url: "https://registry.example",
        sourceType: "data",
        credibility: "high",
        isPrimary: true,
        independenceGroup: "registry"
      })
    ];
    expect(claimQualityScore(sources, "confirmed")).toBeGreaterThan(claimQualityScore(sources, "contested"));
    expect(crossCheckWeight("confirmed")).toBeGreaterThan(crossCheckWeight("single_source"));
    expect(crossCheckWeight("single_source")).toBeGreaterThan(crossCheckWeight("unverified"));
  });

  it("uses a stable semantic claim identifier instead of a page URL", () => {
    expect(canonicalClaimKey("Release Date", "ignored")).toBe("release-date");
    expect(canonicalClaimKey("", "The product shipped on 20 August 2026.")).toBe(
      "the-product-shipped-on-20-august-2026"
    );
  });
});
