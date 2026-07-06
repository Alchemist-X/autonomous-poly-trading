/**
 * Connect to Polymarket's CLOB market WebSocket and stream live order-book /
 * price-change events for the cached World Cup markets (proof the WS infra works).
 *
 *   pnpm tsx scripts/world-cup/ws-listen.ts                       # 100 active tokens, 20s
 *   pnpm tsx scripts/world-cup/ws-listen.ts --limit 400 --seconds 30
 *   pnpm tsx scripts/world-cup/ws-listen.ts --slug world-cup-winner
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSnapshot, PolymarketMarketWs, buildIndex } from "../../packages/sports-data/src/index.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(REPO_ROOT, "runtime-artifacts/world-cup/polymarket");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const snapshot = await readSnapshot(OUT_DIR);
  if (!snapshot) {
    console.error("No cache found. Run cache-markets.ts first.");
    process.exitCode = 1;
    return;
  }
  const index = buildIndex(snapshot, snapshot.generatedAt);
  const slug = arg("--slug");
  const limit = Number(arg("--limit") ?? 100);
  const seconds = Number(arg("--seconds") ?? 20);

  // Choose tokens: a specific event, else active markets first.
  let markets = snapshot.markets.filter((m) => m.active && !m.closed && m.enableOrderBook);
  if (slug) markets = snapshot.markets.filter((m) => m.eventSlug === slug);
  const assetIds = markets.flatMap((m) => m.clobTokenIds).filter(Boolean).slice(0, limit);

  if (assetIds.length === 0) {
    console.error("No subscribable asset_ids found for that selection.");
    process.exitCode = 1;
    return;
  }

  console.log(`Subscribing to ${assetIds.length} asset_ids for ${seconds}s...`);
  let events = 0;
  const client = new PolymarketMarketWs({
    assetIds,
    onStatus: (msg) => console.log(`[ws] ${msg}`),
    onEvent: (e) => {
      events += 1;
      const ref = e.asset_id ? index.byTokenId[e.asset_id] : undefined;
      const who = ref ? `${ref.marketSlug} (${ref.outcome})` : (e.asset_id ?? "?");
      const price = (e as { price?: unknown }).price ?? (e as { best_ask?: unknown }).best_ask ?? "";
      if (events <= 40) console.log(`  ${String(e.event_type ?? "?").padEnd(16)} ${who} ${price}`);
    }
  });
  console.log(`(${client.connectionCount} connection(s))`);
  client.start();

  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  client.stop();
  console.log(`\nReceived ${events} events in ${seconds}s. Stopped.`);
  process.exit(0);
}

main().catch((err) => { console.error("ws-listen failed:", err); process.exitCode = 1; });
