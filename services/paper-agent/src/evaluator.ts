// Isolated probability evaluation. Each market is assessed by the iterative
// forecast engine (scripts/forecast/cli.ts) in a SEPARATE PROCESS whose
// prompt contains ONLY the market's question and resolution criteria —
// never our position, entry price, PnL, or the current market price. The
// harness (this file's caller) is the only place beliefs meet prices.
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
import { repoRoot } from "./store";

export interface Evaluation {
  forecastId: string;
  probYes: number; // engine's P(YES) for the market question
  rounds: number;
  status: string;
  evidenceCount: number;
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

function forecastsRoot(): string {
  return process.env.ARTIFACT_STORAGE_ROOT
    ? path.join(process.env.ARTIFACT_STORAGE_ROOT, "forecasts")
    : path.join(repoRoot(), "runtime-artifacts", "forecasts");
}

interface EngineState {
  currentProb?: number;
  round?: number;
  status?: string;
  evidenceLedger?: unknown[];
}

// The engine question is the market question verbatim; --resolution pins the
// market's own resolution text so the frame can't drift from what settles.
export function evaluationQuestion(market: MarketInfo): string {
  return market.question.trim();
}

export async function evaluateMarket(market: MarketInfo, maxRounds: number, timeoutMs = 15 * 60_000): Promise<Evaluation> {
  const question = evaluationQuestion(market);
  const eventId = makeEventId(question);
  const root = repoRoot();
  const args = [path.join(root, "scripts/forecast/cli.ts"), question, "--max-rounds", String(maxRounds)];
  const resolution = market.description?.trim();
  if (resolution) args.push("--resolution", resolution.slice(0, 1500));

  const env: NodeJS.ProcessEnv = { ...process.env, FORECAST_PROVIDER: "deepseek", FORECAST_MIN_ROUNDS: "1" };
  // Backfill the key from the repo-root .env.deepseek in local dev.
  const envFile = path.join(root, ".env.deepseek");
  if (!env.DEEPSEEK_API_KEY && existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1] && !line.trim().startsWith("#") && !env[m[1]]) env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }

  await new Promise<void>((resolve, reject) => {
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
      // exit 0 = done; exit 2 = unforecastable — surface both; others = error.
      if (code === 0 || code === 2) resolve();
      else reject(new Error(`engine exited ${code} for ${eventId}: …${tail.slice(-300)}`));
    });
  });

  const stateFile = path.join(forecastsRoot(), eventId, "state.json");
  if (!existsSync(stateFile)) throw new Error(`engine produced no state for ${eventId} (unforecastable prompt?)`);
  const state = JSON.parse(readFileSync(stateFile, "utf8")) as EngineState;
  if (typeof state.currentProb !== "number") throw new Error(`state for ${eventId} has no probability`);
  log.info(`evaluated ${market.slug} → P(YES)=${(state.currentProb * 100).toFixed(1)}% (round ${state.round ?? "?"})`);
  return {
    forecastId: eventId,
    probYes: state.currentProb,
    rounds: state.round ?? 0,
    status: state.status ?? "unknown",
    evidenceCount: state.evidenceLedger?.length ?? 0
  };
}

// P(this outcome): YES-token holders use P(YES) directly; the other side is
// the complement. (Binary markets only in phase 1 — guarded at entry.)
export function probForOutcome(probYes: number, outcomeIndex: number): number {
  return outcomeIndex === 0 ? probYes : 1 - probYes;
}
