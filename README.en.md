# Autonomous Poly Trading

Chinese version: [README.md](README.md)

This repository is a cloud-hosted autonomous trading system for Polymarket. The goal is to build a trading agent that can run with real funds, expose live activity publicly, and enforce hard risk controls at the service layer.

The v1 scope is intentionally narrow:

- run a single real wallet
- expose a public read-only website
- keep all controls inside the admin surface
- support `codex` as the default skill runtime
- keep an `openclaw` skill runtime integration path ready

## Project goals

This system is designed to solve three practical problems:

- keep the agent running continuously in the cloud instead of as a local script
- expose real positions, trade history, equity, and reports on the web
- move risk management out of prompts and into hard service-side rules

## Repository structure

This repository is a `pnpm` monorepo with the following main parts:

- `apps/web`
  - Next.js site
  - public spectator pages and admin console
  - intended for Vercel
- `services/orchestrator`
  - agent scheduling
  - risk state management
  - periodic jobs such as backtests, resolution checks, and reviews
- `services/executor`
  - Polymarket CLOB integration
  - order execution, fill sync, and position sync
  - live ops scripts
- `packages/contracts`
  - shared zod schemas
  - validation for `TradeDecisionSet` and related payloads
- `packages/db`
  - Drizzle schema
  - queries
  - seeds and migrations
- `vendor`
  - pinned manifest for external repositories

## Website shape

The public site currently includes:

- `/`
  - overview page
  - cash, equity, and system status
- `/positions`
  - current positions
- `/trades`
  - trade history
- `/runs`
  - agent run list
- `/runs/[id]`
  - run detail
  - reasoning, logs, and decisions
- `/reports`
  - pulse, review, and resolution outputs
- `/backtests`
  - daily backtest results

The admin page supports:

- `pause`
- `resume`
- `run-now`
- `cancel-open-orders`
- `flatten`

V1 does not provide a public developer API. The site reads from the database or internal site handlers only.

## Risk rules

The current hard risk rules are:

- per-position stop loss: `30%`
- portfolio drawdown halt: `20%`
- max total exposure: `50%`
- max concurrent positions: `10`
- max single trade size: `5%` of bankroll

The first execution version uses `FOK` market orders.

This means:

- model outputs are still constrained by service-side risk checks
- once the system enters `HALTED`, no new positions should be opened
- stop-loss exits and manual flatten actions take priority over normal strategy activity

See [risk-controls.en.md](risk-controls.en.md) for the full hard-control document.

## Provider runtime

The orchestrator now runs on a provider-based runtime:

- `AGENT_RUNTIME_PROVIDER=codex|openclaw`
- `codex` and `openclaw` each have independent skill settings
- each provider can configure:
  - skill root directory
  - Chinese or English skill locale
  - the list of skills used in the current decision cycle
- the runtime no longer keeps a mock pulse fallback
- if the provider command is missing, a skill file is missing, or pulse fetch fails, the run fails closed

The current pulse storage naming is:

```text
reports/pulse/YYYY/MM/DD/pulse-<timestamp>-<runtime>-<mode>-<runId>.md
reports/pulse/YYYY/MM/DD/pulse-<timestamp>-<runtime>-<mode>-<runId>.json
```

## External repository dependencies

The current system is built around the following external repositories:

- `polymarket-trading-TUI`
  - trading terminal and CLOB wiring reference
- `polymarket-market-pulse`
  - core market recommendation and sizing input
- `alert-stop-loss-pm`
  - stop-loss logic reference
- `all-polymarket-skill`
  - references for backtesting, monitoring, and resolution tracking
- `pm-PlaceOrder`
  - execution reference and local credential source

The `vendor` directory exists so these repositories can be pinned to explicit versions instead of being pulled ad hoc at runtime.

## Quick start

1. Copy the env template:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pnpm install
```

3. Sync external vendor repositories:

```bash
pnpm vendor:sync
```

4. Start local data services:

```bash
docker compose up -d postgres redis
```

5. Run migrations and seed data:

```bash
pnpm db:migrate
pnpm db:seed
```

6. Start the monorepo:

```bash
pnpm dev
```

Default local ports:

- web: `http://localhost:3000`
- orchestrator: `http://localhost:4001`
- executor: `http://localhost:4002`

## Environment configuration

See [.env.example](.env.example) for the full template.

If your Polymarket credentials are stored in a sibling repository, set:

```bash
ENV_FILE=../pm-PlaceOrder/.env.aizen
```

The executor and orchestrator also support auto-discovering a sibling `.env.aizen` during development.

The environment variables are grouped into four logical sets:

- shared
  - database
  - Redis
  - app URL
- web
  - admin password
  - internal orchestrator token
- executor
  - private key
  - funder address
  - signature type
  - chain id
- orchestrator
  - provider selection
  - codex / openclaw skill settings
  - pulse fetch and storage settings
  - schedules
  - risk parameters

## Common commands

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

E2E workspace:

```bash
pnpm e2e:install-browsers
pnpm e2e:local-lite
AUTOPOLY_E2E_REMOTE=1 pnpm e2e:remote-real
```

Executor live checks:

```bash
pnpm --filter @autopoly/executor ops:check
pnpm --filter @autopoly/executor ops:check -- --slug <market-slug>
pnpm --filter @autopoly/executor ops:trade -- --slug <market-slug> --max-usd 1
```

Provider trial run:

```bash
pnpm trial:run
```

Recommended first `codex` trial-run command:

```bash
CODEX_SKILLS=polymarket-market-pulse \
CODEX_SKILL_LOCALE=zh \
PROVIDER_TIMEOUT_SECONDS=180 \
CODEX_COMMAND='codex exec --skip-git-repo-check -C {{repo_root}} -s read-only --color never -c model_reasoning_effort="low" --output-schema {{schema_file}} -o {{output_file}} < {{prompt_file}}' \
pnpm trial:run
```

## Deployment shape

Recommended deployment layout:

- `apps/web`
  - deploy to Vercel
  - use read-only Postgres credentials
- `services/orchestrator`
  - deploy to a single cloud host
- `services/executor`
  - deploy to the same cloud host
- Postgres
  - preferably managed
- Redis
  - only for backend coordination and queues

Admin actions remain inside the site and call protected orchestrator endpoints instead of being exposed publicly.

## Current status

As of `2026-03-14`, the repository already has:

- the monorepo structure
- public pages and admin pages
- the shared data model
- orchestrator and executor service scaffolding
- `.env.aizen` auto-discovery
- one successful capped live trade test below `$1`
- a `codex/openclaw` provider runtime structure inside the orchestrator
- real pulse fetch plus namespaced pulse artifact storage, with no mock pulse fallback
- one successful `codex` trial run with real pulse plus structured decisions

See [progress.md](progress.md) for detailed progress tracking.

The E2E test driven development workspace lives in [E2E Test Driven Development/README.md](E2E%20Test%20Driven%20Development/README.md).

## Current limitations

The main current limitations are:

- Docker runtime validation has not been completed on this machine
- production deployment to Vercel and the cloud host is not done yet
- the `codex` trial-run path is connected, but the full production loop still needs more validation
- the `openclaw` runtime surface is wired, but the CLI is not installed on this machine

## Next steps

See [todo-loop.md](todo-loop.md) for the current high-priority follow-up items.
