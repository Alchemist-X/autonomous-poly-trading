# General Collaboration Rules (Team Template)

> **Sync rule:** If a repository keeps both `CLAUDE.md` and `AGENTS.md`, the two files must stay aligned. Keeping only one is also acceptable, but do not leave them diverged for long.

Chinese version: see [`/CLAUDE.md`](../../CLAUDE.md).

Last updated: 2026-05-08

## 0. Scope

- This is a reusable cross-project collaboration baseline for most software, automation, data, and frontend work.
- Project-specific content goes at the bottom of this file under "## Project Execution Notes," or in a separate `project-rules.md`. Project rules should be "executable constraints + a date," not background prose.
- If rules conflict, the default priority is:
  - the user's explicit request in the current task
  - project-specific addendum (the "Project Execution Notes" at the bottom)
  - this general template

## 1. Language and Documentation

- Code comments must be in English.
- Human-facing Markdown defaults to Chinese, with an English copy (`*.en.md` or under `docs/en/`).
- Chinese keeps the primary filename; English uses `*.en.md`.
- If the Chinese and English versions diverge, the Chinese version is the source of truth and the English version must be brought back into alignment quickly.
- Any update to human-facing docs should update both language versions together.
- If one iteration can only update one language first, mark the file clearly as "translation pending" and complete the sync before handoff.

## 2. Terminal Interaction and Progress Visibility

- Every critical workflow must print visible stage output in the terminal.
- Long-running tasks must emit heartbeat progress updates: current stage, elapsed time, remaining time or timeout signal if available.
- Background jobs and sub-agents are allowed to do heavy work quietly, but the main session must keep visible progress flowing to the user.
- Terminal output should preferably be colorful and leveled (`INFO/WARN/ERR/OK`).
- Errors must be actionable and should preferably be archived under `run-error/<timestamp>-<reason>/`, including at least: failure stage, key context, concise cause, next command(s) or recovery action.
- If the task produces logs, reports, or artifact directories, print the important paths at the end.

## 3. Communication Style and Human Review Entry Point

- Default to language that a normal product manager can understand; do not hide behind jargon or buzzwords.
- Necessary technical terms get a first-mention explanation: what they mean and what they affect.
- Every substantive reply or progress update should **start with a human review entry point**: 1-5 concrete files / routes / commands / sections most worth manual review, before any abstract summary.
- Right after the review entry point, explain what was changed and the effect of the change.
- When describing a plan, answer these four things first: what the problem is / what it affects / how it will be handled / what the user needs to decide.
- If model, reasoning, infrastructure, deployment, or execution details matter, give the plain-English conclusion first and technical detail second.
- Avoid reporting nouns without a conclusion. "Framework / loop / pipeline / enablement" are not answers by themselves.

## 4. Collaboration and Delegation Baseline

- Default flow: the main session decomposes the task, decides "what is the most blocking thing the main session itself should drive right now," and delegates parallelizable parts to sub-agents.
- The main session owns goal alignment, dependency handling, integration, external communication, and final acceptance.
- Unless a task is tiny, strictly serial, or involves high-risk permission ops, do not pile every heavy step onto the main session.
- The agent should make low-stakes decisions on its own and keep iterating + testing until the issue is genuinely resolved; do not bounce obviously inferable choices back to the user.
- When blocked, classify whether the issue is code, environment, external service, permission boundary, or your own over-cautious judgement — then decide the next step.
- Stop and ask the user only when external permissions, irreversible risk, cost/safety/production impact, or genuine product-goal ambiguity is involved.
- Save in-progress work periodically with timestamps; do not wait until the entire task is done to flush state.
- If more than `12h` has passed since the last saved or pushed checkpoint, prioritise saving a usable update before continuing the long task.

## 5. Sub-agent Usage Rules

