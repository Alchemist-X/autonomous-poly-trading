# Pulse Timeout Calibration Plan

## 1. Problem

The current `pulse-direct` path has an internal hard timeout:

- `DEFAULT_PULSE_DIRECT_RENDER_TIMEOUT_SECONDS = 180` in [`services/orchestrator/src/pulse/full-pulse.ts`](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/pulse/full-pulse.ts)

Its practical impact is:

- when `PULSE_REPORT_TIMEOUT_SECONDS` is unset or less than or equal to `0`, `pulse-direct` still does not wait indefinitely
- if Codex rendering exceeds `180` seconds, the system switches to deterministic fallback
- the fallback emits a conservative provisional open candidate, or directly `skip`s
- this keeps the loop alive, but it also hides the real rendering latency problem

## 2. Goal

This round must answer three questions:

1. What hard timeout limits exist on this path
2. How long five truly parallel runs take when all timeout limits are disabled
3. What new, looser limits should be set based on measured runtime

## 3. Scope

Only this real path is in scope:

- `pnpm daily:pulse`
- `pnpm pulse:live`
- `ensureDailyPulseSnapshot`
- `generatePulseSnapshot`
- `market-pulse.ts`
- `full-pulse.ts`
- `pulse-direct-runtime`

The following are not the main target of this round:

- `rough-loop`
- `resolution` jobs
- non-`pulse-direct` legacy `provider-runtime` paths

If they contain timeouts, they will be listed, but not included in the five-run experiment set.

## 4. Known Hard Timeout Inventory

This round will verify and complete the following list:

1. Pulse fetch timeout
   - `PULSE_FETCH_TIMEOUT_SECONDS`
   - child-process kill for `fetch_markets.py`
2. Pulse render timeout
   - `PULSE_REPORT_TIMEOUT_SECONDS`
   - internal `180s` fallback when `pulse-direct` has no explicit report timeout
3. Pulse research subprocess timeout
   - `scrape-market.ts`
   - `orderbook.ts`
   - first-time `npm install` for `api-trade-polymarket`
4. Decision runtime timeout
   - `PROVIDER_TIMEOUT_SECONDS`
   - must confirm whether it actually applies to the active `pulse-direct` path

## 5. Experiment Rules

- worktree must be used
- sub-agents must be used for parallel work
- five runs must start in parallel
- no timeout restriction may be active during this experiment round
- default production behavior must not be permanently broken for the sake of the experiment
- each run must preserve isolated artifacts and timing records

## 6. Experiment Design

### 6.1 Preparation

1. Create a dedicated experiment worktree
2. Add an explicit way to disable timeouts inside the experiment worktree
3. Keep default behavior unchanged:
   - default production timeout behavior must stay intact
   - timeout disabling must only happen when explicitly requested by experiment config or `0`

### 6.2 Parallel execution

Start five real runs at the same time, preferably with:

- `ENV_FILE=.env.pizza`
- `AUTOPOLY_EXECUTION_MODE=live`
- `AGENT_DECISION_STRATEGY=pulse-direct`
- `--recommend-only`

At the same time, ensure all of the following are disabled:

- Pulse fetch timeout
- Pulse render timeout
- Pulse research subprocess timeout
- provider runtime timeout

Each run must record:

- run id
- start time
- Pulse fetch completion time
- Pulse render completion time
- total elapsed time
- whether fallback was triggered
- key artifact directory

### 6.3 Result summary

At minimum, compute the following across the five runs:

- shortest runtime
- longest runtime
- median
- average
- P80
- whether there is a clear long tail

## 7. Rules for New Limits

After the experiment, new limits must be derived using these rules:

1. do not set defaults from the average
   - averages are too easily pulled down by unusually fast samples
2. defaults must at least cover the longest stable sample, with safety margin
3. render timeout and fetch timeout must be configured separately
4. both must remain independently overridable by env
5. keep heartbeat visibility instead of hiding long tasks behind short timeouts

Suggested decision method:

- fetch timeout: use `2x` the largest observed fetch time, with a reasonable upper cap
- render timeout: prefer observed render P80 or max, then add `30%` to `50%` headroom
- if all five runs are well above `180s`, the current `180s` is clearly too tight and should be raised directly

## 8. Deliverables

This round must produce:

1. a timeout inventory
2. a five-run parallel experiment result table
3. new timeout recommendations
4. corresponding code changes
5. verification output

## 9. Risks

- five simultaneous runs may amplify external provider jitter
- a timeout-free mode can damage production defaults if not gated explicitly
- the repository already contains uncommitted user changes, so those must not be overwritten

## 10. Execution Order

1. inventory hard timeouts
2. write the plan document
3. create the experiment worktree
4. add explicit timeout-disabling capability in the experiment worktree
5. run five experiments in parallel
6. summarize timings
7. return to the main workspace and land formal config/code changes
8. verify
