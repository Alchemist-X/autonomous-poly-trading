---
name: daily-pulse
description: "在 autonomous-poly-trading 仓库中运行 daily pulse 主流程。用于用户要求执行 daily pulse、生成当日组合 review / monitor / rebalance 报告，或明确说“运行 daily pulse”时。默认主链路是 live real-money，并优先使用 .env.pizza 作为测试钱包环境；只有用户明确要求预览或只看建议时，才降级到 --recommend-only。"
---

# Daily Pulse

在这个仓库里，`daily pulse` 的推荐入口统一走：

`pnpm daily:forecast`

## 什么时候使用

- 用户要求“运行 daily pulse”
- 用户要求跑一轮组合 review / monitor / rebalance
- 用户要求生成最新的 daily pulse recommendation
- 用户要求用现有 pulse artifact 快速重跑 daily pulse

## 默认行为

- 默认命令：
  - `pnpm daily:forecast`
- 默认是主执行模式：
  - 内部会走 `forecast:live`
  - 默认不加 `--recommend-only`
  - 默认把 `ENV_FILE` 设为 `.env.pizza`
  - 默认把 `AGENT_DECISION_STRATEGY` 设为 `pulse-direct`
  - 默认把 `AUTOPOLY_EXECUTION_MODE` 设为 `live`
  - 默认按 real-money 主链路执行

只有当用户明确要求预览、只看建议、或避免真实下单时，才使用：

- `pnpm daily:forecast -- --recommend-only`

## 常用变体

- 输出 JSON：
  - `pnpm daily:forecast -- --json`
- 复用已有 pulse artifact，跳过重新生成 pulse：
  - `pnpm daily:forecast -- --pulse-json <path> --pulse-markdown <path>`
- 显式降级为只看建议：
  - `pnpm daily:forecast -- --recommend-only --json`
- 明确切回 legacy provider 复审：
  - `AGENT_DECISION_STRATEGY=provider-runtime pnpm daily:forecast`

## 运行前检查

- 如果没有明确指定 env，默认就是 `.env.pizza`
- 主要执行语义按真钱主链路理解
- 只有当用户明确要求预览、review-only、或避免下单时，才加：
  - `pnpm daily:forecast -- --recommend-only --json`

## 结果应汇报什么

运行后至少向用户汇报：

- 使用了哪个 env
- 是否是 `recommend-only` 还是 `execute`
- `runId`
- archive directory
- recommendation / execution / review-report 的路径
- 本轮关键结论：
  - 新开仓
  - 建议减仓/平仓
  - 被 guardrails 拦截的项

## 关键产物位置

- `runtime-artifacts/pulse-live/<timestamp>-<runId>/`
- `runtime-artifacts/reports/pulse/...`
- `runtime-artifacts/reports/review/...`
- `runtime-artifacts/reports/monitor/...`
- `runtime-artifacts/reports/rebalance/...`
