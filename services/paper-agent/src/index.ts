// Long-lived scheduler: three evaluation cycles a day at configured UTC
// times, a fast tick (stop-loss sweep + resting-limit fills + resolutions) in
// between, and a daily reflection report after the last cycle.
//
// All portfolio work is serialized through ONE async queue — cycles, ticks
// and reflections can never interleave loads/saves (last-save-wins was a
// confirmed review finding).
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
log.info(`exit: net-edge < ${cfg.exitEdgePp}pp or stop-loss ${cfg.stopLossPct * 100}% · hybrid ${cfg.hybridMarketRatio * 100}% market / ${(1 - cfg.hybridMarketRatio) * 100}% limit (TTL ${cfg.limitTtlHours}h; stop-loss = 100% market)`);
log.info(`watchlist: ${cfg.watchlistPath ?? "(none — evaluation-only book)"}`);

// Single-writer queue: everything that touches the portfolio goes through
// here, in order. `pending` flags collapse repeat triggers instead of
// queueing an unbounded backlog during a long cycle.
let queue: Promise<void> = Promise.resolve();
const pending = { cycle: false, tick: false, reflect: false };

function enqueue(kind: keyof typeof pending, job: () => Promise<void>): void {
  if (pending[kind]) return;
  pending[kind] = true;
  queue = queue
    .then(async () => {
      pending[kind] = false;
      await job();
    })
    .catch((error) => {
      pending[kind] = false;
      log.error(`${kind} failed: ${error instanceof Error ? error.message : String(error)}`);
    });
}

const firedMinutes = new Set<string>();
const lastEvalTime = cfg.evalTimesUtc[cfg.evalTimesUtc.length - 1];

function onMinute(): void {
  const now = new Date();
  const hhmm = now.toISOString().slice(11, 16);
  const key = now.toISOString().slice(0, 10) + " " + hhmm;
  if (!cfg.evalTimesUtc.includes(hhmm) || firedMinutes.has(key)) return;
  // Prune BEFORE adding, so the just-added key is never wiped (review fix).
  if (firedMinutes.size > 100) firedMinutes.clear();
  firedMinutes.add(key);
  log.info(`=== evaluation cycle trigger ${hhmm} UTC ===`);
  enqueue("cycle", () => runEvaluationCycle(cfg));
  // Reflection is queued independently: even if the cycle throws or the
  // trigger overlaps a running job, the daily report still lands.
  if (hhmm === lastEvalTime) {
    enqueue("reflect", async () => {
      await writeReflectionReport();
    });
  }
}

setInterval(onMinute, 20_000);
setInterval(() => enqueue("tick", () => runFillTick(cfg)), cfg.fillCheckMinutes * 60_000);
log.info("scheduler armed (single-writer queue)");
