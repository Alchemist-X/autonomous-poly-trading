# 0317 Remote Deployment Handoff

中文主文件见 [handoff-0317.md](handoff-0317.md)。

Last updated: 2026-03-17

## 1. Goal of This Handoff

This document is for a remote Agent that knows nothing about this repository, the configured skills, or the current delivery status.

The goal is not more local exploration. The goal is to let that Agent do the following on a remote server:

- clone the repository and build it successfully
- get one daily Polymarket autonomous trading loop running first
- then upgrade it toward full autonomous position adjustment, monitoring, and stop-loss handling

The product request can be reduced to 3 modules:

1. `Pulse`
   - the core input source
   - looks for new recommendations
2. `Market Monitor / Portfolio Monitor`
   - checks whether the current portfolio is abnormal, still worth holding, or needs rebalancing
   - should reuse pulse reasoning as much as possible
3. `Stop Loss / Alerts`
   - watches data-source changes and position risk
   - triggers reduce / close / halt actions when needed

## 2. Bottom Line First: The Safest Remote Handoff Path

If the remote Agent needs to get something running on a server quickly, use this order:

1. deploy `pulse:live` first
   - it does not depend on local `Postgres` or `Redis`
   - it is the easiest remote closed loop today
   - it fits a daily scheduled job
2. start with `--recommend-only`
   - validate pulse, provider, artifacts, logs, and recommendation quality
   - avoid real execution first
3. remove `--recommend-only` only after that looks stable
   - then let it trade
4. if the actual goal is “automatic position adjustment + automatic stop-loss + complete portfolio monitoring”
   - do not stop at pulse-live
   - continue into the full `orchestrator + executor + Postgres + Redis` path

Reason:

- `pulse:live` is currently the easiest path to build and run remotely
- but it is not yet a full autonomous portfolio-management system
- current `pulse-direct` keeps existing positions as `hold` by default and explicitly states that no dedicated exit engine exists yet
- the real `sync portfolio + stop-loss + snapshot` logic lives in the full executor queue-worker path

So:

- if you only need “run every day and optionally open new positions from pulse”, start with `pulse:live`
- if you need “real autonomous management of existing positions”, you must continue into the full service path

## 3. Current Repository Status

Current Git baseline:

- local `HEAD` / `origin/main`: `b2e87ff`
- commit message: `fix: surface pulse-live execution mode and strategy`

The repository already has these foundations:

- the `pnpm` monorepo exists
- `apps/web`, `services/orchestrator`, `services/executor`, and `services/rough-loop` all exist
- provider runtime is wired for `codex | openclaw`
- pulse is no longer a mock fallback; it is fetched for real and archived
- one small real trade has already succeeded
- `pulse:live` already produces preflight / recommendation / execution-summary archives

Important non-goals:

- `rough-loop` is a code-task loop, not the production trading path
- its docs explicitly say it does not handle real trading, production deployment, or private-key operations by default
- do not use `rough-loop` as the main remote trading entrypoint

## 4. Verified Results

### 4.1 Baseline validation

According to [progress.en.md](progress.en.md) and the current repo state, these have already passed:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

On 2026-03-17, two additional Rough Loop regression tasks were completed:

- `RL-002`
  - `services/orchestrator/src/runtime/provider-runtime.test.ts` passed
- `RL-003`
  - `scripts/pulse-live.test.ts` now covers the `execution mode` / `decision strategy` output contract

### 4.2 Real trade result

The most clearly recorded small real trade is:

- market: `tur-kas-eyu-2026-03-15-kas`
- action: `BUY NO`
- requested notional: `$1`
- status: `matched`
- order ID: `0x4ec470917138126104a097a3fdaa506d61860e15c1dad9c2d21bbaf5678f1921`

The position was read back successfully:

- outcome: `No`
- size: `2.040815`
- average cost: `0.49`

### 4.3 Latest pulse-live remote-friendly closed loop

