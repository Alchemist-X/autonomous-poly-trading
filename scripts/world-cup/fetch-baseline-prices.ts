/**
 * One-shot capture of the Polymarket prediction-time prices for every group-stage
 * fixture, written to apps/web/lib/world-cup/generated/baseline-prices.generated.json.
 *
 * These prices are FIXED history (the market's implied win/draw/loss at the exact
 * minute our forecast was generated), so they are captured ONCE and committed; the
 * daily performance build (build-performance.ts) reads this file with no network.
 *
 * Policy note: the public forecasts remain market-blind — they never consulted a
 * price. This file exists only to BENCHMARK those blind forecasts after the fact
 * (the "预测效果 / performance" page: Mock PNL, Brier skill vs market, calibration).
 * Each fixture's prices are read at its forecast `generated_at` from the Polymarket
 * CLOB price history; legs are mapped to home(a)/away(b) by team name, not position.
 *
 *   pnpm tsx scripts/world-cup/fetch-baseline-prices.ts
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GEN_DIR = path.join(REPO_ROOT, "apps/web/lib/world-cup/generated");
const PREDICTIONS = path.join(GEN_DIR, "predictions.generated.json");
const OUT = path.join(GEN_DIR, "baseline-prices.generated.json");

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

const C = {
  info: (m: string) => console.log(`\x1b[36mINFO\x1b[0m  ${m}`),
  ok: (m: string) => console.log(`\x1b[32mOK\x1b[0m    ${m}`),
  warn: (m: string) => console.log(`\x1b[33mWARN\x1b[0m  ${m}`)
};

interface Outcome {
  readonly key: string;
  readonly label_en: string;
}
interface Forecast {
  readonly family: string;
  readonly event_slug: string;
  readonly generated_at: string;
  readonly outcomes: readonly Outcome[];
}
export interface BaselinePrice {
  readonly a: number;
  readonly draw: number;
  readonly b: number;
}

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function sim(title: string, name: string): number {
  const a = norm(title), b = norm(name);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  return [...a].filter((c) => b.includes(c)).length / Math.max(a.length, b.length);
}

// Read the prediction-time yes-price per outcome {a,draw,b} for one fixture.
async function priceFor(slug: string, tsISO: string, homeEn: string, awayEn: string): Promise<BaselinePrice> {
  const ts = Math.floor(new Date(tsISO).getTime() / 1000);
  const events = (await fetchJson(`${GAMMA}/events?slug=${encodeURIComponent(slug)}`)) as Array<{ markets?: Array<{ groupItemTitle?: string; question?: string; clobTokenIds: string }> }>;
  const ev = events[0];
  if (!ev?.markets?.length) throw new Error("no event/markets");
  const team: Array<{ title: string; p: number }> = [];
  let draw = NaN;
  for (const m of ev.markets) {
    const title = m.groupItemTitle ?? m.question ?? "";
    const token = JSON.parse(m.clobTokenIds)[0] as string;
    const hist = ((await fetchJson(`${CLOB}/prices-history?market=${token}&startTs=${ts - 7200}&endTs=${ts + 7200}&fidelity=10`)) as { history?: Array<{ t: number; p: number }> }).history ?? [];
    if (!hist.length) throw new Error(`no price history (${title})`);
    let best = hist[0];
    for (const pt of hist) if (Math.abs(pt.t - ts) < Math.abs(best.t - ts)) best = pt;
    if (/^draw\b/i.test(title) || /end in a draw/i.test(m.question ?? "")) draw = best.p;
    else team.push({ title, p: best.p });
  }
  if (team.length !== 2 || Number.isNaN(draw)) throw new Error("unexpected market shape");
  const [l1, l2] = team;
  const direct = sim(l1.title, homeEn) + sim(l2.title, awayEn);
  const swap = sim(l1.title, awayEn) + sim(l2.title, homeEn);
  const [a, b] = direct >= swap ? [l1.p, l2.p] : [l2.p, l1.p];
  return { a, draw, b };
}

async function main(): Promise<void> {
  const data = JSON.parse(await readFile(PREDICTIONS, "utf8")) as { entries: Forecast[] };
  const fixtures = data.entries.filter((e) => e.family === "group_match");
  C.info(`capturing prediction-time prices for ${fixtures.length} group fixtures …`);

  const prices: Record<string, BaselinePrice | null> = {};
  const failed: string[] = [];
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < fixtures.length) {
      const f = fixtures[cursor++];
      const home = f.outcomes.find((o) => o.key === "a")?.label_en ?? "";
      const away = f.outcomes.find((o) => o.key === "b")?.label_en ?? "";
      try {
        prices[f.event_slug] = await priceFor(f.event_slug, f.generated_at, home, away);
      } catch (err) {
        prices[f.event_slug] = null;
        failed.push(f.event_slug);
        C.warn(`  ${f.event_slug}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  const captured = Object.values(prices).filter(Boolean).length;
  await mkdir(GEN_DIR, { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "polymarket-clob-price-history",
        note: "Market's implied win/draw/loss at each fixture's forecast time. Post-hoc benchmark only — the forecasts themselves are market-blind.",
        prices
      },
      null,
      1
    )
  );
  C.ok(`captured ${captured}/${fixtures.length} (${failed.length} failed)`);
  C.ok(`data: ${OUT}`);
}

main().catch((err) => {
  console.error("fetch-baseline-prices failed:", err);
  process.exitCode = 1;
});
