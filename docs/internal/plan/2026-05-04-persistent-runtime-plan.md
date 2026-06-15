# Predict Raven Agent-first 持久化运行改造计划

## Goal

- 把持久化运行模块改造成 **Agent-first trading runtime**：Raven Agent 负责完整上下文推理、交易意图和自我修正，core code 负责工具、反馈注入、审计、少量不可绕过硬边界。
- 先设定一个能连续运行 `12h` 的目标，验证“达成-评估-更新”的闭环，而不是直接追求 30 天无人值守。
- 本计划只做方案和任务拆分，不开始实现。

## Review 入口

- `services/orchestrator/src/runtime/`：放 Raven Agent loop、Evaluator、Feedback injection 最合适。
- `services/orchestrator/src/jobs/agent-cycle.ts`：当前 stateful agent cycle 入口，可改造成每轮 agent run 的编排器。
- `services/orchestrator/src/lib/execution-planning.ts`：交易意图进入执行前的风险裁剪位置。
- `scripts/pulse-live.ts`：现有 live preflight、archive、错误摘要可抽成共享能力。
- `scripts/position-monitor.ts`：模型无关的 stop-loss 常驻守护。
- `docs/risk-controls.md`：需要补充“软反馈”和“硬限制”的边界。

## 核心设计

### 1. Raven Agent 是主驾驶

每一轮运行都由 Raven Agent 读取完整 context pack 后输出交易判断：

- 当前持仓、余额、risk caps、系统状态。
- 最近 N 次 run summary、上次 Raven Agent reasoning、失败记录。
- 最新 pulse / market candidates / relevant sources。
- evaluator 上一轮指出的问题和本轮必须重点修正的 checklist。

Raven Agent 输出：

- 人类可读 reasoning。
- 结构化 `trade_intents.json`。
- 当前持仓 review：每个仓位继续持有、减仓、平仓或等待 resolution 的理由。
- 对 evaluator feedback 的逐条回应。
- 是否需要继续调查、降级、暂停或执行。

### 2. Evaluator / Feedback 层不断推动 Raven Agent 修正

Evaluator 不替 Raven Agent 下结论，而是检查 Raven Agent 的输出质量，并把发现注入回当前对话。

Evaluator 第一版分成几类，分别评估 Raven Agent 在推理质量、决策质量和流程完整性上的表现：

| Evaluator 类型 | 检查什么 | 输出 |
| --- | --- | --- |
| 推理质量评估 | thesis、反证、概率差、置信度、信息是否过期、是否遗漏关键情景 | 推理缺口、需要补充的问题 |
| 决策质量评估 | open / hold / reduce / close 是否和 edge、赔率、仓位、历史理由一致 | 需要 Raven Agent 回应或修订的交易判断 |
| 流程完整性评估 | 是否检查了正确信息源、resolution 规则、官方来源、最新盘口、当前持仓和钱包状态 | 缺失步骤、错误来源、需要重新查询的内容 |
| 执行可行性评估 | token 是否可交易、order book 是否支撑 size、最小下单量、滑点、流动性 | 执行风险和 size 修正建议 |
| 后训练数据评估 | context / decision / feedback / revised decision 是否可复盘、可训练 | 缺失 artifact 和结构化字段 |

流程完整性评估要特别检查：

- Raven Agent 是否明确读过当前持仓，而不是只看新市场。
- 对每个已持仓 market，是否找到 resolution 条款、正确 resolution source，并确认拿到的是当前有效信息。
- 信息源是否是原始来源或可信聚合来源，而不是只引用二手结论。
- 市场概率、Raven Agent 概率、流动性和盘口是否来自同一时间窗口。
- 如果信息源缺失或冲突，是否进入查询/补证流程，而不是直接给交易结论。

反馈不用英文等级，统一用 `1-5` 分：

