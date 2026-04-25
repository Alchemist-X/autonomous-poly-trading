# Rough Loop 8h Sustained Run Plan

中文版见 [2026-03-17-rough-loop-8h-run-plan.md](2026-03-17-rough-loop-8h-run-plan.md)。

Last updated: 2026-03-17

## Goal

- This plan assumes `Ralph loop` means the existing `Rough Loop` in this repository.
- The goal is not to let Rough Loop touch real trading or secrets. The goal is to let it sustain an `8h` run while pushing the main project objectives:
  - cloud autonomous trading for Polymarket
  - Portfolio Monitor / Review / Rebalance capabilities
  - Stop Loss / hard risk controls
  - remote deployment and long-running readiness
- This plan solves two concrete problems:
  - the loop must not run out of work during `8h`
  - every task card must have hard enough acceptance criteria to avoid fake progress

## Outcome

After applying this plan, we should have:

- a task pool large enough to keep Rough Loop busy for `8h`, not just 1 to 3 cards
- a queue biased toward the project's mainline instead of scattered low-value cleanup
- strong `Allowed Paths`, `Definition of Done`, and `Verification` on every task
- a way to score the run by completed count, pass rate, mainline impact, and artifact quality
- a stable `8h` autonomous coding run without handing Rough Loop real trading or production credentials

This plan does not directly do the following:

- it does not let Rough Loop take over real trading
- it does not implement an automatic task generator in this round; it uses a high-quality prebuilt task pool first

Additional clarification:

- you have now authorized, in principle, access to:
  - real private keys
  - real live trading
  - system-level security settings
  - replacing existing live services
- that still does not mean “unconditionally enabled”
- the plan will place those actions inside a strict risk envelope, and real execution does not begin until you provide the actual stop-loss and position-limit values

If you also provide a `VPS` plus `SSH` access, this plan expands into:

- direct build, test, smoke-run, and deployment rehearsal inside the remote workspace
- a dual-track model of “local 8h Rough Loop progress” plus “remote validation and deployment readiness”
- a plan that does not just generate tasks, but steadily pushes the project toward a real remotely operated system

## Implementation

### 1. Operating model

Treat the `8h` run as a controlled batch with quotas, refill lines, and acceptance gates.

Recommended targets:

- total duration: `8h`
- target completed tasks: `10` to `14`
- ideal task duration: `20` to `40` minutes each
- allowed task types:
  - code fixes
  - test hardening
  - docs and operator guidance
  - artifact-path completion
- default exclusions:
  - real trading
  - production deployment
  - private-key and sensitive env work

Recommended run shape:

1. Phase 0: Bootstrap `15` to `30` minutes
   - verify daemon, lock, heartbeat, and artifacts
   - run one minimal smoke task first
2. Phase 1: Mainline push `5h`
   - prioritize core trading, runtime, archive, and regression work
3. Phase 2: Hardening `2h`
   - cover monitor, stop-loss, deployment, and doc gaps
4. Phase 3: Closeout `30` to `45` minutes
   - avoid ending on half-finished work
   - produce run summary, handoff, and remaining backlog

### 1.5 Remote VPS / SSH execution track

If you provide:

- `VPS`
- `SSH host`
- `port`
- `user`
- authentication method
- remote workspace path

then this plan should become a two-track plan:

- local:
  - Rough Loop keeps pushing code, tests, docs, and queue supply for `8h`
- remote:
  - validate the current mainline with real build / test / smoke / deployment work

Recommended remote permission boundary:

- allowed by default:
  - clone / pull the repo
  - install dependencies
  - build / test / run pulse-live smoke
  - configure `cron` or `systemd`
  - write non-sensitive logs and artifacts
- now authorized in principle:
  - writing real private keys
  - enabling real live trading
  - changing firewall, cloud networking, or system-wide security settings
  - replacing existing production services
- before any of those high-risk actions actually happen, all of the following must still be true:
  - you provide explicit stop-loss and position-limit values
  - remote archival and fail-fast paths are already validated
  - emergency halt and rollback paths are prepared
  - execution mode, wallet, limits, and risk parameters are all printed explicitly in the output

Recommended remote priority order:

1. get remote build passing
2. get pulse-live recommend-only passing
3. get a constrained live-execution smoke passing
4. get the daily scheduler passing
5. only then consider the full `orchestrator + executor + Postgres + Redis` path

