/**
 * Rebuild apps/web/lib/world-cup/generated/performance.generated.json from the
 * forecasts + settled results + captured prediction-time prices. Pure/no-network,
 * so it runs on every daily results refresh (chained after wc:results) to keep the
 * 预测效果 / performance page current as fixtures settle.
 *
 *   pnpm tsx scripts/world-cup/build-performance.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computePerformance, type BaselinePrice, type PerfFixture, type PerfResult } from "./lib/performance.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GEN_DIR = path.join(REPO_ROOT, "apps/web/lib/world-cup/generated");

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(GEN_DIR, name), "utf8")) as T;
}

async function main(): Promise<void> {
  const predictions = await readJson<{ entries: Array<PerfFixture & { family: string }> }>("predictions.generated.json");
  const results = (await readJson<{ results: Record<string, PerfResult> }>("results.generated.json")).results;
  const baseline = (await readJson<{ prices: Record<string, BaselinePrice | null> }>("baseline-prices.generated.json")).prices;

  const fixtures = predictions.entries.filter((e) => e.family === "group_match");
  const perf = computePerformance(fixtures, results, baseline);

  const out = path.join(GEN_DIR, "performance.generated.json");
  await mkdir(GEN_DIR, { recursive: true });
  await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), ...perf }, null, 1));

  const a = perf.agg;
  console.log(
    `\x1b[32mOK\x1b[0m    performance: settled=${a.settled} · bestPick=${a.bestPickHit}/${a.settled} (${a.bestPickPct}%) · ` +
      `mockPNL=${a.roiPct >= 0 ? "+" : ""}${a.roiPct}% · brierSkill=${a.bssPct >= 0 ? "+" : ""}${a.bssPct}% · ECE=${a.ecePct}%`
  );
  console.log(`\x1b[32mOK\x1b[0m    data: ${out}`);
}

main().catch((err) => {
  console.error("build-performance failed:", err);
  process.exitCode = 1;
});
