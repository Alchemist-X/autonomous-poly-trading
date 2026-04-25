# Position Review Module Refactor Plan

Last updated: 2026-03-17

## Summary

The goal is not to keep expanding `pulse-direct` with existing-position review logic. The goal is to add a standalone `Position Review` module.

The intended responsibility split is:

- `Pulse`
  - research, candidates, prices, and edge inputs
- `Position Review`
  - review the current portfolio positions
- `Pulse Entry Planner`
  - extract new `open / skip` ideas from pulse research
- `Decision Composer`
  - merge `review + entries` into a single `TradeDecisionSet`

In other words:

- `Position Review` is not a child function inside `pulse-direct`
- it is a separate module
- it only reuses `pulse` research and edge signals

## Current Problem

In the current default path:

- `pulse-direct` hardcodes all existing positions to `hold`
- it does not actually evaluate whether a current position still has edge
- it does not allow the AI to actively emit `close / reduce` for existing positions
- `review-report` currently summarizes decisions, but it is not a real review report

So the current structure still does not satisfy:

1. think about whether the current position still has edge
2. continue only if that edge still exists
3. allow the AI to sell when a position is no longer good
4. always produce a readable conclusion

## Target Behavior

Each `daily pulse` cycle should handle existing positions like this:

1. load the current portfolio
2. load pulse research results
3. review each current position:
   - whether the thesis still holds
   - whether edge still exists
   - whether contrary evidence has appeared
   - whether the position is near or beyond stop loss
   - whether it is still worth using portfolio capacity
4. output one conclusion per position:
   - `hold`
   - `reduce`
   - `close`
5. every conclusion must include:
   - `still_has_edge`
   - `reason`
   - `confidence`
   - `human_review_flag`
6. merge those conclusions with new entry suggestions
7. automatically write a `review-report`

## Planned Modules

### 1. `services/orchestrator/src/review/position-review.ts`

Responsibility:

- input:
  - `overview`
  - `positions`
  - `pulse snapshot`
  - parsed pulse recommendations
  - config
- output:
  - one review result per existing position
  - including:
    - `action`
    - `stillHasEdge`
    - `humanReviewFlag`
    - `reason`
    - `confidence`
    - `decision`

### 2. `services/orchestrator/src/runtime/pulse-entry-planner.ts`

Responsibility:

- parse pulse markdown / pulse candidates
- generate new entry candidates
- output:
  - `open`
  - `skip`
- does not handle existing positions

### 3. `services/orchestrator/src/runtime/decision-composer.ts`

Responsibility:

- merge:
  - `position review results`
  - `pulse entry plans`
- handle deduplication
- avoid repeated `open` actions for already-held tokens
- output unified `TradeDecisionSet["decisions"]`

## New Main Flow

The adjusted main flow should be:

1. load portfolio
2. generate pulse
3. parse pulse entry plans
4. run position review
5. compose decisions
6. apply guardrails
7. build execution plan
8. execute or preview
9. sync state
10. write summary / reports / archive

## Reporting Requirements

`review-report` should no longer just list non-`hold` decisions. It should answer:

- which existing positions should still be held
- which existing positions should be reduced
- which existing positions should be exited
- whether each position still has edge
- which conclusions should be reviewed by a human

Suggested sections:

1. review overview
2. existing-position review results
3. new entry suggestions
4. positions that still have edge
5. positions that have lost edge
6. human review priorities
7. model reflection

## Implementation Order

### Phase 1

- add `position-review.ts`
- support:
  - `hold`
  - `close`
- every existing position must have a conclusion

### Phase 2

- extract `pulse-entry-planner.ts`
- move pulse parsing logic out of `pulse-direct-runtime.ts`

### Phase 3

- add `decision-composer.ts`
- merge review output with entry output

### Phase 4

- refactor `pulse-direct-runtime.ts`
- make it responsible only for:
  - calling review
  - calling the entry planner
  - calling the composer
  - producing logs / artifacts

### Phase 5

- upgrade `review-report`
- write `still_has_edge / human_review_flag / reason`

## Acceptance Criteria

- existing positions are no longer hardcoded to `hold`
- the AI can output `close` for current positions
- every existing position gets a review conclusion
- `review-report` directly shows:
  - hold
  - sell
  - reason
  - whether edge still exists

## Current Execution Decision

This round will implement:

- a standalone `Position Review` module
- a standalone `Pulse Entry Planner`
- a standalone `Decision Composer`
- a thin `pulse-direct-runtime`
- a `review-report` that includes edge conclusions for current positions