### 1.6 Risk envelope for real execution

Since you have now authorized real execution in principle, the plan needs to turn “allowed” into “allowed only within explicit limits.”

Parameters that must be fixed before live rollout:

- `POSITION_STOP_LOSS_PCT`
- `DRAWDOWN_STOP_PCT`
- `MAX_TRADE_PCT`
- `MAX_EVENT_EXPOSURE_PCT`
- `MAX_TOTAL_EXPOSURE_PCT`
- `MAX_POSITIONS`
- maximum acceptable daily loss
- wallet boundary for test wallet vs. production wallet
- emergency halt command and rollback procedure

Recommended first-round defaults:

- position stop loss: `20%` to `30%`
- max trade size per order: `1%` to `3%`
- max event exposure: `10%` to `20%`
- max total exposure: `20%` to `35%`
- max concurrent positions: `3` to `5`
- max daily tolerated loss: `2%` to `5%`

Without these values, do not enter real live-trading mode.

### 1.7 Currently confirmed first-round parameters

Based on the limits you just gave, this plan now uses:

- `DRAWDOWN_STOP_PCT=0.3`
  - reason: halt live trading once total loss exceeds `30%`
- `POSITION_STOP_LOSS_PCT=0.3`
  - reason: keep the per-position stop aligned with the current stop-loss threshold
- `MAX_TRADE_PCT=0.2`
  - reason: you explicitly raised the per-trade cap to `20%`
- `MAX_EVENT_EXPOSURE_PCT=0.3`
  - reason: you explicitly set it to `30%`
- `MAX_TOTAL_EXPOSURE_PCT=1.0`
  - reason: the current code cannot actually ignore this value; `100%` is the closest executable match to “full bankroll is acceptable”
- `MAX_POSITIONS=5`
  - reason: a `20 USD` account does not strictly cap the number of open positions, so we still keep a mild operational count limit
- `INITIAL_BANKROLL_USD=20`
  - reason: the remote test account starts at `20 USD`
- maximum daily loss threshold
  - current code has no separate daily-loss knob; for now `DRAWDOWN_STOP_PCT=0.3` acts as the effective hard stop

Compatibility note:

- current `live:test` preflight explicitly requires:
  - `MAX_TRADE_PCT<=0.1`
  - `MAX_EVENT_EXPOSURE_PCT<=0.3`
- this means your requested `MAX_TRADE_PCT=0.2` will make the current `live:test` fail immediately
- therefore the first real execution smoke should prefer:
  - `pulse:live`
- if we later want the full `live:test` path, we must either:
  - temporarily reduce `MAX_TRADE_PCT` back to `0.1`
  - or change the full-live preflight contract

### 2. Task supply design

Do not prepare only the live `Queue`. Prepare three layers.

Recommended three-layer supply:

- `Active Queue`
  - start with `8` task cards already in `rough-loop.md`
- `Warm Reserve`
  - keep another `6` to `8` cards ready to paste in
- `Cold Backlog`
  - keep another `6` to `10` candidate tasks as replacements

Recommended refill rules:

- when `todo < 4`, refill back to `8`
- when `2` tasks in a row become `blocked`, switch to the reserve batch
- when `2` tasks in a row produce mostly doc value and no core code/test progress, force the next batch back toward mainline engineering

### 3. Task mix

To keep the run aligned to the project, do not let task mix drift.

Recommended mix:

- `35%`: trading mainline and runtime stability
  - `provider-runtime`
  - `pulse-direct`
  - `pulse:live`
  - `trial:run`
- `25%`: Portfolio Monitor / Review / Stop Loss
  - `queue-worker`
  - snapshot
  - risk events
  - report artifacts
- `20%`: deployment and observability
  - remote deployment docs
  - health / status / summary
  - artifact discoverability
- `20%`: docs / regression / closeout
  - bilingual docs
  - missing tests
  - handoff / operator guidance

Hard constraints:

- docs-only tasks must stay under `30%` of the total
- at least `3` code or test tasks must always remain in `todo`
- do not allow `3` docs-only tasks in a row

### 4. Task admission standards

Before a candidate enters `Queue`, it must satisfy all of the following:

1. clearly helps the current project objective
2. can finish within Rough Loop's single-task budget
   - design for roughly `45` minutes or less
3. has narrow `Allowed Paths`
   - ideally `1` to `5` files
4. has an outcome-based `Definition of Done`
5. has specific `Verification`
   - prefer targeted tests or smoke checks
6. does not require fresh secrets from the user
7. does not heavily overlap with the previous batch's write scope

### 5. Acceptance standards

This is the most important part of the plan. Use two layers of acceptance.

#### A. Per-task acceptance

Every task card must satisfy:

- a concrete output
  - code, tests, docs, or artifact-path changes
- a concrete verification command
  - and that command must actually cover the change
- a meaningful result summary
  - `Latest Result` cannot just say `done`
- if human-readable docs change
  - Chinese primary and English mirror both update
- if CLI or runtime-output contracts change
  - add at least one regression test or smoke check

Bad examples:

- "polish wording"
- "add some tests"
- "improve deployment"
- "clean up code"

These are too vague for Rough Loop.

#### B. Whole-run acceptance

Score the full `8h` run with hard metrics:

- survival time
  - daemon stays alive close to `8h`
- completed task count
  - complete `10` to `14`
- verification pass rate
  - `>= 80%`
- mainline-task share
  - tasks directly tied to trading / monitor / risk must be `>= 60%`
- blocked rate
  - `blocked` should stay under `20%`
- artifact completeness
  - `runtime-artifacts/rough-loop/latest.json`
  - `heartbeat.json`
  - per-run artifacts all exist
- commit quality
  - no unrelated dirty changes get swept into auto-commits

Recommended run-level success definition:

- no task starvation during `8h`
- at least `10` high-value completed tasks
- at least `8` tasks with passing verification
- at least `3` tasks directly advancing the trading mainline
- at least `2` tasks directly advancing portfolio monitor / stop-loss / review
- one fresh handoff plus next-round backlog at the end

### 5.5 My staged goals and metrics

If you are prepared to provide remote `VPS + SSH`, I should commit to staged deliverables, not just “keep working continuously.”

Recommended four levels:

#### Level 0: remote workspace takeover

Goal:

- log in over `SSH`
- confirm the remote workspace
- clone / pull the repo
- run `pnpm install` and `pnpm vendor:sync`
- record the remote environment baseline

Acceptance metrics:

- remote repo directory exists
- availability of `node`, `pnpm`, `git`, and `codex` is confirmed
- baseline command logs are saved
- at least one remote-environment handoff file exists

#### Level 1: remote pulse-live-loop validation

Goal:

- pass the following remotely:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `ENV_FILE=... pnpm pulse:live -- --recommend-only`

Acceptance metrics:

- all four classes of commands succeed at least once
- pulse markdown / json artifacts are generated
- recommendation artifact is generated
- runtime log is generated
- if a failure occurs, the error remains actionable and includes enough context

#### Level 1.5: remote constrained real-execution smoke

Goal:

- complete one to a small number of real execution smokes within the stop-loss and position limits you provide
- validate:
- real wallet
- real live path
- real archival
- real failure protection

Preferred path:

- use `pulse:live` first
- do not treat `live:test` as the primary first real smoke path
  - because the current `live:test` preflight is incompatible with `MAX_TRADE_PCT=0.2`

Acceptance metrics:

- at least `1` real execution completes within the configured limits
- every real execution prints:
  - execution mode
  - decision strategy
  - wallet / env
  - requested USD
  - archive dir
- every real execution preserves:
  - preflight
  - recommendation
  - execution summary
  - error artifact when failing
- no order breaches the stop-loss and position limits you supplied
- if a critical failure happens, the system fails fast and preserves intermediate artifacts

#### Level 2: remote daily run becomes sustainable

Goal:

- connect the constrained execution path to `cron` or `systemd`
- ensure it can run unattended on a fixed schedule
- ensure failed runs still leave traceable artifacts

Acceptance metrics:

- the scheduled job is installed
- success rate across `3` consecutive scheduled runs is `>= 90%`
- every run emits:
  - preflight
  - recommendation
  - pulse artifacts
  - runtime log
- if real execution is enabled in this round:
  - execution summary
  - error artifact on failures
- the latest run time, exit status, and artifact directory can be found quickly

#### Level 3: remote deployment pushes the real project objective

