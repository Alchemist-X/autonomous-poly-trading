# Handoff 0510 — Pre-Commit Wrap-Up

Last updated: 2026-05-10
- Track 1 (Pulse quality + Pizza snapshot previews) by Codex
- Track 2 (Mode A managed product) by Claude (Opus 4.7)

> Two parallel tracks this week:
> 1. **Pulse quality improvements** (Codex) — `pulse:positions` / market binding / PnL ledger / position research / web snapshot
> 2. **Raven Managed Product Mode A** (Claude) — consumer AI managed-trading Phase 3a complete + paper-mode smoke test
>
> Sections up through §"Next Time" are Track 1. §"Track 2 · Mode A" is appended at the end.

## Human Review Entry Points

- Current change set: `git status --short`
- Current branch state: `main...origin/main [ahead 43]`
- Main code diff: `git diff --stat`
- Highest-value code review entry points:
  - `scripts/pulse-live.ts`
  - `services/orchestrator/src/runtime/pulse-entry-planner.ts`
  - `services/orchestrator/src/lib/execution-planning.ts`
  - `services/orchestrator/src/review/position-review.ts`
  - `apps/web/lib/trading-snapshot.ts`
- Three non-production Pizza snapshot previews:
  - Folio: `https://autopoly-pizza-spectator-eixznt54x-alchemist-xs-projects.vercel.app/previews/pizza-ledger-folio`
  - Terminal: `https://autopoly-pizza-spectator-eixznt54x-alchemist-xs-projects.vercel.app/previews/pizza-ledger-terminal`
  - Exchange: `https://autopoly-pizza-spectator-eixznt54x-alchemist-xs-projects.vercel.app/previews/pizza-ledger-exchange`
- Position-only Pulse entry point: `ENV_FILE=.env.pizza pnpm pulse:positions -- --json`
- Latest read-only review archive: `runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/`
- Latest Pulse report: `runtime-artifacts/reports/pulse/2026/05/08/pulse-20260508T021044Z-claude-code-full-245b4933-880f-47d7-ae86-75d5ffb8b81e.md`

## Collaboration Notes

- The main session integrated the document and checked the current worktree state.
- Gauss did a read-only pass over `git status`, `git diff`, and key files, grouping the changes into position-only Pulse, position research, market binding, PnL calibration, execution/performance, Web snapshot, and docs/evaluation.
- Lovelace did a read-only pass over remaining gaps and pre-commit checks, especially flagging the current `git diff --check` trailing whitespace and the need to review `.claude/*`, public JSON files, and English handoff status before staging.

## What Changed

- **Existing-position reviews now use position-only Pulse**: added `pnpm pulse:positions` / `--positions-only`, which forces `recommend-only`, reviews only current holdings, and does not scan new markets or emit new-entry suggestions.
- **Fixed missing edge propagation**: the parser now keeps Pulse Yes/No probability rows even when edge is negative or Kelly sizing is zero; `Position Review` prefers the held-side Pulse edge.
- **Position context is now included**: Pulse candidates include held side, shares, average cost, mark, current value, PnL, and stop-loss threshold so reports can identify the current holding instead of saying the direction is missing.
- **Collaboration rules updated**: `AGENTS.md`, `claude.md`, `docs/en/AGENTS.md`, and `docs/en/CLAUDE.md` now state that event probability / fair probability / edge estimates must use Pulse, and current-position reviews must use position-only Pulse.
- **Per-position PnL and calibration artifacts**: added/wired `position-mark-snapshot.json`, `calibration-ledger.jsonl`, the global Pulse calibration ledger, and per-position mark attribution in run summaries.
- **Factual research for existing holdings**: `pulse-position-research` fetches Gamma event/market records plus held-token orderbooks for every remote position.
- **Execution path hardening**: execution planning now has market-binding checks, outcome-label propagation, and deduped orderbook prefetch; the executor queue honors explicit `execution_amount` / `execution_unit`.
- **Persistent run / dispatch tooling**: added `agent-persistent-runner` and `execution-dispatch` to convert recommendations into dispatchable order plans, with mock executor support.
- **Web snapshot page**: the root page now renders `ProphetsProfitSnapshot`; added `/api/public/trading-snapshot`, `trading-snapshot.ts`, `pulse-position-review.json`, `trading-snapshot-config.json`, and styles.
- **Three Pizza snapshot previews**: added `/previews/pizza-ledger-folio`, `/previews/pizza-ledger-terminal`, and `/previews/pizza-ledger-exchange` without changing production. All three share the same Pizza/Polymarket data and ledger information structure, but use different visual treatments; the home page still defaults to `variant="original"`.
- **Docs and evaluation material**: added the Pulse quality improvement plan, `evaluation/`, the agent swarm prompt, and handoff/onboarding updates.

