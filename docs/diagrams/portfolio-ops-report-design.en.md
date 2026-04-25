# Portfolio Monitor / Review / Rebalance Report Design

This document defines what Markdown artifacts should be produced for portfolio monitor, review, and rebalance, what the model reflection should contain, and how those artifacts should be archived.

This is a human-facing design and acceptance document. It separates:

- logic that already exists in the repository
- recommended Markdown outputs that should be added

## 1. What each capability is supposed to answer

### 1. Portfolio Monitor

It answers:

- whether current positions changed abnormally
- whether stop-loss, drawdown halt, position disappearance, or price anomalies were triggered
- what requires immediate human attention

This is primarily a monitoring and alerting function.

### 2. Portfolio Review

It answers:

- whether each existing position is still worth holding
- whether the original thesis still holds
- which positions should be `hold / reduce / close / rotate`

This is primarily a thesis review function.

### 3. Rebalance

It answers:

- how the current portfolio differs from the target structure
- which trades should move the portfolio back toward that structure
- which proposed trades were blocked by risk or liquidity constraints

This is primarily a structural adjustment function.

## 2. What already exists in the repository

The repository does not currently expose these as three separate services. The behavior is split across modules:

- `monitor`
  - actual implementation: executor `sync portfolio + stop-loss + snapshot`
  - code:
    - [services/executor/src/workers/queue-worker.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/workers/queue-worker.ts#L120)
- `review`
  - actual implementation: runtime decision flow and pulse integration
  - code:
    - [services/orchestrator/src/runtime/pulse-direct-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/pulse-direct-runtime.ts#L216)
    - [services/orchestrator/src/runtime/provider-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/provider-runtime.ts)
- `rebalance`
  - currently limited to:
    - guardrail-based sizing/clipping for new opens
    - `flatten` full liquidation
  - code:
    - [services/orchestrator/src/lib/risk.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/lib/risk.ts#L48)
    - [services/executor/src/workers/queue-worker.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/workers/queue-worker.ts#L215)

Conclusion:

- execution behavior exists
- dedicated human-readable Markdown reports for these three categories do not yet exist

The rest of this document describes the recommended end-state artifacts.

## 3. Markdown output for Portfolio Monitor

### Goal

Let a human immediately understand:

- what the monitor observed
- what changed in the portfolio
- whether automatic actions were triggered
- what requires intervention

### Recommended filenames

- Chinese:
  - `runtime-artifacts/reports/portfolio-monitor/YYYY/MM/DD/portfolio-monitor-<timestamp>-<wallet>.md`
- English:
  - `runtime-artifacts/reports/portfolio-monitor/YYYY/MM/DD/portfolio-monitor-<timestamp>-<wallet>.en.md`

### Recommended sections

1. Run overview
2. Portfolio snapshot
3. Position changes
4. Risk alerts
5. Automatic actions
6. Model reflection
7. Human follow-up items

### Recommended example

```md
# Portfolio Monitor Report

## Run Overview

- Wallet: pizza
- Monitor time: 2026-03-17 15:00:00 CST
- Data source: Polymarket remote positions + local snapshot
- System status: running

## Portfolio Snapshot

- Cash: 15.99 USDC
- Open Positions: 4
- Total Equity: 19.42 USD
- Drawdown: 2.8%

## Position Changes

| Market | Side | Previous | Current | Change |
| --- | --- | --- | --- | --- |
| Bitcoin dip to 65k | No | 0 | 1.34 | New |
| Gavin Newsom nomination | No | 0 | 1.32 | New |
| Fed cut by June | No | 1.00 | 1.00 | Unchanged |

## Risk Alerts

- No position triggered stop-loss.
- No portfolio-level drawdown halt.
- No remote/local position mismatch.

## Automatic Actions

- No automatic sell was executed.
- No flatten action was executed.

## Model Reflection

- This run did not make a new directional judgment. It only validated state and scanned for risk.
- The most useful signal was that remote positions matched the local snapshot, which suggests the execution writeback path is healthy.
- The biggest blind spot is that open-order changes and theme concentration are not yet monitored.
- Next suggested check: total exposure to the same political theme.

## Human Follow-up

- Decide whether political markets need a separate theme exposure cap.
- Decide whether “position disappeared without recorded execution” should be promoted to a critical alert.
```

### What the monitor reflection should contain

The monitor is not placing a new bet, so its reflection should not say “bullish” or “bearish”. It should explain:

- which monitoring signals were most trustworthy
- which blind spots were not covered
- which non-triggered risks should be checked next
- which issues should be escalated to a human

## 4. Markdown output for Portfolio Review

### Goal

Let a human clearly understand:

- what to do with each current position
- why that judgment was made
- why a hold is justified
- why a reduce or close is justified

### Recommended filenames

- Chinese:
  - `runtime-artifacts/reports/review/YYYY/MM/DD/portfolio-review-<timestamp>-<runId>.md`
- English:
  - `runtime-artifacts/reports/review/YYYY/MM/DD/portfolio-review-<timestamp>-<runId>.en.md`

### Recommended sections

1. Run overview
2. Current holdings
3. Position-by-position review
4. Portfolio-level conclusion
5. Positions no longer worth holding
6. Model reflection
7. Human review items

### What the review reflection should contain

Review reflection should focus on why the judgment is valid or where it might fail:

- which evidence mattered most
- what evidence is still missing
- which position is most likely misjudged
- which conclusions should be escalated to human review

## 5. Markdown output for Rebalance

### Goal

Let a human understand:

- how the current portfolio deviates from the target structure
- how the system wants to rebalance
- why some proposals were not executed

### Recommended filenames

- Chinese:
  - `runtime-artifacts/reports/rebalance/YYYY/MM/DD/portfolio-rebalance-<timestamp>-<runId>.md`
- English:
  - `runtime-artifacts/reports/rebalance/YYYY/MM/DD/portfolio-rebalance-<timestamp>-<runId>.en.md`

### Recommended sections

1. Rebalance overview
2. Current structure vs target structure
3. Proposed trades
4. Blocked trades
5. Expected post-trade structure
6. Model reflection
7. Human approval items

### What the rebalance reflection should contain

Rebalance reflection should discuss the portfolio structure, not just one market:

- whether the target structure is reasonable
- whether same-theme concentration is amplifying risk
- what happens if no rebalance is executed
- which proposals are theoretically correct but operationally blocked

## 6. Recommended common reflection fields

All three report types should share the same reflection frame:

- `Most important conclusion`
- `Most relied-on evidence`
- `Biggest blind spot`
- `Most likely failure mode`
- `What happens if we do nothing`
- `What needs human review`

Benefits:

- humans read every report with the same mental model
- reflection quality can be compared across runs
- model conclusions and human approval can be archived separately

## 7. Recommended archive layout

These artifacts should live under `runtime-artifacts/reports/`, not inside ad hoc chat notes:

```text
runtime-artifacts/reports/
  portfolio-monitor/YYYY/MM/DD/
    portfolio-monitor-<timestamp>-<wallet>.md
    portfolio-monitor-<timestamp>-<wallet>.en.md
    portfolio-monitor-<timestamp>-<wallet>.json
  review/YYYY/MM/DD/
    portfolio-review-<timestamp>-<runId>.md
    portfolio-review-<timestamp>-<runId>.en.md
    portfolio-review-<timestamp>-<runId>.json
  rebalance/YYYY/MM/DD/
    portfolio-rebalance-<timestamp>-<runId>.md
    portfolio-rebalance-<timestamp>-<runId>.en.md
    portfolio-rebalance-<timestamp>-<runId>.json
```

Each run should keep:

- Markdown primary file
- English copy
- structured JSON result
- links to pulse / runtime-log / execution-summary artifacts

## 8. Minimal rollout order

If this should be implemented incrementally, the natural order is:

1. `review-report`
   - closest to the current pulse/runtime decision chain
2. `portfolio-monitor-report`
   - sync and stop-loss logic already exists
3. `rebalance-report`
   - full target-structure logic does not exist yet

## 9. Purpose of this document

This is not an execution log. It is:

- a human acceptance reference
- an implementation template
- a blueprint for future automated artifacts

If the next step is code, the cleanest path is:

- add a shared Markdown renderer
- then feed `monitor / review / rebalance` structured results into it
