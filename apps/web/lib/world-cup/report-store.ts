import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";
import type { WorldCupReport, WorldCupReportSummary } from "./types";
import { toSummary } from "./types";

// MVP storage: pre-generated JSON reports on disk under runtime-artifacts.
// Phase 1 swaps this for the forecast_reports Postgres table (same shape), so
// the rest of the app depends only on these functions, not the storage medium.

function candidateDirs(): string[] {
  const fromEnv = process.env.WORLD_CUP_REPORTS_DIR;
  const relative = ["runtime-artifacts/world-cup/reports", "../../runtime-artifacts/world-cup/reports", "../../../runtime-artifacts/world-cup/reports"];
  const resolved = relative.map((rel) => path.resolve(process.cwd(), rel));
  return fromEnv ? [path.resolve(fromEnv), ...resolved] : resolved;
}

async function resolveReportsDir(): Promise<string | null> {
  for (const dir of candidateDirs()) {
    try {
      const stat = await fs.stat(dir);
      if (stat.isDirectory()) return dir;
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function readReportFile(filePath: string): Promise<WorldCupReport | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as WorldCupReport;
  } catch (error) {
    console.error(`Failed to read forecast report at ${filePath}:`, error);
    return null;
  }
}

export async function getAllReports(): Promise<WorldCupReport[]> {
  const dir = await resolveReportsDir();
  if (!dir) return [];
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    console.error(`Failed to list forecast reports in ${dir}:`, error);
    return [];
  }
  const reports = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readReportFile(path.join(dir, entry.name, "report.json")))
  );
  return reports
    .filter((report): report is WorldCupReport => report !== null)
    .sort((a, b) => (a.meta.kickoffUtc ?? "").localeCompare(b.meta.kickoffUtc ?? ""));
}

export async function getReport(matchId: string): Promise<WorldCupReport | null> {
  const dir = await resolveReportsDir();
  if (!dir) return null;
  // Constrain to a slug to avoid path traversal.
  if (!/^[a-z0-9-]+$/i.test(matchId)) return null;
  return readReportFile(path.join(dir, matchId, "report.json"));
}

export async function getAllSummaries(): Promise<WorldCupReportSummary[]> {
  const reports = await getAllReports();
  return reports.map(toSummary);
}