Goal:

- keep advancing, in the remote environment:
  - Portfolio Monitor / Review / Rebalance
  - Stop Loss / risk controls
  - readiness for the full live service path
- turn “daily executable script” into “early long-running trading-system shape”

Acceptance metrics:

- at least `3` remotely validated high-value changes directly advance the trading mainline
- at least `2` remotely validated high-value changes directly advance monitor / stop-loss / review
- at least `1` fresh remote handoff clearly states:
  - what works now
  - what still does not work
  - what the next blocker is

#### Level 4: real execution can be considered

This level is now authorized in principle, but it is still not “unconditionally enabled.”

Preconditions:

- dedicated wallet, limits, and risk thresholds are confirmed separately
- remote archival, failure protection, and halt paths are already validated first
- current live service state is backed up and a rollback plan exists before replacing online services
- target system-security changes and rollback commands are prepared before changing security settings

Acceptance metrics:

- preflight stably identifies execution mode, wallet, and risk parameters
- every real execution produces a complete archive
- failures can fail fast while preserving intermediate artifacts
- no real order breaches the risk envelope you provided
- no live service replacement is left without rollback coverage

### 6. Suggested first task pool

This is a pool design, not an instruction to implement every card immediately.

Recommended first pool: `14` cards

1. `pulse-direct-runtime` regression hardening
2. `pulse:live` artifact and error-path regression coverage
3. `provider-runtime` filtering and explanatory-decision hardening
4. `queue-worker` stop-loss plus snapshot regression coverage
5. `queue-worker` remote/local mismatch detection
6. minimum `portfolio review / rebalance` artifact writer
7. `live:test` failure-context and halt-summary improvements
8. remote daily-run operator guidance in `README` / handoff docs
9. `systemd / cron` operator doc
10. runtime summary or run-index discoverability
11. `rough-loop` queue-refill guidance
12. `rough-loop` closeout template
13. bilingual doc debt cleanup
14. pending test debt cleanup

### 7. Recommended task-card style

To keep Rough Loop productive for `8h`, task cards should look like this:

- narrow title
  - one job only
- small `Allowed Paths`
  - minimize collateral edits
- outcome-based `Definition of Done`
  - for example: "add X regression coverage and stabilize Y output"
- shortest useful `Verification`
  - prefer single-file `vitest`, import smoke, or targeted `rg` contract checks
- explicit `Context`
  - explain why this task matters now

### 8. Pre-run checklist

Before starting the real `8h` run, confirm:

- `rough-loop.md` already contains at least `8` queued cards
- `Warm Reserve` is written and ready
- existing dirty worktree state is known and acceptable
- `ROUGH_LOOP_RELAX_GUARDRAILS`, `ROUGH_LOOP_REQUIRE_CLEAN_TREE`, and `ROUGH_LOOP_AUTO_PUSH` are decided
- the intended branch is decided
- at least one smoke card has already proven the loop end to end

If this round also includes the remote track, additionally confirm:

- `SSH host / port / user / auth` are provided
- whether system-package installation is allowed is clear
- whether `sudo`, `docker`, and `systemctl` are allowed is clear
- the remote workspace and log directories are clear
- which stop-loss and position-limit values apply to real execution is explicit
- the conflict between `MAX_TRADE_PCT=0.2` and the current full-live preflight is known, with a chosen workaround
- whether replacing existing live services is allowed is explicit
- how far system-level security changes may go is explicit
- whether old services already exist on the server has been checked first

## User Decisions

- Decision: whether `Ralph loop` really means the existing `Rough Loop`
  - Why it matters: this decides whether we extend the current daemon or define a new loop
  - Recommended default: yes, use the existing `Rough Loop`

- Decision: whether this `8h` run should stay in safe code-task mode only
  - Why it matters: current Rough Loop docs already exclude real trading, production deployment, and secret handling
  - Recommended default: yes, code / tests / docs / artifacts only

- Decision: whether to allow auto-push
  - Why it matters: `8h` runs generate many commits; auto-push reduces manual work but increases branch-risk
  - Recommended default: no for the first run; auto-commit only on an isolated branch

- Decision: whether docs-only tasks are allowed as filler
  - Why it matters: banning them entirely can starve the queue; allowing too many dilutes mainline value
  - Recommended default: allow them, capped at `30%`

