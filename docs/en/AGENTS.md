# General Collaboration Rules (Team Template)

> **Sync rule:** If a repository keeps both `CLAUDE.md` and `AGENTS.md`, the two files must stay aligned. Keeping only one is also acceptable, but do not leave them diverged for long.

Chinese version: see the matching primary-language file in the same directory.

Last updated: 2026-04-20

## 0. Scope

- This is a reusable cross-project collaboration baseline for most software, automation, data, and frontend work.
- Project-specific rules should be added in a "Project Addendum" section or moved to files such as `project-rules.md`, `ops.md`, or `runbook.md`. Do not mix business-specific rules directly into the shared baseline.
- If rules conflict, the default priority is:
  - the user's explicit request in the current task
  - project-specific addendum rules
  - this general template

## 1. Language and Documentation

- Code comments must be in English.
- Human-facing Markdown defaults to Chinese, with an English copy (`*.en.md`).
- Chinese keeps the primary filename, English uses `*.en.md`.
- If the Chinese and English versions diverge, the Chinese version is the source of truth and the English version must be brought back into alignment quickly.
- Any update to human-facing docs should update both language versions together.
- If one iteration can only update one language first, mark the file clearly as "translation pending" and complete the sync before handoff.

## 2. Terminal Interaction and Progress Visibility

- Every critical workflow must print visible stage output in the terminal.
- Long-running tasks must emit heartbeat progress updates, ideally including:
  - current stage
  - elapsed time
  - remaining time or timeout signal, if available
- Background jobs and sub-agents are allowed to do heavy work quietly, but the main session must keep visible progress flowing to the user.
- Terminal output should preferably be colorful and leveled (`INFO/WARN/ERR/OK`).
- Errors must be actionable and should preferably be archived under `run-error/<timestamp>-<reason>/`, including at least:
  - failure stage
  - key context (environment, inputs, target, artifact directory)
  - concise cause
  - next command(s) or recovery action
- If the task produces logs, reports, or artifact directories, print the important paths at the end.

## 3. Communication Style and Human Review Entry Point

- Default to language that a normal product manager can understand; do not hide behind jargon, buzzwords, or vague technical phrasing.
- Necessary technical terms are allowed, but explain them the first time they appear: what they mean and what they affect.
- Every substantive reply or progress update should start with a human review entry point:
  - first point out the `1-5` places most worth manual review
  - prefer concrete files, routes, commands, or sections before abstract summary
- Immediately after the review entry point, explain:
  - what was changed
  - what effect the change had
- When describing a plan, answer these four things first:
  - what the problem is
  - what it affects
  - how it will be handled
  - what the user needs to decide
- If model, reasoning, infrastructure, deployment, or execution details matter, give the plain-English conclusion first and technical detail second.
- Avoid reporting nouns without a conclusion. Terms like "framework," "loop," "pipeline," or "enablement" are not answers by themselves.

## 4. Collaboration and Delegation Baseline

- Default collaboration mode: the main session decomposes the task first, decides what blocking work it should handle locally right now, and then delegates suitable parallel work to sub-agents.
- The main session owns goal alignment, dependency handling, result integration, user-facing communication, and final acceptance.
- Do not keep all heavy work in the main session unless the task is trivial, must be sequential, or involves high-risk privileged operations.
- The agent should make low-value decisions autonomously and keep trying and testing until the issue is actually resolved; do not keep pushing obviously decidable choices back to the user.
- When blocked, first determine whether the issue comes from code, environment, external services, permission boundaries, or overly conservative judgment before deciding what to do next.
- Stop and ask the user only when the task requires external permission, carries irreversible risk, affects cost/security/production, or the product goal itself is genuinely unclear.
- Save progress periodically by default instead of waiting until the entire task is finished; every key save point should include a clear timestamp so the latest recoverable state is traceable.
- If more than `12h` has passed since the last meaningful saved or pushed progress point, package and save the current usable update before continuing long-running work.

## 5. Sub-agent Usage Rules

