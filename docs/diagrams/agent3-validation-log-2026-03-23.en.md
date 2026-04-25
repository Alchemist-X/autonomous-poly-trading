# Agent 3 Validation Log (2026-03-23)

Chinese version: [agent3-validation-log-2026-03-23.md](agent3-validation-log-2026-03-23.md).

## Scope

This pass only covers verification, safe real-money path testing, and bottleneck discovery. It does not change the main product logic.

Operating order:

- `paper`
- then `recommend-only`
- then real-money `pulse:live`
- never bypass preflight
- never widen bankroll or risk caps

## 1. Targeted tests

Executed:

```bash
pnpm vitest run \
  scripts/pulse-live.test.ts \
  scripts/daily-pulse.test.ts \
  services/orchestrator/src/runtime/decision-composer.test.ts \
  services/orchestrator/src/runtime/pulse-entry-planner.test.ts \
  services/orchestrator/src/lib/portfolio-report-artifacts.test.ts \
  services/executor/src/workers/queue-worker.test.ts
```

Result:

- `6/6` test files passed
- `18/18` tests passed

Conclusion:

- The current dirty worktree does not immediately fail at the unit-test layer across the most relevant changed areas.

## 2. Paper reset

Executed:

```bash
AUTOPOLY_EXECUTION_MODE=paper \
AUTOPOLY_LOCAL_STATE_FILE=$PWD/runtime-artifacts/local/agent3-paper-state.json \
pnpm trial:reset-paper -- --bankroll 20
```

Result:

- Success
- state file:
  - `runtime-artifacts/local/agent3-paper-state.json`

Conclusion:

- Paper state initialization works
- A single explicit local state source can be set and printed cleanly

## 3. Paper recommend bottleneck

Executed:

```bash
AUTOPOLY_EXECUTION_MODE=paper \
AUTOPOLY_LOCAL_STATE_FILE=$PWD/runtime-artifacts/local/agent3-paper-state.json \
pnpm trial:recommend -- --json
```

Observed bottleneck:

- After entering `tsx src/ops/trial-recommend.ts -- --json`, the process went into a long silent period
- The wait was inside the `codex exec` pulse-render subprocess
- Active process at the time:
  - `codex exec ... -o /var/folders/.../full-pulse-report.md -`
- During observation:
  - CPU stayed near `0`
  - the temp output file had not appeared yet
  - no extra terminal stage heartbeat was emitted

Action:

- Manually interrupted
- exit code `130`

Conclusion:

- The main `paper -> trial:recommend` bottleneck is not an immediate failure. It is the `pulse render / codex exec` segment lacking heartbeats and observability.
- This is inconsistent with the repository preference for visible stage output.

## 4. Pulse Live recommend-only replay

To bypass the model-side bottleneck, this pass reused an existing pulse archive:

```bash
ENV_FILE=.env.pizza \
AUTOPOLY_EXECUTION_MODE=live \
pnpm pulse:live -- --recommend-only --json \
  --pulse-json runtime-artifacts/reports/pulse/2026/03/20/pulse-20260320T070042Z-codex-full-f983b827-bd7c-4cde-bbf5-6e59691197a4.json \
  --pulse-markdown runtime-artifacts/reports/pulse/2026/03/20/pulse-20260320T070042Z-codex-full-f983b827-bd7c-4cde-bbf5-6e59691197a4.md
```

Result:

- Success
- `executionMode=live`
- `decisionStrategy=pulse-direct`
- `runId=dd659a03-00ff-428b-afbc-d3f9196ebe3e`
- archive:
  - `runtime-artifacts/pulse-live/2026-03-23T075158Z-dd659a03-00ff-428b-afbc-d3f9196ebe3e`

Key preflight facts:

- collateral: `15.9882 USD`
- remote positions: `4`
- bankroll cap: `20`
- configured min trade: `10`
- `MAX_TRADE_PCT=0.2`
- `MAX_EVENT_EXPOSURE_PCT=0.3`