## Latest Verification

- `pnpm test -- services/orchestrator/src/runtime/pulse-entry-planner.test.ts services/orchestrator/src/runtime/pulse-direct-runtime.test.ts services/orchestrator/src/review/position-review.test.ts`
  - This ran the full Vitest suite: 48 files / 402 tests passed.
- `pnpm typecheck`
  - 9 workspace projects passed.
- `ENV_FILE=.env.pizza pnpm pulse:positions -- --json`
  - Succeeded in `recommend-only` mode with `executablePlans=0`; no orders were placed.
- Pizza snapshot preview:
  - `pnpm --filter @autopoly/web typecheck` passed.
  - `pnpm --filter @autopoly/web build` passed.
  - Local `http://localhost:3007` passed Playwright checks for all three preview routes, with 0 console/page errors and mobile `overflowPx=0`.
  - Vercel preview deploy `dpl_D3VdKtc1YZ6YTxXSn2qRg7DGgC1P` is Ready with `target=preview`; all three online preview routes passed Playwright checks and showed the Pizza data markers: `$500.00` starting capital and `34 fills`. At verification time, live marks were about `ending_nav=$554.25` and `roi=+10.85%`.
  - Screenshots: `output/playwright/pizza-preview-{folio,terminal,exchange}.png` and `output/playwright/pizza-preview-live-{folio,terminal,exchange}.png`.
  - **Did not run `vercel deploy --prod`; production `https://autopoly-pizza-spectator.vercel.app` was not changed.**

## Latest Position Review

- All 7 holdings are No / hold.
- Positive-edge holdings: Delcy +9.5pp, Finland +4.15pp, Measles +4.0pp, France +2.85pp, England +2.05pp, Leclerc +1.45pp.
- Crude edge=0 is intentional, not a parser miss: Pulse explicitly refused to estimate AI probability without settlement rules and CL data. Next review should fetch the rules, WTI/CL spot data, volatility, and relevant news first.

## Before Committing

- `git status` includes `.claude/settings.local.json` and `.claude/worktrees/`. These look like local agent/Claude workspace state; confirm whether they should be excluded before staging.
- Read-only sub-agent check found that `git diff --check` currently reports trailing whitespace in `docs/internal/review/review-and-plan.md:237-247`; clean that before committing.
- `docs/en/agent-handoff.md` still contains a “Translation pending” note. The English version now has 2026-05-08/05-10 additions, so confirm whether that note is still accurate.
- The new web public JSON files are data sources for the snapshot view. Confirm they are intended static snapshots, not temporary exports.
- `apps/web/public/pulse-position-review.json` is a public summary extracted from the 2026-05-08 position-only Pulse archive. Refresh it after the next `pulse:positions` run, otherwise frontend rationales will lag the real position review.
- Vercel preview note: the final review entry point is the `autopoly-pizza-spectator-eixznt54x...` deployment. Intermediate preview `dpl_BLwwnqngFevVbmHFSPBQo2LyTyxz` used the wrong preview environment and shows `0 fills / $11,842.77 NAV`; do not use it for human review.
- This is a wide change set. Suggested commit split:
  - Pulse position/edge flow: `pulse:positions`, position-only Pulse, parser/runtime/position review.
  - Execution/dispatch hardening: market binding, orderbook prefetch/cache, poly-cli default-off, queue worker execution amount, persistent runner/dispatch.
  - Web snapshot: `ProphetsProfitSnapshot`, `/api/public/trading-snapshot`, public JSON, favicon, styles.
  - Docs/evaluation: AGENTS/CLAUDE rules, handoff, evaluation, plan/review docs.
