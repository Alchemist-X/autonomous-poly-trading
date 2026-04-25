# 项目架构审计与清理方案 / Project Architecture Audit & Cleanup Plan

> 审计日期：2026-03-29
> English sections follow each Chinese section.

---

## 1. 当前项目结构全景 / Current Project Structure Overview

```
autonomous-poly-trading/                    # pnpm monorepo, Node>=20, pnpm@10.28.1
│
├── .env.aizen                              # 钱包环境 (aizen 实例)
├── .env.example                            # 环境变量模板
├── .env.no1                                # 钱包环境 (no1 实例)
├── .env.pizza                              # 钱包环境 (pizza 实例 - 当前主力)
├── .env.wallets/                           # 多钱包 env 目录 (含 manifest.json + no1.env + pizza.env)
├── agents.env                              # Claude Code agent 配置环境变量
│
├── apps/
│   └── web/                                # [活跃] Next.js 16 公开围观 UI (Vercel 部署)
│       ├── app/                            # App Router 页面
│       ├── components/                     # React 组件
│       └── lib/                            # 前端工具函数
│
├── services/
│   ├── orchestrator/                       # [活跃] 调度器：Pulse + 决策 + 风控 + 报告
│   │   └── src/
│   │       ├── config.ts                   # 全局配置 (187行，含所有环境变量映射)
│   │       ├── index.ts                    # Fastify 服务入口 + cron + BullMQ
│   │       ├── jobs/
│   │       │   ├── agent-cycle.ts          # 主调度循环 (仅 stateful 路径)
│   │       │   ├── backtest.ts             # 回测任务
│   │       │   ├── daily-pulse-core.ts     # 每日 Pulse 核心逻辑
│   │       │   └── resolution.ts           # 到期/结算扫描 (965行)
│   │       ├── lib/
│   │       │   ├── artifacts.ts            # 归档路径构建器
│   │       │   ├── env-file.ts             # .env 文件加载
│   │       │   ├── execution-planning.ts   # 执行计划编排 (含 buildExecutionPlan)
│   │       │   ├── portfolio-report-artifacts.ts  # 报告生成 (1266行!)
│   │       │   ├── risk.ts                 # applyTradeGuards 风控
│   │       │   ├── state.ts                # 内存状态管理
│   │       │   ├── terminal-progress.ts    # TUI 进度
│   │       │   └── text-metrics.ts         # 文本度量
│   │       ├── ops/
│   │       │   ├── paper-trading.ts        # 模拟交易 (仅 paper 路径)
│   │       │   ├── trial-approve.ts        # 人工审批
│   │       │   ├── trial-recommend.ts      # 推荐生成
│   │       │   ├── trial-recommend-checkpoint.ts
│   │       │   ├── trial-reset-paper.ts    # 重置模拟账本
│   │       │   └── trial-run.ts            # 入口 (2行重导出)
│   │       ├── pulse/
│   │       │   ├── full-pulse.ts           # Pulse 全流程 (1251行!)
│   │       │   └── market-pulse.ts         # 市场数据拉取 + 候选筛选
│   │       ├── review/
│   │       │   └── position-review.ts      # 已有仓位复审 (383行)
│   │       ├── routes/
│   │       │   └── admin.ts                # 管理 API
│   │       └── runtime/
│   │           ├── agent-runtime.ts        # AgentRuntime 接口定义
│   │           ├── runtime-factory.ts      # 工厂：pulse-direct vs provider-runtime
│   │           ├── pulse-direct-runtime.ts # [主路径] 纯计算决策
│   │           ├── provider-runtime.ts     # [遗留] 971行 LLM 子进程调用
│   │           ├── decision-composer.ts    # 合并 review + entry 决策
│   │           ├── decision-metadata.ts    # 决策类型定义
│   │           ├── pulse-entry-planner.ts  # Pulse 开仓规划
│   │           └── skill-settings.ts       # Skill Provider 配置
│   │
│   ├── executor/                           # [活跃] 执行器：Polymarket CLOB 下单
│   │   └── src/
│   │       ├── config.ts                   # 执行器配置
│   │       ├── index.ts                    # Fastify 服务入口
│   │       ├── lib/
│   │       │   ├── env-file.ts             # .env 文件加载 (与 orchestrator 重复!)
│   │       │   ├── orderbook-limits.ts     # 订单簿限价
│   │       │   ├── polymarket-sdk.ts       # Polymarket SDK 封装
│   │       │   ├── polymarket.ts           # 下单/同步/止损
│   │       │   ├── risk.ts                 # 执行层风控 (仅导出 placeholder)
│   │       │   └── store.ts               # 状态持久化
│   │       ├── ops/                        # (空目录，仅占位)
│   │       └── workers/
│   │           └── queue-worker.ts         # BullMQ worker
│   │
│   └── rough-loop/                         # [活跃] 独立代码任务循环器 (非交易)
│       └── src/
│           ├── cli.ts                      # CLI 入口
│           ├── config.ts                   # 循环配置
│           └── lib/                        # 循环逻辑 (loop/git/markdown/provider...)
│
├── packages/
│   ├── contracts/                          # [活跃] Zod schema 共享契约
│   │   └── src/index.ts                    # TradeDecisionSet 等核心类型
│   ├── db/                                 # [活跃] Drizzle ORM schema + 查询 + 迁移
│   │   └── src/
│   │       ├── schema.ts                   # DB schema 定义
│   │       ├── queries.ts                  # 查询函数
│   │       ├── local-state.ts              # 无 DB 本地状态管理
│   │       └── migrations/                 # SQL 迁移文件
│   └── terminal-ui/                        # [活跃] 终端美化输出工具库
│       └── src/index.ts                    # 彩色日志/进度条/错误格式化
│
├── scripts/                                # [活跃] CLI 入口脚本 (22个文件)
│   ├── pulse-live.ts              # 无状态实盘测试 (984行!)
│   ├── live-test.ts                        # 有状态实盘测试 (726行)
│   ├── pulse-live-pulse.ts        # Pulse 子流程
│   ├── pulse-live-helpers.ts      # 辅助函数
│   ├── daily-pulse.ts                      # 每日 Pulse 脚本
│   ├── live-run-summary.ts                 # 运行总结生成
│   ├── live-run-common.ts                  # 公共辅助
│   ├── live-run-summary-builders.ts        # 总结构建器
│   ├── live-preflight-probes.ts            # 预检探针
│   ├── live-test-helpers.ts                # 测试辅助
│   ├── generate-wallet-envs.ts             # 钱包环境生成器
│   ├── poly-cli.ts                         # Polymarket CLI 工具
│   ├── cache-polymarket-order-limits.ts    # 缓存订单限价
│   ├── sync-vendors.mjs                    # vendor 仓库同步
│   └── polymarket-wallets.example.json     # 钱包示例
│
├── vendor/                                 # [活跃] 外部参考仓库 (265MB)
│   ├── manifest.json                       # 5个仓库清单
│   └── repos/                              # git clone 的参考实现
│       ├── all-polymarket-skill/           # Claude Code skill 编排
│       ├── polymarket-market-pulse/        # 市场研究 Pulse
│       ├── polymarket-trading-TUI/         # 交易信号参考
│       ├── alert-stop-loss-pm/             # 止损参考
│       └── pm-PlaceOrder/                  # 下单延迟基准
│
├── Illustration/                           # [文档] 架构图/运维手册/评估报告 (28个文件)
├── Plan/                                   # [文档] 实施计划 (8个文件)
├── Wasted/                                 # [归档] 已清理的历史文档
│   ├── legacy-docs/                        # 旧 handoff 文档
│   ├── exploration/                        # 一次性探索稿
│   ├── progress-history/                   # 历史进度记录
│   └── bundles/                            # 清理打包
├── E2E Test Driven Development/            # [休眠] Playwright E2E 测试 (45MB)
│
├── runtime-artifacts/                      # [运行产物] 运行归档 (33MB, gitignored except .gitkeep)
│   ├── pulse-live/                     # 49+个时间戳命名的运行目录
│   ├── live-test/                          # 有状态运行归档
│   ├── reports/                            # Pulse 报告
│   ├── rough-loop/                         # Rough Loop 产物
│   └── ...
├── run-error/                              # [运行产物] 错误归档
├── claude-review/                          # [文档] Claude 审计输出
│   └── review-and-plan.md                  # 先前审计 + 简化方案
│
├── deploy/
│   └── hostinger/                          # Hostinger VPS 部署脚本
│
├── skills/
│   └── daily-pulse/                        # Claude Code daily-pulse skill
│
├── .local/
│   └── aliyun/                             # 阿里云 SSH 脚本 + 文档
│
│── 根级 Markdown (16个文件):
│   ├── README.md / README.en.md            # 项目总说明
│   ├── AGENTS.md / AGENTS.en.md            # 协作约定
│   ├── rough-loop.md / rough-loop.en.md    # Rough Loop 任务队列
│   ├── rough-loop-guide.md / ...en.md      # Rough Loop 使用指南
│   ├── progress.md / progress.en.md        # 项目进度
│   ├── risk-controls.md / ...en.md         # 风控说明
│   ├── timeout-reference.md / ...en.md     # 超时参考
│   └── todo-loop.md / todo-loop.en.md      # Todo Loop (旧版)
│
│── 根级配置:
│   ├── package.json                        # monorepo 根配置
│   ├── pnpm-workspace.yaml                 # workspace 定义
│   ├── pnpm-lock.yaml                      # 锁文件
│   ├── tsconfig.base.json                  # TS 基础配置
│   ├── vitest.config.ts                    # 测试配置
│   ├── vercel.json                         # Vercel 部署配置
│   ├── docker-compose.yml                  # 本地开发容器
│   └── docker-compose.hostinger.yml        # 生产部署容器
```