An archived `pulse:live` run on `2026-03-17` shows:

- runId: `8c1f79e9-37f3-4706-8009-4dd6924def96`
- archive directory:
  - `runtime-artifacts/pulse-live/2026-03-17T024012Z-8c1f79e9-37f3-4706-8009-4dd6924def96/`
- preflight:
  - `executionMode=live`
  - `collateralBalanceUsd=41.7019`
  - `remotePositionCount=12`
  - `decisionStrategy=pulse-direct`
- recommendation:
  - pulse markdown generated
  - pulse json generated
  - runtime log generated
- execution summary:
  - `executed=[]`
  - the flow completed, but no new order was actually sent in that run

This matters because:

- it proves the pulse-live loop `fetch remote portfolio -> pulse -> recommendations -> archive` already closes
- it does not prove the strategy is already adjusting positions autonomously

### 4.4 Latest full live-path failure

The `live:test` archive on `2026-03-16` shows:

- directory:
  - `runtime-artifacts/live-test/2026-03-16T092641Z-pending/`
- error summary:
  - `Failed query: select 1`
  - followed by `halt write failed`

That means:

- the full live path with `DB/Redis` has not yet completed a stable closed-loop validation in the current environment
- the remote Agent must not assume the full production path is already ready

## 5. Current Capability Boundaries

This section matters. A remote Agent can easily deploy the wrong thing otherwise.

### 5.1 What already exists

- `Pulse`
  - real fetch
  - unified archival
- `provider-runtime`
  - can output structured `TradeDecisionSet`
- `pulse-direct`
  - can translate pulse reports into executable decisions
- `pulse:live`
  - can run a live flow without DB/Redis
- `executor sync + stop-loss`
  - exists inside the queue worker
- `drawdown halt`
  - exists in the full service path

### 5.2 What is still not fully connected

- `pulse-direct` currently defaults existing positions to `hold`
  - this is not a bug
  - it is the current implementation boundary
  - there is no dedicated exit / rebalance engine yet
- `Portfolio Monitor / Review / Rebalance`
  - currently more like capabilities spread across the codebase
  - the report design exists, but the full standalone report pipeline is not finished
- `live:test`
  - the full service closed loop still lacks final validation
- `openclaw`
  - the interface exists, but there is no complete local run record yet

### 5.3 What that means

If the remote goal is only:

- run every day
- check for pulse recommendations
- optionally open new positions

then use:

- `AGENT_DECISION_STRATEGY=pulse-direct`
- `pnpm pulse:live`

If the remote goal is:

- automatically review existing positions
- automatically `reduce / close / rotate`
- automatically stop-loss
- automatically snapshot / halt / sync the portfolio

then continue into:

- real position-review behavior through `provider-runtime`
- the full `executor queue worker` path
- always-on `orchestrator + executor + DB + Redis` deployment

## 6. Mapping the User’s Three Modules to Current Code

### 6.1 Pulse

Main entrypoints:

- [services/orchestrator/src/pulse/market-pulse.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/pulse/market-pulse.ts)
- [services/orchestrator/src/pulse/full-pulse.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/pulse/full-pulse.ts)

### 6.2 Market Monitor / Portfolio Monitor

This is not a standalone service yet. The current execution path is:

- [services/executor/src/workers/queue-worker.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/workers/queue-worker.ts)

It already includes:

- remote-position sync
- snapshots
- drawdown halt
- stop-loss sell execution

The product / archival design document already exists here:

- [Illustration/portfolio-ops-report-design.en.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/Illustration/portfolio-ops-report-design.en.md)

### 6.3 Stop Loss / Alerts

The current stop-loss execution code lives in:

- [services/executor/src/workers/queue-worker.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/workers/queue-worker.ts)
- [services/executor/src/lib/risk.test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/lib/risk.test.ts)

### 6.4 Decision runtimes

There are currently two main runtime paths:

