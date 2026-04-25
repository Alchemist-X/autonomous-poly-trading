# Pulse Timeout 校正计划

## 1. 问题

当前 `pulse-direct` 路径存在一个内部硬超时：

- `[services/orchestrator/src/pulse/full-pulse.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/pulse/full-pulse.ts)` 中的 `DEFAULT_PULSE_DIRECT_RENDER_TIMEOUT_SECONDS = 180`

它的实际影响是：

- 当 `PULSE_REPORT_TIMEOUT_SECONDS` 未配置或小于等于 `0` 时，`pulse-direct` 仍然不会无限等待
- Codex 渲染一旦超过 `180` 秒，就会直接进入 deterministic fallback
- fallback 会保守地产生一个 provisional 开仓候选，或者直接 `skip`
- 这会让链路“看起来没坏”，但把真实的渲染耗时问题遮住

## 2. 目标

这一轮要回答三件事：

1. 这条链路上到底有哪些硬超时限制
2. 在“完全不限制超时”的前提下，真实 5 路并发运行各自耗时多少
3. 基于实验结果，新的宽松限制应该设成多少

## 3. 本轮范围

只看这条真实链路：

- `pnpm daily:pulse`
- `pnpm pulse:live`
- `ensureDailyPulseSnapshot`
- `generatePulseSnapshot`
- `market-pulse.ts`
- `full-pulse.ts`
- `pulse-direct-runtime`

本轮不把以下内容作为主目标：

- `rough-loop`
- `resolution` job
- `legacy provider-runtime` 的非 pulse-direct 主链路

如果它们有 timeout，会记录，但不纳入这次 5 路实验主样本。

## 4. 已知硬 timeout 清单

本轮执行前先核实并补齐以下几类：

1. Pulse 抓取超时
  - `PULSE_FETCH_TIMEOUT_SECONDS`
  - `fetch_markets.py` 子进程 kill
2. Pulse 渲染超时
  - `PULSE_REPORT_TIMEOUT_SECONDS`
  - `pulse-direct` 未配置时的内部 `180s fallback`
3. Pulse 研究子命令超时
  - `scrape-market.ts`
  - `orderbook.ts`
  - `api-trade-polymarket` 首次 `npm install`
4. 决策运行时超时
  - `PROVIDER_TIMEOUT_SECONDS`
  - 需要区分它在 `pulse-direct` 下是否真正生效

## 5. 实验原则

- 必须使用 worktree
- 必须使用 sub-agent 并行推进
- 5 组实验必须同时启动
- 这一轮实验中不允许任何 timeout 限制生效
- 默认生产行为不能因为实验而被永久改坏
- 每组实验必须保留独立产物和耗时记录

## 6. 实验方案

### 6.1 准备

1. 新建专用实验 worktree
2. 在实验 worktree 中加入“timeout 可显式禁用”的实现
3. 保持默认行为不变：
  - 默认仍然保留现有生产 timeout
  - 只有显式传入实验开关或 `0` 时，才禁用 timeout

### 6.2 并行执行

同时启动 5 组真实运行，建议统一：

- `ENV_FILE=.env.pizza`
- `AUTOPOLY_EXECUTION_MODE=live`
- `AGENT_DECISION_STRATEGY=pulse-direct`
- `--recommend-only`

同时确保以下 timeout 全部禁用：

- Pulse fetch
- Pulse render
- Pulse research subcommands
- provider runtime timeout

每组实验单独记录：

- run id
- 启动时间
- Pulse fetch 完成时间
- Pulse render 完成时间
- 总耗时
- 是否触发 fallback
- 关键产物目录

### 6.3 结果归纳

对 5 组实验至少计算：

- 最短耗时
- 最长耗时
- 中位数
- 平均值
- P80
- 是否存在明显长尾

## 7. 新限制的制定规则

实验结束后按以下原则回推新限制：

1. 默认值不能取平均值
  - 平均值太容易被偶发快样本拉低
2. 默认值至少覆盖本轮最长稳定样本，并留安全余量
3. 渲染 timeout 和抓取 timeout 要分开设置
4. 允许通过 env 单独覆盖
5. 保留 heartbeat，让长任务可见，而不是靠短 timeout 掩盖

建议的决策方法：

- fetch timeout：取本轮 fetch 最大值的 `2x`，但设一个合理上限
- render timeout：优先参考本轮 render P80 或最大值，再额外留 `30%` 到 `50%` 余量
- 如果 5 组里全部远高于 `180s`，说明当前 `180s` 已经明显偏紧，应直接上调

## 8. 交付物

本轮结束后需要产出：

1. timeout 清单
2. 5 路并发实验结果表
3. 新的 timeout 建议值
4. 对应代码修改
5. 验证结果

## 9. 风险

- 5 路同时跑可能放大外部 provider 抖动
- “无 timeout” 模式如果没加显式开关，容易误伤默认生产行为
- 当前仓库有未提交改动，必须避免覆盖用户已有修改

## 10. 执行顺序

1. 盘点硬 timeout
2. 建计划文档
3. 建实验 worktree
4. 在实验 worktree 中加入“禁用 timeout”能力
5. 并发跑 5 组
6. 汇总耗时
7. 回到主工作区落正式配置和代码
8. 验证

