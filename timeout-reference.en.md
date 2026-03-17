# Timeout Reference Table
Chinese version: [timeout-reference.md](timeout-reference.md).

Last updated: 2026-03-16

| Service | Module / Operation | Timeout Name | Current / Default Value | Can Be Disabled | Location | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `apps/web` | Entire service | None | None | N/A | N/A | No runtime timeout is currently defined |
| `services/executor` | Entire service | None | None | N/A | N/A | No runtime timeout is currently defined |
| `services/orchestrator` | Decision runtime: `codex exec` / template provider | `PROVIDER_TIMEOUT_SECONDS` | `0` | Yes, `0=disabled` | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/runtime/provider-runtime.ts` | AI decision path timeout, disabled by default |
| `services/orchestrator` | Full pulse render / pulse research subcommands | `PULSE_REPORT_TIMEOUT_SECONDS` | `0` | Yes, `0=disabled` | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/pulse/full-pulse.ts` | Covers full-pulse render, `npm install`, `scrape-market.ts`, and `orderbook.ts` |
| `services/orchestrator` | Pulse market fetch | `PULSE_FETCH_TIMEOUT_SECONDS` | `60s` | `0=disabled` not supported | `.env.example` / `services/orchestrator/src/config.ts` / `services/orchestrator/src/pulse/market-pulse.ts` | External fetch timeout, still finite |
| `services/orchestrator` | Resolution: `python3 fetch_event.py` | Hardcoded | `90_000 ms` | No | `services/orchestrator/src/jobs/resolution.ts` | Event-data fetch |
| `services/orchestrator` | Resolution: `python3 scrape_source.py` | Hardcoded | `120_000 ms` | No | `services/orchestrator/src/jobs/resolution.ts` | Resolution-source snapshot |
| `services/rough-loop` | Task provider execution | `ROUGH_LOOP_TASK_TIMEOUT_MINUTES` | `45 min` | `0=disabled` not implemented | `.env.example` / `services/rough-loop/src/config.ts` / `services/rough-loop/src/lib/provider.ts` | Upper bound for provider execution per task |
| `services/rough-loop` | Verification commands | `ROUGH_LOOP_TASK_TIMEOUT_MINUTES` | `45 min` | `0=disabled` not implemented | `.env.example` / `services/rough-loop/src/config.ts` / `services/rough-loop/src/lib/verification.ts` | Same budget applied to each verification command |
| `services/rough-loop` | Doctor: `command -v <provider>` | Hardcoded | `15_000 ms` | No | `services/rough-loop/src/lib/doctor.ts` | Environment check |
| `services/rough-loop` | Git: `git diff --name-only --relative` | Hardcoded | `15_000 ms` | No | `services/rough-loop/src/lib/git.ts` | Worktree scan |
| `services/rough-loop` | Git: `git diff --cached --name-only --relative` | Hardcoded | `15_000 ms` | No | `services/rough-loop/src/lib/git.ts` | Staged scan |
| `services/rough-loop` | Git: `git ls-files --others --exclude-standard` | Hardcoded | `15_000 ms` | No | `services/rough-loop/src/lib/git.ts` | Untracked scan |
| `services/rough-loop` | Git: `git diff --relative` | Hardcoded | `15_000 ms` | No | `services/rough-loop/src/lib/git.ts` | Diff export |
| `services/rough-loop` | Git: `git rev-parse --is-inside-work-tree` | Hardcoded | `15_000 ms` | No | `services/rough-loop/src/lib/git.ts` | Git writability check |
| `services/rough-loop` | Git: `git add -- ...` | Hardcoded | `15_000 ms` | No | `services/rough-loop/src/lib/git.ts` | Staging files |
| `services/rough-loop` | Git: `git commit -m ...` | Hardcoded | `30_000 ms` | No | `services/rough-loop/src/lib/git.ts` | Auto-commit |
| `services/rough-loop` | Git: `git push` | Hardcoded | `60_000 ms` | No | `services/rough-loop/src/lib/git.ts` | Auto-push |

| Global Convention | Value |
| --- | --- |
| AI reasoning path waits indefinitely by default | `PROVIDER_TIMEOUT_SECONDS=0` |
| Pulse render / research waits indefinitely by default | `PULSE_REPORT_TIMEOUT_SECONDS=0` |
| Services that still keep finite timeouts | `orchestrator` external fetches, `orchestrator` resolution jobs, `rough-loop` provider/verification/git/doctor |
