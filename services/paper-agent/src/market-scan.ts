// Market universe scanner: discovers candidate markets for the configured
// categories via Gamma tag filters (probed 2026-07-03: /markets?tag_id= works;
// market rows carry no category field, so tags are the only reliable taxonomy).
// Filters mirror the repo's standing risk gates: liquidity ≥ $5k hard floor,
// binary Yes/No only, sane price band (no longshot junk), open + not expiring
// imminently.
//
// Selection is a random draw of one candidate per category (2026-08-24), not
// the top-of-list walk it used to be: always evaluating the same handful of
// highest-24h-volume markets meant the fleet's new-entry attention converged
// on a narrow, repeat set of "usual suspects" instead of sampling the wider
// pool that clears the risk gates.

import { log } from "./log";

const GAMMA = "https://gamma-api.polymarket.com";

// Resolved live from /tags/slug/<name> (2026-07-03).
export const CATEGORY_TAG_IDS: Readonly<Record<string, number>> = {
  finance: 120,
  geopolitics: 100265,
  tech: 1401,
  economy: 100328,
  business: 107,
  crypto: 21,
  ai: 439,
  stocks: 604,
  world: 101970,
  politics: 2
};

export interface ScanRow {
  slug?: string;
  question?: string;
  outcomes?: unknown;
  clobTokenIds?: unknown;
  closed?: boolean;
  endDate?: string;
  volume24hr?: number | string;
  liquidityNum?: number | string;
  bestBid?: number | string;
  bestAsk?: number | string;
}

export interface ScanCandidate {
  slug: string;
  question: string;
  category: string;
  volume24hUsd: number;
  liquidityUsd: number;
}

export interface ScanOptions {
  minLiquidityUsd: number;
  minVolume24hUsd: number;
  perCategory: number;
  minHoursToEnd: number;
  priceBand: [number, number];
}

export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  minLiquidityUsd: 5_000, // repo risk hard floor
  minVolume24hUsd: 2_000, // loosened from 10k (user 2026-07-03) — liquidity floor carries the risk gate
  perCategory: 12, // widened with the volume gate: the top-8 cap was binding before the gate could

  minHoursToEnd: 48, // skip markets resolving imminently — no time to re-evaluate
  priceBand: [0.02, 0.98] // widened from [0.05, 0.95] (user 2026-08-24) — only cut the true no-edge extremes
};

function parseArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Pure filter — unit-testable without the network.
export function filterScanRows(rows: ScanRow[], category: string, opts: ScanOptions, now: number): ScanCandidate[] {
  const out: ScanCandidate[] = [];
  for (const row of rows) {
    if (!row.slug || row.closed) continue;
    const outcomes = parseArray(row.outcomes);
    if (outcomes.length !== 2) continue;
    if (outcomes[0]?.trim().toLowerCase() !== "yes" || outcomes[1]?.trim().toLowerCase() !== "no") continue;
    if (parseArray(row.clobTokenIds).length !== 2) continue;
    const liquidity = Number(row.liquidityNum ?? 0);
    const volume = Number(row.volume24hr ?? 0);
    if (!(liquidity >= opts.minLiquidityUsd) || !(volume >= opts.minVolume24hUsd)) continue;
    if (row.endDate) {
      const hoursToEnd = (Date.parse(row.endDate) - now) / 3600_000;
      if (Number.isFinite(hoursToEnd) && hoursToEnd < opts.minHoursToEnd) continue;
    }
    const ask = Number(row.bestAsk ?? NaN);
    if (Number.isFinite(ask) && (ask < opts.priceBand[0] || ask > opts.priceBand[1])) continue;
    out.push({
      slug: row.slug,
      question: row.question ?? row.slug,
      category,
      volume24hUsd: volume,
      liquidityUsd: liquidity
    });
    if (out.length >= opts.perCategory) break;
  }
  return out;
}

// Uniform pick — swappable for a seeded RNG in tests without touching callers.
function pickRandom<T>(items: readonly T[], rng: () => number = Math.random): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(rng() * items.length)];
}

export async function scanMarkets(
  categories: string[],
  opts: ScanOptions = DEFAULT_SCAN_OPTIONS,
  fetchFn: typeof fetch = fetch,
  rng: () => number = Math.random
): Promise<ScanCandidate[]> {
  const seen = new Set<string>();
  const all: ScanCandidate[] = [];
  for (const category of categories) {
    const tagId = CATEGORY_TAG_IDS[category.trim().toLowerCase()];
    if (!tagId) {
      log.warn(`unknown scan category "${category}" — skipped (known: ${Object.keys(CATEGORY_TAG_IDS).join(", ")})`);
      continue;
    }
    try {
      const res = await fetchFn(
        `${GAMMA}/markets?closed=false&tag_id=${tagId}&order=volume24hr&ascending=false&limit=100`,
        { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) }
      );
      if (!res.ok) throw new Error(`gamma scan ${res.status}`);
      const rows = (await res.json()) as ScanRow[];
      // Filter first (still capped at opts.perCategory, still ranked by 24h
      // volume within the filter step), THEN draw one at random from that
      // shortlist — the ranking decides who clears the risk gate, not who
      // gets evaluated.
      const shortlist = filterScanRows(rows, category, opts, Date.now()).filter((c) => !seen.has(c.slug));
      const pick = pickRandom(shortlist, rng);
      if (pick) {
        seen.add(pick.slug);
        all.push(pick);
      }
    } catch (error) {
      log.error(`scan failed for ${category}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // Highest 24h volume first among this cycle's random draws — ties in
  // remaining eval budget still go to the livelier pick.
  return all.sort((a, b) => b.volume24hUsd - a.volume24hUsd);
}