| 分数 | 含义 | 系统动作 |
| --- | --- | --- |
| `1` | 通过 | 记录结果，允许继续 |
| `2` | 轻微提醒 | 注入软提醒，允许继续 |
| `3` | 需要回应 | 注入质疑，要求 Raven Agent 逐条回应 |
| `4` | 需要修订 | 注入反馈，要求 Raven Agent 重新生成 decision |
| `5` | 硬边界或真实状态不明 | 不执行真钱动作，只允许解释、补证、降级或进入 diagnostic mode |

### 3. Core code 是 Agent 操作系统，不是策略主脑

Core code 提供：

- context pack builder
- evaluator runner
- feedback injector
- intent schema validator
- archive writer
- Query Code 环境
- scheduler / heartbeat / lock
- executor queue adapter
- 最小硬风控

Core code 不应该替 Raven Agent 发明策略，不应该把 Raven Agent 降级成日报机器人。

Query Code 环境的定位：

- 给 Raven Agent 和 Evaluator 一个快速、只读、可复现的查询环境。
- 可以查 artifacts、DB 快照、当前持仓、run summary、market metadata、resolution source、order book 和 wallet preflight 结果。
- 可以运行小段只读分析代码来核对“这个结论是否有数据支持”。
- 默认不能写状态、不能下单、不能改 wallet；它只产出 `query-code-result.json`，作为 feedback 和 revised decision 的证据。

### 4. 少量硬边界仍不可绕过

这些情况不能只靠反馈提醒：

- 钱包地址或 env 不匹配。
- 系统 `paused` / `halted`。
- 重入 lock 已被占用。
- token 不在允许交易集合或无法验证。
- 单笔、总敞口、事件敞口、最大仓位数超过硬上限。
- 关键状态缺失到无法确认真实风险。

补充说明：

- 系统 `paused` 是临时暂停状态，表示本轮不允许新的真钱开仓；常见触发包括人工暂停、连续两轮失败、wallet/env 不匹配、关键状态互相冲突、heartbeat 过期、Evaluator 连续给出 `5` 分硬风险。`paused` 可以在诊断后人工恢复。
- 系统 `halted` 是更强的风控停机状态，通常来自组合回撤、硬风控触发或不可忽略的资金安全问题；`halted` 下禁止新的 open，只能做诊断、取消挂单、必要的减仓/平仓流程。
- 重入 lock 用来防止两个 Raven Agent run、两个 scheduler 或人工命令同时触发同一钱包的交易。每轮开始时写入 runId、wallet、startedAt、heartbeat 和过期时间；lock 未过期时第二个 run 必须跳过，不能并发下单。
- “关键状态缺失”不是简单的 API 报错，而是无法判断真实风险：例如 DB 持仓、Polymarket 远端持仓、钱包余额、最新 archive、order book 或 resolution source 之间出现冲突。系统要把状态标记为 `verified / stale / conflict / missing`，只要处于 `conflict` 或关键字段 `missing`，真钱动作进入 diagnostic，不继续执行。

除这些硬边界外，优先用 evaluator feedback 让 Raven Agent 自己修正。

## 12h 目标

### 目标定义

在一个 main-derived worktree 或 VPS 环境中，运行 `12h` 的 Agent-first 持久化循环：

- 每 `90` 到 `120` 分钟唤醒一次 Raven Agent，预计 `6` 到 `8` 轮。
- 每轮完整执行：
  1. build context pack
  2. 当前持仓 review：逐仓检查原始 thesis、当前 edge、resolution 进展、盘口、PnL 和风险占用
  3. Raven Agent initial analysis
  4. evaluator 检查
  5. feedback 注入
  6. Raven Agent revised decision
  7. execution gate
  8. live execution dispatch
  9. archive + metrics
  10. update next-run checklist
