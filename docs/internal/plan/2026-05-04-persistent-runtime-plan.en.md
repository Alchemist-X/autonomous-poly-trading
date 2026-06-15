# Predict Raven Agent-first Persistent Runtime Plan

## Goal

- Turn the persistence module into an **Agent-first trading runtime**: Raven Agent owns full-context reasoning, trade intent, and self-correction; core code provides tools, feedback injection, audit trails, and a small set of non-bypassable hard boundaries.
- Start with a `12h` continuous-run target to validate the achieve-evaluate-update loop before aiming for 30+ unattended days.
- This document is only a plan and task breakdown. It does not start implementation.

## Review Entry Points

- `services/orchestrator/src/runtime/`: best place for the Raven Agent loop, Evaluator, and feedback injection.
- `services/orchestrator/src/jobs/agent-cycle.ts`: current stateful agent-cycle entry point; can become the per-run orchestrator.
- `services/orchestrator/src/lib/execution-planning.ts`: where trade intents enter risk clipping before execution.
- `scripts/pulse-live.ts`: existing live preflight, archives, and error summaries can be extracted into shared capabilities.
- `scripts/position-monitor.ts`: model-free stop-loss guardian.
- `docs/risk-controls.md`: needs to distinguish soft feedback from hard limits.

## Core Design

### 1. Raven Agent Is The Driver

Each run starts with Raven Agent reading a complete context pack and producing a trading judgment:

- Current positions, balance, risk caps, and system status.
- The latest N run summaries, prior Raven Agent reasoning, and failure records.
- Latest pulse, market candidates, and relevant sources.
- Evaluator findings from the previous run and this run's required checklist.

Raven Agent outputs:

- Human-readable reasoning.
- Structured `trade_intents.json`.
- Current position review: whether each position should be held, reduced, closed, or kept waiting for resolution.
- Responses to evaluator feedback.
- Whether to investigate more, downgrade, pause, or execute.

### 2. Evaluator / Feedback Continuously Improves Raven Agent

The Evaluator does not replace Raven Agent's judgment. It checks output quality and injects findings back into the current conversation.

Evaluator v1 is split into several types that assess Raven Agent reasoning quality, decision-making quality, and process completeness:

| Evaluator type | What it checks | Output |
| --- | --- | --- |
| Reasoning quality | Thesis, counter-evidence, probability gap, confidence, stale information, missing scenarios | Reasoning gaps and questions to answer |
| Decision quality | Whether open / hold / reduce / close matches edge, odds, position state, and prior reasoning | Trading judgments that need response or revision |
| Process completeness | Correct sources, resolution rules, official references, latest order book, current positions, and wallet state | Missing steps, wrong sources, queries to rerun |
| Execution feasibility | Token tradability, order book depth, minimum order size, slippage, liquidity | Execution risks and size revision suggestions |
| Post-training data | Whether context / decision / feedback / revised decision can be reviewed and trained on | Missing artifacts and structured fields |

Process completeness is especially important:

- Raven Agent must explicitly review current positions, not only new opportunities.
- For every held market, it must identify the resolution terms, correct resolution source, and whether the fetched information is current.
- Sources should be primary or trusted aggregated sources, not only second-hand conclusions.
- Market probability, Raven Agent probability, liquidity, and order book data should come from the same time window.
- If sources are missing or conflicting, the run should query or collect more evidence instead of jumping to a trade conclusion.

Feedback uses a simple `1-5` score:

| Score | Meaning | System action |
| --- | --- | --- |
| `1` | Pass | Record result and continue |
| `2` | Minor reminder | Inject soft reminder and continue |
| `3` | Response required | Inject a challenge and require itemized Raven Agent response |
| `4` | Revision required | Inject feedback and require a new decision |
| `5` | Hard boundary or real state unclear | Do not execute live-money actions; only explain, collect evidence, downgrade, or enter diagnostic mode |

### 3. Core Code Is The Agent Operating System

Core code provides:

- context pack builder
- evaluator runner
- feedback injector
- intent schema validator
- archive writer
- Query Code environment
- scheduler / heartbeat / lock
- executor queue adapter
- minimal hard risk controls

Core code should not invent strategy for Raven Agent, and Raven Agent should not be reduced to a report writer.

The Query Code environment:

- Gives Raven Agent and Evaluator a fast, read-only, reproducible query environment.
- Can inspect artifacts, DB snapshots, current positions, run summaries, market metadata, resolution sources, order books, and wallet preflight results.
- Can run small read-only analysis snippets to check whether a conclusion is supported by data.
- Cannot write state, place orders, or modify wallets by default; it only produces `query-code-result.json` as evidence for feedback and revised decisions.

### 4. A Small Set Of Hard Boundaries Remain Non-bypassable

These cannot be handled by feedback alone:

- Wallet address or env mismatch.
- System `paused` / `halted`.
- Re-entry lock already held.
- Token is not in the allowed trading set or cannot be verified.
- Trade, total exposure, event exposure, or max-position caps exceeded.
- Critical state is missing enough that real risk cannot be verified.

Additional definitions:

- System `paused` is a temporary pause state: no new live-money opens are allowed. Common triggers include manual pause, two consecutive failed runs, wallet/env mismatch, conflicting critical state, stale heartbeat, or repeated Evaluator score `5` hard-risk findings. `paused` can be manually resumed after diagnosis.
- System `halted` is a stronger risk stop, usually caused by portfolio drawdown, hard risk triggers, or material fund-safety concerns. In `halted`, new opens are forbidden; only diagnosis, cancel-open-orders, and necessary reduce / close flows are allowed.
- The re-entry lock prevents two Raven Agent runs, two schedulers, or a manual command from trading the same wallet at the same time. Each run writes runId, wallet, startedAt, heartbeat, and expiry; if the lock is active, the second run must skip instead of placing concurrent orders.
- "Critical state missing" means the system cannot identify real risk, not merely that one API failed. Examples: DB positions, remote Polymarket positions, wallet balance, latest archive, order book, or resolution source conflict. The system classifies state as `verified / stale / conflict / missing`; `conflict` or missing critical fields enter diagnostic mode and do not continue execution.

Outside those hard boundaries, prefer evaluator feedback so Raven Agent corrects itself.

## 12h Target

### Target Definition

Run a `12h` Agent-first persistence loop in a main-derived worktree or VPS environment:

- Wake Raven Agent every `90` to `120` minutes, for roughly `6` to `8` runs.
- Each run completes:
  1. build context pack
  2. current position review: per-position original thesis, current edge, resolution progress, order book, PnL, and risk usage
  3. Raven Agent initial analysis
  4. evaluator review
  5. feedback injection
  6. Raven Agent revised decision
  7. execution gate
  8. live execution dispatch
  9. archive + metrics
  10. update next-run checklist
- The first stage is live-first: use real wallet preflight, real positions, real market data, real order books, the full execution gate, and produce a dispatchable live execution plan.
- Code tests use a mock executor / fixture wallet to prevent accidental orders; product logic does not use `recommend-only` as the target state.
- The trading loop must be complete. It should not be centered on canceling orders or a temporary live-money switch; every run covers current-position review, new-opportunity scan, no-edge / overpriced asset handling, feedback revision, execution gate, live execution plan, and post-run review.
- If the user provides a new wallet address or env file, the 12h runner must print and archive the actual wallet address, collateral, chain, and env path. Address mismatch enters paused / diagnostic mode instead of continuing live execution.

### 12h Success Criteria

- Complete at least `6` loop runs.
- Every run writes complete artifacts:
  - `context-pack.json`
  - `position-review.json`
  - `source-resolution-audit.json`
  - `initial-decision.json`
  - `evaluator-report.json`
  - `feedback-injection.md`
  - `revised-decision.json`
  - `execution-gate.json`
  - `execution-dispatch-plan.json`
  - `run-summary.md`
  - `transcript-summary.md`
- Evaluator triggers and records at least one score `3` or `4` feedback item.
- Raven Agent must respond to feedback explicitly, not simply repeat it.
- Every existing position must be reviewed with a hold / reduce / close / wait-resolution reason.
- For positions with no edge, reversed edge, market overvaluation, broken thesis, or changed resolution risk, Raven Agent must evaluate reduce / close.
- Re-entry lock, heartbeat, and latest state refresh normally.
- Consecutive failures must not exceed `2`; if they do, the loop enters paused / diagnostic mode.
- At the end, write `12h-review.md`: which feedback improved decisions, which evaluator rules were false positives, and what should be updated next.

### Non-goals For 12h

- Do not require profit during the 12h run.
- Do not require unrestricted live trading.
- Do not require the evaluator to be perfect on the first iteration.
- Do not let core code automatically replace Raven Agent's strategy fallback.

## Achieve-Evaluate-Update Loop

### Achieve

Each run must produce a checkable result:

- Raven Agent completes one full trading judgment.
- Raven Agent completes a current-position review, especially checking whether no-edge or overpriced positions should be sold.
- Evaluator completes one quality review.
- Feedback is injected and produces a revised decision.
- Execution gate outputs execute, skip, downgrade, or block.
- Test mode may mock the executor, but the runtime must produce a real execution plan instead of only recommendations.
- The whole process is archived as a post-training trajectory.

### Evaluate

At the end of each run, evaluate:

- `analysis_completeness_score`: whether required dimensions were covered.
- `feedback_response_score`: whether Raven Agent genuinely absorbed feedback.
- `decision_stability`: whether the change from initial to revised decision is reasonable.
- `risk_alignment`: whether the decision matches current positions and hard limits.
- `position_review_quality`: whether every position was checked for edge, resolution, order book, PnL, and sell rationale.
- `process_completeness_score`: whether source / resolution / order book / wallet / current-position checks were completed.
- `artifact_quality`: whether later review and training are possible.
- `operator_intervention_needed`: whether a human must take over.

### Update

Each run writes evaluation results into the next-run checklist:

- Add or adjust evaluator rules.
- Add this run's exposed issue to the Raven Agent prompt.
- Add missing data to the context pack.
- Add quick queries to the Query Code environment.
- If a feedback type repeatedly false-positives, lower its score.
- If Raven Agent repeatedly ignores a risk, raise its score.
- If two runs fail consecutively, enter diagnostic mode and do not continue live execution.

## Implementation Phases

### Phase 0: Define Data Contracts

Create or standardize these schemas:

- `AgentContextPack`
- `PositionReview`
- `SourceResolutionAudit`
- `AgentInitialDecision`
- `EvaluatorReport`
- `FeedbackInjection`
- `AgentRevisedDecision`
- `ExecutionGateResult`
- `QueryCodeResult`
- `ExecutionDispatchPlan`
- `LoopMetrics`

Success criteria:

- Every artifact has a clear JSON schema.
- Any run can be replayed from artifacts alone.

### Phase 1: Build The 12h Runner

Add `agent-persistent-runner`:

- accepts `--duration-hours 12`
- accepts `--interval-minutes 90`
- defaults to live-first: full preflight, position review, execution gate, and a real execution plan
- supports `--env-file <path>` or wallet profile so a user-provided wallet address can be used
- supports `--mock-executor` for code testing only; production runs do not use recommend-only
- refreshes heartbeat every run
- uses a re-entry lock
- writes failures to `run-error/<timestamp>-agent-persistent/`

Success criteria:

- Local short smoke works with `--duration-minutes 20 --interval-minutes 5`.
- Smoke writes artifacts for at least 2 runs.

### Phase 2: Add Evaluator / Feedback

Implement evaluator:

- V1 includes reasoning quality, decision quality, process completeness, execution feasibility, and post-training data evaluators.
- Start with deterministic checklist + optional small-model critic.
- Output findings and `1-5` scores.
- Generate feedback prompts for scores `3` and above; score `4` requires a new decision; score `5` enters hard-boundary or diagnostic handling.

Implement feedback injector:

- Inject evaluator findings into the same-run Raven Agent revision stage.
- Require Raven Agent to respond to every finding.

Success criteria:

- A manually incomplete decision triggers revise.
- Raven Agent revised decision references and handles evaluator findings.

### Phase 3: Add Execution Gate And Hard Boundaries

Implement execution gate:

- schema validation
- system status: distinguish running / paused / halted and explain why paused
- wallet / env / collateral
- stale pulse
- token allowability
- risk caps
- lock / idempotency
- critical state classifier: mark critical state as verified / stale / conflict / missing

Success criteria:

- Soft problems go to feedback, not direct block.
- Hard problems always block.
- paused / halted / lock / critical-state reasons are understandable from the archive.
- Gate result is archived clearly.

### Phase 4: 12h Soak

Run sequence:

1. `20min` local smoke.
2. `2h` live-first runner + mock executor trial to validate code and archives.
3. `12h` live-first runner with the user-provided wallet/env and real preflight; whether executor is mocked must be printed by runtime parameters.
4. If live execution is enabled, every archive must record wallet, collateral, risk caps, execution dispatch plan, and executor response.

Success criteria:

- The 12h review clearly lists:
  - what was achieved
  - which evaluator feedback worked
  - how Raven Agent improved
  - which current positions had no edge, which looked overpriced, and which should continue to hold
  - which data gaps blocked judgment
  - how the next run should update prompt / evaluator / context pack

