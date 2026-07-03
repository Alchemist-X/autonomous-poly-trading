// Long-lived scheduler: three evaluation cycles a day at configured UTC
// times, a fast tick for resting-limit fills/resolutions in between, and a
// daily reflection report after the last cycle.
//
// PAPER ONLY: this process reads public market data and simulates fills. It
// has no keys, no signer, and no code path that could place a real order.

import { loadPaperConfig } from "./config";
import { log } from "./log";
import { writeReflectionReport } from "./reflect";
import { runEvaluationCycle, runFillTick } from "./run-cycle";
import { paperRoot } from "./store";

const cfg = loadPaperConfig();

log.info("paper-agent starting — mode: PAPER (simulated fills only; no real orders, ever)");
log.info(`book root: ${paperRoot()} · bankroll $${cfg.bankrollUsd} · eval times UTC: ${cfg.evalTimesUtc.join(", ")}`);
log.info(`exit: net-edge < ${cfg.exitEdgePp}pp or stop-loss ${cfg.stopLossPct * 100}% · hybrid ${cfg.hybridMarketRatio * 100}% market / ${(1 - cfg.hybridMarketRatio) * 100}% limit (TTL ${cfg.limitTtlHours}h)`);
log.info(`watchlist: ${cfg.watchlistPath ?? "(none — evaluation-only book)"}`);

let cycleRunning = false;
const ranCycleForMinute = new Set<string>();
const lastEvalTime = cfg.evalTimesUtc[cfg.evalTimesUtc.length - 1];

async function maybeRunCycle(): Promise<void> {
  const now = new Date();
  const hhmm = now.toISOString().slice(11, 16);
  const key = now.toISOString().slice(0, 10) + " " + hhmm;
  if (!cfg.evalTimesUtc.includes(hhmm) || ranCycleForMinute.has(key)) return;
  ranCycleForMinute.add(key);
  if (ranCycleForMinute.size > 100) ranCycleForMinute.clear();
  if (cycleRunning) {
    log.warn("previous cycle still running — skipping this trigger");
    return;
  }
  cycleRunning = true;
  log.info(`=== evaluation cycle ${hhmm} UTC ===`);
  try {
    await runEvaluationCycle(cfg);
    if (hhmm === lastEvalTime) await writeReflectionReport();
  } catch (error) {
    log.error(`cycle failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    cycleRunning = false;
  }
}

let tickRunning = false;
async function maybeTick(): Promise<void> {
  if (tickRunning || cycleRunning) return;
  tickRunning = true;
  try {
    await runFillTick(cfg);
  } catch (error) {
    log.error(`fill tick failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    tickRunning = false;
  }
}

setInterval(() => void maybeRunCycle(), 20_000);
setInterval(() => void maybeTick(), cfg.fillCheckMinutes * 60_000);
log.info("scheduler armed");