- 默认第一阶段就是 live-first 完整循环：使用真实钱包 preflight、真实持仓、真实 market data、真实 order book、完整 execution gate，并生成可 dispatch 到 executor 的真实执行计划。
- 代码测试阶段使用 mock executor / fixture wallet 防止误下单；产品逻辑不把 `recommend-only` 作为目标状态。
- 交易循环必须是完整闭环，不以“取消订单”或“临时真钱开关”作为核心目标；每轮都要覆盖持仓 review、新机会筛选、无 edge/高估资产处置、反馈修订、执行门、真实执行计划、复盘更新。
- 如果用户提供新的钱包地址或 env 文件，本轮 12h runner 必须在 preflight 中打印并归档实际使用的钱包地址、collateral、chain、env path；地址不匹配时进入 paused / diagnostic，不继续真钱执行。

### 12h 成功条件

- 至少完成 `6` 轮循环。
- 每轮都有完整 artifact：
  - `context-pack.json`
  - `position-review.json`
  - `source-resolution-audit.json`
  - `initial-decision.json`
  - `evaluator-report.json`
  - `feedback-injection.md`
  - `revised-decision.json`
  - `execution-gate.json`
  - `execution-dispatch-plan.json`
  - `run-summary.md`
  - `transcript-summary.md`
- evaluator 至少能触发并记录一次 `3` 分或 `4` 分反馈。
- Raven Agent 必须对反馈作出明确回应，不能只原样复述。
- 每个已有持仓都必须被 review，并给出 hold / reduce / close / wait-resolution 的理由。
- 对没有 edge、edge 反转、市场被高估、原 thesis 失效或 resolution 风险变化的持仓，Raven Agent 必须评估 reduce / close。
- 重入 lock、heartbeat、latest state 都正常刷新。
- 连续失败不能超过 `2` 轮；达到阈值后进入 paused / diagnostic mode。
- 12h 结束时输出 `12h-review.md`：哪些反馈改善了决策，哪些 evaluator 规则误伤，下一轮要更新什么。

### 12h 不追求的目标

- 不要求 12h 内真实盈利。
- 不要求 12h 内直接开启无限制 live。
- 不要求 evaluator 一次设计完美。
- 不要求 core code 自动替 Raven Agent 做策略 fallback。

## 达成-评估-更新流程

### 达成

每轮要达成一个可检查结果：

- Raven Agent 完成一次完整交易判断。
- Raven Agent 完成一次当前持仓 review，尤其检查无 edge 或被市场高估的仓位是否应卖出。
- Evaluator 完成一次质量检查。
- Feedback 被注入并产生 revised decision。
- Execution gate 输出执行、跳过、降级或阻断结论。
- 测试阶段可以 mock executor，但运行链路必须生成真实执行计划，而不是只写建议。
- 所有过程落盘，成为后训练轨迹。

### 评估

每轮结束时评估：

- `analysis_completeness_score`：分析是否覆盖必要维度。
- `feedback_response_score`：Raven Agent 是否真正吸收反馈。
- `decision_stability`：修改前后结论是否合理变化。
- `risk_alignment`：是否贴合当前仓位和硬风控。
- `position_review_quality`：是否逐仓检查 edge、resolution、盘口、PnL 和卖出理由。
- `process_completeness_score`：是否完成 source / resolution / order book / wallet / current position 检查。
- `artifact_quality`：后续能否复盘和训练。
- `operator_intervention_needed`：是否需要人工接管。

### 更新

每轮把评估结果写入下一轮 checklist：

- evaluator 新增或调整规则。
- Raven Agent prompt 增加本轮暴露的问题。
- context pack 增加缺失数据。
- Query Code 环境增加本轮需要的快捷查询。
- 如果某类反馈连续误伤，降低分数。
- 如果某类风险被 Raven Agent 忽略，提高分数。
- 如果连续两轮失败，进入 diagnostic mode，不继续真钱执行。

## 实现阶段

### Phase 0：设计数据契约

新增或整理这些 schema：

