# E2E Test Driven Development

Chinese version: [README.md](README.md)

This directory is the repository workspace for end-to-end test driven development. The goal is not only to hold a few tests, but to systematize how the project validates behavior, records evidence, and increases autonomy over time.

The first version focuses on the trading system itself:

- `apps/web`
- `services/orchestrator`
- `services/executor`
- risk controls
- persistence and public-site visibility

At the same time, this workspace reserves interfaces and placeholders for the phase-two autonomous development loop.

## Structure

- `master-plan.md`
  - overall E2E TDD design
- `capability-ladder.md`
  - autonomy capability ladder
- `test-matrix.md`
  - scenarios, environments, and guardrail matrix
- `suite/`
  - the actual runner package
- `artifacts/`
  - output directory for videos, screenshots, traces, and reports
- `fixtures/`
  - controlled risk cases and input fixtures
- `prompts/`
  - placeholders for future prompt-driven repair loops

## Modes

### `local-lite`

Characteristics:

- does not require local Docker, Redis, or Postgres
- uses dynamic mock state to drive website data
- starts a fake orchestrator to test admin proxying, page polling, and recording
- can run directly on the current machine

### `remote-real`

Characteristics:

- attaches to real web, orchestrator, and executor services
- uses real database state and real wallet flows
- intended for remote smoke tests and true end-to-end validation

## Common commands

Install Playwright browsers:

```bash
pnpm e2e:install-browsers
```

Run local degraded E2E:

```bash
pnpm e2e:local-lite
```

Run remote-real E2E:

```bash
AUTOPOLY_E2E_REMOTE=1 pnpm e2e:remote-real
```

## Currently implemented

- bilingual documentation scaffold
- standalone `suite` package
- local-lite fake orchestrator
- dynamic mock-state driven pages
- Playwright browser recording
- failure and success walkthrough recording
- deterministic risk fixture validation
- remote-real scenario entry points and guardrail scaffolding

## Current limitations

- this machine has no Docker, Redis, or Postgres, so only `local-lite` is runnable locally
- `remote-real` requires explicit environment variables and remote infrastructure
- GitHub PR automation, merge automation, and feedback loops are still phase-two placeholders
