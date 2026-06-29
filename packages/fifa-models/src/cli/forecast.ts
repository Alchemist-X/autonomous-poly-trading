/**
 * CLI: fit the eight models on the group stage and forecast the knockout fixtures
 * with all nine forecasters, then archive every prediction for later scoring.
 *
 *   pnpm --filter @autopoly/fifa-models forecast                       # synthetic smoke run
 *   pnpm --filter @autopoly/fifa-models forecast -- --data <extractDir> --skip 73
 *
 * --data mode derives the REAL R32 bracket from the extracted group results.
 * --skip drops already-played fixtures (e.g. 73 = the resolved Canada v South Africa).
 *
 * Output (per fixture): forecasts.json (all 9, machine-readable) + report.md /
 * report.en.md (bilingual forecasting-engine writeup). Plus by-forecaster rollups,
 * standings.json, a leaderboard.json + summary.md. Nothing here consults market data.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runForecasts, type TournamentData, type OrchestratorResult } from "../orchestrator.js";
import { buildLiveTournamentData, buildActualTournamentData, type LiveTournamentData } from "../data-loader.js";
import { generateSyntheticTournament } from "../synthetic.js";
import { formatLeaderboard } from "../evaluate.js";
import {
  renderForecastsJson,
  renderReportCn,
  renderReportEn,
  type FixtureForecasts,
  type ForecasterEntry,
} from "../report.js";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const C = { info: "\x1b[36m", ok: "\x1b[32m", warn: "\x1b[33m", off: "\x1b[0m" };
const log = (lvl: keyof typeof C, msg: string): void =>
  console.log(`${C[lvl]}[${lvl.toUpperCase()}]${C.off} ${msg}`);

interface Args {
  readonly data?: string;
  readonly actualBracket?: string;
  readonly elo: string;
  readonly out: string;
  readonly seed: number;
  readonly skip: readonly string[];
}

const parseArgs = (argv: readonly string[]): Args => {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const rt = path.join(ROOT, "runtime-artifacts", "world-cup");
  const data = get("--data");
  return {
    data,
    actualBracket: get("--actual-bracket"),
    elo: get("--elo") ?? path.join(rt, "elo-table.json"),
    out: get("--out") ?? path.join(rt, "fifa8-forecasts", data ? "live" : "synthetic"),
    seed: Number(get("--seed") ?? 20260629),
    skip: (get("--skip") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  };
};

const isSkipped = (fixtureId: string, skip: readonly string[]): boolean =>
  skip.some((s) =>
    /^\d+$/.test(s) ? fixtureId.includes(`-m${s}-`) : fixtureId.toLowerCase().includes(s.toLowerCase()),
  );

/** Pivot the orchestrator's per-forecaster output into per-fixture bundles. */
const toFixtureForecasts = (result: OrchestratorResult): FixtureForecasts[] => {
  const order: { id: string; teamA: string; teamB: string }[] = [];
  const seen = new Set<string>();
  for (const f of result.forecasters) {
    for (const p of f.predictions) {
      if (!seen.has(p.fixtureId)) {
        seen.add(p.fixtureId);
        order.push({ id: p.fixtureId, teamA: p.teamA, teamB: p.teamB });
      }
    }
  }
  return order.map(({ id, teamA, teamB }) => {
    const entries: ForecasterEntry[] = [];
    for (const f of result.forecasters) {
      const pred = f.predictions.find((p) => p.fixtureId === id);
      if (pred) entries.push({ id: f.id, name: f.name, family: f.family, prediction: pred.prediction });
    }
    return { fixtureId: id, teamA, teamB, kickoffUtc: "", entries };
  });
};

interface Loaded {
  readonly data: TournamentData;
  readonly standings?: LiveTournamentData["standings"];
}

