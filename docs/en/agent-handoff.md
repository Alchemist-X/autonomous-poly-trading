# Agent Handoff — Current State + Pending TODOs

> **Read this every time you take over the project.** This is the shared notebook between sessions for predict-raven — what the previous agent did, what's currently in focus, what's next.
>
> **When to update**:
> - At every wrap-up (the agent updates itself)
> - When the user says "记一下" / "save this" / "update handoff" (update immediately)
> - After completing a P0 / P1 task (mark done + add new entries)
>
> **Update principle**: keep it tight + actionable. **Not a running log.** For details, check `git log` or `docs/internal/review/`.
>
> Chinese version: [`docs/agent-handoff.md`](../agent-handoff.md)
>
> Last updated: 2026-05-10 by Codex (three non-production Pizza snapshot style previews deployed to Vercel preview; production `autopoly-pizza-spectator.vercel.app` was not promoted; local/preview build + Playwright verification passed)
>
> **Translation pending** — the Chinese version contains Mode A Phase 3a entries (3a.0 builder code / 3a.1 adapter / 3a.2 pulse-dispatcher bridge done as of 2026-05-05) that have not yet been mirrored here. See `docs/agent-handoff.md` for the canonical state.

---

## 🔴 P0 — Now / Today

- [x] **【P00 · Implemented】pulse-direct market-binding validation**: Fixed on 2026-05-05. `pulse-entry-planner` no longer binds multi-strike markets by shared event URL alone; `execution-planning` adds a P00 gate requiring marketSlug / tokenId / outcomeLabel / rule threshold to match exactly, with bestBid / bestAsk / decision price allowed within 3%; `pulse-live` fail-fasts in live mode on `blocked_by_market_binding`. Test coverage: `pulse-entry-planner.test.ts` / `execution-planning.test.ts` / full `pnpm test` 392 pass.
- [x] **【P0 · v1 implemented】Independent research review for existing positions**: on 2026-05-07, `pulse-live` now generates `position-research.json` for every remote holding outside the random Pulse candidate set, fetching Gamma event/market payloads plus the held-token orderbook. `Position Review` consumes `positionResearch` first, so uncovered holdings are marked `fresh-position-research` / `position-research-refreshed` instead of stale hold by default (near-stop-loss positions still reduce). **Remaining gap**: no model-level probability re-estimation and no comments/external-source crawler yet; this is factual refresh + artifact, not a full external research agent.
- [x] **【P0 · Implemented】Existing-position reviews must use position-only Pulse probability/edge refresh**: on 2026-05-08, added `pnpm pulse:positions` (equivalent to `pulse:live --recommend-only --positions-only`). It only generates Pulse analysis for current holdings, does not scan new markets, and does not emit new-entry recommendations. Candidate JSON now includes held side / shares / average cost / mark / PnL; the parser keeps Yes/No probability rows even when edge is negative, and `Position Review` prefers the held-side Pulse edge. Verification archive: `runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/`, 7 holds, 0 fills, 12 Pulse review plans; Crude kept edge=0 because Pulse explicitly refused to estimate probability without rule / CL data.
- [x] **【P1 · Implemented】Per-position PnL snapshots + calibration ledger**: implemented on 2026-05-07. `pulse-live` / `pulse:recommend` write `position-mark-snapshot.json`, per-run `calibration-ledger.jsonl`, and append `runtime-artifacts/evaluation/pulse-calibration-ledger.jsonl`; run-summary now displays per-position mark attribution and unexplained equity residual.
- [ ] **【User does this themselves next session】Manual review of every intermediate analysis doc produced this round**: check whether their format and content are acceptable. At minimum:
  - `docs/agent-onboarding.md` / `docs/agent-handoff.md` (zh + en)
  - `docs/internal/plan/2026-04-28-v2-cutover-runbook.md`
  - `docs/diagrams/dev-reference.md` (zh + en)
  - `claude.md` / `AGENTS.md` (4 files, zh + en) — the "Project Execution Notes" tail section
  - Main `README.md` (Quick Start rewrite + System Design)
  - The user specifically wants to review **format and content presentation** for fit
- [ ] **2026-04-28 11:00 UTC · V2 cutover-day operations**: pause all crons → wait for official cutover completion → verify SDK connectivity → restart services. Detailed steps in [`docs/internal/plan/2026-04-28-v2-cutover-runbook.md`](../internal/plan/2026-04-28-v2-cutover-runbook.md)
- [ ] **Wrap pizza wallet's USDC.e → pUSD** (must be done before V2 cutover, otherwise post-4/28 preflight will see collateral=0). Manual: log into polymarket.com UI and find the "Migrate to pUSD" entry

