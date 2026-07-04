// Resolution backfill + calibration scoring for the pulse calibration ledger.
//
// Every live/recommend run appends decisions to
// runtime-artifacts/evaluation/pulse-calibration-ledger.jsonl with
// outcome.status="pending" — but nothing ever resolved them, so the system has
// never scored a single one of its own forecasts. This script closes that
// feedback loop:
//   1. read the global ledger, collect pending market slugs
//   2. look each up on Gamma (two-step open/closed lookup via the paper-agent's
//      hardened read-only client) and detect terminal resolution
//   3. write outcomes back (atomic rewrite) and compute Brier / calibration /
//      market-relative skill, archived as a report the next session can read
//
// Read-only on the network; writes only under runtime-artifacts/evaluation/.
//
// Usage:
//   pnpm forecast:score              # backfill + score + write report
//   pnpm forecast:score -- --dry-run # report only, never rewrites the ledger
//   pnpm forecast:score -- --json    # machine-readable summary on stdout

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fetchMarket, type MarketInfo } from "../services/paper-agent/src/polymarket.ts";

export interface LedgerOutcome {
  status: "pending" | "resolved" | "voided";
  resolvedAtUtc: string | null;
  winningOutcome: string | null;
  realizedPnlUsd: number | null;
}

// Loose row shape: the ledger is an append-only external file, so parse
// defensively and preserve unknown fields verbatim on rewrite.
export interface LedgerRow {
  decisionKey?: string;
  decision?: {
    action?: string;
    marketSlug?: string;
    outcomeLabel?: string | null;
    aiProb?: number;
    marketProb?: number;
    edge?: number;
    confidence?: string;
  };
  execution?: {
    status?: string;
    filledNotionalUsd?: number | null;
    avgPrice?: number | null;
  };
  outcome?: Partial<LedgerOutcome>;
  [key: string]: unknown;
}

export function parseLedgerLines(text: string): { rows: LedgerRow[]; badLines: number } {
  const rows: LedgerRow[] = [];
  let badLines = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) rows.push(parsed as LedgerRow);
      else badLines++;
    } catch {
      badLines++;
    }
  }
  return { rows, badLines };
}

// Realized PnL is only well-defined for a filled BUY of a resolved outcome:
// shares pay $1 each on a win, $0 on a loss (voided markets refund at $0.50,
// left null here rather than guessed). Everything else stays null.
export function computeRealizedPnlUsd(row: LedgerRow, winningOutcome: string | null): number | null {
  const filled = row.execution?.filledNotionalUsd;
  const avgPrice = row.execution?.avgPrice;
  const held = row.decision?.outcomeLabel;
  if (winningOutcome == null || filled == null || avgPrice == null || !held) return null;
  if (!(filled > 0) || !(avgPrice > 0)) return null;
  const shares = filled / avgPrice;
  return Number((held === winningOutcome ? shares - filled : -filled).toFixed(4));
}

// Immutably fill a pending row's outcome from a terminal Gamma resolution.
// Non-terminal states (open / awaiting UMA) leave the row untouched.
export function applyResolution(
  row: LedgerRow,
  market: Pick<MarketInfo, "resolution" | "resolvedOutcomeIndex" | "outcomes" | "endDateIso">,
  nowUtc: string
): { row: LedgerRow; changed: boolean } {
  if ((row.outcome?.status ?? "pending") !== "pending") return { row, changed: false };
  if (market.resolution === "resolved" && market.resolvedOutcomeIndex != null) {
    const winningOutcome = market.outcomes[market.resolvedOutcomeIndex] ?? null;
    return {
      row: {
        ...row,
        outcome: {
          status: "resolved",
          resolvedAtUtc: market.endDateIso ?? nowUtc,
          winningOutcome,
          realizedPnlUsd: computeRealizedPnlUsd(row, winningOutcome)
        }
      },
      changed: true
    };
  }
  if (market.resolution === "voided") {
    return {
      row: {
        ...row,
        outcome: { status: "voided", resolvedAtUtc: market.endDateIso ?? nowUtc, winningOutcome: null, realizedPnlUsd: null }
      },
      changed: true
    };
  }
  return { row, changed: false };
}

export interface CalibrationBucket {
  range: string; // e.g. "60-70%"
  count: number;
  meanForecast: number; // average stated P(chosen outcome)
  hitRate: number; // share that actually resolved to the chosen outcome
}

