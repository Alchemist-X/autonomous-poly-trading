# Rough Loop
Chinese version: [rough-loop.md](rough-loop.md).

## Rules
- 所有任务都必须写明完成定义、验证命令和允许改动路径。
- 默认只处理代码任务，不处理真实交易、生产部署和私钥操作。
- 每次文档更新都要同步维护英文副本。
- 每次任务完成后，Rough Loop 都应立即提交本轮任务触碰到的文件。

## Queue
### RL-004 | 补齐 Hostinger 443 SSH 清单并写明阿里云独立账户要求 / Add the Hostinger 443 SSH checklist and record the Aliyun dedicated-user requirement

#### Title
补齐 Hostinger 443 SSH 清单并写明阿里云独立账户要求 / Add the Hostinger 443 SSH checklist and record the Aliyun dedicated-user requirement

#### Status
todo

#### Priority
P1

#### Depends On
- none

#### Allowed Paths
- Illustration/hostinger-root-access.md
- Illustration/hostinger-root-access.en.md
- Illustration/ssh-connectivity-postmortem-2026-03-23.md
- Illustration/ssh-connectivity-postmortem-2026-03-23.en.md

#### Definition of Done
- Add a shortest executable Hostinger `SSH over 443` checklist to `Illustration/hostinger-root-access.md` and `Illustration/hostinger-root-access.en.md`
- Make the postmortem state explicitly that Hostinger over `443` is technically feasible but must be validated separately rather than treated as already proven
- Record explicitly in the relevant docs that Aliyun `admin` is bootstrap-only and long-term deployment plus daily ops must move to a dedicated `AutoPulse` user

#### Verification
- rg -n "Port 443|SSH over 443|AutoPulse|bootstrap-only|独立账户" Illustration/hostinger-root-access.md Illustration/hostinger-root-access.en.md Illustration/ssh-connectivity-postmortem-2026-03-23.md Illustration/ssh-connectivity-postmortem-2026-03-23.en.md

#### Context
- This round of debugging already proved that `22` is unstable under the current local network / VPN path while Aliyun `443` is usable
- The user explicitly asked to record “if needed, the next step is to add the shortest Hostinger SSH-to-443 checklist” into Rough Loop
- The user also explicitly required that Aliyun must not keep using `admin` long-term and needs a separate account

#### Latest Result
- Task recorded, not started yet.

#### Attempts
0

## Running
No tasks.

## Blocked
No tasks.

## Done
### RL-003 | 确保 forecast:live 明确输出 execution mode 与 decision strategy / Ensure forecast:live prints execution mode and decision strategy

#### Title
确保 forecast:live 明确输出 execution mode 与 decision strategy / Ensure forecast:live prints execution mode and decision strategy

#### Status
done

#### Priority
P1

#### Depends On
- RL-001

#### Allowed Paths
- scripts/pulse-live.ts
- scripts/pulse-live.test.ts
- services/orchestrator/src/ops/trial-recommend.ts
- README.md
- README.en.md

#### Definition of Done
- `forecast:live` 的人类可读输出始终明确展示当前 `execution mode` 与 `decision strategy` / Ensure the human-readable `forecast:live` output always shows the current `execution mode` and `decision strategy`
- 用测试覆盖这个输出契约，防止未来回退 / Cover this output contract with tests to prevent regressions
- 只有在命令行行为真的变化时才更新 `README.md` 和 `README.en.md` / Update `README.md` and `README.en.md` only if the CLI behavior really changes

#### Verification
- pnpm vitest run scripts/pulse-live.test.ts
- pnpm exec tsx -e "import('./scripts/pulse-live.ts').then(() => console.log('import-ok'))"

#### Context
- 仓库规则要求任何一次执行都必须明确当前使用的 `execution mode` 与 `decision strategy` / Repository rules require every execution path to state the current `execution mode` and `decision strategy`

#### Latest Result
- Added `Execution Mode` / `Decision Strategy` to preflight, recommendation, execution, and error output, mirrored the same fields into `--json`, and passed the targeted test plus module-import smoke check.

#### Attempts
1

### RL-002 | 补齐 provider-runtime 结构化输出回归覆盖 / Add provider-runtime structured-output regression coverage

#### Title
补齐 provider-runtime 结构化输出回归覆盖 / Add provider-runtime structured-output regression coverage

#### Status
done

#### Priority
P1

#### Depends On
- RL-001

#### Allowed Paths
- services/orchestrator/src/runtime/provider-runtime.ts
- services/orchestrator/src/runtime/provider-runtime.test.ts
- README.md
- README.en.md

#### Definition of Done
- `services/orchestrator/src/runtime/provider-runtime.test.ts` 至少覆盖一个 wrapper-key 输出场景和一个无效输出场景 / Cover at least one wrapper-key output case and one invalid-output case in `services/orchestrator/src/runtime/provider-runtime.test.ts`
- 如果现有实现存在缺口，则修复 `services/orchestrator/src/runtime/provider-runtime.ts`，并保持错误信息可执行 / Fix `services/orchestrator/src/runtime/provider-runtime.ts` if the current implementation has gaps, keeping error messages actionable
- 只有在实现契约确实变化时才更新 `README.md` 和 `README.en.md` / Update `README.md` and `README.en.md` only if the implementation contract actually changes

#### Verification
- pnpm vitest run services/orchestrator/src/runtime/provider-runtime.test.ts

#### Context
- `progress.md` 仍然说明 `codex` 的完整生产决策闭环还需要更多验证 / `progress.md` still says the full `codex` production decision loop needs more validation

#### Latest Result
- All verification commands passed.

#### Attempts
1

### RL-001 | 补充 Rough Loop bootstrap smoke 说明 / Add Rough Loop bootstrap smoke guidance

#### Title
补充 Rough Loop bootstrap smoke 说明 / Add Rough Loop bootstrap smoke guidance

#### Status
done

#### Priority
P0

#### Depends On
none

#### Allowed Paths
- rough-loop-guide.md
- rough-loop-guide.en.md

#### Definition of Done
- 在 `rough-loop-guide.md` 增加最小闭环启动步骤，覆盖旧 daemon 或 `.rough-loop.lock` 检查、`ROUGH_LOOP_AUTO_PUSH=1` 启动方式，以及首张 smoke 任务建议 / Add the minimal closed-loop bootstrap steps to `rough-loop-guide.md`, covering old daemon or `.rough-loop.lock` checks, the `ROUGH_LOOP_AUTO_PUSH=1` startup flow, and the recommended first smoke task
- 在 `rough-loop-guide.en.md` 同步更新相同信息 / Sync the same information in `rough-loop-guide.en.md`

#### Verification
- rg -n "ROUGH_LOOP_AUTO_PUSH|\.rough-loop\.lock|smoke" rough-loop-guide.md rough-loop-guide.en.md

#### Context
- `Wasted/legacy-docs/260316-handoff.md` 已明确建议先用最小任务卡验证 daemon 自动拾取、归档和单任务提交闭环 / `Wasted/legacy-docs/260316-handoff.md` already recommends validating daemon pickup, artifact generation, and single-task commits with a minimal task card

#### Latest Result
- 已采纳第 1 次尝试生成的指南更新，并手动清理 provider 留下的 blocked 占位结果 / Accepted the guide updates from attempt 1 and manually cleared the provider's blocked placeholder result

#### Attempts
1
