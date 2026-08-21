// Delta PM service entrypoint — Phase 0 SHADOW mode.
// execution mode: shadow (paper decisions only; this process contains no
// signing code and cannot place real orders). Decision source: AI + coded
// policy; risk anchors are user-decided env values (see config.ts).

import path from "node:path";
import { readFileSync } from "node:fs";
import { universeFileSchema, type UniverseEntry } from "@autopoly/delta-pm-contracts";
import { config } from "./config.js";
import { backfillFromSitemap, pollFeed } from "./feed.js";
import { marketState, sweepCandles, sweepCtxs } from "./market.js";
import { acquireBookLock, appendLedger, pmRoot, releaseBookLock, repoRoot } from "./store.js";
import { currentMarks, enqueueWriter, loadPortfolio, processNews, scheduleDailyReview, scheduleFastTick } from "./run-cycle.js";
import { equityOf } from "./policy.js";
import { runReflection } from "./reflect.js";
import { startStatusServer } from "./status-server.js";

function loadUniverse(): UniverseEntry[] {
  const file = path.join(repoRoot(), "services", "delta-pm", "config", "universe.json");
  const parsed = universeFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  return parsed.stocks;
}

async function main(): Promise<void> {
  const universe = loadUniverse();
  const benchmarks = ["XYZ100", "SP500"].map((b) => `${config.hlDex}:${b}`);
  const sweepCoins = [...universe.map((u) => u.hlSymbol), ...benchmarks];

  console.log("== Delta PM — Phase 0 shadow mode ==");
  console.log(`execution mode: shadow (paper only, no signing code) | decision source: AI + coded policy`);
  console.log(`artifacts root: ${pmRoot()}`);
  console.log(`universe: ${universe.length} names | benchmarks: ${benchmarks.join(", ")}`);
  console.log(`risk anchors (USER-DECIDED 2026-08-22): per-position hard stop −${config.hardStopAdversePct * 100}% | portfolio halt −${config.portfolioHaltLossPct * 100}%`);
  console.log(`feed: ${config.feedUrl} every ${config.feedPollSeconds}s | market: ctx ${config.ctxPollSeconds}s, 1m archive ${config.candleSweepMinutes}m`);

  if (!acquireBookLock()) {
    console.error("[ERR] another delta-pm process holds the book lock — refusing to double-run");
    process.exit(1);
  }
  process.on("exit", releaseBookLock);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  appendLedger({ type: "service_start", version: config.version, universe: universe.length, feedUrl: config.feedUrl });

  startStatusServer(universe);

  // --- market pollers ---
  if (config.marketEnabled) {
    const ctxLoop = async () => {
      try {
        await sweepCtxs();
      } catch (error) {
        marketState.lastError = error instanceof Error ? error.message : String(error);
        console.warn(`[WARN] ctx sweep failed: ${marketState.lastError}`);
      }
    };
    const candleLoop = async () => {
      try {
        const n = await sweepCandles(sweepCoins);
        marketState.lastError = null;
        console.log(`[OK] 1m archive sweep: ${n} candles across ${sweepCoins.length} coins`);
      } catch (error) {
        marketState.lastError = error instanceof Error ? error.message : String(error);
        console.warn(`[WARN] candle sweep failed: ${marketState.lastError}`);
      }
    };
    await ctxLoop();
    void candleLoop();
    setInterval(ctxLoop, config.ctxPollSeconds * 1000);
    setInterval(candleLoop, config.candleSweepMinutes * 60_000);
  }

  // --- news feed ---
  if (config.feedEnabled) {
    // Startup backfill fills poller gaps (feed window is only ~20 entries).
    try {
      const backfilled = await backfillFromSitemap();
      if (backfilled.length) console.log(`[OK] sitemap backfill queued ${backfilled.length} items`);
      for (const item of backfilled) void processNews(item, { universe });
    } catch (error) {
      console.warn(`[WARN] sitemap backfill failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const feedLoop = async () => {
      try {
        const { newItems } = await pollFeed();
        if (newItems.length) console.log(`[OK] feed: ${newItems.length} new item(s)`);
        for (const item of newItems) void processNews(item, { universe });
      } catch (error) {
        console.warn(`[WARN] feed poll failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    await feedLoop();
    setInterval(feedLoop, config.feedPollSeconds * 1000);
  }

  // --- book maintenance ---
  setInterval(() => scheduleFastTick({ universe }), config.fastTickMinutes * 60_000);
  // Daily review at the configured UTC time (checked each minute).
  let lastReviewDay = "";
  setInterval(() => {
    const now = new Date();
    const hhmm = now.toISOString().slice(11, 16);
    const day = now.toISOString().slice(0, 10);
    if (hhmm >= config.dailyReviewUtc && lastReviewDay !== day) {
      lastReviewDay = day;
      console.log("[INFO] daily position review starting");
      scheduleDailyReview({ universe });
      // Reflection runs after the review in the same slow lane: 24h signal
      // follow-ups (incl. the archived/"wrongly killed" column) + the daily
      // calibration report — the actual product of Phase 0.
      enqueueWriter(false, async () => {
        const portfolio = loadPortfolio();
        const report = await runReflection(equityOf(portfolio, currentMarks(universe)), portfolio);
        console.log(`[OK] daily reflection written: ${report}`);
      });
    }
  }, 60_000);

  console.log("[OK] delta-pm running — waiting for news");
}

main().catch((error) => {
  console.error("[ERR] fatal:", error);
  appendLedger({ type: "error", where: "main", message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