- Only split when the task has obvious parallelizable subproblems (implementation vs tests, cross-module independent edits, code change vs reference look-up).
- Do not split small / tightly-coupled / continuous-context tasks.
- Do not split first when high-risk operations are involved (production data changes, permission changes, deletions, fund operations, public releases) — those default to the main session.
- Before splitting, the main session defines each sub-agent's goal / ownership / inputs and outputs / success criteria.
- Parallel only works when sub-tasks have low dependencies, clear interfaces, and isolatable change surfaces; if a prerequisite result will reshape later work, run them serially.
- Before parallel execution, the main session establishes shared constraints: data structures, naming, interface contracts, directory layout, which shared files may be touched.
- Sub-agents stay within their ownership; cross-boundary changes must be raised to the main session, not "fixed in passing."
- Sub-agent reports must be merge-ready units: what was done / which files or logic were affected / current status / blockers / impact on parallel work.
- When two sub-agents conflict on the same file / interface / behaviour, the main session arbitrates; sub-agents must not overwrite each other.
- Main session must take over when: sub-tasks deadlock / shared abstraction needs change / root cause diverges from the original split / cross-module architecture trade-off needed.
- Pause and ask the user when: goal is unclear / irreversible op required / behaviour the user explicitly specified would change / new external dependency or permission needed / clear cost/safety/production risk.
- Final integration is the main session's job and is not further delegated: unify behaviour, resolve conflicts, verify the original goal is met.
- At task end, leave a minimal traceable record: who owned what, which conclusions were adopted, which approaches were dropped, what residual risk remains.

## 6. Execution Safety and State Consistency

- High-risk executions must include a `preflight` / `dry-run` / `plan-only` / `preview` stage; that stage is not the destination, it is a required step before live execution.
- Every critical execution prints the current `execution mode` (`inspect / dry-run / live / migration / release`) plus the decision source (human / script / AI).
- High-risk paths default to `fail-fast`; silent degradation or quiet fallback after a critical check fails is not allowed.
- When internal limits, external thresholds, missing permissions, or environment conditions guarantee failure, warn explicitly and surface both the internal and external constraints.
- Do not perform irreversible operations when full analysis, verification, or dependencies are not yet ready.
- Single state source; whenever environment / account / wallet / dataset / working directory / state file is involved, print the value actually in use.
- If environment / account / multi-state-file mixing is detected, warn and suggest a fix.
- Fallback configuration must be clearly labelled as fallback, never disguised as live truth.
- For user-visible critical changes, do not declare success based on exit code alone; verify real behaviour matches expectations.

## 7. Traceable Artifacts

- All critical runs must produce traceable artifacts: preflight, input parameters, recommendations, execution results, error info, summary reports.
- On failure, preserve intermediate artifacts (checkpoint, temp files, provider output, log fragments) for resume or post-mortem.
- After every run, print the archive directory and key file paths.
- Content meant to explain or document for users (flowcharts, FAQs, key mechanism notes, retros) goes under `docs/diagrams/`.
- `docs/` files follow the same bilingual rule: Chinese primary `*.md` + English mirror under `docs/en/` or `*.en.md`.
- Working logs and retros live in their own directory; do not pile them into `CLAUDE.md` / `AGENTS.md`.

## 8. Deployment and Release Verification

- For external deployment, release, or environment switches, do not declare success purely on a green CLI exit, URL, or log; perform real acceptance.
- After every public deployment, the main session must at minimum:
  - open the actual deployed result or target service
  - capture screenshots or visible evidence
  - compare the live result against the local target version or user reference
  - verify the target API, key data path, or core user flow is healthy
- If the homepage or the target view is already a full styled page, also confirm the layout / shell is not still wrapping a legacy frame, so the new and old pages do not stack.
- Do not tell the user "this matches local" before doing real online verification.

---

## Project Execution Notes (predict-raven specific)

> ⚠️ **This is a real-money live trading project.** Every `pulse:live` run places real, irreversible orders on Polymarket.

### 30-second must-read

