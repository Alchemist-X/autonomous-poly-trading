# Rough Loop
英文版见 [rough-loop.en.md](rough-loop.en.md)。

## Rules（规则）
- 所有任务都必须写明完成定义、验证命令和允许改动路径。
- 默认只处理代码任务，不处理真实交易、生产部署和私钥操作。
- 每次文档更新都要同步维护英文副本。
- 每次任务完成后，Rough Loop 都应立即提交本轮任务触碰到的文件。

## Queue（待执行）
### RL-003 | 确保 live:test:stateless 明确输出 execution mode 与 decision strategy / Ensure live:test:stateless prints execution mode and decision strategy

#### Title（标题）
确保 live:test:stateless 明确输出 execution mode 与 decision strategy / Ensure live:test:stateless prints execution mode and decision strategy

#### Status（状态）
todo

#### Priority（优先级）
P1

#### Depends On（依赖任务）
- RL-001

#### Allowed Paths（允许改动路径）
- scripts/live-test-stateless.ts
- scripts/live-test-stateless.test.ts
- services/orchestrator/src/ops/trial-recommend.ts
- README.md
- README.en.md

#### Definition of Done（完成定义）
- `live:test:stateless` 的人类可读输出始终明确展示当前 `execution mode` 与 `decision strategy` / Ensure the human-readable `live:test:stateless` output always shows the current `execution mode` and `decision strategy`
- 用测试覆盖这个输出契约，防止未来回退 / Cover this output contract with tests to prevent regressions
- 只有在命令行行为真的变化时才更新 `README.md` 和 `README.en.md` / Update `README.md` and `README.en.md` only if the CLI behavior really changes

#### Verification（验证命令）
- pnpm vitest run scripts/live-test-stateless.test.ts

#### Context（上下文）
- 仓库规则要求任何一次执行都必须明确当前使用的 `execution mode` 与 `decision strategy` / Repository rules require every execution path to state the current `execution mode` and `decision strategy`

#### Latest Result（最近结果）
- 尚未开始 / Not started

#### Attempts（尝试次数）
0

## Running（进行中）
暂无任务。

## Blocked（阻塞）
暂无任务。

## Done（已完成）
### RL-002 | 补齐 provider-runtime 结构化输出回归覆盖 / Add provider-runtime structured-output regression coverage

#### Title（标题）
补齐 provider-runtime 结构化输出回归覆盖 / Add provider-runtime structured-output regression coverage

#### Status（状态）
done

#### Priority（优先级）
P1

#### Depends On（依赖任务）
- RL-001

#### Allowed Paths（允许改动路径）
- services/orchestrator/src/runtime/provider-runtime.ts
- services/orchestrator/src/runtime/provider-runtime.test.ts
- README.md
- README.en.md

#### Definition of Done（完成定义）
- `services/orchestrator/src/runtime/provider-runtime.test.ts` 至少覆盖一个 wrapper-key 输出场景和一个无效输出场景 / Cover at least one wrapper-key output case and one invalid-output case in `services/orchestrator/src/runtime/provider-runtime.test.ts`
- 如果现有实现存在缺口，则修复 `services/orchestrator/src/runtime/provider-runtime.ts`，并保持错误信息可执行 / Fix `services/orchestrator/src/runtime/provider-runtime.ts` if the current implementation has gaps, keeping error messages actionable
- 只有在实现契约确实变化时才更新 `README.md` 和 `README.en.md` / Update `README.md` and `README.en.md` only if the implementation contract actually changes

#### Verification（验证命令）
- pnpm vitest run services/orchestrator/src/runtime/provider-runtime.test.ts

#### Context（上下文）
- `progress.md` 仍然说明 `codex` 的完整生产决策闭环还需要更多验证 / `progress.md` still says the full `codex` production decision loop needs more validation

#### Latest Result（最近结果）
- All verification commands passed.

#### Attempts（尝试次数）
1

### RL-001 | 补充 Rough Loop bootstrap smoke 说明 / Add Rough Loop bootstrap smoke guidance

#### Title（标题）
补充 Rough Loop bootstrap smoke 说明 / Add Rough Loop bootstrap smoke guidance

#### Status（状态）
done

#### Priority（优先级）
P0

#### Depends On（依赖任务）
none

#### Allowed Paths（允许改动路径）
- rough-loop-guide.md
- rough-loop-guide.en.md

#### Definition of Done（完成定义）
- 在 `rough-loop-guide.md` 增加最小闭环启动步骤，覆盖旧 daemon 或 `.rough-loop.lock` 检查、`ROUGH_LOOP_AUTO_PUSH=1` 启动方式，以及首张 smoke 任务建议 / Add the minimal closed-loop bootstrap steps to `rough-loop-guide.md`, covering old daemon or `.rough-loop.lock` checks, the `ROUGH_LOOP_AUTO_PUSH=1` startup flow, and the recommended first smoke task
- 在 `rough-loop-guide.en.md` 同步更新相同信息 / Sync the same information in `rough-loop-guide.en.md`

#### Verification（验证命令）
- rg -n "ROUGH_LOOP_AUTO_PUSH|\.rough-loop\.lock|smoke" rough-loop-guide.md rough-loop-guide.en.md

#### Context（上下文）
- `260316-handoff.md` 已明确建议先用最小任务卡验证 daemon 自动拾取、归档和单任务提交闭环 / `260316-handoff.md` already recommends validating daemon pickup, artifact generation, and single-task commits with a minimal task card

#### Latest Result（最近结果）
- 已采纳第 1 次尝试生成的指南更新，并手动清理 provider 留下的 blocked 占位结果 / Accepted the guide updates from attempt 1 and manually cleared the provider's blocked placeholder result

#### Attempts（尝试次数）
1
