# E2E Master Plan

Chinese version: [master-plan.md](master-plan.md)

## Goal

This workspace turns the current project into a reusable set of E2E modules instead of one-off scripts.

The first stage only needs to validate the key trading-system loop:

1. verify current state
2. start or attach the environment
3. trigger one run
4. verify database or mock-state updates
5. verify public website visibility
6. verify admin actions
7. record failure and success videos

## Module design

The modules are grouped into two phases:

- `trading-system`
  - implemented in v1
- `autonomous-dev-loop`
  - phase-two interface placeholders

Every module exposes:

- `id`
- `phase`
- `run(context)`

and returns:

- `status`
- `assertions`
- `artifacts`
- `summary`
- `nextAction`

## local-lite

This mode is designed for the current machine.

Implementation:

- no real database
- no real Redis
- no real executor or orchestrator
- `packages/db` reads a mutable state file when no database exists
- a fake orchestrator mutates that state file
- the web app still reads data through its own route handlers

This keeps:

- the real website
- the real admin login flow
- real polling
- real browser recording

## remote-real

This mode is intended for remote environments.

Requirements:

- existing web, orchestrator, and executor services
- real Postgres and Redis
- real wallet and risk guardrails
- the suite only attaches, triggers, asserts, and records

## Guardrails

For real environments, the default safeguards are:

- `AUTOPOLY_E2E_REMOTE=1`
- `ALLOW_REAL_TRADING=1`
- `MAX_LIVE_TRADE_USD <= 1`
- allowlisted market slugs
- destructive admin cases explicitly separated

## Phase two

Phase two is not executed yet, but the structure is reserved for:

- bug reproduction
- candidate fix generation
- post-fix verification
- resolution recording
- PR opening
- feedback ingestion
- build failure repair
- human escalation
- merge
