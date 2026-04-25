# Repository Slimming And Refactor Draft

This document turns the previous discussion into an editable Markdown draft so you can modify, remove, or annotate it directly.

Suggested usage:

- edit the checklist items directly
- add your own judgments under each section
- delete anything you disagree with
- keep only the parts you want to continue with

## Current Goal

The current default goal is:

- make the main system path more explicit
- identify modules that are truly unused or still placeholder-level
- separate:
  - core modules
  - merge candidates
  - legacy / experimental modules
  - modules that should be removed or de-emphasized

## 1. Module Triage Checklist

Please edit the status using:

- `[keep]`
- `[merge]`
- `[demote]`
- `[remove]`
- `[pending]`

### 1. Main trading path

- [ ] `Pulse` market scanning and reporting
  - Current suggestion: `keep`
  - Reason: this is the information source for `daily pulse`

- [ ] `pulse-direct`
  - Current suggestion: `keep`
  - Reason: it can become the single main decision path

- [ ] `provider-runtime`
  - Current suggestion: `demote`
  - Reason: keep it for replay, comparison, and compatibility, but not as the main path

- [ ] `live:test`
  - Current suggestion: `merge`
  - Reason: heavily overlaps with `pulse:live`

- [ ] `pulse:live`
  - Current suggestion: `merge`
  - Reason: heavily overlaps with `live:test`

- [ ] local `paper` trading
  - Current suggestion: `keep`
  - Reason: still valuable for local validation and manual confirmation

- [ ] `trial:recommend / trial:approve / trial:reset-paper`
  - Current suggestion: `merge`
  - Reason: they should become thin paper wrappers on top of a shared core

### 2. Execution and risk

- [ ] executor trading adapter
  - Current suggestion: `keep`
  - Reason: this is the real execution base

- [ ] `sync portfolio`
  - Current suggestion: `keep`
  - Reason: this is the core of portfolio monitoring

- [ ] `stop-loss`
  - Current suggestion: `keep`
  - Reason: real risk-control behavior

- [ ] `flatten`
  - Current suggestion: `keep`
  - Reason: explicit and useful liquidation capability

- [ ] scattered preflight logic
  - Current suggestion: `merge`
  - Reason: should become a shared probe module

- [ ] scattered error rendering and terminal summaries
  - Current suggestion: `merge`
  - Reason: should be unified through `terminal-ui`

### 3. Reporting and archives

- [ ] `run-summary`
  - Current suggestion: `keep`
  - Reason: already aligns well with your workflow

- [ ] `review-report`
  - Current suggestion: `pending`
  - Reason: schema and UI know about it, but a full producer does not exist yet

- [ ] `portfolio-monitor-report`
  - Current suggestion: `add and keep`
  - Reason: execution behavior exists, but human-readable output is missing

- [ ] `rebalance-report`
  - Current suggestion: `add and keep`
  - Reason: future `daily pulse` needs this structural explanation

- [ ] `backtest-report`
  - Current suggestion: `demote`
  - Reason: current implementation is still lightweight / placeholder-like

- [ ] `resolution-report`
  - Current suggestion: `keep`
  - Reason: this is a real long-running capability

### 4. Peripheral and experimental surface

- [ ] `openclaw`
  - Current suggestion: `demote`
  - Reason: currently looks like a reserved provider rather than an active main capability

- [ ] `rough-loop`
  - Current suggestion: `demote`
  - Reason: move it out of the main product story and treat it as a separate experimental / ops subsystem

- [ ] README language that presents many entrypoints as co-equal core architecture
  - Current suggestion: `rewrite`
  - Reason: it expands the apparent system boundary and makes future decisions harder

## 2. Main redundancy points identified so far

### 1. Two heavy live scripts

Current large files:

- `scripts/live-test.ts`: about `809` lines
- `scripts/pulse-live.ts`: about `1269` lines
- `scripts/live-run-summary.ts`: about `453` lines

Current issues:

