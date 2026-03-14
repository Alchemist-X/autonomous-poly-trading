# Autonomous Poly Trading

英文版见 [README.en.md](README.en.md)。

这是一个面向 Polymarket 的云端自主交易系统仓库，目标是做出一套可以真实运行、可公开围观、并且具备硬风控约束的交易 Agent。

第一版的定位很明确：

- 只跑一个真钱包实例
- 网站对外公开，只读围观
- 管理操作只在站内管理员页面可用
- 默认支持 `codex` skill runtime
- 预留 `openclaw` skill runtime 接口

## 项目目标

这个系统希望同时解决三件事：

- 让 Agent 可以在云端持续运行，而不是只在本地脚本里临时执行
- 让第三方用户可以在网页上看到真实仓位、交易历史、净值和报告
- 把风控从提示词里拿出来，变成服务层的硬规则

## 仓库结构

本仓库是一个 `pnpm` monorepo，主要分为以下几部分：

- `apps/web`
  - Next.js 网站
  - 用于公开围观页和管理员控制台
  - 目标部署平台是 Vercel
- `services/orchestrator`
  - 负责调度 Agent 运行
  - 负责风控状态管理
  - 负责 backtest、resolution、review 等周期任务
- `services/executor`
  - 负责对接 Polymarket CLOB
  - 负责下单、成交同步、仓位同步
  - 负责 live ops 脚本
- `packages/contracts`
  - 共享的 zod schema
  - 用来约束 `TradeDecisionSet` 等结构化数据
- `packages/db`
  - Drizzle schema
  - 数据查询
  - 种子数据与迁移
- `vendor`
  - 外部依赖仓库的固定清单
  - 用于把外部 repo 锁到特定 commit

## 网站形态

公开围观页当前规划和实现的页面包括：

- `/`
  - 总览页
  - 展示资金、净值、系统状态等信息
- `/positions`
  - 当前持仓
- `/trades`
  - 历史成交
- `/runs`
  - Agent 运行列表
- `/runs/[id]`
  - 单次运行详情
  - 包括 reasoning、日志、决策等
- `/reports`
  - pulse、review、resolution 结果
- `/backtests`
  - 每日回测结果

管理员页面提供以下操作：

- `pause`
- `resume`
- `run-now`
- `cancel-open-orders`
- `flatten`

第一版不提供对外开发者 API。网站只读数据库或走站内内部接口，不做公开可集成的 API 产品。

## 风控规则

当前已经明确的硬风控包括：

- 单仓止损：`30%`
- 总体资金回撤停机：`20%`
- 最大总敞口：`50%`
- 最大并发持仓数：`10`
- 单笔最大下单比例：资金的 `5%`

执行层首版统一使用 `FOK` 市价单。

这意味着：

- 即使模型想下单，服务层仍然会做风控裁剪
- 进入 `HALTED` 状态后，不允许继续新开仓
- 止损和人工 flatten 的优先级高于常规策略动作

完整规则见 [risk-controls.md](risk-controls.md)。

## Provider Runtime

当前 orchestrator 已经切到 provider-based runtime：

- `AGENT_RUNTIME_PROVIDER=codex|openclaw`
- `codex` 和 `openclaw` 都有独立的 skill 配置
- skill 可配置：
  - skill 根目录
  - 中文或英文 locale
  - 参与本轮决策的 skill 列表
- 当前不再保留 mock pulse fallback
- 如果 provider 命令缺失、skill 文件缺失或 pulse 抓取失败，运行会直接 fail-closed

当前默认的 pulse 存储命名为：

```text
reports/pulse/YYYY/MM/DD/pulse-<timestamp>-<runtime>-<mode>-<runId>.md
reports/pulse/YYYY/MM/DD/pulse-<timestamp>-<runtime>-<mode>-<runId>.json
```

## 外部仓库依赖

当前系统围绕以下外部仓库进行集成：

- `polymarket-trading-TUI`
  - 作为交易终端和 CLOB 接线参考
- `polymarket-market-pulse`
  - 作为下注建议和仓位建议的核心输入
- `alert-stop-loss-pm`
  - 作为止损逻辑参考
- `all-polymarket-skill`
  - 提供 backtesting、monitor、resolution tracking 等能力参考
- `pm-PlaceOrder`
  - 作为下单参考和本地凭据来源

