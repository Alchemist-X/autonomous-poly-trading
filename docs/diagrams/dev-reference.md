# 开发与运维参考

> 英文版：[dev-reference.en.md](dev-reference.en.md)（待同步翻译）
>
> 最后更新：2026-07-03（Stage 1 清理后重写仓库树；删除 e2e / hostinger / viewer / position-monitor 相关条目）

本仓库主 README 只保留面向 Agent 的自然语言工作流。需要直接用 pnpm 手动操作、或者排查依赖/部署形态时，翻这份。

## 命名说明（pulse / forecast / autopoly / raven）

仓库里有几组"看着不一样、其实指同一个东西"的名字，先在这里说清，免得每个新接手的人重新踩坑：

- **`forecast:*` = 面向用户的命令名；`pulse` = 引擎内部代号。两者是同一套预测引擎。** CLI 用 `forecast:live` / `forecast:recommend` / `forecast:positions`；而 `services/orchestrator/src/pulse/`、`scripts/pulse-*.ts`、归档路径 `runtime-artifacts/pulse/…` 和 `runtime-artifacts/reports/pulse/…` 仍叫 `pulse`。`pulse:*` 命令保留为 `forecast:*` 的**兼容别名**（见 `package.json`）。
  - **为什么不全量改名（有意保留）：** 全量重命名要动 12 个 `src/pulse/` 文件 + 13 个 `pulse-*` 脚本 + 12 处写 `runtime-artifacts/pulse` 的归档路径——改归档路径会让已有归档"失联"、并改变实盘运行的写入位置，**风险高、收益低**。所以内部一律读作"引擎代号 = pulse，对外命令名 = forecast"，不再追求字面统一。
  - **冻结策略（2026-07-03 Stage 2 定，用于止血而非改名）：** 以下 `pulse` 标识符视为 **frozen legacy identifier**，任何重构都**不许改**，因为改了会断链或孤立历史数据：① `PULSE_*` 环境变量（部署脚本/cron 依赖）；② DB 里持久化的 artifact kind `pulse-report`；③ 归档路径 `runtime-artifacts/pulse-live/` 与 `runtime-artifacts/reports/pulse/`。**可安全改名的只有文件/模块名层**（约 30 个 `pulse-*` 文件），中等风险、需一次性 PR + 全仓 grep 兜底，暂不做。
  - **别名弃用：** `package.json` 里 5 个 `pulse:*` 命令（`daily:pulse` / `pulse:live` / `pulse:recommend` / `pulse:positions` / `managed:pulse`）是 `forecast:*` / `daily:forecast` / `managed:forecast` 的**兼容别名**，标记为 **deprecated**；文档/新脚本一律用 `forecast:*`，别名走完一个弃用周期后删除。**新代码一律 forecast 命名**。
- **三层产品 / 包命名（历史累积，各自内部自洽）：**
  - `predict-raven` = 仓库名（GitHub repo / 本地目录）。
  - `@autopoly/*` = npm workspace scope（历史遗留；所有子包都用这个 scope，不影响功能）。
  - `raven` = 产品代号（`apps/raven`、`apps/raven-managed` 等）。

## Monorepo 结构

本仓库是 `pnpm` monorepo（`pnpm@10.28.1`，Node ≥ 20），没有根级 `src/`，源码分布在以下子包中：

```
predict-raven/
├── apps/
│   ├── web/                          # Next.js 公开站：世界杯盲测预测（forecasting-agent.com）
│   ├── raven/                        # Raven Forecasting Engine 三屏 app（:3200）
│   └── raven-managed/                # 托管交易前端（Phase 3a 完成，保留待开发）
├── services/
│   ├── orchestrator/                 # 调度、Pulse、决策运行时、风控、报告
│   ├── executor/                     # Polymarket CLOB 对接、下单、同步、队列 worker
│   ├── managed-trading/              # 托管交易后端（保留待开发）
│   └── rough-loop/                   # 独立的代码任务循环器（非交易主链路）
├── packages/
│   ├── contracts/                    # Zod schema：TradeDecisionSet 等共享契约 + env 加载
│   ├── db/                           # Drizzle schema、迁移、查询、local-state
│   ├── terminal-ui/                  # 终端彩色输出、错误摘要、表格渲染
│   ├── norns/                        # 模型别名解析（orchestrator 配置链）
│   ├── sports-model/                 # 世界杯建模原语（elo/poisson/xg 等，fifa-models 消费）
│   ├── sports-data/                  # Polymarket Gamma/WS 行情客户端（世界杯脚本用）
│   ├── fifa-models/                  # FIFA 八模型淘汰赛预测引擎
│   └── market-intelligence/          # Python 种子模块（issue #25 定性，未接线）
├── scripts/                          # 工作区级入口：pulse-live / daily-pulse / forecast/ / world-cup/
├── vendor/                           # 外部仓库锁定清单（manifest.json）+ vendor:sync 镜像（gitignore）
├── deploy/                           # docker-compose、raven Docker 套件、cron 模板
├── docs/                             # agent-handoff / diagrams / internal（中英双语）
├── evaluation/                       # 历史评测归档
├── runtime-artifacts/                # 运行产物归档（默认 gitignore；世界杯共享件白名单入库）
├── .github/workflows/                # ci.yml（build/typecheck/test 门禁）+ wc-results.yml（世界杯部署）
└── package.json                      # 根 scripts + workspace 依赖
```

### 各模块职责速查

| 模块 | 做什么 | 关键入口 |
| --- | --- | --- |
| `apps/web` | 世界杯盲测预测公开站 + prediction-engine 展示页 | `app/[locale]/world-cup/` |
| `apps/raven` | Forecasting Engine 三屏 app（Ask → Research → Verdict） | `app/page.tsx` |
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
pnpm typecheck          # 全量类型检查（workspace 包）
pnpm typecheck:scripts  # scripts/ 树 tsc 门禁（2026-07-03 起；14 个存量错清零前 CI 非阻塞）
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

当前实际部署形态：`apps/web` → Vercel（`wc-results.yml` 用 `VERCEL_TOKEN` 构建+部署+promote）；`apps/raven` → GCP 东京 VM Docker（套件见 `deploy/raven/`）。Hostinger VPS 方案已于 2026-07-03 随 Stage 1 清理移除（`deploy/hostinger/` 已删，runbook 仅存档参考）。

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
