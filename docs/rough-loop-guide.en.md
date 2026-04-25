# Rough Loop Guide
Chinese version: [rough-loop-guide.md](rough-loop-guide.md).

## Goal

`Rough Loop` is the code-task continuous executor for this repository.

You only maintain [rough-loop.md](../rough-loop.md) at the repo root and keep adding task cards under `Queue`. The service reads tasks, runs Codex, verifies the result, updates task status, and stores artifacts under `runtime-artifacts/rough-loop/`.

## Commands

Check the environment first:

```bash
pnpm rough-loop:doctor
pnpm rough-loop:doctor -- --json
```

Run a single task:

```bash
pnpm rough-loop:once
pnpm rough-loop:once -- --json
```

Run as a polling daemon:

```bash
pnpm rough-loop:start
```

Run in watch mode:

```bash
pnpm rough-loop:dev
```

TTY terminals use colored human-readable sections by default; `--json`, CI, non-TTY shells, or `NO_COLOR=1` fall back to machine-readable or colorless output.

## Minimal Bootstrap Smoke

Start with one minimal `smoke` task card to validate daemon pickup, artifact generation, and the single-task commit / push loop before moving on to larger work.

First confirm there is no old daemon still holding `.rough-loop.lock`:

```bash
ps -ax -o pid=,command= | rg 'node dist/cli.js daemon|pnpm rough-loop:start'
test -f .rough-loop.lock && cat .rough-loop.lock
```

- If you still see a live old daemon, stop it first so two processes do not compete for `.rough-loop.lock`
- If only `.rough-loop.lock` remains and there is no matching live process, treat it as a leftover lock and remove it before restarting:

```bash
rm -f .rough-loop.lock
```

Then start a fresh daemon with the minimal closed loop. If you want every completed task to auto-push to the current branch, start it with `ROUGH_LOOP_AUTO_PUSH=1`:

```bash
ROUGH_LOOP_RELAX_GUARDRAILS=1 \
ROUGH_LOOP_REQUIRE_CLEAN_TREE=0 \
ROUGH_LOOP_AUTO_PUSH=1 \
pnpm rough-loop:start
```

Recommended first `smoke` task:

- Pick the smallest possible doc pair change or one tiny test change; do not start with the trading execution path
- Keep `Allowed Paths` narrowed to one or two files so the commit / push scope is easy to inspect
- Verify that the daemon moves the task to `running`, writes `runtime-artifacts/rough-loop/runs/...`, and commits only the files touched by that task

## Task Card Format

Every task must live under the `Queue` section and use this structure:

```md
### RL-001 | Implement the Rough Loop README section

#### Title
Implement the Rough Loop README section

#### Status
todo

#### Priority
P1

#### Depends On
- none

#### Allowed Paths
- README.md
- README.en.md

#### Definition of Done
- Add a Rough Loop section to README
- Keep README.en.md in sync

#### Verification
- pnpm typecheck
- pnpm test

#### Context
- Add the Rough Loop entrypoint and guardrail overview

#### Latest Result
- Not started

#### Attempts
0
```

## Field Rules

- `Status` only allows:
  - `todo`
  - `running`
  - `blocked`
  - `done`
  - `cancelled`
- `Priority` only allows:
  - `P0`
  - `P1`
  - `P2`
- `Allowed Paths` cannot be empty
- `Definition of Done` cannot be empty
- `Verification` cannot be empty
- Use `- none` when `Depends On` has no dependencies

To reuse the default verification set, write:

```md
#### Verification
- default
```

The service expands it to:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

If you want to start directly in the current dirty worktree and do not want Rough Loop to block on `Allowed Paths`, sensitive-path checks, or clean-tree checks, explicitly enable:

```bash
ROUGH_LOOP_RELAX_GUARDRAILS=1
```

When enabled:

- a dirty worktree does not block startup
- missing `Verification` falls back to the default verification commands
- missing `Allowed Paths` expands to the whole repository
- sensitive-path or out-of-scope edit checks no longer auto-block the task

## Runtime Behavior

- The default provider is `codex`
- A clean tree is required by default, but `rough-loop.md` / `rough-loop.en.md` task updates are treated as system-managed
- The loop auto-commits to the current branch by default and commits immediately after each completed task using only the files touched by that task
- Auto-push is disabled by default
- Sensitive paths, out-of-scope edits, or missing acceptance criteria move the task to `Blocked`
- Verification failures are retried automatically up to `3` times in the same loop run

With `ROUGH_LOOP_RELAX_GUARDRAILS=1`, the worktree and path guardrails above are explicitly relaxed.

## Artifact Layout

Every attempt writes its own artifact directory:

```text
runtime-artifacts/rough-loop/runs/YYYY/MM/DD/<timestamp>-<run-id>/
```

It always contains:

- `task-snapshot.md`
- `prompt.md`
- `provider-output.md`
- `verification.log`
- `git.diff.txt`
- `result.json`
- `summary.md`

The loop also refreshes:

- `runtime-artifacts/rough-loop/latest.json`
- `runtime-artifacts/rough-loop/heartbeat.json`

## Pause / Resume

Create an empty file at the repo root:

```bash
touch .rough-loop.pause
```

Remove it to resume:

```bash
rm .rough-loop.pause
```