Recommendation facts:

- total decisions: `6`
- breakdown:
  - `close`: `1`
  - `hold`: `3`
  - `open`: `2`
- executable plans: `0`

Blocked reasons:

- `will-bitcoin-dip-to-65k-in-march-2026`
  - `below Polymarket minimum order size (5 shares)`
- `will-crude-oil-cl-hit-high-100-by-end-of-march-658-396-769-971`
  - `guardrails removed the open decision`
- `netanyahu-out-by-june-30-383-244-575`
  - `guardrails removed the open decision`

Conclusion:

- The current `.env.pizza` real-money environment is not “broken”. It can produce decisions, but execution planning removes every candidate because of risk and market sizing constraints.
- That is a real and useful system state.

## 5. Stateful `live:test` preflight

Executed:

```bash
ENV_FILE=.env.pizza AUTOPOLY_EXECUTION_MODE=live pnpm live:test -- --json
```

Result:

- Failed
- stage: `unknown`
- message: `DATABASE_URL is not configured.`
- archive:
  - `runtime-artifacts/live-test/2026-03-23T075243Z-pending`
- error artifact:
  - `runtime-artifacts/live-test/2026-03-23T075243Z-pending/error.json`

Conclusion:

- The blocker on `live:test` is infrastructure, not trading logic.
- `DATABASE_URL` must be configured before stateful queue-worker validation is meaningful.

## 6. Real-money pulse-live execution branch

Executed:

```bash
ENV_FILE=.env.pizza \
AUTOPOLY_EXECUTION_MODE=live \
pnpm pulse:live -- --json \
  --pulse-json runtime-artifacts/reports/pulse/2026/03/20/pulse-20260320T070042Z-codex-full-f983b827-bd7c-4cde-bbf5-6e59691197a4.json \
  --pulse-markdown runtime-artifacts/reports/pulse/2026/03/20/pulse-20260320T070042Z-codex-full-f983b827-bd7c-4cde-bbf5-6e59691197a4.md
```

Result:

- Success
- `runId=54f81d9a-842a-459f-a05f-5a7faa9206c3`
- `executedOrders=0`
- archive:
  - `runtime-artifacts/pulse-live/2026-03-23T075303Z-54f81d9a-842a-459f-a05f-5a7faa9206c3`

Key artifacts:

- `preflight.json`
- `recommendation.json`
- `execution-summary.json`
- `run-summary.md`
- `run-summary.en.md`

Run-summary facts:

- no executable plans
- no actual orders sent
- equity stayed at `19.59`
- open position count stayed at `4`

Conclusion:

- The current real-money pulse-live path can safely reach the execution branch and still end in a `0 order` no-op under current guardrails.
- This is a repeatable and low-risk real-money validation path.

## 7. Most important bottlenecks right now

1. `trial:recommend` pulse render / codex exec lacks visible heartbeats and can go silent for too long
2. Under `.env.pizza`, bankroll is too small relative to `configuredMinTradeUsd=10` and order-book minimums, so both opens and closes struggle to become executable plans
3. `live:test` is blocked by missing `DATABASE_URL`, so the full stateful path is not yet testable
4. `.env.pizza` currently exposes `MAX_TRADE_PCT=0.2`, while the documented `live:test` constraint is `<=0.1`
   - this does not block the pulse-live recommend-only replay
   - but it is still a risk signal that needs an explicit policy decision

## 8. Recommended next steps

1. Add explicit stage heartbeats and timeout summaries to `trial:recommend` / pulse render
2. Clarify whether `.env.pizza` is intentionally running with `MAX_TRADE_PCT=0.2`
3. If the goal is continued low-risk real-money validation, prefer `pulse:live` with a reused pulse snapshot
4. If the goal is full production-path validation, configure `DATABASE_URL` and the rest of the stateful infrastructure first
