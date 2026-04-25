# Dev & Ops Reference

> Chinese version: [dev-reference.md](dev-reference.md) — authoritative source
>
> Last updated: 2026-04-23

The main README only keeps the Agent-facing natural-language workflow. When you need to run pnpm directly, or want to debug dependencies / deployment shapes, look here.

## Monorepo Structure

This is a `pnpm` monorepo (`pnpm@10.28.1`, Node ≥ 20) with no root-level `src/`. Source code is spread across the following packages:

```
autonomous-poly-trading/
├── apps/
│   └── web/                          # Next.js 16 site: public spectator view + admin console
├── services/
│   ├── orchestrator/                 # Scheduling, Pulse, decision runtime, risk, reports
│   ├── executor/                     # Polymarket CLOB integration, orders, sync, queue worker
│   └── rough-loop/                   # Standalone code-task loop (not on the trading path)
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
| `services/rough-loop` | Automated code-task loop (not involved in trading) | `src/cli.ts` |

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
ENV_FILE=.env.live-test pnpm pulse:live
ENV_FILE=.env.live-test pnpm pulse:live -- --recommend-only
ENV_FILE=.env.live-test pnpm pulse:live -- --json

# Live Stateful
ENV_FILE=.env.live-test pnpm live:test

# Daily Pulse (convenience entry for pulse:live; defaults to .env.pizza + live + pulse-direct)
pnpm daily:pulse
```

### Execution Flow Stages

Every live path must go through Preflight. It is not a standalone mode — it is a mandatory stage.

**pulse:live**:

```
Preflight → Fetch remote positions/collateral → Pulse generation → Decision runtime → Risk + token cap → Direct execution → Summary archive
```

**live:test**:

```
Preflight(+DB/Redis/Queue) → Pulse generation → Agent Cycle (decisions + persistence) → Queue dispatch → Executor worker → Sync → Summary archive
```

**paper**:

```
Load portfolio context → Pulse generation → Decision runtime → shared buildExecutionPlan (same risk + exchange-threshold rules as pulse:live) → awaiting-approval → trial:approve → Paper state update
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

### Rough Loop

```bash
pnpm rough-loop:doctor
pnpm rough-loop:once
pnpm rough-loop:start
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
