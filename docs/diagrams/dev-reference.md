# 开发与运维参考

> 英文版：[dev-reference.en.md](dev-reference.en.md)（待同步翻译）
>
> 最后更新：2026-06-15

本仓库主 README 只保留面向 Agent 的自然语言工作流。需要直接用 pnpm 手动操作、或者排查依赖/部署形态时，翻这份。

## 命名说明（pulse / forecast / autopoly / raven）

仓库里有几组"看着不一样、其实指同一个东西"的名字，先在这里说清，免得每个新接手的人重新踩坑：

- **`forecast:*` = 面向用户的命令名；`pulse` = 引擎内部代号。两者是同一套预测引擎。** CLI 用 `forecast:live` / `forecast:recommend` / `forecast:positions`；而 `services/orchestrator/src/pulse/`、`scripts/pulse-*.ts`、归档路径 `runtime-artifacts/pulse/…` 和 `runtime-artifacts/reports/pulse/…` 仍叫 `pulse`。`pulse:*` 命令保留为 `forecast:*` 的**兼容别名**（见 `package.json`）。
  - **为什么不全量改名（有意保留）：** 全量重命名要动 12 个 `src/pulse/` 文件 + 13 个 `pulse-*` 脚本 + 12 处写 `runtime-artifacts/pulse` 的归档路径——改归档路径会让已有归档"失联"、并改变实盘运行的写入位置，**风险高、收益低**。所以内部一律读作"引擎代号 = pulse，对外命令名 = forecast"，不再追求字面统一。
- **三层产品 / 包命名（历史累积，各自内部自洽）：**
  - `predict-raven` = 仓库名（GitHub repo / 本地目录）。
  - `@autopoly/*` = npm workspace scope（历史遗留；所有子包都用这个 scope，不影响功能）。
  - `raven` = 产品代号（`apps/raven-managed`、`raven-agent-loop` 等）。

## Monorepo 结构

本仓库是 `pnpm` monorepo（`pnpm@10.28.1`，Node ≥ 20），没有根级 `src/`，源码分布在以下子包中：

```
autonomous-poly-trading/
├── apps/
│   └── web/                          # Next.js 16 网站：公开围观 + 管理员控制台
├── services/
│   ├── orchestrator/                 # 调度、Pulse、决策运行时、风控、报告
│   ├── executor/                     # Polymarket CLOB 对接、下单、同步、队列 worker
│   └── rough-loop/                   # 独立的代码任务循环器（非交易主链路）
├── packages/
│   ├── contracts/                    # Zod schema：TradeDecisionSet 等共享契约
│   ├── db/                           # Drizzle schema、迁移、查询、local-state
│   └── terminal-ui/                  # 终端彩色输出、错误摘要、表格渲染
├── scripts/                          # 工作区级入口：daily-pulse、live-test、poly-cli
├── vendor/                           # 外部仓库锁定清单（manifest.json）
├── deploy/hostinger/                 # VPS 部署脚本与环境模板
├── Illustration/                     # 架构图、流程图、运维说明（中英双语）
├── Plan/                             # 阶段性规划文档
├── Wasted/                           # 已归档的 legacy handoff / 探索稿 / 历史进度
├── E2E Test Driven Development/      # Playwright + Vitest E2E 套件
├── runtime-artifacts/                # 运行产物归档（.gitignore，仅保留 .gitkeep）
├── docker-compose.yml                # 本地 Postgres 17 + Redis 8
├── docker-compose.hostinger.yml      # 生产向容器编排
└── package.json                      # 根 scripts + workspace 依赖
```

### 各模块职责速查

| 模块 | 做什么 | 关键入口 |
| --- | --- | --- |
| `apps/web` | 公开页面（总览/持仓/成交/runs/reports/backtests）+ 管理员操作 | `app/page.tsx` |
| `services/orchestrator` | Pulse 生成 → 决策运行时 → 风控裁剪 → 报告产物 | `src/jobs/daily-pulse-core.ts` |
| `services/executor` | Polymarket CLOB 下单、仓位同步、止损、flatten | `src/workers/queue-worker.ts`、`src/lib/polymarket.ts` |
| `packages/contracts` | `TradeDecisionSet`、`actionSchema`、队列/任务名等 | `src/index.ts` |
| `packages/db` | DB schema + 查询；paper 模式下的 file-backed local state | `src/queries.ts`、`src/local-state.ts` |
| `packages/terminal-ui` | 终端 UI 工具库 | `src/index.ts` |
| `scripts/` | CLI 入口，拼接不同运行模式 | `daily-pulse.ts`、`pulse-live.ts`、`live-test.ts` |
| `services/rough-loop` | 代码任务自动循环（不参与交易） | `src/cli.ts` |

## 命令速查

### 构建与校验

```bash
pnpm build              # 全量构建
pnpm typecheck          # 全量类型检查
pnpm test               # Vitest 单测
```

### 数据库

```bash
pnpm db:generate        # 生成迁移
pnpm db:migrate         # 执行迁移
pnpm db:seed            # 种子数据
```

### 交易链路