- [services/orchestrator/src/runtime/pulse-direct-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/pulse-direct-runtime.ts)
- [services/orchestrator/src/runtime/provider-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/provider-runtime.ts)

Practical interpretation:

- `pulse-direct`
  - easier to get running first
  - more conservative for existing positions
- `provider-runtime`
  - more suitable in principle for review / reduce / close / rebalance
  - but still lacks enough real production-loop validation

## 7. Recommended Remote Deployment Plans

### 7.1 Plan A: first ship the minimum useful daily autonomous loop

Use this when:

- you want a daily remote loop first
- you do not want to introduce Postgres / Redis yet
- you can accept “recommendation-first, limited rebalance capability”

Remote prerequisites:

- Node.js `20+`
- `corepack`
- `pnpm@10.28.1`
- `git`
- a working `codex` CLI
- network access to Polymarket

Suggested commands:

```bash
git clone https://github.com/Alchemist-X/autonomous-poly-trading.git
cd autonomous-poly-trading

corepack enable
corepack prepare pnpm@10.28.1 --activate

cp .env.example .env
pnpm install
pnpm vendor:sync

pnpm typecheck
pnpm test
pnpm build
```

Then split environment variables into two layers:

1. root `.env`
   - shared non-secret configuration
2. dedicated wallet env file
   - never commit it
   - point to it through `ENV_FILE=/secure/path/wallet.env`

Suggested initial remote values:

```bash
AUTOPOLY_EXECUTION_MODE=live
AGENT_RUNTIME_PROVIDER=codex
AGENT_DECISION_STRATEGY=pulse-direct
PULSE_SOURCE_REPO=all-polymarket-skill
PULSE_SOURCE_REPO_DIR=vendor/repos/all-polymarket-skill
CODEX_SKILL_ROOT_DIR=vendor/repos/all-polymarket-skill
CODEX_SKILL_LOCALE=zh
CODEX_SKILLS=polymarket-market-pulse,portfolio-review-polymarket,poly-position-monitor,poly-resolution-tracking,api-trade-polymarket
PULSE_LIVE_MAX_BUY_TOKENS=1
PULSE_LIVE_MIN_TRADE_USD=0.01
PROVIDER_TIMEOUT_SECONDS=0
PULSE_REPORT_TIMEOUT_SECONDS=0
```

First run recommendations only:

```bash
ENV_FILE=/secure/path/pizza.env pnpm pulse:live -- --recommend-only
```

Only after verifying the following artifacts should you enable execution:

- `runtime-artifacts/pulse-live/<timestamp>-<runId>/preflight.json`
- `runtime-artifacts/pulse-live/<timestamp>-<runId>/recommendation.json`
- `runtime-artifacts/reports/pulse/YYYY/MM/DD/*.md`
- `runtime-artifacts/reports/pulse/YYYY/MM/DD/*.json`
- `runtime-artifacts/reports/runtime-log/YYYY/MM/DD/*.md`

Then enable real execution:

```bash
ENV_FILE=/secure/path/pizza.env pnpm pulse:live
```

### 7.2 Plan B: if it must run every day

For the pulse-live path, use system cron or a systemd timer.

Simple cron example:

```cron
15 9 * * * cd /srv/autonomous-poly-trading && ENV_FILE=/secure/path/pizza.env pnpm pulse:live >> /var/log/autopoly-pulse-live.log 2>&1
```

If you want to observe for 3 to 7 days before allowing real execution, start with:

```cron
15 9 * * * cd /srv/autonomous-poly-trading && ENV_FILE=/secure/path/pizza.env pnpm pulse:live -- --recommend-only >> /var/log/autopoly-pulse-live.log 2>&1
```

### 7.3 Plan C: if the target is a full autonomous portfolio-management system

When the target becomes:

- automatic rebalancing
- automatic stop-loss
- automatic sync
- automatic snapshots
- halted-state management
- web visibility

the remote deployment should switch to always-on services, not a once-per-day script.