## 🟡 P1 — This week

- [ ] **Wire up Polymarket Builder Code** (do immediately after V2 stabilises): register at https://polymarket.com/settings?tab=builder → set `POLYMARKET_BUILDER_CODE` env → include `builderCode` field in the FOK / GTC calls in `services/executor/src/lib/polymarket-sdk.ts`. Earns trade rebates
- [x] **【P1 · Implemented】Default Polymarket reads to in-process SDK + dedupe orderbook prefetch**: on 2026-05-07, `POLY_CLI_ENABLED` now has to be explicitly `true` before reads use `pnpm exec tsx scripts/poly-cli.ts`; the default path uses the in-process SDK. `POLY_CLI_STRICT=true` still forces the isolation bridge. `pulse-live` has per-run Promise caches for `readBook` / `computeAvgCost`; `buildExecutionPlan` bounded-concurrency-prefetches each unique open/close/reduce tokenId once per run.
- [ ] **Switch `fees.ts` sizing path to V2 dynamic fees**: use the existing `fetchDynamicFeeParams(client, conditionID)` helper (see `services/orchestrator/src/lib/fees.ts:328`) to replace the static category-fee table. Prerequisite: plumb `conditionId` through to `PlannedExecution` (currently absent)

## 🟢 P2 — Eventually

- [ ] **Rename Vercel project** `autopoly-pizza-spectator` → `predict-raven`: Vercel dashboard → Project Settings → Name. After rename, also update the spectator URL at the top of README to `predict-raven.vercel.app`
- [x] **Promote the prophets-profit clone to production**: completed on 2026-05-10 at `https://autopoly-pizza-spectator.vercel.app`. The page keeps the prophets-profit look, but now uses Pizza Polymarket public-wallet data plus a bundled Pulse position-review summary instead of the source Kalshi static snapshot.
- [x] **Three non-production Pizza snapshot style previews**: completed on 2026-05-10 and deployed only to Vercel preview, with no production promote. Review URLs: `https://autopoly-pizza-spectator-eixznt54x-alchemist-xs-projects.vercel.app/previews/pizza-ledger-folio`, `/previews/pizza-ledger-terminal`, and `/previews/pizza-ledger-exchange`. Final preview deploy: `dpl_D3VdKtc1YZ6YTxXSn2qRg7DGgC1P`, with runtime env explicitly set to Pizza wallet `0x6664...614e` and `INITIAL_BANKROLL_USD=500`. Intermediate preview `dpl_BLwwnqngFevVbmHFSPBQo2LyTyxz` used the wrong preview wallet env and showed 0 fills; do not use it for review.
- [ ] **Automate `pulse-position-review.json` refresh**: `apps/web/public/pulse-position-review.json` is currently a manual public summary extracted from the 2026-05-08 position-only Pulse archive. After the next `pnpm pulse:positions` run, add/export a script so the deployed rationale data does not lag current holdings.
- [ ] **Upgrade README banner to 1200×630 PNG**: currently 1254×1254 square; Twitter card crops top and bottom. Make a horizontal version and re-upload to GitHub Settings → Social Preview
- [ ] **CONTRIBUTING.md + Google Form**: user mentioned for later
- [ ] **Drop lowercase `claude.md`, canonicalise to `CLAUDE.md`**: macOS case-insensitive FS treats them as one file. Use the two-step `git mv -f claude.md _CLAUDE.md && git mv _CLAUDE.md CLAUDE.md` workaround

## ⛔ Done / Don't redo (decisions are final)

- ✅ **Polymarket V2 SDK migration** (commit `48181a5`): executor side switched to `@polymarket/clob-client-v2@1.0.2`, constructor changed to options form, SignatureType compatible, CTF address unchanged. No regressions
- ✅ **README major slimming + Quick Start lifted up** (commits `70aa9c1` `8994ad1`): from 570 → ~290 lines, dropped "three execution paths" and the long manifesto
- ✅ **Repo renamed** `autonomous-poly-trading` → `predict-raven` + local dir at `~/dev-proj/predict-raven/` (symlink keeps the old path working)
- ✅ **Repo root slimming** (commit `24a9b0a`): 33 → 23 entries. `.en.md` into `docs/en/`, build configs into `config/`, `docker-compose` into `deploy/`, `Illustration/` → `docs/diagrams/`, `Plan/` → `docs/internal/plan/`, `Wasted/` → `docs/archive/`, `E2E Test Driven Development/` → `e2e/`
- ✅ **CLAUDE.md / AGENTS.md Tier 2 trim** (commit `abb2c60`): from 181 → 138 lines, added the "Project Execution Notes" tail section
- ✅ **GitHub Social Preview** is set to the raven logo
- ✅ **MIT LICENSE** added
- ✅ **rough-loop.md kept at root** (Plan B explicit trade-off): 3 ts files hardcode the path, moving was higher risk than the visual gain

