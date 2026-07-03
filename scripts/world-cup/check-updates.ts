/**
 * Check whether the cached Polymarket World Cup markets have changed: re-fetch
 * from Gamma, diff against the saved snapshot, and report new / removed /
 * status-changed / price-moved markets. Run this on every access.
 *
 *   pnpm tsx scripts/world-cup/check-updates.ts          # report only
 *   pnpm tsx scripts/world-cup/check-updates.ts --apply  # also update the cache
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchAllWorldCupMarkets, WORLD_CUP_TAG_IDS, buildSnapshot, buildIndex,
  diffSnapshots, readSnapshot, writeCache, unionPreservingDropped
} from "../../packages/sports-data/src/index.js";
import { stripPrices } from "./lib/market-blind.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(REPO_ROOT, "runtime-artifacts/world-cup/polymarket");

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const cached = await readSnapshot(OUT_DIR);
  if (!cached) {
    console.error("No cache found. Run: pnpm tsx scripts/world-cup/cache-markets.ts");
    process.exitCode = 1;
    return;
  }

  console.log(`Cache from ${cached.generatedAt} (${cached.counts.total} markets). Re-fetching...`);
  const generatedAt = new Date().toISOString();
  const markets = await fetchAllWorldCupMarkets(WORLD_CUP_TAG_IDS);
  const fresh = stripPrices(buildSnapshot(markets, WORLD_CUP_TAG_IDS, generatedAt));
  const diff = diffSnapshots(cached, fresh);

  const s = diff.summary;
  const total = s.addedCount + s.removedCount + s.statusChangedCount + s.priceChangedCount;
  console.log(`\n=== Updates vs cache ===`);
  console.log(`added=${s.addedCount}  removed=${s.removedCount}  statusChanged=${s.statusChangedCount}  priceMoved=${s.priceChangedCount}  unchanged=${s.unchanged}`);

  const show = <T>(label: string, items: readonly T[], fmt: (x: T) => string) => {
    if (items.length === 0) return;
    console.log(`\n${label} (${items.length}, showing up to 8):`);
    for (const it of items.slice(0, 8)) console.log(`  ${fmt(it)}`);
  };
  show("NEW", diff.added, (m) => `[${m.category}] ${m.question} — ${m.marketSlug}`);
  show("REMOVED", diff.removed, (m) => `${m.question} (${m.id})`);
  show("STATUS", diff.statusChanged, (m) => `${m.from}→${m.to}: ${m.question}`);

  if (apply) {
    // Carry forward any market that dropped out of the tag (kept inactive) so we
    // never lose its token/condition mappings.
    const merged = stripPrices(buildSnapshot(unionPreservingDropped(fresh.markets, cached.markets), WORLD_CUP_TAG_IDS, generatedAt));
    const index = buildIndex(merged, generatedAt);
    await writeCache(OUT_DIR, merged, index);
    const logLine = JSON.stringify({ checkedAt: generatedAt, summary: s }) + "\n";
    await fs.appendFile(path.join(OUT_DIR, "updates-log.jsonl"), logLine, "utf8");
    console.log(`\n--apply: cache updated to ${generatedAt}; diff appended to updates-log.jsonl`);
  } else if (total > 0) {
    console.log(`\n${total} change(s) detected. Re-run with --apply to update the cache.`);
  } else {
    console.log(`\nNo changes. Cache is current.`);
  }
}

main().catch((err) => { console.error("check-updates failed:", err); process.exitCode = 1; });