- duplicated preflight, archive handling, summaries, context rows, and error output
- both live routes behave like full product entrypoints instead of reusing one shared run core

### 2. Two decision architectures living in parallel

- `services/orchestrator/src/runtime/provider-runtime.ts`: about `828` lines
- `services/orchestrator/src/runtime/pulse-direct-runtime.ts`: about `325` lines

Current issues:

- if the final product wants `pulse-direct` as the only main path, keeping `provider-runtime` as a main feature raises complexity
- artifact, reasoning, and summary behavior is split across runtimes

### 3. Too many top-level commands for what are really backend differences

Current surface includes:

- `trial:*`
- `live:test`
- `pulse:live`
- orchestrator + executor + web

Current issue:

- many differences are really just `state backend` or `execution backend`
- but they currently appear as multiple top-level flows and scripts

## 3. Refactor draft

The following is the current recommended draft. You can edit or remove anything.

### Refactor goal

Converge the system toward:

- one main use case: `daily pulse`
- one main decision mode: `pulse-direct`
- one shared core
- adapters for paper/live behavior

### Structure draft

#### 1. One shared run core

Unified main flow:

1. load portfolio
2. generate pulse
3. pulse direct decisions
4. apply guardrails
5. build execution plan
6. execute or preview
7. sync state
8. write summary / reports / archive

Recommendation:

- `trial:*`
- `live:test`
- `pulse:live`

should all call the same core instead of each owning a full copy of the flow.

#### 2. Use adapters instead of continuing to fork scripts

Suggested adapters:

- `state adapter`
  - `paper-local`
  - `db-state`
  - `remote-live snapshot`

- `execution adapter`
  - `paper`
  - `live-direct`
  - `live-queue`

- `report adapter`
  - `run-summary`
  - `monitor-report`
  - `review-report`
  - `rebalance-report`

#### 3. Converge the decision layer

Recommendation:

- make `pulse-direct` the single main decision entrypoint
- demote `provider-runtime` to:
  - replay tool
  - comparison tool
  - legacy compatibility layer

Responsibility split:

- Pulse: what to buy, why, and suggested sizing
- Risk: whether it is allowed and how much is permitted
- Execution: how the order is sent and how state is synced

#### 4. Unify the reporting layer

Use one shared report model for at least:

- `run-summary`
- `portfolio-monitor`
- `portfolio-review`
- `portfolio-rebalance`

Suggested shared fields:

- run metadata
- actions / blocked / skipped
- portfolio before / after
- reasoning summary
- model reflection
- artifact links

## 4. Suggested phased rollout order

### Phase 1

- merge the shared logic from `live:test` and `pulse:live`
- do not change CLI names yet, only extract a shared core

### Phase 2

- converge toward `pulse-direct`
- mark `provider-runtime` as legacy

### Phase 3

- unify preflight / archive / terminal error / summary handling

### Phase 4

- connect `review / monitor / rebalance` Markdown outputs into the execution path

### Phase 5

- clean up experimental surface:
  - `openclaw`
  - `rough-loop`
  - placeholder-style `backtest`
  - report types without a real producer

## 5. Decisions I need you to lock

Please edit the lines below directly.

### 1. Your definition of the main path

- Current default: `daily pulse`
- Your edit:

### 2. Whether `provider-runtime` should remain

- Current default: keep it, but demote it to legacy
- Your edit:

### 3. Whether `rough-loop` should remain in the main repo

- Current default: keep the code, but demote it out of the main product story
- Your edit:

### 4. Whether `openclaw` should remain

- Current default: demote to experimental
- Your edit:

### 5. Whether `backtest` should continue or be de-emphasized

- Current default: demote it and remove it from the main UI/story
- Your edit:

## 6. The sections I suggest you edit first

- `1. Module Triage Checklist`
- `3. Refactor draft`
- `5. Decisions I need you to lock`

Once you edit this file, I can use your revised version as the source of truth instead of guessing from scratch.
