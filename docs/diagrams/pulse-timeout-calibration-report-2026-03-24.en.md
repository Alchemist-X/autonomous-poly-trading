# Pulse Timeout Calibration Experiment Report

Date: 2026-03-24

## 1. Executive Summary

This experiment answered the key question:

- the old `180s` internal `pulse-direct` render fallback was clearly too tight
- under 5-way parallel real runs, the pipeline completed in `333.86s` to `511.62s`
- all 5 samples completed successfully, and none triggered fallback
- the long tail was concentrated in full pulse rendering, not in preflight

Based on the measured results, the experiment initially recommended:

- `PULSE_FETCH_TIMEOUT_SECONDS=120`
- `PULSE_DIRECT_RENDER_TIMEOUT_SECONDS=600`
- `PULSE_TIMEOUT_MODE=default`
- `PULSE_REPORT_TIMEOUT_SECONDS=0` unchanged

Later, to leave more headroom for live tail latency, the current repository defaults were widened further to:

- `PULSE_FETCH_TIMEOUT_SECONDS=300`
- `PULSE_DIRECT_RENDER_TIMEOUT_SECONDS=1200`

## 2. Background

The user pointed out a hard limit in the codebase:

- the previous `DEFAULT_PULSE_DIRECT_RENDER_TIMEOUT_SECONDS = 180` in [`services/orchestrator/src/pulse/full-pulse.ts`](../services/orchestrator/src/pulse/full-pulse.ts)

Its practical effect was:

- when `PULSE_REPORT_TIMEOUT_SECONDS <= 0` and the strategy is `pulse-direct`
- the system does not wait indefinitely for full pulse rendering
- once the internal threshold is reached, it switches to deterministic fallback

This creates a visibility problem:

- the loop appears to survive
- but the real rendering tail latency is hidden behind fallback

## 3. Goal

This round had three goals:

1. inventory the hard timeout limits on this path
2. run 5 truly parallel real executions with timeout limits removed
3. derive new, looser defaults from measured runtime

## 4. Hard Timeout Inventory

### 4.1 Timeouts that matter on the main path

| Item | Location | Previous default | Notes |
| --- | --- | --- | --- |
| Pulse fetch timeout | [`services/orchestrator/src/config.ts`](../services/orchestrator/src/config.ts) + [`services/orchestrator/src/pulse/market-pulse.ts`](../services/orchestrator/src/pulse/market-pulse.ts) | `60s` | Used for the `fetch_markets.py` subprocess |
| Pulse report timeout | [`services/orchestrator/src/config.ts`](../services/orchestrator/src/config.ts) + [`services/orchestrator/src/pulse/full-pulse.ts`](../services/orchestrator/src/pulse/full-pulse.ts) | `0` | When positive, limits `scrape-market.ts`, `orderbook.ts`, and render |
| Internal `pulse-direct` render fallback | [`services/orchestrator/src/pulse/full-pulse.ts`](../services/orchestrator/src/pulse/full-pulse.ts) | `180s` | Automatically applied when `PULSE_REPORT_TIMEOUT_SECONDS` is not set to a positive value |

### 4.2 Adjacent timeout

| Item | Location | Notes |
| --- | --- | --- |
| `PROVIDER_TIMEOUT_SECONDS` | [`services/orchestrator/src/config.ts`](../services/orchestrator/src/config.ts) | Not the blocking point on this `pulse-direct` experiment path |

## 5. Experiment Design

### 5.1 Execution model

- dedicated worktree: `/Users/Aincrad/dev-proj/autonomous-poly-trading-timeout-exp`
- 5 sub-agents running in parallel
- all runs used real `pulse:live --recommend-only`
- each run used an isolated artifact root

### 5.2 Timeout-free experiment mode

To guarantee that this round applied no timeout restrictions, the experiment worktree added:

- `PULSE_TIMEOUT_MODE=unbounded`

Its behavior:

- disables Pulse fetch timeout
- disables Pulse research subprocess timeout
- disables the internal `pulse-direct` render fallback
- leaves default production behavior unchanged unless explicitly enabled

### 5.3 Command

All 5 samples used the same command, with only `ARTIFACT_STORAGE_ROOT` changing:

```bash
ENV_FILE=/Users/Aincrad/dev-proj/autonomous-poly-trading/.env.pizza \
AUTOPOLY_EXECUTION_MODE=live \
AGENT_DECISION_STRATEGY=pulse-direct \
PULSE_TIMEOUT_MODE=unbounded \
PULSE_FETCH_TIMEOUT_SECONDS=0 \
PULSE_REPORT_TIMEOUT_SECONDS=0 \
PROVIDER_TIMEOUT_SECONDS=0 \
ARTIFACT_STORAGE_ROOT=<per-run-artifact-root> \
/usr/bin/time -p \
/Users/Aincrad/dev-proj/autonomous-poly-trading/node_modules/.bin/tsx \
scripts/pulse-live.ts --recommend-only --json
```

## 6. Five-Run Parallel Results

### 6.1 Per-sample results

| Run | real(s) | user(s) | sys(s) | preflight(s) | context(s) | markdown(s) | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| run01 | `339.47` | `17.09` | `4.49` | `12` | `101` | `326` | success, no fallback |
| run02 | `333.86` | `18.53` | `5.20` | `11` | `76` | `319` | success, no fallback |
| run03 | `511.62` | `16.93` | `4.41` | `11` | `94` | `499` | success, no fallback |
| run04 | `473.90` | `17.65` | `4.62` | `10` | `76` | `464` | success, no fallback |
| run05 | `418.99` | `16.73` | `4.20` | `22` | `71` | `405` | success, no fallback |

Notes:

- `preflight` is inferred from `preflight.json` write time
- `context` is inferred from `pulse.json` write time and represents research context being written
- `markdown` is inferred from `pulse.md` write time and represents render completion

### 6.2 Aggregate stats

| Metric | total(s) | context(s) | markdown(s) |
| --- | --- | --- | --- |
| min | `333.86` | `71` | `319` |
| median | `418.99` | `76` | `405` |
| mean | `415.57` | `83.60` | `402.60` |
| p80 | `481.44` | `95.40` | `471.00` |
| max | `511.62` | `101` | `499` |

### 6.3 Key observations

1. the old `180s` render timeout was clearly too tight
   - even the fastest render completed at `319s`
   - the slowest render completed at `499s`

2. preflight was not the main problem
   - all 5 samples stayed within `10s` to `22s`

3. the long tail was concentrated in full pulse rendering
   - `context` completed in `71s` to `101s`
   - `markdown` stretched total runtime to `319s` to `499s`

4. all 5 samples completed successfully
   - none were cut off by the old `60s` fetch timeout
   - none were cut off by the old `180s` render fallback
   - the final blockers were normal risk and exchange minimum constraints, not timeout failures

## 7. Why the New Defaults Were Chosen

### 7.1 Render timeout

The experiment initially recommended raising the internal `pulse-direct` render timeout from `180s` to `600s` because:

- observed `markdown max = 499s`
- observed `p80 = 471s`
- a value near `480s` would still lose to the long-tail sample
- `600s` leaves about `20%` to `27%` safety margin

### 7.2 Fetch timeout

The experiment initially recommended raising the default Pulse fetch timeout from `60s` to `120s` because:

- current artifacts only expose `context` timing, not a pure fetch-only stage
- the observable front segment landed in `71s` to `101s`
- this strongly suggests the old `60s` is too tight as a conservative default
- `120s` is deliberately looser without becoming excessively large

Important caveat:

- `120s` is a conservative inference from the observable front segment
- it is not a direct fetch-only measurement
- if exact fetch calibration is needed later, stage-level timing should be added

### 7.3 Current repository defaults

After the experiment, the current repository defaults were widened further to:

- `PULSE_FETCH_TIMEOUT_SECONDS=300`
- `PULSE_DIRECT_RENDER_TIMEOUT_SECONDS=1200`

This step was a manual choice for additional operating headroom, not a new experimentally derived minimum.

## 8. Landed Code Changes

### 8.1 New experiment mode

- added `PULSE_TIMEOUT_MODE=default|unbounded` in [`services/orchestrator/src/config.ts`](../services/orchestrator/src/config.ts)

### 8.2 Fixed fetch timeout semantics

- added `resolvePulseFetchTimeoutMs` in [`services/orchestrator/src/pulse/market-pulse.ts`](../services/orchestrator/src/pulse/market-pulse.ts)
- `unbounded` mode no longer schedules `setTimeout`

### 8.3 Made render timeout configurable

- added `PULSE_DIRECT_RENDER_TIMEOUT_SECONDS` in [`services/orchestrator/src/config.ts`](../services/orchestrator/src/config.ts)
- [`services/orchestrator/src/pulse/full-pulse.ts`](../services/orchestrator/src/pulse/full-pulse.ts) now reads the value from config
- the current default is now `1200`

