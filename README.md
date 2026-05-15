<p align="center">
  <img src="assets/predict-raven.png" alt="predict-raven" width="220" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

# Predict-Raven

> This README is written in Chinese for the maintainer's convenience. Don't worry — every document in this repository has a matching English version. See [docs/en/README.md](docs/en/README.md) for the full English README.

最后更新：2026-05-15

---

**Predict-Raven** 是一个在Polymarket上实现自主交易的Agent框架，可以通过claude code / codex等常见架构在本地端持久化部署

实盘公开：
- **持仓和决策记录**：[autopoly-pizza-spectator.vercel.app](https://autopoly-pizza-spectator.vercel.app)
- **实盘地址 Polymarket profile**：[`https://polymarket.com/profile/0x6664e32f79aee42639f73633e40b5a842b07614e`](https://polymarket.com/profile/0x6664e32f79aee42639f73633e40b5a842b07614e)

## 系统设计

Predict-Raven围绕**Market Pulse**这一核心组件设计：让 AI 自主评估事件发生的概率，动态地从信息源收集证据，将其与市场隐含的赔率对比，综合交易的edge和资金回报效率给出交易指示。

### 为什么让 Agent 来做这件事

1. **在复杂推理能力上超过人类** — Agent 事实上在复杂任务上的推理能力已经接近或者超过人类水平。更多时候，人类的优势主要在于更好的信息源而不是推理，但这一差距可以通过工程能力弥合。核心分析能力已经到位。
2. **覆盖面广且时效性强** — Agent 能 7×24 小时同时监控数千个市场，发现任何个人无法跟踪的定价偏差。在新闻爆发时，Agent 能做到秒级响应，人类则至少需要 3 分钟以上，像这样的交易机会在无数个市场都有出现。
3. **预测市场仍处于蓝海** — 政治和科技预测市场中，多数参与者缺乏清晰的定价模型，且普遍畏惧库存管理和逆向选择风险。系统化的 Agent 交易在这些领域面临的竞争极少。哪怕在体育市场，在 moneyline 以外也有很多市场。

### 核心定位

- Agent 下单、决策思路全部在网页上公开
- Agent 在云端持续运行，而非本地脚本临时执行，不需要人类介入
- 已使用 `@polymarket/clob-client-v2`，抵押品默认 pUSD；V2 切换日 2026-04-28 11:00 UTC，cutover runbook 见 [`docs/internal/plan/2026-04-28-v2-cutover-runbook.md`](docs/internal/plan/2026-04-28-v2-cutover-runbook.md)

## 快速开始

通过 AI Agent（Claude Code / Codex / OpenClaw）自然语言快速开始

> **前置**：你需要先装好 [Claude Code](https://claude.com/claude-code) 或 [Codex CLI](https://github.com/openai/codex) 任一个，`git clone` 本仓库后在仓库目录里启动它，再开始下面 4 步。

### 1. 准备环境

对 Agent 说：

```
帮我装好 predict-raven 需要的依赖
```

预期：Agent 会跑 `pnpm install` + `pnpm build`，告诉你环境是否就绪。如果你电脑上还没装 Node.js / pnpm，它也会先把这两样装上。这一步不需要 Docker、也不需要真钱包。

### 2. 配置资金

Predict-Raven 支持多种资金管理方式，包括社交登录（Google、TG）和 OKX Agentic Wallet。

Polymarket 钱包凭据可以从 polymarket.com → Settings → Export Wallet 拿到。新建 `.env.live-test`（参考 `.env.example` 模板），把这 4 个字段填进去：

- `PRIVATE_KEY` — 钱包私钥
- `FUNDER_ADDRESS` — Polymarket proxy wallet 地址
- `SIGNATURE_TYPE` — 签名类型（`0` 或 `1`）
- `CHAIN_ID` — `137`（Polygon mainnet）

填完后对 Agent 说：

```
我想配置钱包
```

预期：Agent 会读取你的 `.env.live-test`，确认钱包能连上 Polymarket，并打印钱包地址和当前余额。如果有字段没填，会立刻告诉你缺哪一个。

### 3. 获取推荐，不下单

对 Agent 说：

```
帮我推荐一些交易，不用下单
```

预期：Agent 会列出几个推荐交易，每条带上市场、方向、押注金额，以及它估算的胜率优势（edge）和资金回报效率。完整的推理过程也会落盘成 markdown，方便你回头复盘。这一步**不会真的下单**，所以钱包里没有 USDC 也能完整跑通。

### 4. 实盘交易

对 Agent 说：

```
实盘运行 pulse
```


预期：Agent 会按上一步的推荐真实下单，完成后告诉你成交了哪几笔、哪些被拒。

> 想看具体的 pnpm 命令、环境变量、归档目录，见 [docs/diagrams/dev-reference.md](docs/diagrams/dev-reference.md)。

## 架构总览

系统分为四层，数据从上到下流动：

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 · Research / Pulse                                 │
│  从 Polymarket 抓取市场列表，生成 Pulse 候选池              │
│  产物 → runtime-artifacts/reports/pulse/...                 │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2 · Decision / Runtime                               │
│  orchestrator 将 Pulse + 持仓上下文 → 结构化决策            │
│  主路径: pulse-direct │ legacy: provider-runtime            │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3 · Execution / Risk                                 │
│  服务层硬风控裁剪 → executor 下单 / 同步 / 止损 / flatten   │
│  FOK 市价单 · 单笔≤15% · 总敞口≤80% · 回撤≥30% halt       │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4 · State / Archive / UI                             │
│  DB / 本地状态 / runtime-artifacts 归档 / apps/web 展示     │
└─────────────────────────────────────────────────────────────┘
```

## Provider 切换

系统不绑定 AI 框架，Codex / Claude Code / OpenClaw 互相替换只需改一行：

```bash
AGENT_RUNTIME_PROVIDER=codex        # 可选：codex / claude-code / openclaw
```

自定义 Agent 通过 `<PROVIDER>_COMMAND` 配置模板命令，示例和占位符见 [.env.example](.env.example)。

## 决策引擎

当前有两种决策策略，由 `AGENT_DECISION_STRATEGY` 环境变量控制：

### pulse-direct（当前默认主路径）

```
Pulse markdown → 正则/表格解析 → PulseEntryPlan
                                        ↓
当前持仓 → reviewCurrentPositions → hold/reduce/close
                                        ↓
           monthlyReturn 排序（top 4）→ 20% batch cap
                                        ↓
                   composePulseDirectDecisions → TradeDecisionSet
```

不依赖外部 LLM 进程，直接从 Pulse 结构化章节提取开仓候选，按 `monthlyReturn = edge / monthsToResolution` 排序，取 top 4，单轮总下注不超过 bankroll 的 20%。

### provider-runtime（legacy 对照）

通过 spawn 外部进程（Codex / OpenClaw / Claude Code CLI），把 Pulse + 持仓上下文传给 LLM，解析 stdout 得到 `TradeDecisionSet`。仍可用，但不再是默认路径。

## 风控体系

**核心思路：风控不靠提示词，而是服务层硬规则。** 无论上游是哪种 provider、哪种决策策略，只要进入 orchestrator / executor 链路就受统一约束——Agent 的推理错误、异常数据、模型越权都无法绕过。三级防线 + Pulse 前置校验，全部在下单前裁剪；单个持仓越线强制止损；整体回撤越线直接 halt 且只有管理员能恢复（fail-closed）。

### 系统级

| 规则 | 阈值 | 效果 |
| --- | --- | --- |
| 组合回撤 halt | 净值相对高水位回撤 ≥ **30%** | 进入 `halted`，禁止新开仓 |
| 恢复 | 仅管理员 `resume` | fail-closed 设计 |

### 仓位级

| 规则 | 阈值 |
| --- | --- |
| 单仓止损 | 浮亏 ≥ **30%** |
| 止损优先级 | 高于常规策略动作 |

### 执行级

| 规则 | 默认值 |
| --- | --- |
| 下单类型 | **FOK** 市价单 |
| 单笔上限 | 资金的 **15%** |
| 最大总敞口 | 资金的 **80%** |
| 单事件敞口上限 | 资金的 **30%** |
| 最大并发持仓 | **22** 个 |
| 最小交易额 | **$5** |
| 最小有效额度 | 低于此直接丢弃 |

### Pulse 级

- 必须来自真实 `fetch_markets.py` 抓取，不再有 mock fallback
- Pulse 超龄（>120 分钟）或候选不足（<1 个）视为风险状态，本轮禁止新 `open`
- `open` 的 `token_id` 必须来自 Pulse candidates

完整规则见 [risk-controls.md](docs/risk-controls.md)。

## 环境变量

完整模板：[.env.example](.env.example)

分四组理解：

| 组 | 关键变量 | 说明 |
| --- | --- | --- |
| **共享** | `AUTOPOLY_EXECUTION_MODE` `DATABASE_URL` `REDIS_URL` `AUTOPOLY_LOCAL_STATE_FILE` | 执行模式（paper/live）、基础设施连接 |
| **Web** | `ADMIN_PASSWORD` `ORCHESTRATOR_INTERNAL_TOKEN` | 管理员鉴权 |
| **Executor** | `PRIVATE_KEY` `FUNDER_ADDRESS` `SIGNATURE_TYPE` `CHAIN_ID` | Polymarket 钱包与链配置 |
| **Orchestrator** | `AGENT_RUNTIME_PROVIDER` `AGENT_DECISION_STRATEGY` `PULSE_*` `CODEX_*` | Provider 选择、Pulse 抓取、风控参数 |

如果 Polymarket 凭据放在相邻仓库，可以设 `ENV_FILE=../pm-PlaceOrder/.env.aizen`。真实资金测试建议固定使用独立的 `.env.live-test`。

## 资金与账号配置

Polymarket 下单链路至少需要四个字段：

- `PRIVATE_KEY` — 钱包私钥（建议用 Polymarket 的代理钱包而不是主钱包）
- `FUNDER_ADDRESS` — Polymarket proxy wallet 地址（有 collateral 的那一个）
- `SIGNATURE_TYPE` — `0` 或 `1`，取决于钱包类型
- `CHAIN_ID` — `137`（Polygon mainnet）

建议按用途拆独立文件，都不进 git：

- `.env.live-test` — 真金实盘凭据
- `.env.<wallet-name>`（如 `.env.pizza`）— 按钱包名拆分，避免混用

Agent 每次 preflight 都会打印当前 `ENV_FILE`、钱包地址、collateral 金额，对不上立刻终止，避免错用钱包。

## 外部依赖仓库

`vendor/manifest.json` 锁定了以下外部仓库的具体 commit：

| 仓库 | 用途 |
| --- | --- |
| `polymarket-trading-TUI` | 交易终端和 CLOB 接线参考 |
| `polymarket-market-pulse` | Pulse 研究输入 |
| `alert-stop-loss-pm` | 止损逻辑参考 |
| `all-polymarket-skill` | Backtesting、Monitor、Resolution 等 skill 参考 |
| `pm-PlaceOrder` | 下单参考和本地凭据源 |

运行 `pnpm vendor:sync` 把它们同步到 `vendor/repos/`。纯 `pnpm build` 不需要 vendor，但跑 pulse / trial / live 链路前必须先 sync。

## 运行归档

所有运行产物写入 `runtime-artifacts/`（已 `.gitignore`），由 `ARTIFACT_STORAGE_ROOT` 控制根目录。

| 路径 | 内容 |
| --- | --- |
| `reports/pulse/YYYY/MM/DD/` | Pulse markdown + JSON |
| `reports/review\|monitor\|rebalance/` | 组合报告 |
| `reports/runtime-log/` | 决策运行时解释性日志 |
| `pulse-live/<timestamp>-<runId>/` | Pulse Live 运行产物 |
| `live-test/<timestamp>-<runId>/` | Stateful 运行产物（失败时含 `error.json`） |
| `checkpoints/trial-recommend/` | Paper 推荐断点续跑检查点 |
| `local/paper-state.json` | Paper 默认状态文件 |

失败归档（按 AGENTS 约定）写入 `run-error/`，包含失败阶段、核心上下文、原因摘要和下一步命令。

## 待办

- [ ] **高优 · 2026-04-21 记入** — Pulse 流程人为检查与优化（端到端：prompt / 技能文档、候选与归档质量、`Illustration/pulse-live-flow.md` 等与真实运行对齐）。

## 文档索引

- [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) — Agent 协作约定（必读）
- [risk-controls.md](docs/risk-controls.md) — 风控硬规则完整说明
- [.env.example](.env.example) — 环境变量模板
- [Illustration/onboarding-architecture.md](Illustration/onboarding-architecture.md) — 架构图 + 模块地图
- [Illustration/trading-modes-flowchart.md](Illustration/trading-modes-flowchart.md) — 下单模式流程图
- [Illustration/hostinger-vps-deploy-runbook.md](Illustration/hostinger-vps-deploy-runbook.md) — VPS 部署 runbook
- [Illustration/dev-reference.md](Illustration/dev-reference.md) — 命令速查 / 依赖矩阵 / 部署形态
- [progress.md](docs/progress.md) — 实现进度与运行数据快照
- [rough-loop.md](rough-loop.md) — Rough Loop 子系统入口

历史 handoff 和一次性探索稿归档在 [Wasted/README.md](Wasted/README.md)。
