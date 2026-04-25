# Agent 3 验证记录（2026-03-23）

英文版见 [agent3-validation-log-2026-03-23.en.md](agent3-validation-log-2026-03-23.en.md)。

## 范围

本轮只做验证、真钱链路安全测试和卡点定位，不改主产品逻辑。

遵守原则：

- 先 `paper`
- 再 `recommend-only`
- 再真钱 `pulse:live`
- 不绕过 preflight
- 不放宽 bankroll / risk caps

## 1. Targeted tests

已执行：

```bash
pnpm vitest run \
  scripts/pulse-live.test.ts \
  scripts/daily-pulse.test.ts \
  services/orchestrator/src/runtime/decision-composer.test.ts \
  services/orchestrator/src/runtime/pulse-entry-planner.test.ts \
  services/orchestrator/src/lib/portfolio-report-artifacts.test.ts \
  services/executor/src/workers/queue-worker.test.ts
```

结果：

- `6/6` test files 通过
- `18/18` tests 通过

结论：

- 当前脏工作树对应的核心改动面至少在单测层面没有立刻炸掉。

## 2. Paper reset

已执行：

```bash
AUTOPOLY_EXECUTION_MODE=paper \
AUTOPOLY_LOCAL_STATE_FILE=$PWD/runtime-artifacts/local/agent3-paper-state.json \
pnpm trial:reset-paper -- --bankroll 20
```

结果：

- 成功
- state file：
  - `runtime-artifacts/local/agent3-paper-state.json`

结论：

- paper state 初始化正常
- 单一状态源可以显式指定并打印出来

## 3. Paper recommend 卡点

已执行：

```bash
AUTOPOLY_EXECUTION_MODE=paper \
AUTOPOLY_LOCAL_STATE_FILE=$PWD/runtime-artifacts/local/agent3-paper-state.json \
pnpm trial:recommend -- --json
```

观察到的卡点：

- 进入 `tsx src/ops/trial-recommend.ts -- --json` 后，长时间没有新的终端心跳
- 实际停留在 `codex exec` 的 pulse render 子流程
- 当时进程：
  - `codex exec ... -o /var/folders/.../full-pulse-report.md -`
- 观测期间：
  - CPU 近似 `0`
  - 临时输出文件尚未生成
  - 终端没有阶段进度补充

处理：

- 人工中断，退出码 `130`

结论：

- 当前 `paper -> trial:recommend` 最大卡点不是直接报错，而是 `pulse render / codex exec` 段缺少心跳且可观测性差
- 这与仓库“关键流程必须可见输出”的偏好不一致

## 4. Pulse Live recommend-only 回放

为了绕开上面的模型卡点，本轮复用已有 pulse 归档：

```bash
ENV_FILE=.env.pizza \
AUTOPOLY_EXECUTION_MODE=live \
pnpm pulse:live -- --recommend-only --json \
  --pulse-json runtime-artifacts/reports/pulse/2026/03/20/pulse-20260320T070042Z-codex-full-f983b827-bd7c-4cde-bbf5-6e59691197a4.json \
  --pulse-markdown runtime-artifacts/reports/pulse/2026/03/20/pulse-20260320T070042Z-codex-full-f983b827-bd7c-4cde-bbf5-6e59691197a4.md
```

结果：

- 成功
- `executionMode=live`
- `decisionStrategy=pulse-direct`
- `runId=dd659a03-00ff-428b-afbc-d3f9196ebe3e`
- archive：
  - `runtime-artifacts/pulse-live/2026-03-23T075158Z-dd659a03-00ff-428b-afbc-d3f9196ebe3e`

关键 preflight 事实：

- collateral：`15.9882 USD`
- remote positions：`4`
- bankroll cap：`20`
- configured min trade：`10`
- `MAX_TRADE_PCT=0.2`
- `MAX_EVENT_EXPOSURE_PCT=0.3`

recommendation 事实：