`vendor` 目录的作用，是把这些外部依赖锁定在明确版本，而不是在运行时临时拉代码。

## 快速开始

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 安装依赖：

```bash
pnpm install
```

3. 同步外部 vendor 仓库：

```bash
pnpm vendor:sync
```

4. 启动本地数据服务：

```bash
docker compose up -d postgres redis
```

5. 执行数据库迁移并写入初始数据：

```bash
pnpm db:migrate
pnpm db:seed
```

6. 启动整个 monorepo：

```bash
pnpm dev
```

本地默认端口：

- web：`http://localhost:3000`
- orchestrator：`http://localhost:4001`
- executor：`http://localhost:4002`

## 环境变量说明

完整模板见 [.env.example](.env.example)。

如果你的 Polymarket 凭据放在相邻仓库里，可以在 `.env` 中设置：

```bash
ENV_FILE=../pm-PlaceOrder/.env.aizen
```

当前 executor 和 orchestrator 都支持在开发环境自动发现相邻目录中的 `.env.aizen`。

环境变量大致分为四组：

- shared
  - 数据库
  - Redis
  - App URL
- web
  - 管理员密码
  - orchestrator 内部 token
- executor
  - 私钥
  - funder address
  - signature type
  - chain id
- orchestrator
  - provider 选择
  - codex / openclaw skill 设置
  - pulse 抓取与存储参数
  - 调度周期
  - 风控参数

## 常用命令

工作区校验：

```bash
pnpm typecheck
pnpm test
pnpm build
```

数据库相关：

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

E2E 工作区：

```bash
pnpm e2e:install-browsers
pnpm e2e:local-lite
AUTOPOLY_E2E_REMOTE=1 pnpm e2e:remote-real
```

执行层 live 检查：

```bash
pnpm --filter @autopoly/executor ops:check
pnpm --filter @autopoly/executor ops:check -- --slug <market-slug>
pnpm --filter @autopoly/executor ops:trade -- --slug <market-slug> --max-usd 1
```

试运行 provider runtime：

```bash
pnpm trial:run
```

推荐首次 `codex` 试运行参数：

```bash
CODEX_SKILLS=polymarket-market-pulse \
CODEX_SKILL_LOCALE=zh \
PROVIDER_TIMEOUT_SECONDS=180 \
CODEX_COMMAND='codex exec --skip-git-repo-check -C {{repo_root}} -s read-only --color never -c model_reasoning_effort="low" --output-schema {{schema_file}} -o {{output_file}} < {{prompt_file}}' \
pnpm trial:run
```

## 部署形态

推荐部署方式如下：

- `apps/web`
  - 部署到 Vercel
  - 使用只读 Postgres 凭据
- `services/orchestrator`
  - 部署到单台云主机
- `services/executor`
  - 部署到同一台云主机
- Postgres
  - 建议使用托管数据库
- Redis
  - 仅供后台任务和队列使用

管理员操作保持在站内，通过受保护的内部接口调用 orchestrator，不向公众暴露。

## 当前状态

截至 `2026-03-14`，当前仓库已经完成这些基础工作：

- monorepo 已经搭起来
- 围观站页面和管理员页面已经存在
- 共享数据模型已经建立
- executor / orchestrator 的服务骨架已完成
- `.env.aizen` 自动发现已经接通
- 已经成功完成一次不超过 `$1` 的真实下单测试
- orchestrator 已切到 `codex/openclaw` provider runtime 结构
- pulse 已改为真实抓取并按命名空间落盘，不再使用 mock pulse fallback
- 已成功完成一次 `codex` 试运行，拿到真实 pulse + 结构化决策输出

更详细的实现进度见 [progress.md](progress.md)。

端到端测试驱动开发工作区见 [E2E Test Driven Development/README.md](E2E%20Test%20Driven%20Development/README.md)。

## 当前限制

目前仍有以下限制：

- 这台开发机器没有 Docker，所以没有完成本地 Docker 运行态验证
- Vercel 和云主机的正式部署还没做
- `codex` 试运行链路已接入，但完整生产闭环还需要继续打通
- `openclaw` 运行接口已预留，但本机尚未安装 `openclaw` CLI

## 后续规划

接下来的高优先级事项见 [todo-loop.md](todo-loop.md)。