const loadData = async (args: Args): Promise<Loaded> => {
  if (args.data) {
    const statsPath = path.join(args.data, "team-match-stats.json");
    if (args.actualBracket) {
      log("info", `loading extracted data + ACTUAL R32 bracket: ${args.actualBracket}`);
      const live = await buildActualTournamentData({ statsPath, eloTablePath: args.elo, bracketFile: args.actualBracket });
      return { data: live, standings: live.standings };
    }
    log("info", `loading extracted data + deriving REAL R32 bracket: ${statsPath}`);
    const live = await buildLiveTournamentData({ statsPath, eloTablePath: args.elo });
    log("info", `qualified third-placed groups: ${live.qualifiedThirdGroups.join(", ")}`);
    return { data: live, standings: live.standings };
  }
  log("info", `no --data: generating synthetic tournament (seed ${args.seed})`);
  const t = generateSyntheticTournament({ seed: args.seed });
  return { data: { matches: t.matches, profiles: t.profiles, priors: t.priors, fixtures: t.fixtures } };
};

const main = async (): Promise<number> => {
  const started = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const { data, standings } = await loadData(args);

  const kept = data.fixtures.filter((f) => !isSkipped(f.id, args.skip));
  const dropped = data.fixtures.length - kept.length;
  if (dropped > 0) log("warn", `skipping ${dropped} already-played fixture(s): ${data.fixtures.filter((f) => isSkipped(f.id, args.skip)).map((f) => `${f.teamA} v ${f.teamB}`).join("; ")}`);
  log("info", `group matches: ${data.matches.length}  knockout fixtures to forecast: ${kept.length}`);

  log("info", "fitting 8 models + multi-calibration, forecasting fixtures...");
  const result = runForecasts({ ...data, fixtures: kept });
  if (result.skippedFixtures.length) {
    log("warn", `skipped ${result.skippedFixtures.length} fixture(s) with missing profiles: ${result.skippedFixtures.join(", ")}`);
  }

  const fixtures = toFixtureForecasts(result);
  await mkdir(args.out, { recursive: true });

  for (const ff of fixtures) {
    const dir = path.join(args.out, ff.fixtureId);
    await mkdir(dir, { recursive: true });
    await Promise.all([
      writeFile(path.join(dir, "forecasts.json"), JSON.stringify(renderForecastsJson(ff), null, 2)),
      writeFile(path.join(dir, "report.md"), renderReportCn(ff)),
      writeFile(path.join(dir, "report.en.md"), renderReportEn(ff)),
    ]);
    log("ok", `archived ${ff.fixtureId} (${ff.entries.length} forecasters)`);
  }

  const byDir = path.join(args.out, "by-forecaster");
  await mkdir(byDir, { recursive: true });
  await Promise.all(
    result.forecasters.map((f) =>
      writeFile(
        path.join(byDir, `${f.id}.json`),
        JSON.stringify({ id: f.id, name: f.name, family: f.family, predictions: f.predictions }, null, 2),
      ),
    ),
  );

  if (standings) {
    await writeFile(path.join(args.out, "standings.json"), JSON.stringify(standings, null, 2));
  }
  await writeFile(path.join(args.out, "leaderboard.json"), JSON.stringify(result.leaderboard, null, 2));
  const summary = [
    `# FIFA 8-model forecast run`,
    ``,
    `- Group matches (training): ${result.groupMatchesUsed}`,
    `- Knockout fixtures forecast: ${fixtures.length}`,
    `- Forecasters: ${result.forecasters.length} (8 models + multi-calibrated)`,
    ``,
    `> In-sample group-stage calibration below is an OPTIMISTIC sanity check (the`,
    `> ensemble & multi-calibrated views are fit on these same rows). The real`,
    `> comparison is the held-out knockout results, scored as each match resolves.`,
    ``,
    "```",
    formatLeaderboard(result.leaderboard),
    "```",
    ``,
  ].join("\n");
  await writeFile(path.join(args.out, "summary.md"), summary);

  log("ok", `\n${formatLeaderboard(result.leaderboard)}`);
  log("ok", `wrote archive -> ${args.out}`);
  log("info", `done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return 0;
};

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    log("warn", `fatal: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
