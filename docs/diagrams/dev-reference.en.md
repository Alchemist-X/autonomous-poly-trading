# Dev & Ops Reference

> Chinese version: [dev-reference.md](dev-reference.md) — authoritative source
>
> Last updated: 2026-06-15

The main README only keeps the Agent-facing natural-language workflow. When you need to run pnpm directly, or want to debug dependencies / deployment shapes, look here.

## Naming (pulse / forecast / autopoly / raven)

A few names look different but mean the same thing. Spelled out here so each new maintainer doesn't have to rediscover it:

- **`forecast:*` = the user-facing command names; `pulse` = the engine's internal codename. They are the same forecasting engine.** The CLI uses `forecast:live` / `forecast:recommend` / `forecast:positions`, while `services/orchestrator/src/pulse/`, `scripts/pulse-*.ts`, and the archive paths `runtime-artifacts/pulse/…` and `runtime-artifacts/reports/pulse/…` still say `pulse`. The `pulse:*` commands are kept as **compatibility aliases** for `forecast:*` (see `package.json`).
  - **Why it isn't fully renamed (kept on purpose):** a full rename would touch 12 files under `src/pulse/` + 13 `pulse-*` scripts + 12 sites that write `runtime-artifacts/pulse` archive paths — and changing the archive paths would orphan existing archives and move where live runs write. **High risk, low reward.** So read it as "engine codename = pulse, user-facing command = forecast" and don't chase literal uniformity.
- **Three-layer product / package naming (accreted history, each internally consistent):**
  - `predict-raven` = the repository (GitHub repo / local dir).
  - `@autopoly/*` = the npm workspace scope (legacy; every package uses it, no functional impact).
  - `raven` = the product codename (`apps/raven`, `apps/raven-delta`, etc.).

## Monorepo Structure

This is a `pnpm` monorepo (`pnpm@10.28.1`, Node ≥ 20) with no root-level `src/`. Source code is spread across the following packages:

```
autonomous-poly-trading/
├── apps/
│   └── web/                          # Next.js 16 site: public spectator view + admin console
├── services/
│   ├── orchestrator/                 # Scheduling, Pulse, decision runtime, risk, reports
│   ├── executor/                     # Polymarket CLOB integration, orders, sync, queue worker
├── packages/
│   ├── contracts/                    # Zod schemas: TradeDecisionSet and shared contracts
│   ├── db/                           # Drizzle schema, migrations, queries, local-state
│   └── terminal-ui/                  # Terminal colored output, error summaries, table rendering
├── scripts/                          # Workspace-level entry points: daily-pulse, live-test, poly-cli
├── vendor/                           # External repo lock manifest (manifest.json)
├── deploy/hostinger/                 # VPS deployment scripts and env templates
├── Illustration/                     # Architecture diagrams, flow charts, ops notes (bilingual)
├── Plan/                             # Phase planning documents
├── Wasted/                           # Archived legacy handoffs / exploration notes / history
├── E2E Test Driven Development/      # Playwright + Vitest E2E suite
├── runtime-artifacts/                # Run artifacts (.gitignored, only .gitkeep kept)
├── docker-compose.yml                # Local Postgres 17 + Redis 8
├── docker-compose.hostinger.yml      # Production-oriented container orchestration
└── package.json                      # Root scripts + workspace dependencies
```

### Module Responsibilities at a Glance

| Module | Purpose | Key Entry |
| --- | --- | --- |
| `apps/web` | Public pages (overview/positions/trades/runs/reports/backtests) + admin ops | `app/page.tsx` |
| `services/orchestrator` | Pulse generation → decision runtime → risk trimming → report artifacts | `src/jobs/daily-pulse-core.ts` |
| `services/executor` | Polymarket CLOB orders, position sync, stop-loss, flatten | `src/workers/queue-worker.ts`, `src/lib/polymarket.ts` |
| `packages/contracts` | `TradeDecisionSet`, `actionSchema`, queue/job names, etc. | `src/index.ts` |
| `packages/db` | DB schema + queries; file-backed local state for paper mode | `src/queries.ts`, `src/local-state.ts` |
| `packages/terminal-ui` | Terminal UI utility library | `src/index.ts` |
| `scripts/` | CLI entry points that wire up different run modes | `daily-pulse.ts`, `pulse-live.ts`, `live-test.ts` |