- `AgentContextPack`
- `PositionReview`
- `SourceResolutionAudit`
- `AgentInitialDecision`
- `EvaluatorReport`
- `FeedbackInjection`
- `AgentRevisedDecision`
- `ExecutionGateResult`
- `QueryCodeResult`
- `ExecutionDispatchPlan`
- `LoopMetrics`

成功标准：

- 每个 artifact 都有明确 JSON schema。
- 任何一轮都能从 artifact 独立复盘。

### Phase 1：做 12h runner

新增 `agent-persistent-runner`：

- 接受 `--duration-hours 12`
- 接受 `--interval-minutes 90`
- 默认 live-first：完整 preflight、持仓 review、execution gate、真实执行计划
- 支持 `--env-file <path>` 或 wallet profile，方便接入用户新钱包地址
- 支持 `--mock-executor` 仅用于代码测试；正式运行不走 recommend-only
- 每轮刷新 heartbeat
- 使用 lock 防重入
- 失败写 `run-error/<timestamp>-agent-persistent/`

成功标准：

- 本地能跑短版 `--duration-minutes 20 --interval-minutes 5` smoke。
- smoke 至少完成 2 轮 artifact 写入。

### Phase 2：接入 Evaluator / Feedback

实现 evaluator：

- 第一版包含推理质量、决策质量、流程完整性、执行可行性、后训练数据五类 evaluator。
- 先用 deterministic checklist + 可选小模型 critic。
- 输出 findings 和 `1-5` 分。
- 对 `3` 分以上生成 feedback prompt；`4` 分要求重新生成 decision；`5` 分进入硬边界或 diagnostic。

实现 feedback injector：

- 把 evaluator findings 注入同一轮 Raven Agent 修正阶段。
- 要求 Raven Agent 对每条 finding 给出 response。

成功标准：

- 人工构造一个分析不完整的 decision，evaluator 能触发 revise。
- Raven Agent revised decision 能引用并处理 evaluator finding。

### Phase 3：执行门与 hard boundary

实现 execution gate：

- schema validation
- system status：区分 running / paused / halted，并写明为什么 pause
- wallet / env / collateral
- stale pulse
- token allowability
- risk caps
- lock / idempotency
- critical state classifier：把关键状态标记为 verified / stale / conflict / missing

成功标准：

- 软问题走 feedback，不直接 block。
- 硬问题必须 block。
- paused / halted / lock / critical state 的原因必须能在 archive 中读懂。
- gate 结果清晰写入 archive。

### Phase 4：12h soak

执行顺序：

1. `20min` 本地 smoke。
2. `2h` live-first runner + mock executor trial，用来验证代码和归档。
3. `12h` live-first runner，使用用户提供的钱包/env 与真实 preflight；executor 是否 mock 由运行参数明确打印。
4. 如果进入真钱执行，必须在每轮 archive 中记录 wallet、collateral、risk caps、execution dispatch plan 和 executor response。

成功标准：

- 12h review 文件清楚列出：
  - 达成了什么
  - evaluator 哪些反馈有效
  - Raven Agent 哪些地方变好了
  - 当前持仓中哪些没有 edge、哪些被高估、哪些应继续 hold
  - 哪些数据缺口阻碍判断
  - 下一轮如何更新 prompt / evaluator / context pack

## User Decisions

- Decision：12h 阶段使用真实 executor 还是 mock executor。
  - Why it matters：用户不需要 recommend-only；但代码测试阶段仍要避免误下单。
  - Recommended default：代码调试先 `--mock-executor`，正式 12h 用真实 executor 并强制打印 execution mode。

- Decision：Evaluator 第一版使用 deterministic checklist 还是小模型 critic。
  - Why it matters：checklist 可控，小模型 critic 更像真实后训练目标。
  - Recommended default：checklist 先行，保留 small model critic adapter。

- Decision：Raven Agent 运行载体。
  - Why it matters：Claude Code / Codex / OpenClaw 的会话持久性、工具权限和成本不同。
  - Recommended default：先做 provider-neutral runner，让 Raven Agent 作为可替换 provider。