- Do not use `pulse:live` to review probabilities. Use `pulse:positions` for current holdings; use `pulse:recommend` only when looking for new opportunities.

## Next Time

- Fetch Crude settlement rules and CL/WTI data, then rerun `pulse:positions` to see whether Pulse can produce a non-zero edge.
- Pick one of the Folio / Terminal / Exchange Pizza snapshot previews; only after a choice should a separate production promote be done.
- Re-run `pnpm typecheck` and the full `pnpm test` before pushing; if the web changes stay, add a frontend smoke or screenshot check.
- Decide the commit policy for `.claude/worktrees/`, `.claude/settings.local.json`, runtime artifacts, and public snapshot JSON.
- Turn `pulse-position-review.json` generation from a manual snapshot into a stable export step after successful `pulse:positions` runs.
- Before pushing, reread `docs/agent-handoff.md` and this file to make sure paths and run ids are still current.

---

## Track 2 · Raven Managed Product (Mode A) — by Claude (Opus 4.7)

### What was built

**Starting point**: Phase 1 was an empty shell.
**End**: Mode A Phase 3a fully landed + end-to-end paper-mode smoke test passed.

#### Phase 1: product framing (2026-05-04)

- Researched betmoar: `$817M cumulative routed volume / non-custodial / $0/$0 fee / no copy trading / no paid tier / 100% revenue from Polymarket Weekly Rewards Pool`. Saved to [`docs/internal/review/2026-05-04-betmoar-and-computer-use-research.md`](../internal/review/2026-05-04-betmoar-and-computer-use-research.md).
- Locked Mode A "Pure Managed AI" — the segment betmoar deliberately avoids. Plan: [`docs/internal/plan/2026-05-04-mode-a-phase-3a-plan.md`](../internal/plan/2026-05-04-mode-a-phase-3a-plan.md).
- Computer Use research demoted to P2.

#### Phase 2: technical landing (2026-05-04 → 05-07, 14 commits)

| Commit | Description |
| --- | --- |
| `a6513bc` | **3a.0** Builder code wired into executor (Pizza/no1 keep this off — self-attribution likely filtered) |
| `12cd3f5` `18ade8a` `c642986` | **3a.1** `PolymarketRelayerAdapter` real impl: deploySafe / getBalance / getPositions / placeOrder |
| `2e81400` | **3a.2** Pulse → Dispatcher bridge: `scripts/managed-pulse.ts` + `proposed-decision-mapper.ts` |
| `7e0b956` | **3a.3** Cron + observability + alerts: `alerts.ts` + `risk-events.ts` + `managed-pulse-archive.ts` + `deploy/managed-pulse.cron.example` |
| `4c51edf` | **3a.4** paper-mode end-to-end smoke test ✅ |

#### Phase 3: UI / design system (10 commits)

`1184a2d` Raven Violet palette → `f826291` Inter + JetBrains Mono via next/font → `7704b40` Lucide icons replace emojis → `68b8ac6` raven brand mark SVG ×6 → `b646b4f` OG image → `da78405` tone-of-voice rewrites → `2f6e37c`-`eadbf55` Tier 1 component library (10 components) → `6a75d59` onboard mechanism diagram → `607511e` design philosophy §1 rewrite

#### Phase 4: infra + workflow (4 commits)

- `13494c8` CLAUDE.md §9 mandates Playwright visual QA for frontend tasks.
- `5dd4917` pin playwright@1.56.1 as workspace devDep.
- `30fec5f` Privy adds Twitter + Google login methods.
- `4d417a9` Neon PG 17.8 in **eu-central-1 (Frankfurt)**: 4 migrations applied, 14 tables verified.

#### Milestone: dogfood paper-mode smoke test (2026-05-07)

End-to-end pipeline ran clean, **0 bugs**. Archive: `runtime-artifacts/managed-pulse/2026-05-07T08-23-06Z-484e1667/`.

