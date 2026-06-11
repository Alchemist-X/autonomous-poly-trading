/**
 * Pre-generate cached World Cup match forecast reports from the locally cached
 * Polymarket market list. Phase 0 MVP: market 1X2 + documented heuristic only
 * (the Elo/Dixon-Coles/Monte Carlo engine arrives in Phase 1).
 *
 * Usage: pnpm tsx scripts/world-cup/generate-reports.ts [--limit N]
 * Output: runtime-artifacts/world-cup/reports/<event_slug>/report.json + index.json
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildWorldCupMatchReport, type MatchPriceInput } from "../../apps/web/lib/world-cup/build-report";
import { toSummary } from "../../apps/web/lib/world-cup/types";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GAMES_CSV = path.join(REPO_ROOT, "runtime-artifacts/world-cup-market-list/latest/games.csv");
const OUT_DIR = path.join(REPO_ROOT, "runtime-artifacts/world-cup/reports");

// Minimal RFC-4180-ish CSV line parser (handles double-quoted fields with commas).
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

interface GameRow {
  subtype: string;
  event_slug: string;
  event_title: string;
  group_item: string;
  yes_price: string;
  end_date: string;
  event_date: string;
  url: string;
}

function stageForDate(eventDate: string): string {
  // Group stage runs 6/11–6/27; everything later is knockout for MVP labelling.
  return eventDate <= "2026-06-27" ? "小组赛" : "淘汰赛";
}

async function main(): Promise<void> {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const csv = await fs.readFile(GAMES_CSV, "utf8");
  const lines = csv.split("\n").filter((line) => line.trim().length > 0);
  const header = parseCsvLine(lines[0]);
  const col = (name: string): number => header.indexOf(name);

  const rows: GameRow[] = lines.slice(1).map((line) => {
    const f = parseCsvLine(line);
    return {
      subtype: f[col("subtype")],
      event_slug: f[col("event_slug")],
      event_title: f[col("event_title")],
      group_item: f[col("group_item")],
      yes_price: f[col("yes_price")],
      end_date: f[col("end_date")],
      event_date: f[col("event_date")],
      url: f[col("url")]
    };
  });

  // Group moneyline rows by event.
  const byEvent = new Map<string, GameRow[]>();
  for (const row of rows) {
    if (row.subtype !== "match_moneyline") continue;
    const list = byEvent.get(row.event_slug) ?? [];
    byEvent.set(row.event_slug, [...list, row]);
  }

  const generatedAtUtc = new Date().toISOString();
  const inputs: MatchPriceInput[] = [];

  for (const [eventSlug, group] of byEvent) {
    const title = group[0]?.event_title ?? "";
    const [homeTeam, awayTeam] = title.split(" vs. ").map((part) => part.trim());
    if (!homeTeam || !awayTeam) continue;
    const homeRow = group.find((r) => r.group_item === homeTeam);
    const awayRow = group.find((r) => r.group_item === awayTeam);
    const drawRow = group.find((r) => r.group_item.startsWith("Draw"));
    if (!homeRow || !awayRow || !drawRow) continue;

    inputs.push({
      matchId: eventSlug,
      homeTeam,
      awayTeam,
      stage: stageForDate(group[0].event_date),
      kickoffUtc: group[0].end_date || null,
      polymarketUrl: group[0].url,
      homeYesPrice: Number(homeRow.yes_price),
      drawYesPrice: Number(drawRow.yes_price),
      awayYesPrice: Number(awayRow.yes_price)
    });
  }

  inputs.sort((a, b) => (a.kickoffUtc ?? "").localeCompare(b.kickoffUtc ?? ""));
  const selected = inputs.slice(0, Number.isFinite(limit) ? limit : inputs.length);

  await fs.mkdir(OUT_DIR, { recursive: true });
  const summaries = [];
  for (const input of selected) {
    const report = buildWorldCupMatchReport(input, generatedAtUtc);
    const dir = path.join(OUT_DIR, input.matchId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    summaries.push(toSummary(report));
  }

  await fs.writeFile(
    path.join(OUT_DIR, "index.json"),
    `${JSON.stringify({ generatedAtUtc, count: summaries.length, matches: summaries }, null, 2)}\n`,
    "utf8"
  );

  console.log(`OK Generated ${summaries.length} World Cup forecast reports → ${OUT_DIR}`);
}

main().catch((error) => {
  console.error("generate-reports failed:", error);
  process.exitCode = 1;
});