---

## 2. 数据流：从市场数据到交易执行 / Data Flow: Market Data to Trade Execution

### 2.1 主链路 (pulse-direct, pulse-live)

这是当前**实际在用的主路径**，通过 `pnpm pulse:live` 启动。

This is the **actually used main path**, launched via `pnpm pulse:live`.

```
┌──────────────────────────────────────────────────────────────────┐
│  1. Preflight 预检                                                │
│     scripts/pulse-live.ts                                │
│     → 加载 .env.pizza (或其他钱包)                                │
│     → 验证钱包凭证、查询余额                                     │
│     → 检查 Polymarket API 可达性                                  │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. Pulse 市场研究                                                │
│     orchestrator/src/pulse/full-pulse.ts (1251行)                 │
│     → 调用 vendor/repos/all-polymarket-skill 的 Python 脚本       │
│       或 polymarket-market-pulse 拉取活跃市场列表                 │
│     → 筛选流动性 > $5000 的市场                                   │
│     → 评估风险标志 (tradeable flag, stale check)                  │
│     → 输出 PulseSnapshot: 候选市场 + 分析报告                    │
│     产物 → runtime-artifacts/reports/pulse/                       │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. Decision 决策                                                 │
│     orchestrator/src/runtime/pulse-direct-runtime.ts              │
│     ├── pulse-entry-planner.ts: 从 Pulse 候选生成开仓计划         │
│     │   → Kelly 计算 → 仓位规模 → 方向判断                       │
│     ├── review/position-review.ts: 已有仓位复审                   │
│     │   → hold / reduce / close 决定                              │
│     └── decision-composer.ts: 合并 review + entry                 │
│         → 去重、add-on 合并 → TradeDecisionSet                   │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. Risk 风控裁剪                                                 │
│     orchestrator/src/lib/risk.ts: applyTradeGuards                │
│     → 7 层串联检查:                                               │
│       Pulse 风险标志 → 系统状态 → Kelly 定价                      │
│       → min(requested, 5% bankroll, liquidityCap,                 │
│              exposureHeadroom, eventHeadroom)                      │
│       → 交易所最低金额 → 订单簿可用性                             │
│     orchestrator/src/lib/execution-planning.ts: buildExecutionPlan│
│     → 将决策转为可执行订单列表                                    │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  5. Execution 执行 (pulse-live 路径直接调用)                      │
│     executor/src/lib/polymarket.ts: 下单到 Polymarket CLOB        │
│     executor/src/lib/polymarket-sdk.ts: SDK 封装                  │
│     executor/src/lib/orderbook-limits.ts: 订单簿询价              │
│     → FOK 市价单 → 等待成交确认                                  │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  6. Archive 归档                                                  │
│     orchestrator/src/lib/portfolio-report-artifacts.ts (1266行)   │
│     → 生成 5-8 个文件: pulse-report, runtime-log, execution-plan, │
│       portfolio-report, summary JSON                              │
│     → 写入 runtime-artifacts/pulse-live/{timestamp}/          │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 遗留路径 (provider-runtime, stateful)

通过 `pnpm live:test` 启动，需要 PostgreSQL + Redis + BullMQ。

Launched via `pnpm live:test`, requires PostgreSQL + Redis + BullMQ.

```
orchestrator (Fastify + cron) → agent-cycle.ts → ProviderRuntime
  → 启动外部 LLM 子进程 (Codex/OpenClaw) 执行 vendor skill
  → 解析 TradeDecisionSet → 入队 BullMQ
  → executor (queue-worker.ts) 消费队列 → 下单
  → DB 写入持仓/交易记录
