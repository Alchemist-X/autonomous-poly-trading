import type { ClaimSource, CrossCheckStatus, SourceType } from "./types";

const SOURCE_BASE: Record<SourceType, number> = {
  official: 36,
  data: 38,
  academic: 34,
  original_reporting: 30,
  press: 18,
  insider: 10,
  secondary: 5
};

export function sourceQualityScore(source: ClaimSource): number {
  const credibility = source.credibility === "high" ? 15 : source.credibility === "medium" ? 7 : 0;
  const support = source.supportQuality === "direct" ? 27 : source.supportQuality === "partial" ? 12 : -12;
  const primary = source.isPrimary ? 12 : 0;
  const verified = source.verifiedInSearchTrace === true ? 10 : source.verifiedInSearchTrace === false ? -20 : 0;
  const relation = source.relation === "context" ? -8 : 0;
  return Math.max(
    0,
    Math.min(100, SOURCE_BASE[source.sourceType] + credibility + support + primary + verified + relation)
  );
}

export function rankClaimSources(sources: readonly ClaimSource[]): ClaimSource[] {
  return sources
    .map((source) => ({ ...source, qualityScore: sourceQualityScore(source) }))
    .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
}

export function claimQualityScore(sources: readonly ClaimSource[], status: CrossCheckStatus): number {
  if (!sources.length) return 0;
  const ranked = rankClaimSources(sources);
  const independent = new Set(
    ranked
      .filter((source) => source.relation === "supports" && source.supportQuality !== "context")
      .map((source) => source.independenceGroup)
      .filter(Boolean)
  ).size;
  const crossCheck = status === "confirmed" ? 12 : status === "contested" ? -8 : status === "unverified" ? -20 : -4;
  return Math.max(
    0,
    Math.min(100, (ranked[0]?.qualityScore ?? 0) + Math.min(12, Math.max(0, independent - 1) * 4) + crossCheck)
  );
}

export function crossCheckWeight(status: CrossCheckStatus): number {
  if (status === "confirmed") return 1;
  if (status === "contested") return 0.55;
  if (status === "unverified") return 0.2;
  return 0.75;
}

export function canonicalClaimKey(claimId: string, claim: string): string {
  const supplied = claimId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "");
  if (supplied) return supplied;
  return claim
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 12)
    .join("-");
}