export interface CalibrationStats {
  totalRows: number;
  resolvedScored: number; // rows with a terminal outcome AND a usable probability
  pendingRows: number;
  aiBrier: number | null; // mean (aiProb - won)^2 — lower is better
  marketBrier: number | null; // same for the market price at decision time
  skillVsMarket: number | null; // marketBrier - aiBrier; positive = beat the market
  realizedPnlUsd: number; // sum over filled resolved rows
  buckets: CalibrationBucket[];
  byAction: Array<{ action: string; count: number; aiBrier: number | null }>;
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function isProb(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 0 && x < 1;
}

export function scoreRows(rows: LedgerRow[]): CalibrationStats {
  const scored = rows.filter(
    (r) =>
      r.outcome?.status === "resolved" &&
      typeof r.outcome?.winningOutcome === "string" &&
      typeof r.decision?.outcomeLabel === "string" &&
      isProb(r.decision?.aiProb)
  );
  const won = (r: LedgerRow): number => (r.decision!.outcomeLabel === r.outcome!.winningOutcome ? 1 : 0);
  const aiSq = scored.map((r) => (r.decision!.aiProb! - won(r)) ** 2);
  const mktScored = scored.filter((r) => isProb(r.decision?.marketProb));
  const mktSq = mktScored.map((r) => (r.decision!.marketProb! - won(r)) ** 2);
  const aiBrier = mean(aiSq);
  const marketBrier = mean(mktSq);

  const bucketEdges = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0000001];
  const buckets: CalibrationBucket[] = [];
  for (let i = 0; i + 1 < bucketEdges.length; i++) {
    const inBucket = scored.filter(
      (r) => r.decision!.aiProb! >= bucketEdges[i] && r.decision!.aiProb! < bucketEdges[i + 1]
    );
    if (!inBucket.length) continue;
    buckets.push({
      range: `${Math.round(bucketEdges[i] * 100)}-${Math.round(Math.min(bucketEdges[i + 1], 1) * 100)}%`,
      count: inBucket.length,
      meanForecast: Number((mean(inBucket.map((r) => r.decision!.aiProb!)) ?? 0).toFixed(4)),
      hitRate: Number((mean(inBucket.map(won)) ?? 0).toFixed(4))
    });
  }

  const actions = [...new Set(scored.map((r) => r.decision?.action ?? "unknown"))].sort();
  const byAction = actions.map((action) => {
    const sub = scored.filter((r) => (r.decision?.action ?? "unknown") === action);
    return { action, count: sub.length, aiBrier: mean(sub.map((r) => (r.decision!.aiProb! - won(r)) ** 2)) };
  });

  const realizedPnlUsd = Number(
    rows
      .map((r) => r.outcome?.realizedPnlUsd)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      .reduce((a, b) => a + b, 0)
      .toFixed(4)
  );

  return {
    totalRows: rows.length,
    resolvedScored: scored.length,
    pendingRows: rows.filter((r) => (r.outcome?.status ?? "pending") === "pending").length,
    aiBrier,
    marketBrier,
    skillVsMarket: aiBrier != null && marketBrier != null ? marketBrier - aiBrier : null,
    realizedPnlUsd,
    buckets,
    byAction
  };
}

const fmt = (v: number | null, digits = 4): string => (v == null ? "n/a" : v.toFixed(digits));

export function renderCalibrationReport(stats: CalibrationStats, generatedAtUtc: string): string {
  const lines: string[] = [];
  lines.push("# Forecast calibration report");
  lines.push("");
  lines.push(`- Generated: ${generatedAtUtc}`);
  lines.push(`- Ledger rows: ${stats.totalRows} (scored resolved: ${stats.resolvedScored}, still pending: ${stats.pendingRows})`);
  lines.push(`- **AI Brier score**: ${fmt(stats.aiBrier)} (lower is better; 0.25 = coin flip on 50/50 calls)`);
  lines.push(`- **Market Brier score** (price at decision time): ${fmt(stats.marketBrier)}`);
  lines.push(
    `- **Skill vs market**: ${fmt(stats.skillVsMarket)} ${
      stats.skillVsMarket == null ? "" : stats.skillVsMarket > 0 ? "(beating the market)" : "(NOT beating the market)"
    }`
  );
  lines.push(`- Realized PnL over filled resolved rows: $${stats.realizedPnlUsd.toFixed(2)}`);
  lines.push("");
  if (stats.buckets.length) {
    lines.push("## Calibration by stated probability");
    lines.push("");
    lines.push("| Forecast bucket | N | Mean forecast | Actual hit rate | Gap |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const b of stats.buckets) {
      const gap = b.hitRate - b.meanForecast;
      lines.push(
        `| ${b.range} | ${b.count} | ${(b.meanForecast * 100).toFixed(1)}% | ${(b.hitRate * 100).toFixed(1)}% | ${
          gap >= 0 ? "+" : ""
        }${(gap * 100).toFixed(1)}pp |`
      );
    }
    lines.push("");
    lines.push("_Positive gap = underconfident in that bucket; negative = overconfident._");
    lines.push("");
  }
  if (stats.byAction.length) {
    lines.push("## By decision action");
    lines.push("");
    lines.push("| Action | N | AI Brier |");
    lines.push("| --- | --- | --- |");
    for (const a of stats.byAction) lines.push(`| ${a.action} | ${a.count} | ${fmt(a.aiBrier)} |`);
    lines.push("");
  }
  lines.push("_Source: runtime-artifacts/evaluation/pulse-calibration-ledger.jsonl (backfilled from Gamma resolutions)._");
  return lines.join("\n");
}