- Only split work when the task has clear parallelizable subproblems, such as separating implementation from testing, code changes from research, or independent module changes from one another.
- Do not split small tasks, tightly coupled tasks, or tasks that require continuous shared context, such as changing one function, fixing one explicit error, or repeatedly reasoning over one dense logic block.
- Do not delegate high-risk operations first and ask questions later. Production data changes, permission changes, destructive actions, money movement, and external releases should stay under main-session control by default.
- Before delegating, the main session must define each sub-agent's boundary clearly: what it owns, what it does not own, what artifact it should produce, and what success means.
- Every sub-agent must have explicit ownership over at least one core responsibility: a module, a file group, a phase, or a validation task.
- Ownership must specify both inputs and expected outputs to avoid multiple agents "helpfully" editing the same area without coordination.
- Parallel work is appropriate only when dependencies are light, interfaces are clear, and the change surface is isolated. If one subtask can change another subtask's design premise, finish the prerequisite work first.
- Before parallel execution begins, the main session should align shared constraints such as data structures, naming, interface contracts, directory placement, and which shared files may be edited.
- A sub-agent should make decisions only inside its own ownership boundary. Cross-boundary changes must be escalated back to the main session instead of expanding scope casually.
- Sub-agent updates should be mergeable-result oriented, not process-oriented. At minimum they should report: what changed, which files or logic were affected, current status, blockers, and whether other parallel work is impacted.
- During parallel work, the main session should perform convergence checks to confirm that assumptions, interfaces, and progress still line up. If a premise changes, pause the affected work and re-scope it.
- If two sub-agents may conflict on the same file, interface, or product behavior, the main session must arbitrate. Sub-agents should not overwrite each other's conclusions directly.
- The main session must take over when subtasks begin blocking one another, when a shared abstraction needs to change, when the root cause differs from the original split assumption, or when cross-module architectural tradeoffs appear.
- Work must pause and go back to the user when the goal is unclear, an irreversible action is required, explicitly requested behavior would change, a new external dependency or permission is needed, or there is clear cost/security/production risk.
- Final integration always belongs to the main session. Integration must at least unify behavior, resolve conflict, and verify that the final result satisfies the original goal.
- At task completion, keep a minimal traceable record of who owned what, which conclusions were accepted, which alternatives were discarded, and what residual risk remains.

### Example Flow

1. The user asks to fix a failing payment callback and add tests and logging.
2. The main session splits the work into three parts: callback logic repair, logging improvements, and test coverage.
3. Ownership is assigned:
   - Agent A only diagnoses the root cause and updates business logic.
   - Agent B only adds key logs and error context.
   - Agent C only reproduces the failure, verifies the fix, and reports residual risk.
4. The main session first sets shared constraints: field names stay unchanged, the external response format stays unchanged, and logs must not leak sensitive data.
5. The three sub-agents work in parallel. If a shared data structure must change, stop scope expansion and let the main session redefine the contract.
6. The main session integrates and validates the result. If the fix would affect production compatibility or require new permissions, pause and confirm with the user.

## 6. Execution Safety and Verification Principles

- Any high-risk execution should have a `preflight`, `dry-run`, `plan-only`, `preview`, or equivalent checking stage. The checking stage is not a separate destination; it is a required step before real execution.
- Every important run should print the current `execution mode`, such as `inspect / dry-run / live / migration / release`.
- If there is a primary decision source, print that as well, such as "human approved", "scripted rule", or "AI-assisted analysis", so the run is traceable later.
- High-risk paths should default to `fail-fast`. Do not silently degrade, quietly fall back, or skip mandatory validation after a critical check fails.
- If internal caps, external thresholds, missing permissions, or environment conditions make an operation impossible, warn explicitly and show both the internal limit and the external requirement.
- Do not execute irreversible actions when the necessary analysis, validation, or dependencies are not ready.
- For user-visible critical changes, command success alone is not enough; verify real behavior.

## 7. State, Config, and Environment Consistency