## 📝 Known landmines (avoid repeating)

- `claude --print` subprocess occasionally hangs at 0 bytes for 5+ minutes → not a failure, wait for it
- Moving `vitest.config.ts` to `config/` requires `root: REPO_ROOT` in the config, otherwise `@autopoly/*` workspace packages cannot be resolved
- `git mv` of an entire directory does not move untracked files — those need a manual `mv`
- During the 4/24 V2 smoke, the no1 wallet had $3.96 USDC.e but $0 pUSD → verifies SDK works but trading requires wrapping first

## 🔄 Last session context (2026-05-10)

- User asked for three preview versions whose style differs from the original site while keeping the same information and layout, and explicitly said not to deploy production. Added three preview routes: `/previews/pizza-ledger-folio` (paper research brief), `/previews/pizza-ledger-terminal` (dark operator terminal), and `/previews/pizza-ledger-exchange` (clean brokerage board). `ProphetsProfitSnapshot` now supports `variant="folio" | "terminal" | "exchange"` plus preview-only `as="div"` to avoid nesting a `<main>` inside the preview shell's `<main>`; the home page still defaults to `variant="original"`.
- Preview deploy: final review base URL is `https://autopoly-pizza-spectator-eixznt54x-alchemist-xs-projects.vercel.app` (deploy `dpl_D3VdKtc1YZ6YTxXSn2qRg7DGgC1P`, `target=preview`, `status=Ready`). Did not run `vercel deploy --prod`, and the production alias `https://autopoly-pizza-spectator.vercel.app` was not changed.
- Verification: `pnpm --filter @autopoly/web typecheck` passed; `pnpm --filter @autopoly/web build` passed; local `http://localhost:3007` and all three Vercel preview routes passed Playwright checks with 0 console/page errors and mobile `overflowPx=0`. Verified Pizza data markers: `$500.00` starting capital and `34 fills`. At verification time, live marks showed preview `ending_nav≈$554.25` and `roi≈+10.85%`. Screenshots: `output/playwright/pizza-preview-{folio,terminal,exchange}.png` and `output/playwright/pizza-preview-live-{folio,terminal,exchange}.png`.
- User confirmed the production switch and requested adapting the page to their own data. `apps/web` root `/` still uses the prophets-profit "Live Trading Snapshot" look, but data now comes from `GET /api/public/trading-snapshot`, implemented by `apps/web/lib/trading-snapshot.ts` over Polymarket public-wallet `overview / positions / closed-positions / activity`, `public/equity-history.json`, and `public/pulse-position-review.json`.
- Removed the source Kalshi `paper-trades.json` to avoid mixed production data. Added `apps/web/public/trading-snapshot-config.json`, so production falls back to Pizza's `$500` starting bankroll when `INITIAL_BANKROLL_USD` is not set; without this, production incorrectly calculated ROI from the first `$20` equity-history row.
- Current production data shape: API returns `starting_capital=$500`, `ending_nav≈$556.98`, `net_pnl≈+$56.98`, `roi≈+11.40%`, `34` fills, `20` markets, and `7` open markets. `pulse-position-review.json` comes from `runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/recommendation.json` and includes only public review summaries and source links.
- Production deploy: `dpl_8is51ocvNuE2H1pxkpBe5UEiEES1`, aliased to `https://autopoly-pizza-spectator.vercel.app`. The intermediate production deploy `dpl_3uM7bQnMp3p3G6U22wSuKVXvtNLR` briefly exposed the wrong `$20` starting-capital fallback and was superseded by the final deployment.
- Verification: `pnpm --filter @autopoly/web typecheck` passed; `pnpm --filter @autopoly/web build` passed; local `http://localhost:3007` and production Playwright checks passed for first viewport, filters, search, and expanded Delcy rationale; production `/api/public/trading-snapshot` returned 200; Playwright console errors were 0. Screenshots: `output/playwright/pizza-adapted-local.png`, `output/playwright/pizza-adapted-production.png`.
- This session did not run `pulse:live` / `daily:pulse` and placed no real-money orders. It only read existing Pulse artifacts and Polymarket public endpoints.

