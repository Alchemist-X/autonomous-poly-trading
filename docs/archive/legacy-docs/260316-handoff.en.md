# 260316 Handoff
Chinese version: [260316-handoff.md](260316-handoff.md).

## 1. Current Task Goal

The immediate goal has narrowed from “continue the trading system” to “make Rough Loop a real continuously running Codex task loop inside the current repository” with these guarantees:

- It continuously reads task cards from [rough-loop.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.md).
- It can start on the current dirty worktree instead of being blocked by strict guardrails.
- After each completed task, it auto-commits only the files truly touched by that task, not all pre-existing dirty files in the repo.
- A real daemon is currently running in this repository.
- A new agent should be able to continue simply by appending tasks to `rough-loop.md`.

Done criteria:

- Rough Loop code, docs, tests, and root scripts exist.
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- The daemon is running.
- `runtime-artifacts/rough-loop/latest.json` and `heartbeat.json` are updating.

## 2. Current Progress

- Added a standalone `services/rough-loop` service instead of reusing the trading orchestrator.
- Added root docs:
  - [rough-loop.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.md)
  - [rough-loop.en.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.en.md)
  - [rough-loop-guide.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop-guide.md)
  - [rough-loop-guide.en.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop-guide.en.md)
- Added root scripts in [package.json](/Users/Aincrad/dev-proj/autonomous-poly-trading/package.json):
  - `pnpm rough-loop:once`
  - `pnpm rough-loop:dev`
  - `pnpm rough-loop:start`
  - `pnpm rough-loop:doctor`
- Added Rough Loop shared schemas/types in [packages/contracts/src/index.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/packages/contracts/src/index.ts).
- Implemented the core Rough Loop modules in `services/rough-loop/src/...`.
- Implemented explicit relaxed mode with `ROUGH_LOOP_RELAX_GUARDRAILS=1`.
- Implemented immediate auto-commit after each completed task, restricted to task-touched files plus `rough-loop.md` / `rough-loop.en.md`.
- Added tests:
  - [services/rough-loop/src/lib/markdown.test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/markdown.test.ts)
  - [services/rough-loop/src/lib/loop.test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/loop.test.ts)
  - [services/rough-loop/src/smoke.test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/smoke.test.ts)
- Latest checks passed:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
- A real daemon is running:
  - `ps` shows `node dist/cli.js daemon`
  - PID is currently recorded in `.rough-loop.lock`

## 3. Key Context

- The long-term repo goal is still the cloud-hosted Polymarket autonomous trading system with the public website, orchestrator, executor, pulse, resolution, and risk controls.
- But the latest user focus is Rough Loop as the always-running Codex system.
- The user explicitly asked for:
  - no restrictions on Rough Loop, or at least explicitly relaxed guardrails
  - a real continuously running loop in the current repository
  - “commit after every completed task”
- The repo already has many unrelated dirty changes:
  - `services/orchestrator`, `packages/db`, `apps/web`, and more
  - untracked files also exist, such as:
    - `services/orchestrator/src/pulse/full-pulse.ts`
    - `services/orchestrator/src/jobs/resolution.test.ts`
    - `packages/db/src/migrations/0001_tracked_sources.sql`
- Do not casually revert those changes.
- Documentation rules still apply:
  - code comments in English
  - human-facing Markdown uses Chinese as the primary file
  - English mirrors should be kept in sync
- Default provider is still `codex`; `openclaw` is only a compatibility path and not fully validated.
- The daemon was started with:
  - `ROUGH_LOOP_RELAX_GUARDRAILS=1`
  - `ROUGH_LOOP_REQUIRE_CLEAN_TREE=0`
  - `ROUGH_LOOP_AUTO_COMMIT=1`
  - then `pnpm rough-loop:start`

## 4. Key Findings

- In strict mode, Rough Loop correctly refuses to start because the repository is dirty.
- In this repository, `ROUGH_LOOP_RELAX_GUARDRAILS=1` is required for uninterrupted startup.
- The original auto-commit implementation would have staged too much from the dirty worktree; this has already been fixed.
- The fix is in [services/rough-loop/src/lib/loop.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/loop.ts), mainly:
  - `snapshotFileSignatures`
  - `detectTaskChangedFiles`
  - `stageCommitIfNeeded`
