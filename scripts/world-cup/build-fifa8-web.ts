/**
 * Consolidate the FIFA 8-model R32 forecast archive into a single web-consumable
 * file: apps/web/lib/world-cup/generated/fifa8-r32.generated.json.
 *
 * Reads the per-fixture archive written by @autopoly/fifa-models
 * (runtime-artifacts/world-cup/fifa8-forecasts/live/<fixture>/forecasts.json) and
 * emits structured data the web renders (all 9 forecasters' a/draw/b per fixture +
 * the headline multi-calibrated view's drivers). The `generatedAt` stamp is the
 * official "prediction-completion moment" — the FIFA8 baseline-price capture reads
 * the Polymarket price at THIS timestamp (the forecasts themselves are market-blind).
 *
 *   pnpm tsx scripts/world-cup/build-fifa8-web.ts
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARCHIVE = path.join(ROOT, "runtime-artifacts/world-cup/fifa8-forecasts/live");
const GEN_DIR = path.join(ROOT, "apps/web/lib/world-cup/generated");
const OUT = path.join(GEN_DIR, "fifa8-r32.generated.json");
const STAMP = path.join(ARCHIVE, "generated-at.txt"); // reuse a fixed stamp across re-runs

const C = {
  info: (m: string) => console.log(`\x1b[36mINFO\x1b[0m  ${m}`),
  ok: (m: string) => console.log(`\x1b[32mOK\x1b[0m    ${m}`),
};

interface ArchivedForecaster {
  readonly id: string;
  readonly name: string;
  readonly family: string;
  readonly probs: { home: number; draw: number; away: number };
  readonly headline: string;
  readonly drivers: ReadonlyArray<{ label: string; detail: string; contributionPp: number }>;
  readonly methodNote: string;
}
interface ArchivedFixture {
  readonly fixtureId: string;
  readonly teamA: string;
  readonly teamB: string;
  readonly headlineForecaster: string;
  readonly forecasters: readonly ArchivedForecaster[];
}

const tier = (p: number): "high" | "medium" | "low" =>
  p >= 0.6 ? "high" : p >= 0.45 ? "medium" : "low";

/** Reuse a committed timestamp if present, else stamp now (the prediction moment). */
async function stableStamp(): Promise<string> {
  try {
    return (await readFile(STAMP, "utf8")).trim();
  } catch {
    const now = new Date().toISOString();
    await writeFile(STAMP, `${now}\n`);
    return now;
  }
}

async function main(): Promise<void> {
  const generatedAt = await stableStamp();
  // Curated per-team FIFA-stat cards (the evidence the detail page renders).
  const teamStats = JSON.parse(
    await readFile(path.join(ARCHIVE, "team-stats.json"), "utf8"),
  ) as Record<string, unknown>;
  // Fixture dirs are slug-named (fifwc-<a>-<b>-<date>); exclude the rollup dir.
  const dateOf = (dir: string): string => (dir.match(/(\d{4}-\d{2}-\d{2})/) ?? [])[1] ?? "";
  const dirs = (await readdir(ARCHIVE, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name.startsWith("fifwc-") && d.name !== "by-forecaster")
    .map((d) => d.name)
    .sort((a, b) => `${dateOf(a)}|${a}`.localeCompare(`${dateOf(b)}|${b}`));

  const fixtures = [];
  let meta: Array<{ id: string; name: string; family: string }> = [];
  let seq = 0;
  for (const dir of dirs) {
    seq += 1;
    const ff = JSON.parse(await readFile(path.join(ARCHIVE, dir, "forecasts.json"), "utf8")) as ArchivedFixture;
    if (meta.length === 0) meta = ff.forecasters.map((f) => ({ id: f.id, name: f.name, family: f.family }));
    const headline = ff.forecasters.find((f) => f.id === ff.headlineForecaster) ?? ff.forecasters[0]!;
    const h = headline.probs;
    const pickKey = h.home >= h.draw && h.home >= h.away ? "a" : h.away >= h.draw ? "b" : "draw";
    const pickPct = Math.round(Math.max(h.home, h.draw, h.away) * 100);
    fixtures.push({
      fixtureId: ff.fixtureId,
      matchNo: seq,
      date: dateOf(dir),
      stage: "R32",
      teamA: ff.teamA,
      teamB: ff.teamB,
      statsA: teamStats[ff.teamA] ?? null,
      statsB: teamStats[ff.teamB] ?? null,
      headline: {
        forecaster: headline.id,
        pick: pickKey,
        pickPct,
        tier: tier(Math.max(h.home, h.draw, h.away)),
        a: round(h.home),
        draw: round(h.draw),
        b: round(h.away),
        drivers: headline.drivers,
        methodNote: headline.methodNote,
      },
      // Every forecaster's full rationale (not just probs) so the detail page can
      // show how each model reasoned, and which it agreed/disagreed with.
      forecasters: ff.forecasters.map((f) => ({
        id: f.id,
        name: f.name,
        family: f.family,
        a: round(f.probs.home),
        draw: round(f.probs.draw),
        b: round(f.probs.away),
        headline: f.headline,
        drivers: f.drivers,
        methodNote: f.methodNote,
      })),
    });
  }

  await mkdir(GEN_DIR, { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      { generatedAt, headlineForecaster: "multicalibrated", marketBlind: true, forecasterMeta: meta, fixtures },
      null,
      1,
    ),
  );
  C.ok(`fifa8-r32: ${fixtures.length} fixtures · ${meta.length} forecasters · generatedAt=${generatedAt}`);
  C.ok(`data: ${OUT}`);
}

const round = (x: number): number => Math.round(x * 1000) / 1000;

main().catch((err) => {
  console.error("build-fifa8-web failed:", err);
  process.exitCode = 1;
});