### 8.4 Unified research timeout handling

- added `resolvePulseResearchTimeoutMs` in [`services/orchestrator/src/pulse/full-pulse.ts`](../services/orchestrator/src/pulse/full-pulse.ts)
- `scrape-market.ts`, `orderbook.ts`, and `npm install` now follow the same timeout path

### 8.5 Updated config sample

- updated [`.env.example`](../.env.example)

## 9. Verification

The following tests passed after the change:

```bash
/Users/Aincrad/dev-proj/autonomous-poly-trading/node_modules/.bin/vitest run \
  services/orchestrator/src/pulse/full-pulse.test.ts \
  services/orchestrator/src/pulse/market-pulse.test.ts \
  services/orchestrator/src/runtime/provider-runtime.test.ts \
  services/orchestrator/src/jobs/daily-pulse-core.test.ts \
  services/orchestrator/src/ops/trial-recommend-checkpoint.test.ts
```

Result:

- `5` test files passed
- `11` tests passed

## 10. Artifact Root

Experiment root:

- `/Users/Aincrad/dev-proj/autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration`

Main sample directories:

- [run01](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd)
- [run02](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29)
- [run03](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee)
- [run04](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95)
- [run05](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844)

## 11. How Recommendations Were Formed

In this timeout experiment, the real "bet recommendation thinking" does not live in a single file. It is spread across five stages:

1. `pulse-*.json`
   - this is the raw research bundle and the closest artifact to the evidence base
   - the most useful fields are `research_candidates`, `selected_candidates`, `risk_flags`, `total_fetched`, and `total_filtered`
   - inside `research_candidates[*]`, you can directly inspect `priorityScore`, `market`, `scrapeResult.rules`, `scrapeResult.market_context.annotations`, `comments.sampled_items`, and `orderbooks`

2. `pulse-*.md`
   - this is the human-readable research write-up
   - the best review sections are `候选池与筛选思路`, then for each market: `证据链`, `推理逻辑`, `仓位建议`, `信息源`, and `评论区校验`
   - if you want to judge whether the recommendation reads like a serious research note, start here

3. `reports/runtime-log/*.md`
   - this is the runtime merge log for `pulse-direct`
   - it explicitly shows `Pulse Entry Planner -> Position Review -> Decision Composer`
   - this is the most important file if you want to see how research candidates became final decisions

4. `recommendation.json`
   - this is the final machine-readable output passed toward execution
   - the most useful fields are `promptSummary`, `reasoningMd`, `overview`, `decisions[*].thesis_md`, and `skipped[*].reason`
   - it also records `pulseJsonPath`, `pulseMarkdownPath`, and `runtimeLogPath` so you can jump backward from the final recommendation to the intermediate artifacts

5. `run-summary.md`
   - this is the final human-facing execution summary
   - because this round used `recommend-only`, there were no live fills; the most important part here is the blocked-item section, which shows whether the final recommendation was stopped by exchange minimums, strategy minimum trade size, or risk caps

One practical detail that is easy to miss in this experiment:

- the `pulse markdown` and `pulse json` files are not stored in each run's main directory; they live under that run's `reports/pulse/...`
- `review / monitor / rebalance / runtime-log` are also stored under `reports/...`, not in the run root
- all 5 runs completed successfully, so there is no `execution-summary.json` and no `error.json`

## 12. Current Limitation

This report still has one known limitation:

- the current artifact set does not expose a fetch-only stage timestamp
- therefore the experiment-recommended `PULSE_FETCH_TIMEOUT_SECONDS=120` is a conservative inference, not a direct fetch-only measurement
- the current repository default `PULSE_FETCH_TIMEOUT_SECONDS=300` is looser, but it is also not a direct fetch-only measurement

If a later round needs a more precise fetch timeout, the recommended next step is to add stage timestamps for:

- fetch start
- fetch end
- research end
- render end

That would remove the need to infer timing from file write timestamps.

## 13. Human Review Entry Points

First, the boundary:

- the sections below only use the emitted, persisted, auditable reasoning trail
- they answer “what did the system rely on when forming this recommendation?”
- they do not expose any unlogged internal model thought

Recommended review order:

1. `preflight.json`
   - confirm the real-money constraints for the run: execution mode, wallet state, remote positions, bankroll cap, minimum trade, and risk controls.
   - example: [run01 preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/preflight.json)
2. `pulse.json`
   - inspect the raw candidate pool and deep-research bundle. This is where the raw rules, sampled comments, annotations, and order-book depth are stored.
   - example: [run01 pulse.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.json)
3. `pulse.md`
   - inspect “why Top 3”, “evidence chain”, “probability assessment”, “reasoning logic”, and “position sizing”. This is the closest human-readable artifact for “how the system thought about the bet”.
   - example: [run01 pulse.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
4. `runtime-log.md`
   - inspect how Pulse Entry Planner, Position Review, and Decision Composer were merged into the final decision set.
   - example: [run01 runtime-log.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/runtime-log/2026/03/24/runtime-log-20260324T023205Z-pulse-direct-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
5. `recommendation.json`
   - inspect the final structured output: `ai_prob`, `market_prob`, `edge`, `confidence`, `thesis_md`, and the actual skip/block reasons.
   - example: [run01 recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/recommendation.json)
6. `review/monitor/rebalance/run-summary`
   - these are compressed views of the same run from different portfolio angles.
   - example: [run01 review.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/review/2026/03/24/review-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md), [run01 monitor.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/monitor/2026/03/24/monitor-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md), [run01 rebalance.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/rebalance/2026/03/24/rebalance-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md), [run01 run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.md)

## 14. Real Recommendation Formation Walkthrough

`run01` is used as the canonical walkthrough because its artifact set is complete and representative.

### 14.1 Preflight: what constraints were active?

- entry: [run01 preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/preflight.json)
- key facts:
  - `executionMode=live`
  - `decisionStrategy=pulse-direct`
  - `collateralBalanceUsd=496.3488`
  - `remotePositionCount=3`
  - `bankrollCapUsd=20`
  - `configuredMinTradeUsd=1`
  - `maxTradePct=0.2`
  - `maxEventExposurePct=0.3`

Why this matters:

- the wallet had about `$496.35` of available collateral
- but the strategy-level bankroll for this run was only `$20`
- so the later suggested tickets were necessarily small, which is an important upstream reason why execution was blocked by exchange minimums and risk limits

### 14.2 Pulse: how did the system narrow the universe to Top 3?

- raw structure: [run01 pulse.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.json)
- human-readable output: [run01 pulse.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)

The persisted artifacts show this funnel:

- `total_fetched=1566`
- `total_filtered=90`
- `selected_candidates=12`
- `research_candidates=4`

So the system did not jump straight from “all markets” to “3 bets”. It went through:

1. full market fetch
2. tradability filtering
3. 12 shortlisted candidates
4. 4 deep-research bundles
5. final Top 3 recommendation set

### 14.3 `pulse.json` stores the raw evidence, not just the conclusion

Inside `run01 pulse.json`, the `research_candidates` entries include:

- `market`
  - question, liquidity, 24h volume, Yes/No prices, token ids, bid/ask, spread
- `scrapeResult.rules.description`
  - the raw resolution-rule text
- `scrapeResult.market_context.annotations`
  - market context annotations
- `scrapeResult.comments.sampled_items`
  - sampled comment threads
- `orderbooks`
  - per-outcome book depth, spread, and 2% slippage capacity

That means a human reviewer can directly check:

- whether the rules were interpreted correctly
- whether comments were over-weighted
- whether order-book depth actually supports the suggested size

### 14.4 `pulse.md` is the written “why this bet?” artifact

In `run01 pulse.md`, you can directly inspect these sections:

- candidate pool and filtering logic
- candidates rejected before Top 3
- why the final Top 3 were selected
- per-market `probability assessment`
- per-market `evidence chain`
- per-market `reasoning logic`
- per-market `position sizing`

So the emitted recommendation logic explicitly covers:

1. why the market was worth researching
2. why it survived into Top 3
3. what the market price was, what AI estimated, and what edge remained
4. whether the evidence came from rules, market context, comments, or order books
5. why the suggested notional was that size

### 14.5 `runtime-log.md` shows how the final decision set was composed

- entry: [run01 runtime-log.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/runtime-log/2026/03/24/runtime-log-20260324T023205Z-pulse-direct-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)

This file is not a market research report. It is the final decision log. It explicitly says the run:

1. used Pulse Entry Planner for new entries
2. used Position Review for existing positions
3. used Decision Composer to merge them

For `run01`, the merged output was:

- `hold 3`
- `open 3`
- total decisions `6`

### 14.6 `recommendation.json` shows both the recommendation and why it did not execute

- entry: [run01 recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/recommendation.json)
- summary entry: [run01 run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.md)

The final structured output for `run01` was:

- 3 existing positions reviewed as `hold`
- 3 new entry candidates:
  - `us-forces-enter-iran-by-march-31...`
  - `us-x-iran-ceasefire-by-march-31`
  - `will-england-win-the-2026-fifa-world-cup-937`

But there was no executable plan in the end. The issue was not failed research. It was execution constraints:

- Iran ground-entry market: `blocked_by_exchange_min`
- ceasefire market: `blocked_by_strategy_min_trade`
- England World Cup market: `blocked_by_strategy_min_trade`

For manual review, that means:

- research quality should be judged mainly from `pulse.json` and `pulse.md`
- execution feasibility should be judged mainly from `preflight.json`, `recommendation.json`, and `run-summary.md`

## 15. All Sample Recommendation Shapes

Across all 5 samples, three patterns were stable:

- the 3 legacy positions were always reviewed as `hold`
- most new entries concentrated on the same two short-dated geopolitics markets
- the third slot moved across runs, which suggests some remaining variation in long-tail candidate ranking

### run01

| Item | Content |
| --- | --- |
| Position review | will-bitcoin-dip-to-65k-in-march-2026; will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568; will-gavin-newsom-win-the-2028-us-presidential-election |
| New entries | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519 (ai=0.92, market=0.805, edge=0.115, usd=2.94); us-x-iran-ceasefire-by-march-31 (ai=0.93, market=0.855, edge=0.075, usd=2.58); will-england-win-the-2026-fifa-world-cup-937 (ai=0.94, market=0.871, edge=0.069, usd=2.68) |
| Block reasons | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519: blocked_by_exchange_min: below Polymarket minimum order size (5 shares @ $0.81 ask => $4.05 minimum); us-x-iran-ceasefire-by-march-31: blocked_by_strategy_min_trade: configured minimum trade is $1.00 after guardrails; will-england-win-the-2026-fifa-world-cup-937: blocked_by_strategy_min_trade: configured minimum trade is $1.00 after guardrails |

### run02

| Item | Content |
| --- | --- |
| Position review | will-bitcoin-dip-to-65k-in-march-2026; will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568; will-gavin-newsom-win-the-2028-us-presidential-election |
| New entries | us-x-iran-ceasefire-by-march-31 (ai=0.96, market=0.855, edge=0.105, usd=3.62); us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519 (ai=0.93, market=0.805, edge=0.125, usd=3.2); will-england-win-the-2026-fifa-world-cup-937 (ai=0.95, market=0.871, edge=0.079, usd=3.06) |
| Block reasons | us-x-iran-ceasefire-by-march-31: blocked_by_exchange_min: below Polymarket minimum order size (5 shares @ $0.86 ask => $4.30 minimum); us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519: blocked_by_exchange_min: below Polymarket minimum order size (5 shares @ $0.81 ask => $4.05 minimum); will-england-win-the-2026-fifa-world-cup-937: blocked_by_strategy_min_trade: configured minimum trade is $1.00 after guardrails |

### run03

| Item | Content |
| --- | --- |
| Position review | will-bitcoin-dip-to-65k-in-march-2026; will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568; will-gavin-newsom-win-the-2028-us-presidential-election |
| New entries | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519 (ai=0.92, market=0.805, edge=0.115, usd=2.94); us-x-iran-ceasefire-by-march-31 (ai=0.94, market=0.855, edge=0.085, usd=2.94); will-england-win-the-2026-fifa-world-cup-937 (ai=0.91, market=0.871, edge=0.039, usd=1.52) |
| Block reasons | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519: blocked_by_risk_cap: exchange minimum $4.05 exceeds current risk-limited cap $2.40; us-x-iran-ceasefire-by-march-31: blocked_by_strategy_min_trade: configured minimum trade is $1.00 after guardrails; will-england-win-the-2026-fifa-world-cup-937: blocked_by_risk_cap: total exposure, event exposure, max positions, bankroll cap, or edge scaling reduced the maximum executable notional to zero |

### run04

| Item | Content |
| --- | --- |
| Position review | will-bitcoin-dip-to-65k-in-march-2026; will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568; will-gavin-newsom-win-the-2028-us-presidential-election |
| New entries | us-x-iran-ceasefire-by-march-31 (ai=0.96, market=0.855, edge=0.105, usd=3.62); us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519 (ai=0.94, market=0.805, edge=0.135, usd=3.46) |
| Block reasons | us-x-iran-ceasefire-by-march-31: blocked_by_exchange_min: below Polymarket minimum order size (5 shares @ $0.86 ask => $4.30 minimum); us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519: blocked_by_exchange_min: below Polymarket minimum order size (5 shares @ $0.81 ask => $4.05 minimum) |

### run05

| Item | Content |
| --- | --- |
| Position review | will-bitcoin-dip-to-65k-in-march-2026; will-gavin-newsom-win-the-2028-democratic-presidential-nomination-568; will-gavin-newsom-win-the-2028-us-presidential-election |
| New entries | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519 (ai=0.92, market=0.805, edge=0.115, usd=2.94); us-x-iran-ceasefire-by-march-31 (ai=0.93, market=0.855, edge=0.075, usd=2.58); will-there-be-no-change-in-fed-interest-rates-after-the-april-2026-meeting (ai=0.0515, market=0.0515, edge=0, usd=0.42) |
| Block reasons | us-forces-enter-iran-by-march-31-222-191-243-517-878-439-519: blocked_by_risk_cap: exchange minimum $4.05 exceeds current risk-limited cap $2.40; us-x-iran-ceasefire-by-march-31: blocked_by_strategy_min_trade: configured minimum trade is $1.00 after guardrails; will-there-be-no-change-in-fed-interest-rates-after-the-april-2026-meeting: blocked_by_risk_cap: total exposure, event exposure, max positions, bankroll cap, or edge scaling reduced the maximum executable notional to zero |

## 16. Full Sample File Index

Each run preserved a full reviewable artifact set. The full file list is below so you can click through each run end-to-end.

### run01

- [live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/preflight.json)
- [live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/recommendation.json)
- [live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.en.md)
- [live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/live-stateless/2026-03-24T022639Z-d4cc6055-9811-4532-85f9-3944a817b5dd/run-summary.md)
- [reports/monitor/2026/03/24/monitor-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/monitor/2026/03/24/monitor-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md)
- [reports/monitor/2026/03/24/monitor-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/monitor/2026/03/24/monitor-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
- [reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.json)
- [reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/pulse/2026/03/24/pulse-20260324T022655Z-codex-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/rebalance/2026/03/24/rebalance-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/rebalance/2026/03/24/rebalance-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
- [reports/review/2026/03/24/review-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/review/2026/03/24/review-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.en.md)
- [reports/review/2026/03/24/review-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/review/2026/03/24/review-20260324T023205Z-pulse-direct-runtime-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)
- [reports/runtime-log/2026/03/24/runtime-log-20260324T023205Z-pulse-direct-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run01/reports/runtime-log/2026/03/24/runtime-log-20260324T023205Z-pulse-direct-full-d4cc6055-9811-4532-85f9-3944a817b5dd.md)

### run02

- [live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/preflight.json)
- [live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/recommendation.json)
- [live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/run-summary.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/run-summary.en.md)
- [live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/live-stateless/2026-03-24T022636Z-835b0710-edca-4d85-8f8a-64cb320a5e29/run-summary.md)
- [reports/monitor/2026/03/24/monitor-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/monitor/2026/03/24/monitor-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md)
- [reports/monitor/2026/03/24/monitor-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/monitor/2026/03/24/monitor-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md)
- [reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-835b0710-edca-4d85-8f8a-64cb320a5e29.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-835b0710-edca-4d85-8f8a-64cb320a5e29.json)
- [reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/rebalance/2026/03/24/rebalance-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/rebalance/2026/03/24/rebalance-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md)
- [reports/review/2026/03/24/review-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/review/2026/03/24/review-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.en.md)
- [reports/review/2026/03/24/review-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/review/2026/03/24/review-20260324T023155Z-pulse-direct-runtime-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md)
- [reports/runtime-log/2026/03/24/runtime-log-20260324T023155Z-pulse-direct-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run02/reports/runtime-log/2026/03/24/runtime-log-20260324T023155Z-pulse-direct-full-835b0710-edca-4d85-8f8a-64cb320a5e29.md)

### run03

- [live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/preflight.json)
- [live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/recommendation.json)
- [live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/run-summary.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/run-summary.en.md)
- [live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/live-stateless/2026-03-24T022642Z-dea54f09-16a0-4a79-8a99-e23be84158ee/run-summary.md)
- [reports/monitor/2026/03/24/monitor-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/monitor/2026/03/24/monitor-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md)
- [reports/monitor/2026/03/24/monitor-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/monitor/2026/03/24/monitor-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md)
- [reports/pulse/2026/03/24/pulse-20260324T022657Z-codex-full-dea54f09-16a0-4a79-8a99-e23be84158ee.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/pulse/2026/03/24/pulse-20260324T022657Z-codex-full-dea54f09-16a0-4a79-8a99-e23be84158ee.json)
- [reports/pulse/2026/03/24/pulse-20260324T022657Z-codex-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/pulse/2026/03/24/pulse-20260324T022657Z-codex-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/rebalance/2026/03/24/rebalance-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/rebalance/2026/03/24/rebalance-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md)
- [reports/review/2026/03/24/review-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/review/2026/03/24/review-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.en.md)
- [reports/review/2026/03/24/review-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/review/2026/03/24/review-20260324T023501Z-pulse-direct-runtime-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md)
- [reports/runtime-log/2026/03/24/runtime-log-20260324T023501Z-pulse-direct-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run03/reports/runtime-log/2026/03/24/runtime-log-20260324T023501Z-pulse-direct-full-dea54f09-16a0-4a79-8a99-e23be84158ee.md)

### run04

- [live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/preflight.json)
- [live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/recommendation.json)
- [live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/run-summary.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/run-summary.en.md)
- [live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/live-stateless/2026-03-24T022638Z-4c7d06e0-9610-4eb9-9c50-8cf395459e95/run-summary.md)
- [reports/monitor/2026/03/24/monitor-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/monitor/2026/03/24/monitor-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md)
- [reports/monitor/2026/03/24/monitor-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/monitor/2026/03/24/monitor-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md)
- [reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.json)
- [reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/pulse/2026/03/24/pulse-20260324T022652Z-codex-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/rebalance/2026/03/24/rebalance-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/rebalance/2026/03/24/rebalance-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md)
- [reports/review/2026/03/24/review-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/review/2026/03/24/review-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.en.md)
- [reports/review/2026/03/24/review-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/review/2026/03/24/review-20260324T023422Z-pulse-direct-runtime-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md)
- [reports/runtime-log/2026/03/24/runtime-log-20260324T023422Z-pulse-direct-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run04/reports/runtime-log/2026/03/24/runtime-log-20260324T023422Z-pulse-direct-full-4c7d06e0-9610-4eb9-9c50-8cf395459e95.md)

### run05

- [live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/preflight.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/preflight.json)
- [live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/recommendation.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/recommendation.json)
- [live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/run-summary.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/run-summary.en.md)
- [live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/run-summary.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/live-stateless/2026-03-24T022655Z-38f546fa-52ca-4cd1-a459-ad94995f0844/run-summary.md)
- [reports/monitor/2026/03/24/monitor-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/monitor/2026/03/24/monitor-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md)
- [reports/monitor/2026/03/24/monitor-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/monitor/2026/03/24/monitor-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md)
- [reports/pulse/2026/03/24/pulse-20260324T022721Z-codex-full-38f546fa-52ca-4cd1-a459-ad94995f0844.json](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/pulse/2026/03/24/pulse-20260324T022721Z-codex-full-38f546fa-52ca-4cd1-a459-ad94995f0844.json)
- [reports/pulse/2026/03/24/pulse-20260324T022721Z-codex-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/pulse/2026/03/24/pulse-20260324T022721Z-codex-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/rebalance/2026/03/24/rebalance-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md)
- [reports/rebalance/2026/03/24/rebalance-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/rebalance/2026/03/24/rebalance-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md)
- [reports/review/2026/03/24/review-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/review/2026/03/24/review-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.en.md)
- [reports/review/2026/03/24/review-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/review/2026/03/24/review-20260324T023340Z-pulse-direct-runtime-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md)
- [reports/runtime-log/2026/03/24/runtime-log-20260324T023340Z-pulse-direct-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md](../../autonomous-poly-trading-timeout-exp/runtime-artifacts/timeout-calibration/run05/reports/runtime-log/2026/03/24/runtime-log-20260324T023340Z-pulse-direct-full-38f546fa-52ca-4cd1-a459-ad94995f0844.md)
