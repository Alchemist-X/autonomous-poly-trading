# Agent Onboarding — First time picking up predict-raven

> 🆕 **Read this only on your first contact with this project.** For every subsequent session, jump straight to [`docs/agent-handoff.md`](../agent-handoff.md) for current state + pending TODOs.
>
> You are a Claude Code / Codex / OpenClaw agent **freshly started** in this repo. This doc gets you operational in **5 minutes** without stepping on landmines.
>
> Chinese version: [`docs/agent-onboarding.md`](../agent-onboarding.md)
>
> Last updated: 2026-04-26

---

## ⚠️ 0. This is a real-money live trading project

Every `pnpm daily:forecast` / `pnpm forecast:live` run places **real, irreversible orders** on Polymarket.

**If the user has not explicitly said "live" or "recommend-only," ask first, then act.** Do not default to "let me just try it."

## 1. Inspect the current environment

Run these (read-only, no money moves):

```bash
ls .env.* 2>/dev/null | grep -v example      # how many real credential files exist
grep -c '^[A-Z_]\+=' .env.example             # template field count
```

Files like `.env.pizza` / `.env.no1` at root are user wallet configurations. **Default primary wallet is `.env.pizza`** (per the `default_prompt` in `skills/daily-pulse/agents/openai.yaml`).

> ⚠️ `.env.pizza` is just **the default**, not hardcoded. If you are deployed to a new machine or paired with a different primary wallet, update the default to your own env file and adjust that yaml line accordingly.

## 2. Required reading (in order)

| Order | Doc | Purpose |
| --- | --- | --- |
| 1 | [`/CLAUDE.md`](../../CLAUDE.md) | Collaboration rules + project execution notes (auto-loaded by Claude Code, skim it) |
| 2 | [`docs/risk-controls.en.md`](../risk-controls.en.md) | Full risk-control rules (execution / position / system tier hard caps) |
| 3 | [`docs/internal/plan/2026-04-28-v2-cutover-runbook.md`](../internal/plan/2026-04-28-v2-cutover-runbook.md) | V2 cutover runbook (no longer urgent if today is past 2026-04-28) |
| 4 | [`docs/diagrams/dev-reference.en.md`](../diagrams/dev-reference.en.md) | Command cheatsheet / deployment shapes / dependency matrix |

## 3. Verify it runs (no money involved)

```bash
pnpm install
pnpm build
pnpm test    # should be 317/317 passing
```

If anything fails, find out why first. **Do not run forecast:live without a passing build.**

## 4. How to interpret "run pulse"

| User says | You do |
| --- | --- |
| "give me recommendations" / "no orders" / "recommend only" | `ENV_FILE=.env.pizza pnpm forecast:live -- --recommend-only` |
| "run pulse" / "live" / "real money" / "实盘" | `ENV_FILE=.env.pizza pnpm daily:forecast` |
| "use the no1 wallet" | swap `.env.pizza` for `.env.no1` |
| "show current positions / equity" | read the latest `execution-summary.json` under `runtime-artifacts/pulse-live/`, or visit the spectator site |

## 5. Required reporting after any run

Win or lose:

- Print the run dir path: `runtime-artifacts/pulse-live/<ts>-<runId>/`
- Report key data from `run-summary.md`: fills / rejects / equity delta
- On failure: check `run-error/<ts>-<reason>/error.json` for `failure stage` + `next command`

## 6. Common landmines

| Landmine | How to avoid |
| --- | --- |
| Running `forecast:live` without `--recommend-only` "just to see" | This **places real orders**. Unless the user explicitly said live, keep `--recommend-only` |
| Moving `rough-loop.md` into `docs/` for tidiness | Don't — `services/rough-loop/src/lib/{loop,prompt,doctor}.ts` hardcode the root path |
| `claude --print` subprocess hanging at 0 bytes for 5+ min | **Not a failure** — Pulse render has a 30-minute internal timeout, let it finish |
| Seeing `[WARN] Fee mismatch ...` | Not an error, just a static-table vs on-chain divergence warning, does not block orders |
| Refactoring or slimming the root layout on day 1 | Ask the user first. Cascade risk (vitest config paths, Vercel auto-deploy, etc.) is real |
| Wanting to rename `claude.md` to uppercase `CLAUDE.md` | macOS case-insensitive FS treats them as the same file; git tracks lowercase. Rename requires the two-step `git mv -f` workaround |

## 7. Repo layout cheatsheet for new agents

Main code (where most of your work lands):

```
apps/web/        ← Next.js frontend (public spectator + admin)
services/
  ├── orchestrator/   ← Pulse fetch + decision runtime + risk trim + reports
  ├── executor/       ← Polymarket CLOB orders + sync + stop-loss
  └── rough-loop/     ← Independent task loop (not part of trading)
packages/        ← Shared contracts/db/terminal-ui
scripts/         ← CLI entry points (daily-pulse, pulse-live, etc.)
```

History / internal docs (read on demand):

```
docs/
  ├── archive/             ← Legacy handoffs / exploration notes
  ├── internal/
  │   ├── plan/            ← Phased plans
  │   └── review/          ← Historical review / decision notes
  ├── diagrams/            ← Architecture diagrams + operations runbooks
  ├── en/                  ← English mirrors
  └── *.md                 ← progress / risk-controls / rough-loop-guide / ...
```

## 8. Current-phase facts (may go stale fast)

> Cross-check this section against today's date vs the doc's "Last updated." If they're far apart, get the latest from `progress.md`.

- **V2 cutover: 2026-04-28 11:00 UTC** — see the runbook before/after that
- **Active live wallet**: pizza (`0x6664...614e`), ~$314 collateral, 6+ positions
- **Most recent pulse-live run**: 3 fills succeeded (see the latest dir under `runtime-artifacts/pulse-live/`)

## 9. When in doubt — ask

- Is the wallet right? → Ask
- Recommend-only or live? → Ask
- Will this change touch production cron / Vercel / the user's wallet? → Ask
- Does this "casual cleanup" cascade across multiple modules? → Ask

From CLAUDE.md §4: *"Stop and ask the user only when external permissions, irreversible risk, cost/safety/production impact, or genuine product-goal ambiguity is involved."* — In a real-money trading project, this trigger fires far more often than in normal projects.
