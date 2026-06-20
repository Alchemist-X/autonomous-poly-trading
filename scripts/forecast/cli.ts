// CLI entry for the iterative binary forecaster.
//
// Usage:
//   ANTHROPIC_BASE_URL=... ANTHROPIC_API_KEY=... \
//   pnpm forecast:event -- "Will SpaceX land Starship before 2027?" \
//     [--resolution "..."] [--max-rounds 3] [--model X] [--fresh]
//
// Round 0 frames the prompt into a precise binary question (resolution criteria,
// resolution date, settlement source) before any probability is estimated; an
// ill-posed prompt is flagged for clarification instead of being forecast.
// Re-running the same prompt resumes the existing forecast (adds rounds);
// --fresh starts over. --resolution pins the resolution (the framer keeps it).

import { runForecast, newForecastState } from "./engine";
import { frameEvent } from "./framing";
import { eventDir, loadState, makeEventId } from "./store";
import type { ForecastState } from "./types";

interface CliArgs {
  question: string;
  resolution: string | null;
  maxRounds: number | undefined;
  model: string | undefined;
  fresh: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  let resolution: string | null = null;
  let maxRounds: number | undefined;
  let model: string | undefined;
  let fresh = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--resolution") resolution = argv[++i] ?? null;
    else if (a === "--max-rounds") maxRounds = Number(argv[++i]);
    else if (a === "--model") model = argv[++i];
    else if (a === "--question") positional.push(argv[++i] ?? "");
    else if (a === "--fresh") fresh = true;
    else if (a.startsWith("--")) {
      /* ignore unknown flags */
    } else positional.push(a);
  }
  return { question: positional.join(" ").trim(), resolution, maxRounds, model, fresh };
}

const pct = (p: number): string => `${(p * 100).toFixed(1)}%`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.question) {
    console.error('Usage: pnpm forecast:event -- "<event prompt>" [--resolution ...] [--max-rounds N] [--model X] [--fresh]');
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
    // Round 0 — frame the prompt before any forecasting.
    console.log(`✦ New forecast \`${eventId}\``);
    console.log(`  Prompt: ${args.question}`);
    console.log(`  Endpoint: ${process.env.ANTHROPIC_BASE_URL ?? "(default Anthropic)"}`);
    console.log(`\n▶ Round 0 — framing the question…`);
    const { framing, costUsd } = await frameEvent(args.question, {
      userResolution: args.resolution,
      model: args.model,
    });
    console.log(`  Question:   ${framing.normalizedQuestion}`);
    console.log(`  Resolution: ${framing.resolutionCriteria}`);
    if (framing.resolutionDate) console.log(`  By:         ${framing.resolutionDate}`);
    if (framing.settlementSource) console.log(`  Source:     ${framing.settlementSource}`);
    console.log(`  Prior:      ${pct(framing.priorProbability)} — ${framing.priorRationale}`);
    console.log(`  Audit:      confidence=${framing.framingConfidence}${framing.framingCaveats ? `; ${framing.framingCaveats}` : ""}`);
    if (costUsd != null) console.log(`  (framing cost $${costUsd.toFixed(3)})`);

    if (!framing.forecastable) {
      console.log(`\n■ This prompt is not forecastable as a clean binary event.`);
      console.log(`  Clarification needed: ${framing.clarificationNeeded || "(unspecified)"}`);
      console.log(`\n  Refine your prompt (or pass --resolution "...") and re-run.`);
      process.exit(2);
    }
    state = newForecastState({ eventId, eventText: args.question, framing });
  }

  const final = await runForecast(state, {
    maxRounds: args.maxRounds,
    model: args.model,
    onLog: (m) => console.log(m),
  });

  const dir = eventDir(final.eventId);
  console.log("\n──────────────────────────────────────────");
  console.log(`FINAL P(YES) = ${pct(final.currentProb)}  (80% band ${pct(final.credibleInterval[0])} – ${pct(final.credibleInterval[1])})`);
  console.log(`Status: ${final.status}  ·  Rounds: ${final.round}  ·  Sources: ${final.evidenceLedger.length}`);
  if (final.summary?.verdict) console.log(`\n${final.summary.verdict}`);
  const totalCost = final.roundHistory.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  if (totalCost > 0) console.log(`Total round cost: $${totalCost.toFixed(3)}`);
  console.log(`\nTrace:  ${dir}/report.md`);
  console.log(`State:  ${dir}/state.json`);
}

main().catch((err) => {
  console.error(`\n✖ forecast failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