- 总决策数：`6`
- 其中：
  - `close`: `1`
  - `hold`: `3`
  - `open`: `2`
- executable plans：`0`

被拦截原因：

- `will-bitcoin-dip-to-65k-in-march-2026`
  - `below Polymarket minimum order size (5 shares)`
- `will-crude-oil-cl-hit-high-100-by-end-of-march-658-396-769-971`
  - `guardrails removed the open decision`
- `netanyahu-out-by-june-30-383-244-575`
  - `guardrails removed the open decision`

结论：

- 当前 `.env.pizza` 的真钱环境不是“跑不起来”，而是“能出决策，但在执行规划阶段被风控和盘口门槛全部裁空”
- 这是一个真实且有价值的链路状态

## 5. Stateful live:test preflight

已执行：

```bash
ENV_FILE=.env.pizza AUTOPOLY_EXECUTION_MODE=live pnpm live:test -- --json
```

结果：

- 失败
- stage：`unknown`
- message：`DATABASE_URL is not configured.`
- archive：
  - `runtime-artifacts/live-test/2026-03-23T075243Z-pending`
- error artifact：
  - `runtime-artifacts/live-test/2026-03-23T075243Z-pending/error.json`

结论：

- `live:test` 当前不是交易策略卡住，而是基础设施前置条件未满足
- 先补 `DATABASE_URL`，再谈 queue worker / DB stateful 验证

## 6. 真钱 pulse-live 执行分支

已执行：

```bash
ENV_FILE=.env.pizza \
AUTOPOLY_EXECUTION_MODE=live \
pnpm pulse:live -- --json \
  --pulse-json runtime-artifacts/reports/pulse/2026/03/20/pulse-20260320T070042Z-codex-full-f983b827-bd7c-4cde-bbf5-6e59691197a4.json \
  --pulse-markdown runtime-artifacts/reports/pulse/2026/03/20/pulse-20260320T070042Z-codex-full-f983b827-bd7c-4cde-bbf5-6e59691197a4.md
```

结果：

- 成功
- `runId=54f81d9a-842a-459f-a05f-5a7faa9206c3`
- `executedOrders=0`
- archive：
  - `runtime-artifacts/pulse-live/2026-03-23T075303Z-54f81d9a-842a-459f-a05f-5a7faa9206c3`

关键产物：

- `preflight.json`
- `recommendation.json`
- `execution-summary.json`
- `run-summary.md`
- `run-summary.en.md`

run summary 事实：

- 本轮没有可执行计划
- 本轮没有实际下单成交
- 运行前后净值都为 `19.59`
- 持仓数保持 `4`

结论：

- 当前真钱 pulse-live 链路可以安全走完整个执行分支，并在风控约束下实现 “0 order no-op”
- 这是一条可重复、低风险的真钱验证路径

## 7. 当前最重要的卡点

1. `trial:recommend` 的 pulse render / codex exec 段缺乏可见心跳，且出现长时间静默
2. `.env.pizza` 下 bankroll 太小，而 `configuredMinTradeUsd=10`、order-book minimum 共同导致 open/close 都难以转成 executable plan
3. `live:test` 缺 `DATABASE_URL`，目前无法验证 stateful 完整链路
4. `.env.pizza` 下出现 `MAX_TRADE_PCT=0.2`，而 `live:test` 约束文档要求 `<=0.1`
   - 这不会阻止当前 pulse-live recommend-only 成功
   - 但它是一个需要明确口径的风险信号

## 8. 下一步建议

1. 给 `trial:recommend` / pulse render 增加明确阶段心跳和超时摘要
2. 明确 `.env.pizza` 是否故意使用 `MAX_TRADE_PCT=0.2`
3. 如果目标是继续真钱低风险验证，优先复用 pulse snapshot 跑 `pulse:live`
4. 如果目标是完整生产链路验证，先补 `DATABASE_URL` 和相关 stateful 基础设施