```

**状态**: 代码中 `runtime-factory.ts` 已对 provider-runtime 发出 deprecation warning。实际运行全部使用 pulse-direct + pulse-live 路径。

**Status**: `runtime-factory.ts` already emits a deprecation warning for provider-runtime. All actual runs use the pulse-direct + pulse-live path.

### 2.3 Rough Loop (非交易)

独立的代码任务循环器，用于自动化重复性代码修改任务。

An independent code task loop for automating repetitive code modification tasks.

```
rough-loop/src/cli.ts → 读取 rough-loop.md 任务队列
  → 逐条执行代码任务 → git commit
  → 输出进度到终端
```

---

## 3. 活跃 vs 遗留 vs 死代码 / Active vs Legacy vs Dead Code

### 3.1 活跃模块 (Active)

| 模块 / Module | 路径 / Path | 用途 / Purpose |
|---|---|---|
| Pulse Live 实盘入口 | `scripts/pulse-live.ts` | 当前唯一实际运行的交易入口 |
| Pulse Direct Runtime | `orchestrator/src/runtime/pulse-direct-runtime.ts` | 主决策引擎 |
| Pulse 市场研究 | `orchestrator/src/pulse/full-pulse.ts` | 市场候选生成 |
| 风控 | `orchestrator/src/lib/risk.ts` + `execution-planning.ts` | 交易裁剪 |
| 仓位复审 | `orchestrator/src/review/position-review.ts` | 持仓管理 |
| 执行器 SDK | `executor/src/lib/polymarket*.ts` | Polymarket API 对接 |
| Web UI | `apps/web/` | 公开围观页面 |
| 共享契约 | `packages/contracts/` | Zod schema |
| 数据库 | `packages/db/` | Schema + 查询 |
| 终端 UI | `packages/terminal-ui/` | 输出美化 |
| Vendor 仓库 | `vendor/repos/` | 外部参考实现 |
| Rough Loop | `services/rough-loop/` | 代码任务循环 |

### 3.2 遗留/可删除模块 (Legacy / Removable)

| 模块 / Module | 路径 / Path | 原因 / Reason |
|---|---|---|
| Provider Runtime | `orchestrator/src/runtime/provider-runtime.ts` (971行) | 已被 pulse-direct 取代，代码中已标记 deprecated |
| Skill Settings | `orchestrator/src/runtime/skill-settings.ts` | 仅 provider-runtime 使用 |
| Agent Cycle (stateful) | `orchestrator/src/jobs/agent-cycle.ts` | 仅 stateful 路径使用 |
| Paper Trading | `orchestrator/src/ops/paper-trading.ts` | 模拟交易，当前未使用 |
| Trial 系列 | `orchestrator/src/ops/trial-*.ts` | 人工审批流程，当前未使用 |
| BullMQ Queue Worker | `executor/src/workers/queue-worker.ts` | pulse-live 路径不经过队列 |
| Executor ops/ | `executor/src/ops/` | 空目录 |
| 有状态 live-test | `scripts/live-test.ts` (726行) | 被 pulse-live.ts 取代 |
| todo-loop.md | 根级 | 被 rough-loop.md 取代 |

### 3.3 重复代码 (Duplicated Code)

| 文件 A / File A | 文件 B / File B | 重复内容 / Duplication |
|---|---|---|
| `orchestrator/src/lib/env-file.ts` | `executor/src/lib/env-file.ts` | 完全相同的 loadEnvFile 函数 |
| `orchestrator/src/risk.ts` | `executor/src/lib/risk.ts` | 两个 risk.ts，executor 的仅导出 placeholder |

---

## 4. 清理机会 / Cleanup Opportunities

### 4.1 根级文档泛滥 (Root-Level Document Sprawl)

当前根目录有 **16个 Markdown 文件**，其中大部分应移入子目录。

The root directory has **16 Markdown files**, most of which should be moved to subdirectories.

| 文件 / File | 建议 / Recommendation |
|---|---|
| `README.md` / `README.en.md` | **保留** - 项目入口 |
| `AGENTS.md` / `AGENTS.en.md` | **保留** - 协作约定 |
| `rough-loop.md` / `rough-loop.en.md` | **保留** - Rough Loop 活跃使用 |
| `risk-controls.md` / `risk-controls.en.md` | 移入 `docs/` |
| `rough-loop-guide.md` / `...en.md` | 移入 `docs/` |
| `progress.md` / `progress.en.md` | 移入 `docs/` 或 `Wasted/progress-history/` |
| `timeout-reference.md` / `...en.md` | 移入 `docs/` |
| `todo-loop.md` / `todo-loop.en.md` | 移入 `Wasted/` (已被 rough-loop 取代) |

### 4.2 目录职责重叠 (Overlapping Directories)

| 问题 / Issue | 详情 / Detail |
|---|---|
| `Illustration/` vs `Plan/` vs `claude-review/` | 三个文档目录职责不清：`Illustration/` 存架构图和运维手册，`Plan/` 存实施计划，`claude-review/` 存审计结果。应合并为单一 `docs/` |
| `Wasted/` vs git 历史 | `Wasted/` 作为"软删除回收站"存在，但 git 本身已提供完整历史。应在确认 git 记录后直接删除 |
| `run-error/` vs `runtime-artifacts/` | 错误归档独立于运行产物目录，但逻辑上属于同一归档体系，应合并 |
| `scripts/` 过大 | 22个文件，混合了 CLI 入口、测试脚本、工具函数和测试文件。应拆分 |
| `.env.wallets/` vs 根级 `.env.*` | 钱包环境文件既在根级散落，又在子目录集中管理 |
| `.local/` vs `deploy/` | 两个目录都存部署相关内容，`.local/aliyun/` 是阿里云脚本，`deploy/hostinger/` 是 Hostinger 脚本 |

### 4.3 配置文件整合 (Configuration Consolidation)

| 问题 / Issue | 详情 / Detail |
|---|---|
| 多份 .env | `.env.aizen`, `.env.no1`, `.env.pizza`, `.env.wallets/`, `agents.env`, `deploy/hostinger/.env.*` -- 6+个环境文件 |
| 两份 docker-compose | `docker-compose.yml` (本地) + `docker-compose.hostinger.yml` (生产) 可用 profiles 或 override 合并 |
| 两份 risk.ts | `orchestrator/src/risk.ts` 和 `executor/src/lib/risk.ts` 应提取到 `packages/` |
| 两份 env-file.ts | 同上 |
| `vercel.json` 在根和 apps/web/ | 两处 Vercel 配置 |

### 4.4 死代码路径 (Dead Code Paths)

**provider-runtime 整条链路** (约 1200 行可删除):

- `orchestrator/src/runtime/provider-runtime.ts` (971行)
- `orchestrator/src/runtime/skill-settings.ts` (73行)
- `orchestrator/src/config.ts` 中 `agentRuntimeProviders`, `codex`, `openclaw` 配置块
- `runtime-factory.ts` 的条件分支和 deprecation warning

**stateful-only 路径** (约 600 行可删除):

- `orchestrator/src/jobs/agent-cycle.ts` (仅 stateful cron 使用)
- `executor/src/workers/queue-worker.ts` (BullMQ worker)
- `orchestrator/src/index.ts` 中的 cron/BullMQ 初始化代码

**paper / trial 路径** (约 700 行可删除):

- `orchestrator/src/ops/paper-trading.ts` (283行)
- `orchestrator/src/ops/trial-approve.ts` (89行)
- `orchestrator/src/ops/trial-recommend.ts` (675行)
- `orchestrator/src/ops/trial-recommend-checkpoint.ts` (107行)
- `orchestrator/src/ops/trial-reset-paper.ts` (54行)
- `orchestrator/src/ops/trial-run.ts` (2行)

### 4.5 超大文件 (Oversized Files)

| 文件 / File | 行数 / Lines | 建议 / Recommendation |
|---|---|---|
| `orchestrator/src/pulse/full-pulse.ts` | 1251 | 拆分为 fetch / filter / render / snapshot 模块 |
| `orchestrator/src/lib/portfolio-report-artifacts.ts` | 1266 | 拆分为 report-builder / report-formatter / artifact-writer |
| `orchestrator/src/runtime/provider-runtime.ts` | 971 | 删除 (dead code) |
| `scripts/pulse-live.ts` | 984 | 拆分为 preflight / pulse / decision / execution / report 阶段 |
| `orchestrator/src/jobs/resolution.ts` | 965 | 评估是否仍需要，若需要则拆分 |
| `scripts/live-test.ts` | 726 | 删除 (被 pulse-live 取代) |

### 4.6 monorepo 不必要的复杂度 (Unnecessary Monorepo Complexity)

| 问题 / Issue | 详情 / Detail |
|---|---|
| services/orchestrator + services/executor 分离 | pulse-live 路径中，executor 的功能被 scripts 直接调用，不经过队列。两个服务可合并为一个 |
| BullMQ + Redis 依赖 | pulse-live 路径不使用队列。根 `package.json` 仍有 `bullmq` 和 `ioredis` 依赖 |
| PostgreSQL 依赖 | pulse-live 路径使用 `packages/db/local-state.ts` 而非真实数据库 |
| `E2E Test Driven Development/` | 目录名含空格，45MB (含 node_modules)，在 pnpm-workspace.yaml 中注册为 workspace package |

---

## 5. 建议的目录结构 / Proposed Directory Structure

### 5.1 短期清理 (无破坏性变更) / Short-term Cleanup (Non-breaking)

这些变更不影响任何代码引用路径，可以立即执行。

These changes don't affect any code import paths and can be done immediately.

```
autonomous-poly-trading/
├── README.md / README.en.md               # 保留
├── AGENTS.md / AGENTS.en.md               # 保留
├── rough-loop.md / rough-loop.en.md       # 保留 (Rough Loop 活跃引用)
│
├── docs/                                   # [新建] 合并所有文档
│   ├── architecture/                       # <- Illustration/onboarding-architecture.*
│   │                                       # <- Illustration/trading-modes-flowchart.*
│   ├── operations/                         # <- Illustration/hostinger-*, ssh-*, vercel-*
│   ├── design/                             # <- Illustration/portfolio-ops-report-design.*
│   │                                       # <- Plan/*
│   ├── reports/                            # <- Illustration/pulse-timeout-calibration-*
│   │                                       # <- Illustration/agent3-validation-*
│   │                                       # <- Illustration/balancer-*
│   ├── reference/                          # <- risk-controls.*, rough-loop-guide.*
│   │                                       # <- timeout-reference.*, progress.*
│   └── audits/                             # <- claude-review/*
│
├── archive/                                # [重命名] Wasted/ -> archive/
│   └── ...                                 #   + todo-loop.* 移入
│
├── config/                                 # [新建] 所有环境/配置集中
│   ├── .env.example                        # <- 根级 .env.example
│   ├── wallets/                            # <- .env.wallets/
│   └── deploy/                             # <- deploy/hostinger/
│                                           # <- .local/aliyun/
│
├── (其他目录结构不变)
```

### 5.2 中期重构 (需要更新代码引用) / Medium-term Refactor (Requires Code Updates)

```
autonomous-poly-trading/
├── apps/
│   └── web/                                # Next.js UI (不变)
│
├── src/                                    # [新建] 合并 orchestrator + executor
│   ├── config.ts                           # 统一配置
│   ├── main.ts                             # 单进程入口 (替代两个 Fastify 服务)
│   ├── pulse/                              # 市场研究
│   │   ├── fetch.ts                        # 拉取市场列表
│   │   ├── filter.ts                       # 流动性/质量筛选
│   │   ├── render.ts                       # Pulse 报告渲染
│   │   └── snapshot.ts                     # PulseSnapshot 类型
│   ├── decision/                           # 决策引擎
│   │   ├── entry-planner.ts                # 开仓规划
│   │   ├── position-review.ts              # 仓位复审
│   │   └── composer.ts                     # 决策合并
│   ├── risk/                               # 风控 (从两个 service 提取)
│   │   ├── trade-guards.ts                 # applyTradeGuards (带详细返回)
│   │   └── execution-planning.ts           # 执行计划
│   ├── execution/                          # 交易执行 (从 executor 提取)
│   │   ├── polymarket-sdk.ts
│   │   ├── polymarket.ts
│   │   └── orderbook-limits.ts
│   ├── archive/                            # 归档 (简化)
│   │   └── run-log.ts                      # 单文件 JSONL 替代 5-8 个文件
│   └── jobs/                               # 保留 resolution 等定时任务
│       └── resolution.ts
│
├── scripts/                                # [简化] 仅 CLI 入口
│   ├── live.ts                             # 唯一交易入口 (替代 pulse-live)
│   ├── daily-pulse.ts                      # 每日 Pulse
│   ├── cache-order-limits.ts               # 缓存订单限价
│   └── sync-vendors.mjs                    # vendor 同步
│
├── packages/
│   ├── contracts/                          # 不变
│   ├── db/                                 # 不变 (保留，Web UI 仍可能使用)
│   └── terminal-ui/                        # 不变
│
├── vendor/                                 # 不变
├── docs/                                   # 合并后的文档
├── config/                                 # 合并后的配置
└── services/
    └── rough-loop/                         # 保留 (独立工具，不属于交易链路)
