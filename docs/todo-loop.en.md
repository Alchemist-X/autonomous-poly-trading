# TODO Loop

Chinese version: [todo-loop.md](todo-loop.md)

Last updated: 2026-03-13

This file tracks the next practical steps for the project and splits them into two categories:

- must-have items
- nice-to-have items

## Must-have

### 1. Connect the real Claude Code decision loop

- Connect the runtime abstraction in `services/orchestrator` to a real Claude Code headless command.
- Define the exact runtime inputs:
  - current bankroll
  - current positions
  - risk state
  - market pulse output
  - portfolio review output
- Restrict the output to a validated `TradeDecisionSet`.
- Add safe failure handling:
  - skip trading for the current cycle
  - record the failure reason
  - continue sync and stop-loss jobs

Completion criteria:

- orchestrator can launch Claude on schedule
- Claude output passes schema validation
- valid decisions can enter the executor queue

### 2. Integrate the core external repositories into the real runtime path

- `polymarket-market-pulse`
  - make it a scheduled input source instead of just a vendored repo
- `all-polymarket-skill`
  - integrate at least backtesting, monitoring, and resolution tracking
- `alert-stop-loss-pm`
  - re-check that the current service implementation still matches the original logic
- `polymarket-trading-TUI`
  - use it as a reference to close remaining gaps in parameters, precision handling, and error handling

Completion criteria:

- each external repository has a clear runtime integration point
- the code does not merely vendor them; it actually uses them in scheduled or execution flows

### 3. Move the database from sample data to real runtime data

- inspect `packages/db` and the web app for remaining mock or seed-only display paths
- make overview, positions, trades, and runs reflect real runtime data directly
- ensure agent runs, decisions, executions, risk events, and portfolio snapshots are fully persisted

Completion criteria:

- real data is visible without depending on seed data
- site data matches wallet state and execution records

### 4. Deploy the real infrastructure

- choose managed Postgres
- choose Redis
- deploy `orchestrator + executor` on a cloud host
- deploy `apps/web` on Vercel
- give read-only database credentials to the web app and read-write credentials only to backend services

Completion criteria:

- the spectator site is publicly accessible
- backend services run continuously
- the site shows real positions and real trades

### 5. Harden secrets and permission boundaries

- organize `.env` by environment:
  - local development
  - cloud-host production
  - Vercel production
- ensure the site never receives private keys or signing material
- ensure admin actions validate internal tokens or passwords
- ensure the Claude runtime container cannot access wallet private keys directly

Completion criteria:

- private keys exist only in the executor runtime
- frontend pages and Claude artifacts do not leak secrets

### 6. Run a full dry-run / paper-run

- add a dry-run mode that executes decisions, risk checks, and execution flow without posting real orders
- run it continuously for at least 72 hours
- record:
  - scheduling stability
  - duplicate order behavior
  - queue buildup
  - unexpected halt events

Completion criteria:

- no obvious stability issue during the dry run
- logs and state transitions are readable before switching to larger real-money scope

### 7. Strengthen execution safety

- add more checks before order submission:
  - token exists
  - market is active
  - side is correct
  - amount stays within limits
  - spread is not abnormal
  - slippage stays under threshold
- give stop-loss exits and manual flatten the highest priority
- forbid new opens after drawdown halt

Completion criteria:

- invalid Claude output cannot directly cause unsafe orders
- key risk paths are hard-limited at the executor layer

### 8. Improve production observability

- add structured logs to orchestrator and executor
- record lifecycle events such as:
  - run started
  - run failed
  - decision accepted or rejected
  - order submitted
  - order filled or rejected
  - stop loss triggered
  - drawdown halt triggered
- show recent errors and system state on the site

Completion criteria:

- failures can be localized quickly to Claude, strategy, database, or execution layers

## Nice to have

### 1. OpenClaw runtime

- add `OpenClawRuntime` using the existing `AgentRuntime` abstraction
- keep DB, executor, and web layers unchanged

### 2. Better spectator UX

- improve the equity curve and drawdown display on the home page
- enrich the run detail view with clearer decision chains and source references
- add report filtering by date and type
- improve mobile card layouts

### 3. Upgrade live refresh

- the current implementation uses 5-second polling
- later this can move to SSE or websocket
- only do this after confirming the deployment complexity is acceptable

### 4. Stronger backtesting system

- persist daily backtest snapshots
- compare live trading against backtest expectations
- add simple leaderboard or strategy version comparison

### 5. Better risk panel

- show high-water mark, current drawdown, and remaining exposure capacity
- list stop-loss events and halt history explicitly
- attach notes to manual recovery actions

### 6. Stronger admin controls

- flatten a single position
- disable a certain market type
- disable a specific runtime temporarily
- manually trigger a report or backtest job

### 7. Latency and execution-quality analysis

- benchmark regions using `pm-PlaceOrder`
- record order-to-match latency
- track FOK success rate and execution price slippage

### 8. Automatic reconciliation

- reconcile daily between:
  - database positions
  - website state
  - actual Polymarket account state
- alert automatically when they diverge

### 9. Notifications

- add Telegram, Slack, or email notifications
- prioritize:
  - halt
  - stop loss
  - run failure
  - executor connectivity failure
  - data sync failure

## Suggested execution order

1. Connect the real Claude decision loop.
2. Integrate market pulse, backtesting, and resolution tracking.
3. Complete dry-run validation.
4. Deploy the cloud infrastructure.
5. Add UI polish, SSE, OpenClaw, and stronger notifications later.
