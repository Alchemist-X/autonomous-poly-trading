// Live smoke test for the data layer (run: pnpm tsx src/smoke.ts).
// Hits the REAL The Information feed and the REAL Hyperliquid info API,
// exercises the archive round-trip and the β/excess/ATR math end to end.
// Read-only against both endpoints; safe to run any time.

import { pollFeed } from "./feed.js";
import { fetchAssetCtxs, fetchCandles } from "./hyperliquid.js";
import { archivedDayCount, read1mRange, upsert1m } from "./market.js";
import { candlesDaily, computeAtr, computeBeta, computeDailyVolPct, computeExcessMove, computeMaxDailyMovePct, sessionBucketOf } from "./m0.js";

async function main(): Promise<void> {
  console.log("== feed poll (real) ==");
  const poll = await pollFeed();
  console.log(`notModified=${poll.notModified} newItems=${poll.newItems.length}`);
  for (const item of poll.newItems.slice(0, 5)) {
    console.log(` - [${item.kind}/${item.prefix}] ${item.publishedUtc} ${item.title.slice(0, 90)}`);
  }

  console.log("== hyperliquid ctxs (real) ==");
  const ctxs = await fetchAssetCtxs();
  console.log(`assets=${ctxs.size}`);
  for (const coin of ["xyz:AAPL", "xyz:NVDA", "xyz:SPCX", "xyz:XYZ100"]) {
    const c = ctxs.get(coin);
    console.log(` - ${coin}: mark=${c?.markPx} oracle=${c?.oraclePx} funding=${c?.funding} vol24h=$${((c?.dayNtlVlm ?? 0) / 1e6).toFixed(1)}M`);
  }

  console.log("== 1m candles + archive round-trip ==");
  const now = Date.now();
  const candles = await fetchCandles("xyz:AAPL", "1m", now - 60 * 60_000, now);
  console.log(`fetched 1m candles: ${candles.length} (last close=${candles.at(-1)?.c})`);
  const written = upsert1m("xyz:AAPL", candles);
  const back = read1mRange("xyz:AAPL", now - 60 * 60_000, now);
  console.log(`archive upserted=${written} readBack=${back.length} days=${archivedDayCount("xyz:AAPL")}`);

  console.log("== beta (RTH-aligned 1h) / vol / ATR ==");
  const from1h = now - 200 * 86_400_000;
  const [aapl1h, bench1h] = await Promise.all([
    fetchCandles("xyz:AAPL", "1h", from1h, now),
    fetchCandles("xyz:XYZ100", "1h", from1h, now)
  ]);
  console.log(`1h bars: AAPL=${aapl1h.length} XYZ100=${bench1h.length}`);
  const beta = computeBeta(aapl1h, bench1h);
  console.log(`beta=${beta.beta.toFixed(3)} corr=${beta.corr.toFixed(3)} n=${beta.n} quality=${beta.quality}`);
  const aapl = await candlesDaily("xyz:AAPL");
  console.log(`atr20d=${computeAtr(aapl)?.toFixed(2)} dailyVol=${((computeDailyVolPct(aapl) ?? 0) * 100).toFixed(2)}% maxDailyMove=${(computeMaxDailyMovePct(aapl) * 100).toFixed(1)}%`);

  const t0 = now - 2 * 3600_000;
  const excess = computeExcessMove(
    await fetchCandles("xyz:AAPL", "1m", t0 - 15 * 60_000, now),
    await fetchCandles("xyz:XYZ100", "1m", t0 - 15 * 60_000, now),
    beta.beta,
    t0,
    now
  );
  console.log(`excess move (last 2h, ${sessionBucketOf(now)}): ${excess === null ? "null" : (excess * 100).toFixed(3) + "%"}`);
  console.log("SMOKE OK");
}

main().catch((error) => {
  console.error("SMOKE FAILED:", error);
  process.exit(1);
});