## 🔄 Earlier session context (2026-05-08)

- User clarified on 2026-05-08: any event probability / fair probability / edge estimate must call the Pulse flow; reviewing current positions means using Pulse to analyze existing holdings only, not scanning for new markets. This rule was synced into `AGENTS.md`, `claude.md`, `docs/en/AGENTS.md`, and `docs/en/CLAUDE.md`.
- `pnpm pulse:positions` is implemented: entry point in `scripts/pulse-live.ts`; positions-only forces recommend-only; `market-pulse.ts` builds an existing-position snapshot; `pulse-direct-runtime.ts` emits only existing-position review decisions; `pulse-entry-planner.ts` keeps all probability rows in position-only mode instead of dropping negative-edge / Kelly=0 rows.
- Latest read-only review: `ENV_FILE=.env.pizza pnpm pulse:positions -- --json` succeeded. Archive: `runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/`; Pulse report: `runtime-artifacts/reports/pulse/2026/05/08/pulse-20260508T021044Z-claude-code-full-245b4933-880f-47d7-ae86-75d5ffb8b81e.md`. No orders were placed.
- Current 7 holdings are all No / hold. Positive-edge holdings: Delcy +9.5pp, Finland +4.15pp, Measles +4.0pp, France +2.85pp, England +2.05pp, Leclerc +1.45pp. Crude edge=0 because Pulse explicitly wrote that AI probability was not evaluated due to missing rules / CL data; next review should first fetch rules and WTI/CL data.
- Verification: `pnpm test -- services/orchestrator/src/runtime/pulse-entry-planner.test.ts services/orchestrator/src/runtime/pulse-direct-runtime.test.ts services/orchestrator/src/review/position-review.test.ts` actually ran the full suite, 48 files / 402 tests passed; `pnpm typecheck` passed.

## 🔄 Earlier session context (2026-05-07)

- Pulse-quality additions this round: `scripts/pulse-evaluation-ledger.ts` handles per-position mark attribution + calibration ledger; `scripts/pulse-live.ts` writes those artifacts on recommend-only/live success paths; `scripts/live-run-summary.ts` renders per-position PnL attribution.
- Existing-position review now has a v1 independent research input: `scripts/pulse-position-research.ts` fetches Gamma event/market data plus held-token orderbooks, `scripts/pulse-live.ts` writes `position-research.json`, and `position-review` marks randomly uncovered holdings `fresh-position-research`. Still missing: model-level probability re-estimation and comments/external-source crawling.
- Polymarket performance changes this round: default in-process SDK, poly-cli is explicit opt-in fallback, `pulse-live` caches book/avgCost per run, and `buildExecutionPlan` prefetches unique token orderbooks concurrently.
- Verification: `pnpm typecheck` passed; `pnpm test -- services/orchestrator/src/review/position-review.test.ts services/orchestrator/src/review/position-research.test.ts services/orchestrator/src/lib/execution-planning.test.ts` actually ran the full vitest suite, 47 files / 400 tests passed. Did not run `pulse:live`; no live orders.

## 🔄 Earlier session context (2026-04-26)

- Ran one live `daily:pulse`: 3 fills (finland eurovision $20 / crude oil $54.81 / france world cup $18.94), collateral $314.16 → $220.36, equity $548 → $529
- README banner uses `assets/predict-raven.png` (1254×1254)
- First Twitter post → card image was slow to populate; next time wait 30s after pasting URL before posting

## 📌 Quick reference

| I want to know... | Look at |
| --- | --- |
| First-time onboarding (only once) | [`docs/agent-onboarding.md`](../agent-onboarding.md) (zh) / [`docs/en/agent-onboarding.md`](agent-onboarding.md) (en) |
| Full risk-control rules | [`docs/risk-controls.en.md`](../risk-controls.en.md) |
| Command cheatsheet / deployment | [`docs/diagrams/dev-reference.en.md`](../diagrams/dev-reference.en.md) |
| Historical review / decisions | [`docs/internal/review/`](../internal/review/) |
| Most recent pulse-live run | latest dir under `runtime-artifacts/pulse-live/` |
