# Progress

Last updated: 2026-03-13

## Current state

This repository is now a working v1 foundation for a cloud-hosted autonomous Polymarket trading agent with a public spectator website and an internal admin console.

The codebase has been bootstrapped as a `pnpm` monorepo with:

- `apps/web`: Next.js spectator site for Vercel
- `services/orchestrator`: scheduling, risk control, agent runtime wiring, admin actions
- `services/executor`: Polymarket execution, sync jobs, live ops scripts
- `packages/contracts`: zod contracts for decisions and internal payloads
- `packages/db`: Drizzle schema, queries, seed data, migrations
- `vendor`: pinned third-party dependency manifest for external repos

## Implemented

- Public spectator pages for:
  - overview
  - positions
  - trades
  - runs
  - run detail
  - reports
  - backtests
- Admin page with internal controls for:
  - pause
  - resume
  - run-now
  - cancel-open-orders
  - flatten
- Shared database schema for:
  - agent runs
  - agent decisions
  - execution events
  - positions
  - portfolio snapshots
  - risk events
  - resolution checks
  - artifacts
  - system state
- Queue-driven execution and orchestration service skeletons
- Hard risk rules:
  - 30% per-position stop loss
  - 20% portfolio drawdown halt
- Env auto-discovery for sibling Polymarket credentials via `.env.aizen`
- Live ops scripts for:
  - balance and market sanity checks
  - capped live trade submission

## Verified

- `pnpm typecheck` passes
- `pnpm test` passes
- `pnpm build` passes
- Real wallet credentials were discovered from `../pm-PlaceOrder/.env.aizen`
- Real USDC balance check succeeded
- A real capped live order notional of `$1` was submitted successfully on 2026-03-13
- The resulting position was read back successfully from Polymarket account data

## Live trade confirmation

The latest capped live test executed successfully:

- Market slug: `tur-kas-eyu-2026-03-15-kas`
- Action: `BUY NO`
- Requested notional: `$1`
- Order status: `matched`
- Order id: `0x4ec470917138126104a097a3fdaa506d61860e15c1dad9c2d21bbaf5678f1921`

The post-trade account readback showed:

- Outcome: `No`
- Size: `2.040815`
- Average cost: `0.49`

## Important fixes made during live testing

- CLOB authentication now tries `deriveApiKey()` before `createOrDeriveApiKey()`
- Order book parsing now computes true best bid and best ask instead of trusting array order
- Market selection now prefers liquid `markets` endpoint results before checking detailed books
- Live test tooling supports explicit `--slug` targeting for safer manual execution

## Remaining gaps

- Docker runtime validation has not been completed on this machine because Docker is not installed locally
- The Claude Code runtime is wired as a service interface, but production prompt workflows and artifact publishing still need deeper integration
- External vendor repos are pinned in manifest form, but deeper runtime integration with each repo is still partial
- Vercel deployment and cloud host deployment have not yet been executed against production infrastructure
- No OpenClaw runtime exists yet; only the abstraction is in place

## Next priorities

1. Wire the real Claude Code command and artifact pipeline into orchestrator runs.
2. Replace mock/sample data paths with live DB-backed scheduler flows end to end.
3. Deploy Postgres, Redis, orchestrator, and executor on the target cloud host.
4. Deploy the web app to Vercel using read-only database credentials.
5. Run a longer dry-run soak before increasing real-money automation scope.
