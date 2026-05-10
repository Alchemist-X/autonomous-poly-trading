# Pulse Quality Improvement Process Plan

Last updated: 2026-05-05

Chinese version: [`2026-05-05-pulse-quality-improvement-plan.md`](2026-05-05-pulse-quality-improvement-plan.md)

## Goal

- Convert the latest eval feedback into the standard `pulse` execution process.
- Improve real-money forecasting quality by preventing misbound orders, reviewing existing positions, and explaining PnL, not only by finding new entries.
- Add the required P00 / P0 gates before the next `pulse:live` run.

## Outcome

- `pulse:live` will pass a market identity gate before any live order, preventing failures like `$200 thesis -> $115 order`.
- Existing positions will no longer default to stale hold; each one will output fresh evidence / adverse signal / reduce-close conditions.
- run-summary will explain cash, equity, position-count, and PnL changes.
- Sports data enrichment stays in P3 and does not block the current P00/P0 fixes.

## Implementation

### 1. P00: Market Binding Gate

Goal: before live execution, the researched object and executed object must match exactly.

Fields that must match exactly:

- `marketSlug`
- `tokenId`
- `outcomeLabel`
- rule threshold / strike / candidate / team
- report market title and execution-plan question must correspond

Fields allowed to differ within 3%:

- `bestBid`
- `bestAsk`
- `decision price`
- expected fill price

Execution flow:

1. Pulse report emits structured `selected_decisions`.
2. Entry planner builds the execution plan.
3. Before order placement, run `validateDecisionBinding(reportDecision, executionPlan)`.
4. If identity fields mismatch, fail fast and block trading.
5. If price fields differ by more than 3%, re-quote; if still out of range, require human review or skip.

Acceptance:

- `$115 / $130 / $200` strikes under the same event cannot cross-bind.
- run-summary records whether the binding gate passed or failed.

### 2. P0: Existing Position Review Gate

Goal: existing positions must receive real review, not automatic hold because no opposing pulse exists.

Every existing position must output:

- Whether the current thesis still holds
- fresh evidence: new supporting evidence
- adverse signal: new opposing evidence
- edge status: active edge / stale edge / no edge / unknown
- action: hold / reduce / close / review_required
- stop-loss / take-profit / reduce trigger
- PnL state: unrealized PnL, cost, current mark, change reason

Process changes:

1. Position Review runs before new-entry recommendations.
2. If there is no fresh evidence, label only as `stale-hold`, not `still has edge`.
3. If a position is close to stop-loss, close to resolution, or has lacked fresh evidence for more than N days, force `review_required`.
4. When Composer merges decisions, existing-position review risks take priority over new entries.

Acceptance:

- Review report no longer says `still has edge: yes` while `edge=0`.
- Every hold answers “why not reduce/close now”.

### 3. P1: PnL Attribution Summary

Goal: run-summary explains equity changes instead of only listing before/after numbers.

Add a PnL attribution block with:

- Pre-run cash / equity / open positions
- New-fill notional, avgPrice, immediate mark, spread/slippage
- Existing-position mark-to-market changes
- fees / gas / trading fee / rounding
- Position-count change: expected delta vs actual delta
- Anomalies, such as 3 fills but positions only +2

Acceptance:

- Changes like `equity $548.13 -> $529.01` must have reason categories.
- If the reason cannot be determined, label `unexplained_delta` and output the artifact paths to inspect.

### 4. P1: Deep Research Coverage Policy

Goal: separate “pre-scan” from “live-tradable”.

Suggested rules:

- Pre-scan can deep-research only Top N.
- Live open decisions must have complete research: rules, resolution source, comments, orderbook, external source, known gaps.
- Incomplete candidates can only enter watchlist, not executable plan.

Acceptance:

- Reports clearly label `tradable` / `watchlist` / `insufficient_research`.
- `4/20 deep research` can exist, but cannot be presented as complete live research coverage.

### 5. P2: Citation And Comment Evidence

Goal: make evidence auditable.

Changes:

- Key claims use `source / retrieved_at / credibility / viewpoint / short quote`.
- Comment sampling covers latest, top-liked, holder, and opposition categories.
- Comments enter the evidence chain only when they affect probability; otherwise they stay in comment audit.

Acceptance:

- Humans can trace each key judgment back to source.
- “Public common knowledge” or “betting consensus” no longer substitutes for citation.

### 6. P3: Sports Data Collection TODO

Goal: improve sports forecasting later without blocking current P00/P0 fixes.

Football / World Cup:

- FIFA ranking
- Elo / SPI-style ratings
- Bookmaker odds
- Injuries and squad news
- Schedule path
- Sibling-market probability totals

Eurovision:

- Eurovisionworld / bookmaker odds
- Song-release reactions
- Semifinal draw
- Running order
- Media and community reactions

Acceptance:

- Low-edge sports positions must include sensitivity: whether edge survives changes in external odds / Elo / injury assumptions.

## User Decisions

- Decision: whether P00 market binding gate blocks the next `pulse:live`.
  - Why it matters: this is the minimum protection against real-money misbound orders.
  - Recommended default: yes.

- Decision: mandatory refresh cadence for Existing Position Review.
  - Why it matters: too frequent increases search cost; too sparse lets stale holds accumulate risk.
  - Recommended default: review every live run; if constrained, at least review positions with largest PnL impact, near stop-loss, or near resolution.

- Decision: whether price tolerance stays fixed at 3%.
  - Why it matters: too tight blocks normal quote movement; too loose lets real mispricing through.
  - Recommended default: start with 3%, then calibrate from fill / quote deviation data.

## Risks And Assumptions

- Assumes pulse report / recommendation / execution plan expose enough fields for a binding validator.
- Risk: if the report stays Markdown-only, binding validation depends on brittle parsing; structured decision JSON should come first.
- Risk: Position Review adds search time and may lengthen pulse runtime.
- Risk: PnL attribution needs reliable mark snapshots; if post-fill refresh is unstable, label `unexplained_delta` instead of inventing a cause.

## Execution Gate

- Wait for user review or edits to this plan.
- Do not implement in the same turn as plan creation.
- After user confirmation, implement P00 market binding gate first, then P0 existing-position review gate, then PnL attribution.
