/**
 * Eval data loader. Parses football-data.co.uk season CSVs (results + odds)
 * into a normalised, chronologically-sortable match list for backtesting the
 * sports-model modules against REAL historical outcomes.
 * Data lives (gitignored) under runtime-artifacts/sports/eval/data/.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MatchResult } from "../src/types.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(HERE, "../../../runtime-artifacts/sports/eval/data");

export interface OddsTriple {
  readonly home: number;
  readonly draw: number;
  readonly away: number;
}

export interface EvalMatch {
  readonly league: string;
  readonly date: number; // epoch ms for chronological sort
  readonly home: string;
  readonly away: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly result: MatchResult;
  readonly totalGoals: number;
  /** Best available 1X2 odds (Pinnacle > Bet365 > market average), decimal. null if missing. */
  readonly odds: OddsTriple | null;
  /** Over/Under 2.5 decimal odds, null if missing. */
  readonly ou25: { readonly over: number; readonly under: number } | null;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i += 1; } else inQuotes = false;
      } else current += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { fields.push(current); current = ""; }
    else current += ch;
  }
  fields.push(current);
  return fields;
}

function parseDate(raw: string): number {
  // football-data uses dd/mm/yyyy or dd/mm/yy
  const [d, m, y] = raw.split("/");
  if (!d || !m || !y) return Number.NaN;
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  return Date.UTC(year, Number(m) - 1, Number(d));
}

function num(value: string | undefined): number {
  if (value == null || value === "") return Number.NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

function firstFiniteTriple(
  row: Record<string, string>,
  keys: ReadonlyArray<[string, string, string]>
): OddsTriple | null {
  for (const [hk, dk, ak] of keys) {
    const home = num(row[hk]);
    const draw = num(row[dk]);
    const away = num(row[ak]);
    if (Number.isFinite(home) && Number.isFinite(draw) && Number.isFinite(away) && home > 1 && away > 1) {
      return { home, draw, away };
    }
  }
  return null;
}

function rowToMatch(league: string, row: Record<string, string>): EvalMatch | null {
  const date = parseDate(row.Date ?? "");
  const home = (row.HomeTeam ?? "").trim();
  const away = (row.AwayTeam ?? "").trim();
  const hg = num(row.FTHG);
  const ag = num(row.FTAG);
  if (!home || !away || !Number.isFinite(date) || !Number.isFinite(hg) || !Number.isFinite(ag)) return null;
  const result: MatchResult = hg > ag ? "home" : hg < ag ? "away" : "draw";
  // Prefer Pinnacle (sharp), then Bet365, then market average.
  const odds = firstFiniteTriple(row, [
    ["PSH", "PSD", "PSA"],
    ["B365H", "B365D", "B365A"],
    ["AvgH", "AvgD", "AvgA"],
    ["BbAvH", "BbAvD", "BbAvA"]
  ]);
  const over = num(row["Avg>2.5"] ?? row["B365>2.5"] ?? row["BbAv>2.5"]);
  const under = num(row["Avg<2.5"] ?? row["B365<2.5"] ?? row["BbAv<2.5"]);
  const ou25 = Number.isFinite(over) && Number.isFinite(under) ? { over, under } : null;
  return { league, date, home, away, homeGoals: hg, awayGoals: ag, result, totalGoals: hg + ag, odds, ou25 };
}

export async function loadAllMatches(): Promise<EvalMatch[]> {
  const files = (await fs.readdir(DATA_DIR)).filter((f) => f.endsWith(".csv"));
  const all: EvalMatch[] = [];
  for (const file of files) {
    const league = file.replace(/\.csv$/, "");
    const text = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const header = parseCsvLine(lines[0] ?? "");
    for (let i = 1; i < lines.length; i += 1) {
      const cells = parseCsvLine(lines[i] ?? "");
      const row: Record<string, string> = {};
      header.forEach((key, idx) => { row[key] = cells[idx] ?? ""; });
      const match = rowToMatch(league, row);
      if (match) all.push(match);
    }
  }
  return all.sort((a, b) => a.date - b.date);
}