Recommended shape:

- `apps/web`
  - deploy to Vercel
- `services/orchestrator`
  - keep running on a cloud host
- `services/executor`
  - keep running on the same host
- `Postgres`
  - managed service or Docker
- `Redis`
  - managed service or Docker

In this mode, do not schedule `live:test` externally. Instead:

- keep `orchestrator` running
- use `AGENT_POLL_CRON`, `BACKTEST_CRON`, and `SYNC_INTERVAL_SECONDS` for internal scheduling
- keep `executor` running to process queue jobs and sync / stop-loss activity

But note:

- this full path has not yet finished final remote-stability validation
- do not hand long-running real funds to it without a dedicated smoke validation first

## 8. Common Remote Mistakes

### 8.1 Do not treat rough-loop as the trading entrypoint

It is a code-task loop, not the production trading daemon.

### 8.2 `live:test` and `pulse:live` are different

- `live:test`
  - depends on DB/Redis
  - has stricter preflight rules
  - does not have a completed stable closed-loop record yet
- `pulse:live`
  - does not depend on DB/Redis
  - is the better first remote phase today

### 8.3 If the wallet already has positions, `live:test` will be blocked by preflight

`live:test` requires:

- no remote open positions
- no local DB open positions
- `INITIAL_BANKROLL_USD=20`
- `MAX_TRADE_PCT<=0.1`
- `MAX_EVENT_EXPOSURE_PCT<=0.3`

The latest pulse-live archive shows the current test wallet has:

- `remotePositionCount=12`

So:

- if the remote Agent wants to test `live:test`, use a clean wallet or clear/sync state first

### 8.4 GitHub may not contain current uncommitted local files

The current worktree still has uncommitted files such as:

- `Illustration/portfolio-ops-report-design.md`
- `Illustration/portfolio-ops-report-design.en.md`
- `services/executor/src/workers/queue-worker.test.ts`

If the remote Agent clones directly from GitHub:

- it will not get those local uncommitted files by default
- push them first if they must be part of the remote deployment context

## 9. Recommended Remote Handoff Order

1. clone the repo and confirm the commit baseline
2. run `pnpm install && pnpm vendor:sync`
3. configure the `codex` CLI and a dedicated wallet env file
4. run:
   - `ENV_FILE=/secure/path/pizza.env pnpm pulse:live -- --recommend-only`
5. inspect artifacts, recommendation quality, pulse output, and runtime log
6. then run:
   - `ENV_FILE=/secure/path/pizza.env pnpm pulse:live`
7. observe for several days
8. if the real goal is “automatic rebalance / stop-loss / monitoring”
   - switch to the full service deployment track
   - prioritize real regression validation for `provider-runtime` and the portfolio monitor / review / rebalance path

## 10. Files the Remote Agent Should Read First

If some of these files are missing in a remote clone, first check the earlier note about GitHub not necessarily containing current local uncommitted files before assuming the path is wrong.

- [README.en.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/README.en.md)
- [progress.en.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/progress.en.md)
- [risk-controls.en.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/risk-controls.en.md)
- [Illustration/portfolio-ops-report-design.en.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/Illustration/portfolio-ops-report-design.en.md)
- [services/orchestrator/src/runtime/pulse-direct-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/pulse-direct-runtime.ts)
- [services/orchestrator/src/runtime/provider-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/provider-runtime.ts)
- [services/executor/src/workers/queue-worker.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/workers/queue-worker.ts)
- [scripts/pulse-live.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/scripts/pulse-live.ts)
- [scripts/live-test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/scripts/live-test.ts)

## 11. One-Line Transfer Summary

The repository is already good enough for a remote Agent to run a daily pulse-live loop of `Pulse -> recommendation -> archive -> optional execution`, but “automatic adjustment of existing positions + automatic stop-loss + full portfolio monitoring” still mostly lives in the full service path and has not yet completed final production-loop validation.