- `rough-loop.md` currently has an empty queue, so the daemon is healthy but idle.
- State files show:
  - [runtime-artifacts/rough-loop/latest.json](/Users/Aincrad/dev-proj/autonomous-poly-trading/runtime-artifacts/rough-loop/latest.json)
  - [runtime-artifacts/rough-loop/heartbeat.json](/Users/Aincrad/dev-proj/autonomous-poly-trading/runtime-artifacts/rough-loop/heartbeat.json)
  - both report `No todo tasks are available.`
- `pnpm rough-loop:doctor` can still fail in the current repo because dirty-tree reporting is honest; this does not mean the daemon is down.
- `rough-loop.en.md` should stay aligned with the parser-generated structure, or `doctor` will report an English-mirror mismatch.

## 5. Remaining Work

Priority P0:

- Add real task cards to [rough-loop.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.md) so the daemon actually does useful work.
- Decide what Rough Loop should do next:
  - continue the trading-system integration path
  - clean up and commit the current dirty worktree in controlled chunks
  - or move into deployment / admin / real data chain work

Priority P1:

- Decide whether to organize and submit the large set of pre-existing dirty changes in batches.
- Optionally expose Rough Loop summaries in the admin UI. Not done yet.
- Optionally add starter tasks/templates. Right now the daemon has no queue value because the queue is empty.

Priority P2:

- Decide whether `rough-loop:doctor` should treat dirty-tree status as non-fatal when relaxed mode is explicitly enabled.
- Decide whether to continue toward PR / review / merge automation. That is still conceptual and not implemented with real GitHub side effects.

## 6. Suggested Handoff Path

- Read these first:
  - [rough-loop.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.md)
  - [rough-loop-guide.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop-guide.md)
  - [services/rough-loop/src/lib/loop.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/loop.ts)
  - [services/rough-loop/src/config.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/config.ts)
  - [services/rough-loop/src/lib/loop.test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/rough-loop/src/lib/loop.test.ts)
  - [runtime-artifacts/rough-loop/latest.json](/Users/Aincrad/dev-proj/autonomous-poly-trading/runtime-artifacts/rough-loop/latest.json)
- Validate first:
  - whether the daemon is still alive
  - whether the PID in `.rough-loop.lock` matches a live process
  - whether `latest.json` / `heartbeat.json` are updating
  - whether `rough-loop.md` still has an empty queue
- Recommended first commands:
  - `ps -ax -o pid=,command= | rg 'node dist/cli.js daemon|pnpm rough-loop:start'`
  - `cat .rough-loop.lock`
  - `cat runtime-artifacts/rough-loop/latest.json`
  - `sed -n '1,220p' rough-loop.md`
  - `git status --short`
- Recommended next action:
  - add one minimal executable task card to `rough-loop.md`
  - watch the daemon move it into `Running`
  - confirm it writes `runtime-artifacts/rough-loop/runs/...`
  - confirm completion auto-commits only the files touched by that task

## 7. Risks and Caveats

- Do not assume the current dirty worktree belongs only to Rough Loop. It does not.
- Avoid destructive git commands such as:
  - `git reset --hard`
  - `git checkout --`
  - `git clean -fd`
- The daemon is intentionally running in relaxed mode. It will not protect you from dirty-tree, path-scope, or sensitive-path mistakes the way strict mode would.
- Auto-commit is now narrowed to task-touched files, but if a provider changes many files within a single task, all of those files can still enter that task’s commit.
- Keep the `rough-loop.md` / `rough-loop.en.md` structure stable; the parser expects fixed headings and sections.
- A failing `doctor` command does not necessarily mean the daemon is unhealthy; dirty-tree reporting is the common reason.
- The current PID and lock information are volatile. Recheck them instead of trusting this file blindly.
- `idle` in `latest.json` is expected right now because there are no `todo` tasks.

## First-Step Suggestion For The Next Agent

Do not keep changing Rough Loop itself first. Verify the daemon is alive, then add one minimal task card to [rough-loop.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/rough-loop.md), such as a small doc update or a small test change. Confirm the daemon can pick it up, execute it, write artifacts, and auto-commit only the task-touched files. Only after that loop is proven should you move on to larger trading-system work.
