// Gate-time cross-source coverage check (user ask 2026-08-23): before judging
// materiality, spend one ~15s web search asking "did anyone publish this story
// BEFORE our item's timestamp?". Two consumers:
//   - gate 1 prompt: the LLM sees the hit list and can call a restated/stale
//     story non-tradeable;
//   - gate 2 t0: a verified earlier appearance moves t0 earlier — the SAFE
//     direction (more of the realized move counts as already-priced). This
//     replaces the Phase 0 "published as upper bound" simplification for
//     "Reportedly" items.
// Failure policy: never throws, never blocks the pipeline; skips (no key /
// disabled) and errors are recorded verbatim on the signal so degradation is
// audit-visible, not silent.

import type { NewsItem, PriorCoverage } from "@autopoly/delta-pm-contracts";
import type { SearchHit } from "../../../packages/forecast-engine/src/web-search";
import { config } from "./config.js";
import { tokenJaccard } from "./gate.js";

// forecast-engine is CJS-context TS (no "type":"module"): a STATIC ESM import
// from this package fails tsx's named-export detection at link time (measured
// 2026-08-23: "does not provide an export named 'backendName'"), while a
// dynamic import resolves the full namespace. Hence the lazy loader.
interface WebSearchModule {
  backendName: () => string;
  webSearch: (query: string) => Promise<SearchHit[]>;
}
let webSearchModule: Promise<WebSearchModule> | null = null;
function loadWebSearch(): Promise<WebSearchModule> {
  webSearchModule ??= import("../../../packages/forecast-engine/src/web-search") as unknown as Promise<WebSearchModule>;
  return webSearchModule;
}

// A hit only counts as PRIOR coverage when it (a) predates our item by a real
// margin (clock skew + CDN cache slack), and (b) plausibly tells the same
// story. The similarity bar is deliberately loose — code only computes the
// deterministic t0 shift; the gate-1 LLM makes the qualitative freshness call
// from the full hit list.
const PRIOR_SLACK_MS = 30 * 60_000;
const SAME_STORY_MIN_JACCARD = 0.3;
const SELF_DOMAINS = new Set(["theinformation.com", "www.theinformation.com"]);

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export type SearchFn = (query: string) => Promise<SearchHit[]>;

export async function checkPriorCoverage(item: NewsItem, searchFn?: SearchFn): Promise<PriorCoverage> {
  const query = item.title.trim();
  const empty: PriorCoverage = {
    searched: false,
    skippedReason: null,
    error: null,
    query,
    priorHitCount: 0,
    earliestPriorUtc: null,
    hits: []
  };
  if (!config.coverageCheckEnabled) return { ...empty, skippedReason: "coverage check disabled (DELTAPM_COVERAGE_CHECK)" };
  const mod = await loadWebSearch();
  try {
    mod.backendName(); // throws with an actionable message when no search key is configured
  } catch (error) {
    return { ...empty, skippedReason: error instanceof Error ? error.message : String(error) };
  }
  try {
    const raw = await (searchFn ?? mod.webSearch)(query); // backend enforces its own ~15s timeout
    const publishedMs = Date.parse(item.publishedUtc);
    const hits = raw
      .filter((h) => h.url && !SELF_DOMAINS.has(domainOf(h.url)))
      .slice(0, 8)
      .map((h) => {
        const t = h.publishedDate ? Date.parse(h.publishedDate) : NaN;
        return {
          title: h.title,
          url: h.url,
          domain: domainOf(h.url),
          publishedUtc: Number.isFinite(t) ? new Date(t).toISOString() : null,
          titleSimilarity: Math.round(tokenJaccard(h.title, item.title) * 1000) / 1000
        };
      });
    const prior = hits.filter(
      (h) =>
        h.publishedUtc !== null &&
        Date.parse(h.publishedUtc) <= publishedMs - PRIOR_SLACK_MS &&
        h.titleSimilarity >= SAME_STORY_MIN_JACCARD
    );
    const earliestPriorUtc = prior.length
      ? new Date(Math.min(...prior.map((h) => Date.parse(h.publishedUtc!)))).toISOString()
      : null;
    return { ...empty, searched: true, hits, priorHitCount: prior.length, earliestPriorUtc };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : String(error) };
  }
}

// Deterministic t0 for gate 2: the earliest verified prior appearance wins
// over our item's published time. Harness-enforced (never left to the LLM).
export function effectiveT0Ms(item: NewsItem, coverage: PriorCoverage | null): number {
  const publishedMs = Date.parse(item.publishedUtc);
  if (!coverage?.earliestPriorUtc) return publishedMs;
  return Math.min(publishedMs, Date.parse(coverage.earliestPriorUtc));
}
