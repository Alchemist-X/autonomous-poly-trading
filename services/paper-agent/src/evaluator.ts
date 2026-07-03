// Isolated probability evaluation. Each market is assessed by the iterative
// forecast engine (scripts/forecast/cli.ts) in a SEPARATE PROCESS whose
// prompt contains ONLY the market's question and resolution criteria —
// never our position, entry price, PnL, or the current market price. The
// harness (this file's caller) is the only place beliefs meet prices.
//
// Isolation details (adversarial review 2026-07-03):
// - Dossiers live in the paper agent's OWN namespace
//   (<artifacts>/paper-agent/engine/forecasts/...), never shared with the
//   raven app / forecast-api dossiers, so resumes can't inherit stale state
//   from other surfaces and concurrent engine runs can't clobber each other.
// - The engine's --max-rounds is a TOTAL cap; since evaluations RESUME the
//   same dossier, each cycle passes (completed rounds + evalMaxRounds) so
//   every evaluation actually researches fresh rounds instead of no-oping.
//
// Provider: DeepSeek by default; Kimi/Moonshot works through the same
// OpenAI-compatible adapter (DEEPSEEK_BASE_URL=https://api.moonshot.cn/v1 +
// FORECAST_DEEPSEEK_MODEL=<kimi model> + DEEPSEEK_API_KEY=<moonshot key>).
// The claude provider is deliberately NOT used here — evaluation runs 3×/day
// and must stay cheap.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { log } from "./log";
import type { MarketInfo } from "./polymarket";
import { paperRoot, repoRoot } from "./store";

export interface Evaluation {
  forecastId: string;
  probYes: number; // engine's P(YES) for the market question
  rounds: number;
  status: string;
  evidenceCount: number;
  unforecastable: boolean;
}

// Mirror of scripts/forecast/store.ts makeEventId (same contract as the other
// consumers of the engine).
export function makeEventId(question: string): string {
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .slice(0, 48);
  const hash = createHash("sha1").update(question).digest("hex").slice(0, 8);
  return `${slug || "event"}-${hash}`;
}

// The paper agent's private engine artifact root (isolated dossier namespace).
export function engineRoot(): string {
  return path.join(paperRoot(), "engine");
}

function stateFileFor(eventId: string): string {
  return path.join(engineRoot(), "forecasts", eventId, "state.json");
}

interface EngineState {
  currentProb?: number;
  round?: number;
  status?: string;
  evidenceLedger?: unknown[];
}

function readState(eventId: string): EngineState | null {
  const file = stateFileFor(eventId);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as EngineState;
  } catch {
    return null;
  }
}

export function evaluationQuestion(market: MarketInfo): string {
  return market.question.trim();
}

export async function evaluateMarket(market: MarketInfo, roundsPerEval: number, timeoutMs = 15 * 60_000): Promise<Evaluation> {
  const question = evaluationQuestion(market);
  const eventId = makeEventId(question);
  const root = repoRoot();

  // TOTAL-cap fix: allow `roundsPerEval` NEW rounds on top of what the
  // resumed dossier has already completed.
  const priorRounds = readState(eventId)?.round ?? 0;
  const totalRounds = priorRounds + roundsPerEval;

  const args = [path.join(root, "scripts/forecast/cli.ts"), question, "--max-rounds", String(totalRounds)];
  const resolution = market.description?.trim();
  if (resolution) args.push("--resolution", resolution.slice(0, 1500));

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    FORECAST_PROVIDER: "deepseek",
    FORECAST_MIN_ROUNDS: "1",
    ARTIFACT_STORAGE_ROOT: engineRoot()
  };
  // Backfill the key from the repo-root .env.deepseek in local dev.
  const envFile = path.join(root, ".env.deepseek");
  if (!env.DEEPSEEK_API_KEY && existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1] && !line.trim().startsWith("#") && !env[m[1]]) env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(path.join(root, "node_modules/.bin/tsx"), args, { cwd: root, env });
    const killer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`evaluation timed out after ${Math.round(timeoutMs / 60000)}min for ${eventId}`));
    }, timeoutMs);
    let tail = "";
    const onData = (b: Buffer) => {
      tail = (tail + b.toString()).slice(-2000);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (err) => {
      clearTimeout(killer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(killer);
      if (code === 0 || code === 2) resolve(code);
      else reject(new Error(`engine exited ${code} for ${eventId}: …${tail.slice(-300)}`));
    });
  });

  if (exitCode === 2) {
    // Framing judged the prompt unforecastable — surface it; the caller holds
    // and ledgers rather than trading on a number that doesn't exist.
    return { forecastId: eventId, probYes: NaN, rounds: 0, status: "unforecastable", evidenceCount: 0, unforecastable: true };
  }

  const state = readState(eventId);
  if (!state || typeof state.currentProb !== "number") throw new Error(`engine produced no probability for ${eventId}`);
  log.info(`evaluated ${market.slug} → P(YES)=${(state.currentProb * 100).toFixed(1)}% (rounds ${state.round ?? "?"}/${totalRounds})`);
  return {
    forecastId: eventId,
    probYes: state.currentProb,
    rounds: state.round ?? 0,
    status: state.status ?? "unknown",
    evidenceCount: state.evidenceLedger?.length ?? 0,
    unforecastable: false
  };
}

// P(this outcome): index 0 is the market question's YES side; the other side
// is the complement. Entry points guard that outcome labels are actually
// Yes/No so this mapping cannot silently invert on exotic label pairs.
export function probForOutcome(probYes: number, outcomeIndex: number): number {
  return outcomeIndex === 0 ? probYes : 1 - probYes;
}

export function isYesNoMarket(outcomes: string[]): boolean {
  return outcomes.length === 2 && outcomes[0]?.trim().toLowerCase() === "yes" && outcomes[1]?.trim().toLowerCase() === "no";
}