## Command Cheatsheet

### Build & Validation

```bash
pnpm build              # Full workspace build
pnpm typecheck          # Full type check
pnpm test               # Vitest unit tests
```

### Database

```bash
pnpm db:generate        # Generate migration
pnpm db:migrate         # Run migrations
pnpm db:seed            # Seed data
```

### Trading Paths

```bash
# Paper
AUTOPOLY_EXECUTION_MODE=paper pnpm trial:recommend
AUTOPOLY_EXECUTION_MODE=paper pnpm trial:approve -- --latest

# Pulse Live
ENV_FILE=.env.live-test pnpm forecast:live
ENV_FILE=.env.live-test pnpm forecast:live -- --recommend-only
ENV_FILE=.env.live-test pnpm forecast:live -- --json

# Live Stateful
ENV_FILE=.env.live-test pnpm live:test

# Daily Pulse (convenience entry for forecast:live; defaults to .env.pizza + live + pulse-direct)
pnpm daily:forecast
```

### Execution Flow Stages

Every live path must go through Preflight. It is not a standalone mode — it is a mandatory stage.

**forecast:live**:

```
Preflight → Fetch remote positions/collateral → Pulse generation → Decision runtime → Risk + token cap → Direct execution → Summary archive
```

**live:test**:

```
Preflight(+DB/Redis/Queue) → Pulse generation → Agent Cycle (decisions + persistence) → Queue dispatch → Executor worker → Sync → Summary archive
```

**paper**:

```
Load portfolio context → Pulse generation → Decision runtime → shared buildExecutionPlan (same risk + exchange-threshold rules as forecast:live) → awaiting-approval → trial:approve → Paper state update
```

### Executor Ops

```bash
pnpm --filter @autopoly/executor ops:check
pnpm --filter @autopoly/executor ops:check -- --slug <market-slug>
pnpm --filter @autopoly/executor ops:trade -- --slug <market-slug> --max-usd 1
```

### E2E

```bash
pnpm e2e:install-browsers
pnpm e2e:local-lite
AUTOPOLY_E2E_REMOTE=1 pnpm e2e:remote-real
```

### Vendor

```bash
pnpm vendor:sync        # Sync external repos into vendor/repos/
```

## Dependency Matrix

| Dependency | Required? | Purpose |
| --- | --- | --- |
| Node.js ≥ 20 | ✅ Required | Monorepo build and runtime |
| pnpm 10.x | ✅ Required | Workspace package management (currently `10.28.1`) |
| TypeScript 5.9.x | Built-in | TS compilation |
| Docker / docker compose | Optional | Local Postgres + Redis |
| Postgres 17 | Optional | Required for `live:test` |
| Redis 8 | Optional | Required for `live:test` |
| Codex CLI | Runtime, on demand | `provider-runtime` / Pulse generation |
| Polymarket wallet credentials | Required for live paths | Real-money orders |

## Deployment Shapes

| Component | Recommended Deployment |
| --- | --- |
| `apps/web` | Vercel (read-only Postgres credentials) |
| `services/orchestrator` | Single cloud VM |
| `services/executor` | Same VM |
| Postgres 17 | Managed database |
| Redis 8 | Co-located or managed |

For the Hostinger VPS plan, see [hostinger-vps-deploy-runbook.md](hostinger-vps-deploy-runbook.md), paired with `docker-compose.hostinger.yml` and `deploy/hostinger/stack.env.example`.

Admin operations go through a protected in-site endpoint that calls the orchestrator; ports `4001 / 4002 / 5432 / 6379` are not publicly exposed.

## Minimal Local Stack (Stateful Debugging)

Running `live:test` requires a local Postgres + Redis:

```bash
cp .env.example .env
pnpm install
pnpm vendor:sync
docker compose -f deploy/docker-compose.yml up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Default ports: Web `3000` / Orchestrator `4001` / Executor `4002`.