```

### 5.3 关键变更说明 / Key Changes Explained

**合并 orchestrator + executor**:
- 当前 pulse-live 路径已经绕过了 BullMQ 队列，scripts 直接调用 executor 的 lib 函数
- 两个独立的 Fastify 服务对于单钱包交易者来说是不必要的基础设施开销
- 合并后可移除 BullMQ、Redis 依赖 (Web UI 如需要可单独连接)

**Merge orchestrator + executor**:
- The pulse-live path already bypasses BullMQ, with scripts calling executor lib functions directly
- Two separate Fastify services are unnecessary infrastructure overhead for a single-wallet trader
- After merging, BullMQ and Redis dependencies can be removed (Web UI can connect separately if needed)

**删除 provider-runtime**:
- 971 行代码，已在 runtime-factory.ts 中标记 deprecated
- 维护两条决策路径增加认知负担，pulse-direct 已证明足够

**Remove provider-runtime**:
- 971 lines of code, already marked deprecated in runtime-factory.ts
- Maintaining two decision paths increases cognitive load; pulse-direct has proven sufficient

**简化归档**:
- 每次运行生成 5-8 个文件到嵌套时间戳目录，33MB+ 归档
- 改为单行 JSONL + 必要的 Pulse 报告即可

**Simplify archiving**:
- Each run generates 5-8 files in nested timestamped directories, 33MB+ archive
- Switch to single-line JSONL + necessary Pulse reports

---

## 6. 优先级排序 / Priority Ranking

| 优先级 / Priority | 任务 / Task | 预估工时 / Estimate | 影响 / Impact |
|---|---|---|---|
| P0 | 删除 provider-runtime 整条链路 | 1h | 移除 ~1200 行死代码，减少认知负担 |
| P0 | 根级文档搬迁 (8个文件 -> docs/) | 30min | 根目录从 51 项降至 ~40 项 |
| P1 | 合并 Illustration/ + Plan/ + claude-review/ -> docs/ | 30min | 3 个目录降为 1 个 |
| P1 | 删除 todo-loop.md (移入 archive/) | 5min | 移除过时文件 |
| P1 | 删除 executor/src/ops/ 空目录 | 1min | 清理空占位 |
| P1 | 提取 env-file.ts 到 packages/ | 30min | 消除代码重复 |
| P2 | 合并 run-error/ 进 runtime-artifacts/ | 15min | 统一归档 |
| P2 | 整理 .env 文件到 config/ | 30min | 配置集中管理 |
| P2 | 重命名 Wasted/ -> archive/ | 5min | 更专业的命名 |
| P2 | 拆分 full-pulse.ts (1251行) | 2h | 可维护性 |
| P2 | 拆分 portfolio-report-artifacts.ts (1266行) | 2h | 可维护性 |
| P3 | 拆分 pulse-live.ts (984行) | 2h | 可维护性 |
| P3 | 合并 orchestrator + executor 为单进程 | 4h | 架构简化 |
| P3 | 移除 BullMQ/Redis 依赖 (如 Web UI 不需要) | 1h | 减少基础设施要求 |
| P3 | 清理 E2E Test Driven Development/ (45MB) | 30min | 减少仓库体积 |

---

## 7. 磁盘占用分析 / Disk Usage Analysis

| 目录 / Directory | 大小 / Size | 说明 / Note |
|---|---|---|
| `apps/` (主要是 web/.next) | 331 MB | .next 构建缓存占大头，已 gitignored |
| `vendor/repos/` | 265 MB | 5 个 git clone，已 gitignored |
| `E2E Test Driven Development/` | 45 MB | 含 Playwright + node_modules |
| `runtime-artifacts/` | 33 MB | 运行产物，已 gitignored |
| `services/` | 2.7 MB | 核心代码 |
| `packages/` | 524 KB | 共享库 |
| `Illustration/` | 272 KB | 文档 |
| `scripts/` | 192 KB | CLI 脚本 |
| `Wasted/` | 140 KB | 归档 |

**最大节省机会**: `E2E Test Driven Development/` (45MB) 如不活跃可清理其 node_modules，或从 workspace 中移除。

**Biggest saving opportunity**: `E2E Test Driven Development/` (45MB) can have its node_modules cleaned or be removed from the workspace if inactive.

---

## 8. 总结 / Summary

### 核心发现 / Key Findings

1. **项目有两条完整的决策-执行路径**，但只有一条 (pulse-direct + pulse-live) 在实际使用。另一条 (provider-runtime + stateful + BullMQ) 约 2500 行代码可安全删除。

2. **根目录过度拥挤**：51 项，其中 16 个是 Markdown 文件。大部分文档应移入统一的 `docs/` 目录。

3. **文档目录散落**：`Illustration/`、`Plan/`、`claude-review/`、`Wasted/` 四个目录各自存放不同类型的文档，应合并。

4. **配置文件分散**：6+ 个环境文件散落在根级和子目录，应集中到 `config/`。

5. **超大文件**：5 个文件超过 800 行 (最大 1266 行)，违反项目自身的代码风格规范 (最大 800 行)。

6. **代码重复**：`env-file.ts` 在两个 service 中完全重复。

7. **monorepo 复杂度过高**：对于单钱包交易者，两个独立 Fastify 服务 + BullMQ + Redis 是不必要的基础设施。

### Key Findings (English)

1. **Two complete decision-execution paths exist**, but only one (pulse-direct + pulse-live) is actually used. The other (provider-runtime + stateful + BullMQ) comprises ~2500 lines that can be safely removed.

2. **Root directory is overcrowded**: 51 items, including 16 Markdown files. Most docs should move to a unified `docs/` directory.

3. **Documentation directories are scattered**: `Illustration/`, `Plan/`, `claude-review/`, `Wasted/` each store different types of documentation and should be consolidated.

4. **Configuration files are dispersed**: 6+ env files scattered across root and subdirectories should be centralized in `config/`.

5. **Oversized files**: 5 files exceed 800 lines (max 1266), violating the project's own coding style guidelines (800 line max).

6. **Code duplication**: `env-file.ts` is fully duplicated across two services.

7. **Excessive monorepo complexity**: For a single-wallet trader, two separate Fastify services + BullMQ + Redis is unnecessary infrastructure.
