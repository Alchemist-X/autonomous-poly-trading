/**
 * Fetch ALL Polymarket World Cup markets (finals tag 102232 + pre-WC friendlies
 * tag 102539) and write the cache: snapshot.json + index.json + meta.json.
 * Captures event-slug, market-slug, conditionId, questionID, clobTokenIds, etc.
 *
 * Run: pnpm tsx scripts/world-cup/cache-markets.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchAllWorldCupMarkets, WORLD_CUP_TAG_IDS, buildSnapshot, buildIndex, writeCache, allTokenIds
} from "../../packages/sports-data/src/index.js";
import { stripPrices } from "./lib/market-blind.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(REPO_ROOT, "runtime-artifacts/world-cup/polymarket");

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  console.log(`Fetching World Cup markets from Gamma (tags ${WORLD_CUP_TAG_IDS.join(", ")})...`);
  const markets = await fetchAllWorldCupMarkets(WORLD_CUP_TAG_IDS, {
    onProgress: (msg) => process.stdout.write(`\r  ${msg}            `)
  });
  process.stdout.write("\n");

  const snapshot = stripPrices(buildSnapshot(markets, WORLD_CUP_TAG_IDS, generatedAt));
  const index = buildIndex(snapshot, generatedAt);
  const paths = await writeCache(OUT_DIR, snapshot, index);

  console.log(`\nCached ${snapshot.counts.total} markets (${snapshot.counts.active} active, ${snapshot.counts.closed} closed)`);
  console.log(`Subscribable clob asset_ids: ${allTokenIds(snapshot).length}`);
  console.log("\nBy category:");
  for (const [k, v] of Object.entries(snapshot.counts.byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`);
  }
  console.log("\nTop subtypes:");
  for (const [k, v] of Object.entries(snapshot.counts.bySubtype).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${k.padEnd(24)} ${v}`);
  }
  console.log(`\nWrote:\n  ${paths.snapshot}\n  ${paths.index}\n  ${paths.meta}`);
}

main().catch((err) => { console.error("\ncache-markets failed:", err); process.exitCode = 1; });