- **Live by default**: `pnpm daily:pulse` / `pnpm pulse:live` places real orders. To inspect without trading, you must explicitly pass `--recommend-only` or say "no orders" in the prompt.
- **Default wallet**: `.env.pizza` (active account) — **this is the default, not hardcoded**. When deploying to a new machine or pairing a new agent with a different primary wallet, replace `.env.pizza` with your own env file and update the corresponding line in `skills/daily-pulse/agents/openai.yaml` (`use .env.pizza when no env is specified`). For ad-hoc wallet switches use `ENV_FILE=.env.<name>`. Preflight prints the current wallet address + collateral, abort immediately if it does not match expectation.
- **Hard risk caps** (enforced at the executor service layer, no override): per-trade ≤ 15% bankroll / total exposure ≤ 80% / per-event ≤ 30% / max 22 positions / min $5 trade.
- **Event-probability assessments must use Pulse (2026-05-08)**: any assessment involving event likelihood, fair probability, edge, win rate, or whether an event will happen must first run a read-only Pulse flow and cite the archive paths (`recommendation.json`, Pulse markdown, relevant evidence artifact). For existing-position reviews, use the position-only flow `ENV_FILE=.env.pizza pnpm pulse:positions -- --json` (or `pnpm pulse:live -- --recommend-only --positions-only`) so the run only refreshes evidence and probabilities for current holdings and does not scan/recommend new markets; only use `ENV_FILE=.env.pizza pnpm pulse:recommend` when the user explicitly asks for new opportunities. If there is no Pulse artifact, do not provide probability/edge numbers; explicitly mark it as "not evaluated".
- **Existing positions default to hold**: pulse-direct's Position Review module never closes positions blindly; every `hold` decision carries a reason. `reduce` / `close` requires contradicting evidence.
- **`claude --print` occasionally hangs at 0 bytes for 5+ minutes** — that is not a failure. The Pulse render has a 30-minute internal timeout; let it finish.

### Default ultracode orchestration (2026-06-09, user request, this project only)

- **Every substantive task in this project defaults to ultra**: author/run a Workflow orchestration (understand→design→implement→review, chaining workflows when needed). Token cost is not a constraint; optimize for the most exhaustive, correct result and adversarially verify key findings.
- Go solo only for conversational/Q&A turns or trivial mechanical edits (single-file tweak, constant change, one command). When unsure, lean toward a workflow.
- This is the "default-ultra equivalent": if the FleetView session already shows `Ultracode is on`, that wins; this rule is the cross-surface fallback so behavior stays ultra even where that flag is absent. Temporary override: say "no workflow this time / go solo" in a prompt.

### Key paths

| Topic | File |
| --- | --- |
| **Read every time you take over** — current state + TODOs (updated at wrap-up) | [`docs/en/agent-handoff.md`](agent-handoff.md) |
| **First contact only** (read once) | [`docs/en/agent-onboarding.md`](agent-onboarding.md) |
| Full risk-control rules | [`docs/risk-controls.en.md`](../risk-controls.en.md) |
| V2 cutover runbook (2026-04-28 11:00 UTC) | [`docs/internal/plan/2026-04-28-v2-cutover-runbook.md`](../internal/plan/2026-04-28-v2-cutover-runbook.md) |
| Command cheatsheet / deployment / dependency matrix | [`docs/diagrams/dev-reference.en.md`](../diagrams/dev-reference.en.md) |
| Wallet & account setup (4 fields) | README "Wallet and Account Setup" section |
| Live run summary archive | `runtime-artifacts/pulse-live/<ts>-<runId>/run-summary.md` |
| Pulse AI reasoning report | `runtime-artifacts/reports/pulse/YYYY/MM/DD/pulse-*.md` |

### Wrap-up rituals

- Update [`docs/en/agent-handoff.md`](agent-handoff.md): tick off completed P0/P1 items, add newly discovered TODOs, refresh the "Last session context" section, bump the `Last updated` line.
- Update immediately when the user says "记一下" / "save this" / "update handoff" — do not wait until wrap-up.
- Keep the handoff doc tight: actionable, not a running log; details belong in `git log` or `docs/internal/review/`.

> **Current P0 / P1 / P2 TODOs all live in [`docs/en/agent-handoff.md`](agent-handoff.md)** — this section no longer maintains its own task list to avoid two-source drift.
