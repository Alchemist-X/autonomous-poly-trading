/**
 * Import finished market-blind forecasts into the web app.
 *
 * Scans runtime-artifacts/world-cup/reports/<dir>/prediction.json (unified
 * schema), validates, and emits two generated files for apps/web:
 *   apps/web/lib/world-cup/generated/predictions.generated.json  — card data
 *   apps/web/lib/world-cup/generated/reports.generated.json      — id -> {mdCn, mdEn}
 *
 * The web app statically imports both (SSG; no runtime fs, no backend).
 * Re-run whenever new forecasts land: pnpm tsx scripts/world-cup/import-predictions.ts
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "runtime-artifacts/world-cup/reports");
const OUT_DIR = path.join(REPO_ROOT, "apps/web/lib/world-cup/generated");

const FAMILIES = ["group_match", "group_winner", "reach_quarterfinal", "reach_semifinal", "champion"] as const;
type Family = (typeof FAMILIES)[number];

interface Outcome {
  key: string;
  label_cn: string;
  label_en: string;
  p: number;
}

interface KeyReason {
  cn: string;
  en: string;
  source_url: string;
  source_date: string;
}

export interface ForecastEntry {
  id: string;
  family: Family;
  event_slug: string;
  question_cn: string;
  question_en: string;
  kickoff_utc: string | null;
  generated_at: string;
  outcomes: Outcome[];
  one_liner_cn: string;
  one_liner_en: string;
  key_reasons: KeyReason[];
  confidence_tier: string;
  n_sources: number;
  method_note: string;
  dir: string;
}

function validate(raw: Record<string, unknown>, dir: string): string[] {
  const problems: string[] = [];
  if (typeof raw.id !== "string") problems.push("missing id");
  if (!FAMILIES.includes(raw.family as Family)) problems.push(`bad family: ${String(raw.family)}`);
  const outcomes = raw.outcomes as Outcome[] | undefined;
  if (!Array.isArray(outcomes) || outcomes.length < 2) {
    problems.push("outcomes missing");
  } else {
    const sum = outcomes.reduce((n, o) => n + (typeof o.p === "number" ? o.p : NaN), 0);
    const expected = raw.family === "reach_quarterfinal" ? 8 : raw.family === "reach_semifinal" ? 4 : 1;
    if (!(Math.abs(sum - expected) < 0.06)) problems.push(`outcome sum ${sum.toFixed(3)} != ${expected}`);
    if (outcomes.some((o) => /market|p_mkt/i.test(JSON.stringify(o)))) problems.push("market field leaked into outcomes");
  }
  const reasons = raw.key_reasons as KeyReason[] | undefined;
  if (!Array.isArray(reasons) || reasons.length < 2) problems.push("key_reasons < 2");
  if (typeof raw.one_liner_cn !== "string" || raw.one_liner_cn.length < 8) problems.push("one_liner_cn missing");
  return problems.map((p) => `${dir}: ${p}`);
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const dirs = (await readdir(REPORTS_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const entries: ForecastEntry[] = [];
  const reports: Record<string, { mdCn: string; mdEn: string }> = {};
  const warnings: string[] = [];

  for (const dir of dirs) {
    const base = path.join(REPORTS_DIR, dir);
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(await readFile(path.join(base, "prediction.json"), "utf8"));
    } catch {
      warnings.push(`${dir}: no parseable prediction.json — skipped`);
      continue;
    }
    const problems = validate(raw, dir);
    if (problems.length > 0) {
      warnings.push(...problems, `${dir}: skipped`);
      continue;
    }
    const [mdCn, mdEn] = await Promise.all([
      readFile(path.join(base, "report.md"), "utf8").catch(() => ""),
      readFile(path.join(base, "report.en.md"), "utf8").catch(() => "")
    ]);
    if (!mdCn) {
      warnings.push(`${dir}: report.md missing — skipped`);
      continue;
    }
    const entry: ForecastEntry = {
      id: raw.id as string,
      family: raw.family as Family,
      event_slug: (raw.event_slug as string) ?? dir,
      question_cn: (raw.question_cn as string) ?? "",
      question_en: (raw.question_en as string) ?? "",
      kickoff_utc: (raw.kickoff_utc as string | null) ?? null,
      generated_at: (raw.generated_at as string) ?? generatedAt,
      // Some writers emitted "X win"/"X胜" outcome labels; normalize to the
      // bare team name so flag/team resolution stays uniform.
      outcomes: (raw.outcomes as Outcome[]).map((o) =>
        o.key === "a" || o.key === "b"
          ? { ...o, label_en: o.label_en.replace(/\s+win$/i, ""), label_cn: o.label_cn.replace(/胜$/, "") }
          : o
      ),
      one_liner_cn: raw.one_liner_cn as string,
      one_liner_en: (raw.one_liner_en as string) ?? "",
      key_reasons: (raw.key_reasons as KeyReason[]).slice(0, 3),
      confidence_tier: (raw.confidence_tier as string) ?? "中",
      n_sources: (raw.n_sources as number) ?? 0,
      method_note: (raw.method_note as string) ?? "",
      dir
    };
    entries.push(entry);
    reports[entry.id] = { mdCn, mdEn };
  }

  const byFamily = entries.reduce<Record<string, number>>(
    (acc, e) => ({ ...acc, [e.family]: (acc[e.family] ?? 0) + 1 }),
    {}
  );

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, "predictions.generated.json"),
    JSON.stringify({ generatedAt, counts: byFamily, total: entries.length, entries }, null, 1)
  );
  await writeFile(path.join(OUT_DIR, "reports.generated.json"), JSON.stringify({ generatedAt, reports }));

  // Bracket (modal path) rides along when present so the web bracket tab
  // stays in sync with the archived prediction.
  const bracketSrc = path.join(REPO_ROOT, "runtime-artifacts/world-cup/bracket-prediction.json");
  const bracket = await readFile(bracketSrc, "utf8").catch(() => null);
  if (bracket !== null) {
    await writeFile(path.join(OUT_DIR, "bracket.generated.json"), bracket);
  }

  console.log(`OK  imported ${entries.length} forecasts ${JSON.stringify(byFamily)}`);
  if (warnings.length > 0) {
    console.log(`WARN (${warnings.length}):`);
    for (const w of warnings.slice(0, 30)) console.log(`  - ${w}`);
  }
  console.log(`Wrote:\n  ${path.join(OUT_DIR, "predictions.generated.json")}\n  ${path.join(OUT_DIR, "reports.generated.json")}`);
}

main().catch((err) => {
  console.error("import-predictions failed:", err);
  process.exitCode = 1;
});
