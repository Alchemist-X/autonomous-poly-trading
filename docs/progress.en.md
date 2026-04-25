# Progress Log

Chinese version: [progress.md](progress.md)

Last updated: 2026-03-14

## Current state

This repository already has a workable v1 foundation for a Polymarket trading system built around cloud execution, public web visibility, and hard service-side risk controls.

The monorepo currently includes:

- `apps/web`
  - spectator site and admin pages for Vercel
- `services/orchestrator`
  - scheduling, risk management, job orchestration, admin actions
- `services/executor`
  - Polymarket execution, sync flows, live ops
- `packages/contracts`
  - decision schemas and shared internal contracts
- `packages/db`
  - database schema, queries, seeds, and migrations
- `vendor`
  - pinned external repository manifest

## Implemented

### 1. Website

The public website already includes:

- overview page
- positions page
- trades page
- runs list page
- run detail page
- reports page
- backtests page

The admin surface already supports:

- `pause`
- `resume`
- `run-now`
- `cancel-open-orders`
- `flatten`

### 2. Data model

The database already includes the core tables:

- `agent_runs`
- `agent_decisions`
- `execution_events`
- `positions`
- `portfolio_snapshots`
- `risk_events`
- `resolution_checks`
- `artifacts`
- `system_state`

### 3. Backend foundation

The following base pieces are already in place:

- orchestrator service
- executor service
- shared contracts
- base risk logic
- vendor sync script
- database seed and query layer
- `codex/openclaw` provider-runtime configuration scaffolding
- real pulse fetch, storage, and namespaced artifact output
- the `pnpm trial:run` entry point

### 4. Risk rules

The currently implemented hard rules are:

- per-position `30%` stop loss
- `20%` drawdown halt relative to portfolio high-water mark
- no new opens whenever pulse risk flags are present
- `open` actions may only use `token_id` values from pulse candidates
- `hold/close/reduce` may only target current live positions
- the unified risk document now lives in [risk-controls.en.md](risk-controls.en.md)

### 5. Credential loading

The project can already auto-discover a sibling `.env.aizen` for local development against a real Polymarket wallet.

### 6. Live trading tools

The project already has:

- balance check scripts
- market and orderbook sanity checks
- a capped live trade script limited to `$1`

### 7. E2E TDD workspace

The repository now also includes `E2E Test Driven Development/`, with:

- bilingual top-level docs
- a standalone `suite` test package
- a local-lite fake orchestrator
- dynamic mock-state driven pages
- Playwright recording and tracing
- remote-real scenario entry points

## Verified

The following items have already been verified:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- successful discovery of the real wallet env file at `../pm-PlaceOrder/.env.aizen`
- successful read of the real USDC balance
- successful submission of one live order below `$1`
- successful readback of the resulting position from Polymarket account data
- one successful `codex` trial run using real pulse fetch plus structured decisions

## Most recent live trade

The latest small live test produced:

- market: `tur-kas-eyu-2026-03-15-kas`
- action: `BUY NO`
- requested notional: `$1`
- order status: `matched`
- order ID: `0x4ec470917138126104a097a3fdaa506d61860e15c1dad9c2d21bbaf5678f1921`

Readback position data:

- outcome: `No`
- size: `2.040815`
- average cost: `0.49`

## Most recent Codex trial run

This trial run used:

- provider: `codex`
- skill: `polymarket-market-pulse`
- locale: `zh`
- pulse source: real `fetch_markets.py`
- mock pulse fallback: disabled

Trial result:

- pulse candidates: `12`
- pulse risk flags: `0`
- decisions kept: `5`
- `hold` decisions: `3`
- `open` decisions: `2`

Stored artifacts:

- Pulse Markdown: `reports/pulse/2026/03/14/pulse-20260314T015337Z-codex-full-99fcf009-a9ac-42e4-bae9-222c894d7d77.md`
- Pulse JSON: `reports/pulse/2026/03/14/pulse-20260314T015337Z-codex-full-99fcf009-a9ac-42e4-bae9-222c894d7d77.json`
- Runtime Log: `reports/runtime-log/2026/03/14/runtime-log-20260314T015454Z-codex-full-99fcf009-a9ac-42e4-bae9-222c894d7d77.md`

## Fixes made during live testing

Several important issues were corrected during the live test workflow:

- CLOB authentication now tries `deriveApiKey()` before `createOrDeriveApiKey()`
- orderbook parsing now computes the true best bid and best ask instead of trusting array order
- market filtering now uses the more suitable `markets` endpoint for pre-screening
- live checks now support explicit `--slug` targeting for safer manual execution

## Remaining gaps

The main missing pieces are:

- Docker runtime validation has not been completed because Docker is not installed on this machine
- the full `codex` production decision loop is not fully connected yet
- the `openclaw` runtime surface is wired, but the CLI is not installed on this machine yet
- external vendor repositories are pinned, but many capabilities are not yet integrated into full scheduled runtime flows
- Vercel deployment and cloud-host deployment are not done yet

## Next priorities

1. Connect the real `codex` decision loop.
2. Integrate market pulse, backtesting, and resolution tracking into the orchestrator.
3. Finish `openclaw` CLI integration and run the same trial path through it.
4. Deploy Postgres, Redis, orchestrator, and executor.
5. Deploy the web app to Vercel.
6. Run a longer dry-run before increasing real-money scope.