- Local testing and automation should use a single source of truth for state. Do not switch between multiple state/config files silently.
- Whenever environment, account, tenant, wallet, dataset, working directory, or state file matters, print the exact value being used.
- If mixed environments, mixed accounts, mixed addresses, or mixed state-file risks are detected, print an explicit warning and provide a fix path.
- Never switch target environment or state source silently.
- If fallback config or cached data must be used, label it clearly as fallback instead of presenting it as live truth.

## 8. Traceable Artifacts

- Every important run should archive traceable outputs such as preflight results, input parameters, recommendations, execution results, errors, and summary reports.
- On failure, preserve intermediate artifacts whenever possible, including checkpoints, temp files, provider output, or relevant logs, so the run can be resumed or reviewed.
- At run end, always print the artifact directory and key file paths.
- User-facing explanations and durable notes such as flowcharts, FAQs, mechanism notes, or retrospectives should preferably go into `Illustration/`.
- Docs inside `Illustration/` should also follow the bilingual policy:
  - Chinese primary (`*.md`)
  - English copy (`*.en.md`)
- Work logs and reflections should live in a dedicated directory instead of accumulating inside `CLAUDE.md` or `AGENTS.md`.

## 9. Frontend Exploration Workflow (For Major Redesign Requests)

- When the user asks to redo a website, explore a clearly different visual direction, or substantially rethink the frontend, do not default to a single version. First produce `3` locally renderable preview variants so the user can compare them before any production replacement.
- These `3` variants must differ in at least `2` of the following:
  - information architecture
  - visual language
  - first-screen narrative
  - priority/order of data modules
- The three variants must not be mere color swaps or spacing tweaks. They should read as three clearly distinct directions at a glance.
- During preview work, reuse the real data layer or existing public APIs whenever possible. Do not create a fake backend just for visuals. If static samples are necessary, label them explicitly.
- Preview variants should live under separate local routes or a dedicated preview entry instead of replacing the production page before the user chooses a direction.
- After generating the three previews, the main session must explain for each one:
  - what the design idea is
  - what scenario it fits best
  - what it improves relative to the original version
- Once the user picks a direction, only then should the chosen variant be promoted to the formal page and followed by detailed polish, responsive cleanup, and accessibility finishing.
- The three-variant workflow may be skipped only when:
  - the task is very small and only involves local styling fixes
  - the user explicitly requests a single version only
  - the existing page is tightly constrained by a strict design system and not suitable for direction exploration

## 10. Deployment and Release Verification

- For public deployments, releases, or environment switches, do not treat a successful CLI response, URL, or green log as completion; perform real acceptance.
- After every public deployment, the main session should at minimum:
  - open the real deployed result or target service
  - capture a screenshot or keep visible evidence
  - compare the live result against the intended local version or the user-provided reference
  - verify the target API, critical data path, or core user flow
- If the homepage, target page, or target view is already a full custom page or full-screen preview, also check whether a legacy layout/shell is still wrapping it and stacking old UI on top of the new one.
- Do not tell the user "it matches local" before that live or real-environment verification has been done.

## 11. Project Addendum Pattern

- Project-specific content should preferably be appended at the end of this file or placed in a separate `project-rules.md`, for example:
  - platform-specific deployment commands
  - business thresholds or risk limits
  - environment variable naming
  - third-party API / SDK constraints
  - money safety, data compliance, or audit requirements
- Project addendum rules should be written as executable constraints whenever possible, not just background description.
- Project addendum rules should include dates so staleness is visible.

## 12. Current Default Baseline

- Documentation: Chinese primary + English copy.
- Terminal UX: visible progress + heartbeat updates + actionable errors.
- Human communication: start with a human review entry point, then explain what changed and what effect it had, and only then add conclusions, impact, and technical detail.
- Collaboration mode: the main session decomposes first; sub-agents handle bounded parallel work; the main session integrates and accepts.
- Risky actions: do preflight / dry-run / preview before real execution; without real verification, the work is not complete.
