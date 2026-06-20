// CLI entry for the iterative binary forecaster.
//
// Usage:
//   ANTHROPIC_BASE_URL=... ANTHROPIC_API_KEY=... \
//   pnpm forecast:event -- "Will SpaceX land Starship before 2027?" \
//     --resolution "Resolves YES if an uncrewed or crewed Starship completes a controlled landing" \
//     --deadline 2026-12-31 --max-rounds 3
//
// Re-running the same question resumes the existing forecast (adds more rounds);
// pass --fresh to start over.

import { runForecast, newForecastState } from "./engine";
import { eventDir, loadState, makeEventId } from "./store";
import type { ForecastState } from "./types";

interface CliArgs {
  question: string;
  resolution: string | null;
  deadline: string | null;
  maxRounds: number | undefined;
  model: string | undefined;
  fresh: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  let resolution: string | null = null;
  let deadline: string | null = null;
  let maxRounds: number | undefined;
  let model: string | undefined;
  let fresh = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--resolution") resolution = argv[++i] ?? null;
    else if (a === "--deadline") deadline = argv[++i] ?? null;
    else if (a === "--max-rounds") maxRounds = Number(argv[++i]);
    else if (a === "--model") model = argv[++i];
    else if (a === "--question") positional.push(argv[++i] ?? "");
    else if (a === "--fresh") fresh = true;
    else if (a.startsWith("--")) {
      /* ignore unknown flags */
    } else positional.push(a);
  }
  return { question: positional.join(" ").trim(), resolution, deadline, maxRounds, model, fresh };
}

const pct = (p: number): string => `${(p * 100).toFixed(1)}%`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.question) {
    console.error('Usage: pnpm forecast:event -- "<binary yes/no question>" [--resolution ...] [--deadline ...] [--max-rounds N] [--model X] [--fresh]');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is required (also set ANTHROPIC_BASE_URL for the custom endpoint).");
    process.exit(1);
  }

  const eventId = makeEventId(args.question);
  let state: ForecastState | null = args.fresh ? null : loadState(eventId);
  if (state) {
    console.log(`↻ Resuming forecast \`${eventId}\` (already ran ${state.round} round(s), P(YES)=${pct(state.currentProb)})`);
    state.status = "open";
  } else {
    state = newForecastState({
      eventId,
      eventText: args.question,
      resolutionCriteria: args.resolution,
      deadline: args.deadline,
    });
    console.log(`✦ New forecast \`${eventId}\``);
  }

  console.log(`  Event: ${state.eventText}`);
  if (state.resolutionCriteria) console.log(`  Resolution: ${state.resolutionCriteria}`);
  console.log(`  Endpoint: ${process.env.ANTHROPIC_BASE_URL ?? "(default Anthropic)"}`);

  const final = await runForecast(state, {
    maxRounds: args.maxRounds,
    model: args.model,
    onLog: (m) => console.log(m),
  });

  const dir = eventDir(final.eventId);
  console.log("\n──────────────────────────────────────────");
  console.log(`FINAL P(YES) = ${pct(final.currentProb)}  (80% band ${pct(final.credibleInterval[0])} – ${pct(final.credibleInterval[1])})`);
  console.log(`Status: ${final.status}  ·  Rounds: ${final.round}  ·  Sources: ${final.evidenceLedger.length}`);
  const totalCost = final.roundHistory.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  if (totalCost > 0) console.log(`Total cost: $${totalCost.toFixed(3)}`);
  console.log(`\nTrace:  ${dir}/report.md`);
  console.log(`State:  ${dir}/state.json`);
}

main().catch((err) => {
  console.error(`\n✖ forecast failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