```
✅ Neon DB connected (Frankfurt)
✅ pulse parsed (3 decisions)
✅ user resolved = no1 (0xe14e...dff1)
✅ Safe derivation = 0xC78873...2936 ✅ exact match against .env.no1 FUNDER_ADDRESS
✅ on-chain balance via publicnode RPC = $3.96 USDC.e
✅ risk caps applied (balanced tier 15% × $3.96 = $0.59)
✅ all 3 decisions skipped — below $5 min notional (correct discipline)
✅ run persisted + archived + DB rows all correct
✅ exit 0
```

**Key finding**: `polygon-rpc.com` public RPC now returns 401 ("API key disabled"). Switched to `polygon-bor-rpc.publicnode.com` (alternates: `drpc.org`, `1rpc.io/matic`). Updated `.env.local`.

### Current state

- Branch: `main` (HEAD `4c51edf`, 25 unpushed commits)
- Tests: 65/65 managed-trading + all 9 workspace projects typecheck clean
- Build: `apps/raven-managed` `next build` 12 routes prerender clean
- Polymarket builder credentials: address `0x6664...14e` / code `0x30cf...95e`, all in `.env.local`, fee rate 0%/0% **don't change**

### Next time (Track 2 · Mode A)

#### 🔴 Blocking dogfood happy path (1 user action)

- **Fund no1 Safe with $30+ USDC.e**: address `0xC78873644E582cb950f1Af880C4F3eF3c11f2936`, **USDC.e (not pUSD)**. Then run `pnpm managed:pulse --json --recommendation runtime-artifacts/pulse-live/2026-04-26T060306Z-5f9b3d43.../recommendation.json`. Expect ≥ 1 decision `kept`.

#### 🟠 Blocking live-mode first order

- **Privy dashboard enable session signers**: log into https://dashboard.privy.io → app `cmkqta0kl043dla0dg9zfaufm` → Authentication → Session signers → enable + chainId 137 → grab `signerId` + create server signer key → write to `.env.local` as `NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID` + `PRIVY_SESSION_SIGNER_PRIVATE_KEY` → flip `MANAGED_TRADING_MODE=live` → run `pnpm managed:pulse --json`.

#### 🟡 Non-blocking backlog

- **B**: walk Privy connect-wallet real registration in browser (validate onboard UX, not just SQL INSERT).
- **D**: deploy cron so paper-mode runs daily (validates scheduling + alert webhook + archive accumulation).
- Lock down design inventory §2 five core directions (color / typography / icons / logo / tone) and execute §9.1.
- Apply for Polymarket Verified tier (mail builder@polymarket.com) → enter Weekly Rewards Pool.

### Pitfalls already paid for (avoid repeating)

- `polygon-rpc.com` public RPC returns 401 → use publicnode.
- Private keys / API secrets must not leave the local machine via chat (this round leaked Privy app secret + Polymarket builder secret + Neon DB password — rotate after dogfood works).
- Pizza/no1 (self-owned wallets) **must not** carry their own builder code (likely filtered by Polymarket Weekly Rewards Pool).
- `next build` clean ≠ hydration ok; frontend tasks must run `scripts/visual-qa.mjs` per CLAUDE.md §9.
- With multiple worktrees the `predict-raven` symlink may flip back to `main`; always `git checkout` your working branch before resuming.
- `.claude/worktrees/` accumulated to 9.2GB; **added to `.gitignore` 2026-05-10**.

---

## Combined next-round entry points (both tracks)

| Priority | Task | Track | Blocked by |
| --- | --- | --- | --- |
| 🔴 | Fund no1 Safe with $30+ USDC.e | Mode A | User action |
| 🔴 | Fetch Crude settlement rules + CL/WTI data | Pulse | Research |
| 🟠 | Privy session signer config → first live order | Mode A | User action |
| 🟠 | Pulse pulse-position-research scheduled + emitted | Pulse | Codex |
| 🟡 | Pick Pizza snapshot preview → later production promote | Pulse/Web | User decision |
| 🟡 | Privy connect-wallet real registration + cron deploy | Mode A | User action |
| 🟢 | Lock design §2 five directions + execute §9.1 | Mode A | User decision |
| 🟢 | Polymarket Verified tier application | Mode A | mail builder@polymarket.com |
