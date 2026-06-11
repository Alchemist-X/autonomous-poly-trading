import { promises as fs } from "node:fs";
import path from "node:path";
import type { MarketIndex, MarketSnapshot, SnapshotDiff, WcMarket } from "./types.js";

const PRICE_EPS = 0.005; // 0.5c move = "changed"

export function buildSnapshot(markets: readonly WcMarket[], gammaTagIds: readonly number[], generatedAt: string): MarketSnapshot {
  const byCategory: Record<string, number> = {};
  const bySubtype: Record<string, number> = {};
  let active = 0;
  let closed = 0;
  for (const m of markets) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
    bySubtype[m.subtype] = (bySubtype[m.subtype] ?? 0) + 1;
    if (m.active && !m.closed) active += 1;
    if (m.closed) closed += 1;
  }
  return {
    generatedAt,
    source: { gammaTagIds: [...gammaTagIds], endpoint: "https://gamma-api.polymarket.com/markets?tag_id=" },
    counts: { total: markets.length, active, closed, byCategory, bySubtype },
    markets: [...markets]
  };
}

export function buildIndex(snapshot: MarketSnapshot, generatedAt: string): MarketIndex {
  const byEventSlug: Record<string, string[]> = {};
  const byConditionId: Record<string, string> = {};
  const byMarketSlug: Record<string, string> = {};
  const byTokenId: MarketIndex["byTokenId"] = {};
  for (const m of snapshot.markets) {
    if (m.eventSlug) (byEventSlug[m.eventSlug] ??= []).push(m.id);
    if (m.conditionId) byConditionId[m.conditionId] = m.id;
    byMarketSlug[m.marketSlug] = m.id;
    m.clobTokenIds.forEach((tokenId, outcomeIndex) => {
      if (!tokenId) return;
      byTokenId[tokenId] = {
        marketId: m.id,
        conditionId: m.conditionId,
        marketSlug: m.marketSlug,
        outcome: m.outcomes[outcomeIndex] ?? `outcome_${outcomeIndex}`,
        outcomeIndex
      };
    });
  }
  return { generatedAt, byEventSlug, byConditionId, byMarketSlug, byTokenId };
}

/** All clob asset_ids in a snapshot (the WS subscription set). */
export function allTokenIds(snapshot: MarketSnapshot): string[] {
  const ids = new Set<string>();
  for (const m of snapshot.markets) for (const t of m.clobTokenIds) if (t) ids.add(t);
  return [...ids];
}

function statusOf(m: WcMarket): string {
  if (m.archived) return "archived";
  if (m.closed) return "closed";
  if (m.active) return "active";
  return "inactive";
}

/** Diff two snapshots: what's new, gone, status-changed, or moved on price. */
export function diffSnapshots(oldSnap: MarketSnapshot, newSnap: MarketSnapshot): SnapshotDiff {
  const oldById = new Map(oldSnap.markets.map((m) => [m.id, m]));
  const newById = new Map(newSnap.markets.map((m) => [m.id, m]));

  const added: WcMarket[] = [];
  const statusChanged: SnapshotDiff["statusChanged"][number][] = [];
  const priceChanged: SnapshotDiff["priceChanged"][number][] = [];
  let unchanged = 0;

  for (const [id, nm] of newById) {
    const om = oldById.get(id);
    if (!om) { added.push(nm); continue; }
    const oldStatus = statusOf(om);
    const newStatus = statusOf(nm);
    let touched = false;
    if (oldStatus !== newStatus) {
      statusChanged.push({ id, question: nm.question, from: oldStatus, to: newStatus });
      touched = true;
    }
    const len = Math.max(om.outcomePrices.length, nm.outcomePrices.length);
    let maxDelta = 0;
    for (let i = 0; i < len; i += 1) {
      const a = nm.outcomePrices[i];
      const b = om.outcomePrices[i];
      const delta = Math.abs((Number.isFinite(a) ? (a as number) : 0) - (Number.isFinite(b) ? (b as number) : 0));
      if (Number.isFinite(delta)) maxDelta = Math.max(maxDelta, delta);
    }
    if (maxDelta >= PRICE_EPS) {
      priceChanged.push({ id, question: nm.question, oldPrices: om.outcomePrices, newPrices: nm.outcomePrices, maxDelta: Number(maxDelta.toFixed(4)) });
      touched = true;
    }
    if (!touched) unchanged += 1;
  }

  // Only report a market as "removed" the first time it leaves the tag query
  // while still active — already-inactive carried-forward markets won't re-spam.
  const removed = [...oldById.keys()]
    .filter((id) => !newById.has(id))
    .map((id) => oldById.get(id)!)
    .filter((m) => m.active && !m.closed)
    .map((m) => ({ id: m.id, question: m.question }));

  return {
    added,
    removed,
    statusChanged,
    priceChanged,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      statusChangedCount: statusChanged.length,
      priceChangedCount: priceChanged.length,
      unchanged
    }
  };
}

/**
 * Union fresh markets with any cached market that has dropped out of the tag
 * query, carrying the dropped ones forward as inactive so we never lose their
 * token→market / condition mappings (important for resolving WS events &
 * positions on markets that just closed). Fresh data always wins on overlap.
 */
export function unionPreservingDropped(
  freshMarkets: readonly WcMarket[],
  cachedMarkets: readonly WcMarket[]
): WcMarket[] {
  const freshIds = new Set(freshMarkets.map((m) => m.id));
  const carried = cachedMarkets
    .filter((m) => !freshIds.has(m.id))
    .map((m) => ({ ...m, active: false }));
  return [...freshMarkets, ...carried];
}

// ---- disk persistence ----
export interface CachePaths {
  readonly dir: string;
  readonly snapshot: string;
  readonly index: string;
  readonly meta: string;
}

export function cachePaths(baseDir: string): CachePaths {
  return {
    dir: baseDir,
    snapshot: path.join(baseDir, "snapshot.json"),
    index: path.join(baseDir, "index.json"),
    meta: path.join(baseDir, "meta.json")
  };
}

export async function writeCache(baseDir: string, snapshot: MarketSnapshot, index: MarketIndex): Promise<CachePaths> {
  const paths = cachePaths(baseDir);
  await fs.mkdir(baseDir, { recursive: true });
  await fs.writeFile(paths.snapshot, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await fs.writeFile(paths.index, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await fs.writeFile(paths.meta, `${JSON.stringify({ generatedAt: snapshot.generatedAt, counts: snapshot.counts, source: snapshot.source }, null, 2)}\n`, "utf8");
  return paths;
}

export async function readSnapshot(baseDir: string): Promise<MarketSnapshot | null> {
  try {
    const raw = await fs.readFile(cachePaths(baseDir).snapshot, "utf8");
    return JSON.parse(raw) as MarketSnapshot;
  } catch {
    return null;
  }
}