## User Decisions

- Decision: should the 12h stage use real executor or mock executor?
  - Why it matters: the user does not need recommend-only, but code testing still needs protection against accidental orders.
  - Recommended default: use `--mock-executor` for code debugging, then use real executor for the formal 12h live-first runner with execution mode printed.

- Decision: should Evaluator v1 use deterministic checklist or small-model critic?
  - Why it matters: checklist is controllable; small-model critic is closer to the post-training target.
  - Recommended default: checklist first, with a small-model critic adapter kept open.

- Decision: which provider runs Raven Agent?
  - Why it matters: Claude Code / Codex / OpenClaw differ in session persistence, tool permissions, and cost.
  - Recommended default: build a provider-neutral runner so Raven Agent can be swapped.

- Decision: new wallet address or env file.
  - Why it matters: the 12h runner must verify the actual wallet, collateral, and risk caps instead of assuming `.env.pizza` is always the active account.
  - Recommended default: support `--env-file` / wallet profile; preflight prints and archives the actual address, and mismatches pause the run.

## Risks And Assumptions

- Risk: too much feedback makes Raven Agent overly conservative.
  - Mitigation: track feedback hit rate and false positives, then update scores each run.

- Risk: feedback is too soft and Raven Agent ignores it.
  - Mitigation: score `3` and above require itemized responses; score `4` requires a new JSON decision.

- Risk: Agent-first decisions become irreproducible.
  - Mitigation: force full archiving of context pack, decision, feedback, revised decision, and gate.

- Risk: post-training data is weak if only natural-language summaries are stored.
  - Mitigation: every key step writes both machine-readable JSON and transcript summaries.

- Assumption: the first 12h target is live-first; local code testing may mock the executor, but that is not the product default mode.
- Assumption: core code can be refactored into an Agent operating system rather than a fixed strategy engine.
- Assumption: the user wants Raven Agent to be able to reach order placement, while accepting a small set of non-bypassable hard boundaries.

## Execution Gate

- Wait for user review of this plan.
- If approved, start with Phase 0 plus a 20min mock-executor smoke, then proceed to the 2h / 12h live-first runner.

## Current Implementation Progress (2026-05-04)

- Added `services/orchestrator/src/runtime/raven-agent-loop.ts`:
  - `AgentContextPack`
  - `PositionReviewArtifact`
  - `SourceResolutionAudit`
  - `EvaluatorReport`
  - `FeedbackInjection`
  - `ExecutionGateResult`
  - `ExecutionDispatchPlan`
  - `LoopMetrics`
- Added `scripts/agent-persistent-runner.ts` and `pnpm agent:persistent`:
  - supports `--duration-minutes`
  - supports `--interval-minutes`
  - supports `--max-iterations`
  - supports `--archive-root`
  - supports `--env-file`
  - supports `--mock-executor` for code testing
  - writes and releases `runner.lock` by default to prevent re-entry
- The current runner is a live-first artifact loop: it generates a real execution plan in `execution-dispatch-plan.json` and no longer targets recommend-only.
- Real executor dispatch is not wired yet; running without `--mock-executor` fails fast to avoid accidental orders from a partial implementation.
- Added `services/orchestrator/src/runtime/raven-agent-loop.test.ts`, covering evaluator behavior, execution gate behavior, and artifact writing.
- Verified:
  - `pnpm exec vitest run --config config/vitest.config.ts services/orchestrator/src/runtime/raven-agent-loop.test.ts`
  - `pnpm agent:persistent -- --duration-minutes 0 --max-iterations 1 --interval-minutes 0 --mock-executor --archive-root runtime-artifacts/raven-agent-smoke`
  - `pnpm agent:persistent` without `--mock-executor` refuses live dispatch
  - Pre-seeding `runner.lock` makes the runner refuse startup, validating re-entry protection
- Fixed pre-existing typecheck blockers found while validating:
  - `paper-trading.test.ts` `PlannedExecution` fixture now includes `orderType` / `gtcLimitPrice` / `categorySlug` / `negRisk`
  - `full-pulse.ts` now uses existing `TextMetrics.approxTokens`
- Current validation:
  - `pnpm typecheck` passes
  - `pnpm test` passes (39 files / 320 tests)
  - Because `vendor/repos` is an ignored runtime dependency, this worktree needs `vendor/repos/all-polymarket-skill` copied from the main worktree before the full provider runtime tests pass