// ---- CLI entry ----

function artifactRoot(): string {
  return process.env.ARTIFACT_STORAGE_ROOT ?? path.join(process.cwd(), "runtime-artifacts");
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const asJson = args.has("--json");
  const nowUtc = new Date().toISOString();
  const ledgerPath = path.join(artifactRoot(), "evaluation", "pulse-calibration-ledger.jsonl");

  if (!existsSync(ledgerPath)) {
    console.error(`ERR  ledger not found: ${ledgerPath}`);
    process.exitCode = 1;
    return;
  }
  const { rows, badLines } = parseLedgerLines(readFileSync(ledgerPath, "utf8"));
  if (badLines) console.warn(`WARN ${badLines} malformed ledger line(s) skipped (preserved on rewrite is NOT possible for them)`);
  console.log(`INFO mode=${dryRun ? "dry-run" : "backfill"} | ledger rows: ${rows.length} | ${ledgerPath}`);

  const pendingSlugs = [
    ...new Set(
      rows
        .filter((r) => (r.outcome?.status ?? "pending") === "pending")
        .map((r) => r.decision?.marketSlug)
        .filter((s): s is string => typeof s === "string" && s.length > 0)
    )
  ];
  console.log(`INFO pending market slugs to check on Gamma: ${pendingSlugs.length}`);

  const markets = new Map<string, MarketInfo>();
  for (const slug of pendingSlugs) {
    try {
      const market = await fetchMarket(slug);
      markets.set(slug, market);
      console.log(`INFO  ${slug}: ${market.resolution}${market.resolvedOutcomeIndex != null ? ` → ${market.outcomes[market.resolvedOutcomeIndex]}` : ""}`);
    } catch (error) {
      console.warn(`WARN  ${slug}: lookup failed (${error instanceof Error ? error.message : String(error)}) — kept pending`);
    }
  }

  let changed = 0;
  const updated = rows.map((row) => {
    const slug = row.decision?.marketSlug;
    const market = slug ? markets.get(slug) : undefined;
    if (!market) return row;
    const res = applyResolution(row, market, nowUtc);
    if (res.changed) changed++;
    return res.row;
  });
  console.log(`INFO newly resolved/voided rows: ${changed}`);

  const stats = scoreRows(updated);
  const evalDir = path.join(artifactRoot(), "evaluation");
  const reportPath = path.join(evalDir, "calibration-report.md");
  const summaryPath = path.join(evalDir, "calibration-summary.json");

  if (!dryRun) {
    await mkdir(evalDir, { recursive: true });
    if (changed > 0) {
      // Atomic rewrite so a crash can never truncate the append-only ledger.
      const tmp = `${ledgerPath}.tmp`;
      writeFileSync(tmp, updated.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
      renameSync(tmp, ledgerPath);
      console.log(`OK   ledger rewritten with ${changed} backfilled outcome(s)`);
    }
    writeFileSync(reportPath, renderCalibrationReport(stats, nowUtc), "utf8");
    writeFileSync(summaryPath, `${JSON.stringify({ generatedAtUtc: nowUtc, ...stats }, null, 2)}\n`, "utf8");
    console.log(`OK   report:  ${reportPath}`);
    console.log(`OK   summary: ${summaryPath}`);
  }

  if (asJson) console.log(JSON.stringify({ generatedAtUtc: nowUtc, changed, ...stats }));
  else {
    console.log(
      `OK   scored ${stats.resolvedScored} resolved forecast(s) | AI Brier ${fmt(stats.aiBrier)} | market Brier ${fmt(
        stats.marketBrier
      )} | skill ${fmt(stats.skillVsMarket)} | pending ${stats.pendingRows}`
    );
  }
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(`ERR  ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