- Decision: whether this run should prioritize remote deployment or portfolio monitor / stop-loss
  - Why it matters: both matter, but `8h` is not enough to average the effort cleanly
  - Recommended default: prioritize `portfolio monitor / stop-loss / pulse-live runtime` first, deployment docs in the back half

- Decision: whether to use the success threshold `>=10 completed` plus `>=80% verification pass rate`
  - Why it matters: without a numeric threshold, the run is hard to judge
  - Recommended default: yes

- Decision: whether to formally grant remote `VPS + SSH` access
  - Why it matters: this upgrades the round from local planning and coding to remote validation and deployment progress
  - Recommended default: treat it as authorized in principle and move into the constrained real-execution track

- Decision: whether I may create remote `cron` or `systemd` services
  - Why it matters: without that permission, I can only do manual smoke runs, not long-running validation
  - Recommended default: allow it

- Decision: whether I may install remote system dependencies
  - Why it matters: if `node`, `pnpm`, `git`, `docker`, or other prerequisites are missing, the remote loop cannot close
  - Recommended default: allow it, limited to project needs

- Decision: whether I may access real live-trading env on the server
  - Why it matters: this is the highest-risk boundary and must be explicit
  - Recommended default: allow it, but bind it to the risk envelope you provide

- Decision: what exact real-execution limits you are giving me
  - Why it matters: without explicit numbers, “live trading is allowed” cannot be turned into a safe operational boundary
  - For now, use:
    - `DRAWDOWN_STOP_PCT=0.3`
    - `POSITION_STOP_LOSS_PCT=0.3`
    - `MAX_TRADE_PCT=0.2`
    - `MAX_EVENT_EXPOSURE_PCT=0.3`
    - `MAX_TOTAL_EXPOSURE_PCT=1.0`
    - `MAX_POSITIONS=5`
    - `INITIAL_BANKROLL_USD=20`

- Decision: whether I may replace existing live services
  - Why it matters: this is no longer a pure smoke path; it becomes a real production change
  - Recommended default: allow it, but require a backup of the current version and rollback commands first

- Decision: whether I may change system-level security settings
  - Why it matters: this affects the security surface of the whole server
  - Recommended default: allow it, but only for project-relevant settings and with before/after state recorded

## Risks and Assumptions

- Assumption: the current `Rough Loop` remains the only loop framework in this repo
- Assumption: this round does not require Rough Loop to operate real trading or production secrets
- Risk: over-broad tasks will burn time in `blocked` and retries
- Risk: too many tasks writing the same files will make auto-commit and later integration painful
- Risk: if too many tasks are docs-only, the run will look busy but advance the mainline only weakly
- Risk: if `Warm Reserve` is not ready up front, the queue may starve around hour `3` to `5`
- Risk: the repo's bilingual-doc rule increases the cost of doc tasks and must be budgeted
- Risk: if the remote machine has heavy environment drift, too much time may go to infrastructure repair instead of mainline progress
- Risk: if the remote permission boundary is vague, “allowed to smoke test” may be misread as “allowed to trade live”
- Risk: without remote target metrics, continuous operation can degrade into “staying busy” instead of converging on the project goal
- Risk: even with authorization, a wide risk envelope can still create larger-than-expected losses
- Risk: system-security changes and live-service replacements without rollback plans can amplify outages
- Risk: once real private keys are placed on the remote machine, log hygiene, file permissions, and retention policy must tighten as well
- Risk: if the conflict between `MAX_TRADE_PCT=0.2` and the full-live preflight is not handled deliberately, remote smoke will fail at preflight rather than the trading logic itself

## Execution Gate

- Do not start the `8h` run from this file yet.
- First confirm:
  - `Ralph = Rough Loop`
  - the priority order
  - the success threshold
  - the docs-only cap and auto-push default
  - whether the remote `VPS + SSH` track is enabled
  - how far the remote permission boundary goes
  - whether you accept `MAX_TOTAL_EXPOSURE_PCT=1.0` and `MAX_POSITIONS=5` as the two filled-in defaults
- After confirmation, convert this plan into a real `rough-loop.md` task pool plus reserve backlog; if remote access is enabled, add a remote execution checklist, live-execution safeguards, and staged milestones as the next plan artifact.
