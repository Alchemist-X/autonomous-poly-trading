// One-shot CLOB order-gate probe.
//
// Places a deliberately non-crossing GTC BUY (price far below best bid) and cancels it
// immediately if accepted. Purpose: verify the /order endpoint accepts orders from the current
// network/region (geoblock returns 403 at THIS endpoint, not at the read APIs) without risking a
// fill. Max notional is capped at $5 and the order cannot cross by construction.
//
// Usage: ENV_FILE=/abs/path/.env.pizza pnpm --filter @autopoly/executor exec tsx src/ops/order-gate-probe.ts --slug <market-slug>

import { loadConfig } from "../config.js";
import {
  fetchMarketBySlug,
  readBook,
  resolvePolymarketSigningIdentity
} from "../lib/polymarket.js";
import { cancelOrder, executeLimitOrder } from "../lib/polymarket-sdk.js";

const PROBE_PRICE = 0.01;
const PROBE_SIZE = 500; // 0.01 x 500 = $5 max notional, never crossing an ask >= 0.02

function getArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1]! : fallback;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const slug = getArg("--slug", "will-france-win-the-2026-fifa-world-cup");
  const config = loadConfig();
  const identity = await resolvePolymarketSigningIdentity(config);
  console.log(`[INFO] probe wallet signer=${identity.signerAddress} funder=${identity.funderAddress}`);

  const markets = await fetchMarketBySlug(config, slug);
  const market = Array.isArray(markets) ? markets[0] : markets;
  if (!market) throw new Error(`market not found for slug ${slug}`);
  const tokenIdsRaw = (market as Record<string, unknown>).clobTokenIds;
  const tokenIds: string[] = typeof tokenIdsRaw === "string" ? JSON.parse(tokenIdsRaw) : (tokenIdsRaw as string[]);
  const noToken = tokenIds[1];
  if (!noToken) throw new Error("no NO token on market");

  const book = await readBook(config, noToken);
  if (!book) throw new Error("could not read orderbook");
  console.log(`[INFO] ${slug} NO bestBid=${book.bestBid} bestAsk=${book.bestAsk}`);
  if (book.bestAsk <= PROBE_PRICE * 2) {
    throw new Error(`bestAsk ${book.bestAsk} too close to probe price ${PROBE_PRICE}; aborting (could cross)`);
  }

  console.log(`[INFO] placing non-crossing GTC BUY ${PROBE_SIZE} @ ${PROBE_PRICE} (max $${PROBE_PRICE * PROBE_SIZE})`);
  try {
    const result = await executeLimitOrder(config, {
      tokenId: noToken,
      price: PROBE_PRICE,
      size: PROBE_SIZE,
      side: "BUY"
    });
    const orderId = result.orderId;
    if (!result.ok && !orderId) {
      console.log(`[ERR] /order returned no orderId — gate likely CLOSED. raw=${JSON.stringify(result.rawResponse).slice(0, 400)}`);
      console.log(JSON.stringify({ gate: "closed", error: "no orderId in response", raw: result.rawResponse, elapsedMs: Date.now() - startedAt }));
      process.exitCode = 2;
      return;
    }
    console.log(`[OK] /order ACCEPTED — gate OPEN. orderId=${orderId}`);
    if (orderId) {
      const cancelled = await cancelOrder(config, orderId);
      console.log(`[OK] probe order cancelled: ${JSON.stringify(cancelled)}`);
    } else {
      console.log("[WARN] accepted but no orderId returned — check open orders manually");
    }
    console.log(JSON.stringify({ gate: "open", orderId, elapsedMs: Date.now() - startedAt }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[ERR] /order REJECTED — gate CLOSED: ${message}`);
    console.log(JSON.stringify({ gate: "closed", error: message, elapsedMs: Date.now() - startedAt }));
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`[ERR] probe failed before order step: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
