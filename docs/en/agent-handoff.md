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
> Last updated: 2026-04-26 by Claude (session wrap-up: V2 migration + repo restructure + onboarding/handoff dual-doc pair complete; user flagged a manual review of every intermediate analysis doc as next-session P0)

---

## 🔴 P0 — Now / Today

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
- [ ] **Switch `fees.ts` sizing path to V2 dynamic fees**: use the existing `fetchDynamicFeeParams(client, conditionID)` helper (see `services/orchestrator/src/lib/fees.ts:328`) to replace the static category-fee table. Prerequisite: plumb `conditionId` through to `PlannedExecution` (currently absent)

## 🟢 P2 — Eventually

- [ ] **Rename Vercel project** `autopoly-pizza-spectator` → `predict-raven`: Vercel dashboard → Project Settings → Name. After rename, also update the spectator URL at the top of README to `predict-raven.vercel.app`
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

## 🔄 Last session context (2026-04-26)

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
