# 项目协作约定（按当前用户偏好）

英文版见 [AGENTS.en.md](AGENTS.en.md)。

最后更新：2026-03-17

## 1. 语言与文档

- 代码注释统一使用英文。
- 面向人阅读的 Markdown 默认中文，并维护英文副本（`*.en.md`）。
- 中文文件保留主文件名，英文文件使用 `*.en.md`。
- 新增或修改人类可读文档时，中文与英文必须同步更新。

## 2. 终端交互偏好

- 所有关键流程必须在可见终端输出阶段信息，不允许“静默长时间运行”。
- 长任务必须持续输出进度心跳，建议包含：
  - 当前阶段
  - 已耗时
  - 预计超时/剩余信息（若可得）
- 终端输出优先彩色、分级（`INFO/WARN/ERR/OK`）。
- 错误输出必须可执行，至少包含：
  - 失败阶段（stage）
  - 核心上下文（`runId/market/token/requested usd/env/artifact dir`）
  - 原因摘要
  - 下一步命令

## 3. 交易与执行偏好

- 本仓库支持三条主链路：
  - `paper`（本地模拟，支持手动确认）
  - `live:test:stateless`（无 DB/Redis 依赖，优先用于快速闭环）
  - `live:test`（带 queue worker + DB/Redis 的完整生产路径）
- `Preflight` 是必经阶段，不是独立模式。
- 在 live 路径中：
  - 默认 fail-fast
  - 关键失败后应标记 halted（若该路径设计为可 halt）
  - `collateral=0 且 remote positions=0` 必须拦截（除非明确 recommend-only）
- 决策策略支持：
  - `provider-runtime`
  - `pulse-direct`（House Direct）
- 任何一次执行都要在输出中明确当前使用的 `execution mode` 与 `decision strategy`。

## 4. 状态一致性偏好

- 本地测试应坚持单一状态源，不允许隐式切换多个 state 文件。
- paper 路径统一使用 `AUTOPOLY_LOCAL_STATE_FILE`（或约定默认路径）并在输出中打印。
- 若检测到状态文件不一致或多地址混用风险，必须明确告警并给出修复建议。

## 5. 可追溯归档

- 所有关键运行必须产出可追溯归档（preflight/recommendation/execution/error）。
- 失败时必须保留中间产物（checkpoint、temp、provider output 等）供断点续跑。
- 运行结束后必须输出归档目录与关键文件路径。

## 6. Illustration 归档目录（Human-AI Certified）

- 统一归档目录：`Illustration/`。
- 需要向用户解释或沉淀的内容（流程图、FAQ、关键机制说明）放入该目录。
- `Illustration/` 文档同样执行双语规则：
  - 中文主文件（`*.md`）
  - 英文副本（`*.en.md`）

## 7. 当前默认执行基线

- 文档语言：中文主文件 + 英文副本。
- 终端风格：可见进度 + 彩色分级 + 可执行错误信息。
- 交易调试优先：`live:test:stateless`，再扩展到 `live:test`。