- Decision：新钱包地址或 env 文件。
  - Why it matters：12h runner 必须验证实际钱包、collateral 和风险阈值，不能继续假设 `.env.pizza` 永远是活跃账户。
  - Recommended default：支持 `--env-file` / wallet profile；preflight 打印并归档实际地址，地址不符直接 pause。

## Risks and Assumptions

- 风险：feedback 太多会让 Raven Agent 过度保守。
  - 处理：记录 feedback 命中率和误伤率，每轮更新评分。

- 风险：feedback 太软会被 Raven Agent 忽略。
  - 处理：`3` 分以上要求逐条回应，`4` 分必须重新输出 JSON。

- 风险：Agent-first 容易产生不可复现决策。
  - 处理：强制 context pack、decision、feedback、revised decision、gate 全量归档。

- 风险：长期目标需要 post-training 数据，不能只存自然语言总结。
  - 处理：所有关键节点同时存 machine-readable JSON 和 transcript summary。

- 假设：第一版 12h 目标为 live-first；本地代码测试可以 mock executor，但不是产品默认模式。
- 假设：core code 可以改造成 Agent 操作系统，而不是固定策略引擎。
- 假设：用户希望 Raven Agent 能触达下单，但接受少量不可绕过硬边界。

## Execution Gate

- 等用户 review 本计划。
- 下一步若确认执行，先做 Phase 0 + 20min mock-executor smoke，再进入 2h / 12h live-first runner。

## 当前实现进度（2026-05-04）

- 已新增 `services/orchestrator/src/runtime/raven-agent-loop.ts`：
  - `AgentContextPack`
  - `PositionReviewArtifact`
  - `SourceResolutionAudit`
  - `EvaluatorReport`
  - `FeedbackInjection`
  - `ExecutionGateResult`
  - `ExecutionDispatchPlan`
  - `LoopMetrics`
- 已新增 `scripts/agent-persistent-runner.ts` 和 `pnpm agent:persistent`：
  - 支持 `--duration-minutes`
  - 支持 `--interval-minutes`
  - 支持 `--max-iterations`
  - 支持 `--archive-root`
  - 支持 `--env-file`
  - 支持 `--mock-executor` 用于代码测试
  - 默认写入并释放 `runner.lock`，防止重入
- 当前 runner 是 live-first artifact loop：生成真实执行计划 `execution-dispatch-plan.json`，不再以 recommend-only 为目标。
- 当前真实 executor dispatch 尚未 wired；不带 `--mock-executor` 会 fail-fast，避免半成品误下单。
- 已新增 `services/orchestrator/src/runtime/raven-agent-loop.test.ts`，覆盖 evaluator、execution gate、artifact 写入。
- 已验证：
  - `pnpm exec vitest run --config config/vitest.config.ts services/orchestrator/src/runtime/raven-agent-loop.test.ts`
  - `pnpm agent:persistent -- --duration-minutes 0 --max-iterations 1 --interval-minutes 0 --mock-executor --archive-root runtime-artifacts/raven-agent-smoke`
  - `pnpm agent:persistent` 不带 `--mock-executor` 会拒绝执行真钱 dispatch
  - 预置 `runner.lock` 时，runner 会拒绝启动，验证重入保护有效
- 已修复顺手发现的既有 typecheck 阻塞：
  - `paper-trading.test.ts` 的 `PlannedExecution` fixture 补齐 `orderType` / `gtcLimitPrice` / `categorySlug` / `negRisk`
  - `full-pulse.ts` 改用现有 `TextMetrics.approxTokens`
- 当前验证结果：
  - `pnpm typecheck` 通过
  - `pnpm test` 通过（39 files / 320 tests）
  - 因 `vendor/repos` 是 ignored 运行依赖，本 worktree 需要从主工作区补齐 `vendor/repos/all-polymarket-skill` 后全量 provider runtime 测试才会通过
