# Autonomous Poly Trading

Autonomous Polymarket trading stack with:

- a public spectator website
- an internal admin console
- a cloud-hosted orchestrator
- a queue-driven execution worker
- a shared Postgres data model

The v1 target is simple:

- run one real wallet
- expose positions, trades, equity, reports, and decision logs on the web
- keep third-party users read-only
- keep all trading controls inside the admin surface
- support Claude Code first, OpenClaw later

## Architecture

This repository is a `pnpm` monorepo:

- `apps/web`
  Public website and admin console built with Next.js. Intended for Vercel deployment.
- `services/orchestrator`
  Schedules agent runs, enforces risk rules, triggers reviews, backtests, and admin actions.
- `services/executor`
  Owns Polymarket CLOB connectivity, order execution, position sync, and live ops scripts.
- `packages/contracts`
  Shared zod schemas for trading decisions, risk events, and internal payload validation.
- `packages/db`
  Drizzle schema, seed data, and query helpers for the spectator site and backend services.
- `vendor`
  Pinned manifest for the external repos this project builds around.

## Product shape

The public site exposes:

- `/`
  Overview, equity, cash, and current system state
- `/positions`
  Live positions
- `/trades`
  Trade history
- `/runs`
  Agent run history
- `/runs/[id]`
  Per-run reasoning, logs, and decisions
- `/reports`
  Pulse, review, and resolution outputs
- `/backtests`
  Daily backtesting results

The admin surface exposes:

- `pause`
- `resume`
- `run-now`
- `cancel-open-orders`
- `flatten`

There is no public developer API in v1. The web app uses internal route handlers and database reads only.

## Risk controls

The initial hard risk rules are service-side rules, not prompt suggestions:

- per-position stop loss: `30%`
- portfolio drawdown halt: `20%`
- max total exposure: `50%`
- max concurrent positions: `10`
- max single trade size: `5%` of bankroll

The executor uses `FOK` market orders for v1.

## External repos used

This project is designed around the following repositories from `Alchemist-X`:

- `polymarket-trading-TUI`
  Terminal trading logic and CLOB wiring reference
- `polymarket-market-pulse`
  Core market recommendation input
- `alert-stop-loss-pm`
  Stop-loss logic reference
- `all-polymarket-skill`
  Backtesting and additional monitor / resolution skills
- `pm-PlaceOrder`
  Execution benchmarking reference and local credential source during development

The `vendor` manifest exists so these repos can be pinned and synced locally instead of being pulled ad hoc in production flows.

## Quick start

1. Copy env config:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pnpm install
```

3. Sync pinned vendor repos:

```bash
pnpm vendor:sync
```

4. Start local data services:

```bash
docker compose up -d postgres redis
```

5. Apply migrations and seed:

```bash
pnpm db:migrate
pnpm db:seed
```

6. Start the monorepo:

```bash
pnpm dev
```

Local ports:

- web: `http://localhost:3000`
- orchestrator: `http://localhost:4001`
- executor: `http://localhost:4002`

## Environment

See [.env.example](.env.example) for the full local config template.

If your Polymarket credentials live in a sibling repository, set:

```bash
ENV_FILE=../pm-PlaceOrder/.env.aizen
```

The executor and orchestrator also auto-discover a sibling `.env.aizen` during development.

Key runtime groups:

- shared: database, redis, app url
- web: admin password and internal orchestrator token
- executor: private key, funder address, signature type, chain id
- orchestrator: Claude runtime command, scheduling, risk thresholds

## Useful commands

Workspace validation:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Database:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Live executor checks:

```bash
pnpm --filter @autopoly/executor ops:check
pnpm --filter @autopoly/executor ops:check -- --slug <market-slug>
pnpm --filter @autopoly/executor ops:trade -- --slug <market-slug> --max-usd 1
```

## Deployment shape

- `apps/web` is intended for Vercel with a read-only Postgres connection.
- `services/orchestrator` and `services/executor` are intended for a single cloud host via Docker Compose.
- Postgres should be managed or hosted separately.
- Redis is only for backend job coordination.
- Admin actions stay inside the site and call protected orchestrator endpoints.

## Current status

As of 2026-03-13:

- the monorepo is bootstrapped
- the public pages and admin pages exist
- the shared schema and queue-oriented backend services exist
- live Polymarket credential discovery works
- a capped real-money test order of `$1` was submitted and matched successfully

The latest implementation status is tracked in [progress.md](progress.md).

## Current limitations

- Docker runtime validation has not been completed on this machine because Docker is not installed locally
- production deployment to Vercel and the target cloud host is not done yet
- Claude Code is wired as an integration surface, but the full production decision loop still needs deeper runtime integration
- OpenClaw is not implemented yet