```bash
# Paper
AUTOPOLY_EXECUTION_MODE=paper pnpm trial:recommend
AUTOPOLY_EXECUTION_MODE=paper pnpm trial:approve -- --latest

# Pulse Live
ENV_FILE=.env.live-test pnpm forecast:live
ENV_FILE=.env.live-test pnpm forecast:live -- --recommend-only
ENV_FILE=.env.live-test pnpm forecast:live -- --json

# Live Stateful
ENV_FILE=.env.live-test pnpm live:test

# Daily Pulse（forecast:live 的便捷入口，默认配好 .env.pizza + live + pulse-direct）
pnpm daily:forecast
```

### 执行流程分阶段

所有 live 路径都必须经过 Preflight，不是独立模式而是必经阶段。

**forecast:live**：

```
Preflight → 拉远端持仓/Collateral → Pulse 生成 → 决策运行时 → 风控 + Token Cap → 直接下单 → Summary 归档
```

**live:test**：

```
Preflight(+DB/Redis/Queue) → Pulse 生成 → Agent Cycle(决策+持久化) → 队列投递 → Executor Worker 执行 → Sync → Summary 归档
```

**paper**：

```
加载组合上下文 → Pulse 生成 → 决策运行时 → 共享 buildExecutionPlan（与 forecast:live 相同的风控 + 交易所门槛规则）→ awaiting-approval → trial:approve → Paper State 更新
```

### Executor Ops

```bash
pnpm --filter @autopoly/executor ops:check
pnpm --filter @autopoly/executor ops:check -- --slug <market-slug>
pnpm --filter @autopoly/executor ops:trade -- --slug <market-slug> --max-usd 1
```

### E2E

```bash
pnpm e2e:install-browsers
pnpm e2e:local-lite
AUTOPOLY_E2E_REMOTE=1 pnpm e2e:remote-real
```

### Rough Loop

```bash
pnpm rough-loop:doctor
pnpm rough-loop:once
pnpm rough-loop:start
```

### Vendor

```bash
pnpm vendor:sync        # 同步外部仓库到 vendor/repos/
```

### 世界杯赛果（World Cup 站）

```bash
pnpm wc:results              # 拉取 Polymarket 结算，刷新小组赛赛果数据（只读、市场盲测）
pnpm wc:results -- --all     # 不按开球时间过滤，强制探测全部 72 场
```

- 写入 `apps/web/lib/world-cup/generated/results.generated.json`（World Cup 页面静态导入）。
- **市场盲测**：只存结算事实（胜负方 + 比分），绝不存价格/隐含概率；`outcomePrices` 仅作为 1/0 结算位读取。详见 `scripts/world-cup/lib/settlement.ts`。
- 每次运行向 `runtime-artifacts/world-cup/results-log.jsonl` 追加一行；失败归档到 `run-error/<ts>-update-results/`。脚本只刷新数据，**不提交、不部署**——发布需手动 deploy。
- **每日定时任务**（本机 `/schedule`，非 GitHub Actions）：`taskId = wc-results-daily`，每天 09:17（本地时区）跑一次 `pnpm wc:results`。
  - 查看 / 修改：`mcp__scheduled-tasks__list_scheduled_tasks`、`update_scheduled_task`，或直接编辑 `/Users/Aincrad/.claude/scheduled-tasks/wc-results-daily/SKILL.md`。
  - 该任务只在 Claude 应用打开时触发；应用关闭时错过的任务会在下次启动补跑。

## 依赖矩阵

| 依赖 | 是否必需 | 用途 |
| --- | --- | --- |
| Node.js ≥ 20 | ✅ 必需 | Monorepo 构建与运行 |
| pnpm 10.x | ✅ 必需 | Workspace 包管理（当前 `10.28.1`） |
| TypeScript 5.9.x | 已内置 | TS 编译 |
| Docker / docker compose | 可选 | 本地 Postgres + Redis |
| Postgres 17 | 可选 | `live:test` 需要 |
| Redis 8 | 可选 | `live:test` 需要 |
| Codex CLI | 运行时按需 | `provider-runtime` / Pulse 生成 |
| Polymarket 钱包凭据 | live 路径必需 | 真钱下单 |

## 部署形态

| 组件 | 推荐部署方式 |
| --- | --- |
| `apps/web` | Vercel（只读 Postgres 凭据） |
| `services/orchestrator` | 单台云主机 |
| `services/executor` | 同一台云主机 |
| Postgres 17 | 托管数据库 |
| Redis 8 | 同机或托管 |

Hostinger VPS 方案见 [hostinger-vps-deploy-runbook.md](hostinger-vps-deploy-runbook.md)，配合 `docker-compose.hostinger.yml` 和 `deploy/hostinger/stack.env.example`。

管理员操作通过站内受保护接口调 orchestrator，不向公众暴露 `4001 / 4002 / 5432 / 6379`。

## 本地最小栈（Stateful 调试）

跑 `live:test` 需要本地 Postgres + Redis：

```bash
cp .env.example .env
pnpm install
pnpm vendor:sync
docker compose -f deploy/docker-compose.yml up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm dev
```

默认端口：Web `3000` / Orchestrator `4001` / Executor `4002`。
