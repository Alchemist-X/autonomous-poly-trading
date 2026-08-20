<p align="center">
  <img src="../assets/predict-raven.png" alt="predict-raven" width="220" />
</p>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

# Predict Raven（中文版）

> 英文主版见 [README.md](../README.md)。

最后更新：2026-08-20

---

**predict-raven** 是一个开源的 **forecasting agent 框架**：让 AI agent 自主评估真实世界事件发生的概率，持续收集并权衡证据，并据此行动。同一套 agent 内核目前驱动一族应用：

- **预测市场自主交易** — [Polymarket](https://polymarket.com) 上第一个自主、持续运行的交易 agent。它评估事件的 fair probability，与市场隐含赔率对比，在服务层硬风控约束下交易其中的 edge。
- **市场盲测公开预测** — 对 2026 世界杯全部 48 支球队给出透明、用 Brier 公开记分的概率，全程**不读取任何市场价格**。线上：**[forecasting-agent.com](https://forecasting-agent.com/world-cup)**，并在[预测效果页](https://forecasting-agent.com/world-cup/performance)公开记分。
- **托管 Forecasting Engine** — 同一套迭代式预测引擎的托管产品形态：交互式研究控制台 [/engine](https://forecasting-agent.com/engine)、Raven Delta 新闻影响引擎 [/delta](https://forecasting-agent.com/delta)，以及 forecast API + MCP 服务（概率 + 分析思路 + 证据，输出 JSON / 纯文字 / PDF）。详见下文 [Forecasting Engine（托管服务）](#forecasting-engine托管服务)。
- **自主模拟盘交易** — 交易 agent 的纯模拟孪生体，在云端无人值守运行：每日 3 次市场盲测持仓评估、净 edge 退出、每日自省并给出相对市场的 Brier 技巧分。详见下文 [自主模拟盘交易](#自主模拟盘交易纯模拟)。

实盘 / 预测公开：

- **世界杯预测（市场盲测）**：[forecasting-agent.com/world-cup](https://forecasting-agent.com/world-cup) · [预测效果](https://forecasting-agent.com/world-cup/performance)
- **Forecasting Engine 控制台**：[forecasting-agent.com/engine](https://forecasting-agent.com/engine)（浏览公开；发起新预测需邀请码）
- **Raven Delta 新闻影响引擎**：[forecasting-agent.com/delta](https://forecasting-agent.com/delta)（邀请码门）
- **模拟盘复盘页**：[forecasting-agent.com/live-predict-raven](https://forecasting-agent.com/live-predict-raven)（邀请码门，实时 VM 快照）
- **交易决策记录 / 净值曲线**：[autopoly-pizza-spectator.vercel.app](https://autopoly-pizza-spectator.vercel.app)
- **链上持仓 / 成交（Polymarket profile）**：[`0x6664...614e`](https://polymarket.com/profile/0x6664e32f79aee42639f73633e40b5a842b07614e)

## 系统设计

交易侧围绕 **Market Pulse** 这一核心组件设计：让 AI 自主评估事件发生的概率，动态地从信息源收集证据，将其与市场隐含的赔率对比，综合交易的 edge 和资金回报效率给出交易指示。

同一套证据收集内核已抽成独立引擎包（[`packages/forecast-engine`](../packages/forecast-engine)），也能以**市场盲测**模式运行——完全不读取任何赔率，用于公开的世界杯预测产品（见下文 [市场盲测预测](#市场盲测预测)）和托管的 Forecasting Engine 各产品面。

### 为什么让 Agent 来做这件事

1. **在复杂推理能力上超过人类** — Agent 事实上在复杂任务上的推理能力已经接近或者超过人类水平。更多时候，人类的优势主要在于更好的信息源而不是推理，但这一差距可以通过工程能力弥合。核心分析能力已经到位。
2. **覆盖面广且时效性强** — Agent 能 7×24 小时同时监控数千个市场，发现任何个人无法跟踪的定价偏差。在新闻爆发时，Agent 能做到秒级响应，人类则至少需要 3 分钟以上，像这样的交易机会在无数个市场都有出现。
3. **预测市场仍处于蓝海** — 政治和科技预测市场中，多数参与者缺乏清晰的定价模型，且普遍畏惧库存管理和逆向选择风险。系统化的 Agent 交易在这些领域面临的竞争极少。哪怕在体育市场，在 moneyline 以外也有很多市场。

### 核心定位

- Agent 下单、决策思路全部在网页上公开
- Agent 在云端持续运行，而非本地脚本临时执行，不需要人类介入
- 已使用 `@polymarket/clob-client-v2`，抵押品默认 pUSD；V2 切换日 2026-04-28 11:00 UTC，cutover runbook 见 [`internal/plan/2026-04-28-v2-cutover-runbook.md`](internal/plan/2026-04-28-v2-cutover-runbook.md)

## 市场盲测预测

同一套 agent 还驱动一个与交易侧刻意解耦的**概率研究**产品：预测事件时**不读取任何博彩或预测市场价格**，因此输出是独立的概率估计，而不是对市场共识的复述。

2026 世界杯是它的公开展示——对全部 48 支球队的 87 个问题（冠军、小组头名、小组赛、淘汰赛晋级）给出预测：

- **统计先验**：实时 Elo 评级进入 Davidson 三路模型算单场；晋级 / 夺冠类问题在官方对阵树上跑 10 万次蒙特卡洛模拟。
- **贝叶斯更新**：关键证据（伤停、首发、状态、场地 / 海拔 / 天气）折算成对先验的有界修正——单场最多 ±8 个百分点，且没有来源就不动数。
- **公开记分**：每条预测在比赛结算后用 Brier 公开记分，错了也照样留档。[预测效果页](https://forecasting-agent.com/world-cup/performance)对盲测预测做*事后*基准评测——以预测时刻的 Polymarket 隐含概率为基线，给出 Mock PNL、相对市场的 Brier 技巧分、校准（ECE）与命中率，覆盖小组赛与淘汰赛 32 强两个阶段。

市场数据仅用于事件结构与结算映射（slug / conditionId / 结算规则）；价格字段在写缓存时就被剥离。代码位于 `scripts/world-cup/`、`packages/sports-data/`、`packages/sports-model/`、`apps/web/app/world-cup/`。这是概率研究，不构成投注建议。

## Forecasting Engine（托管服务）

证据收集内核已打包成可复用的**迭代式事件预测引擎**（[`packages/forecast-engine`](../packages/forecast-engine)）：给定一个二元问题，它先做事件 framing，再跑若干轮带引用来源的证据收集，最终产出可追溯的概率和一份结论先行的报告。正确性护栏内建其中——framing 审计、模型自估先验、考虑独立性的证据聚合（同源簇折扣）、强制反证轮、来源核验直接影响权重，以及概率打到引擎上下限时的显式 `saturated` 状态。市场盲测模式（`FORECAST_MARKET_BLIND=1`）在 prompt、搜索、证据加权三个环节全面禁用博彩市场价格。

三个托管产品面在云端 VM 上运行这套引擎，统一挂在 [forecasting-agent.com](https://forecasting-agent.com) 下：

| 产品面 | 是什么 | 代码 |
| --- | --- | --- |
| [`/engine`](https://forecasting-agent.com/engine) | 交互式研究控制台（EN / 中文）——逐步看一次预测如何展开：计划清单、证据卡、判决档案 | `apps/raven` |
| [`/delta`](https://forecasting-agent.com/delta) | **Raven Delta** 新闻影响引擎——粘贴一条新闻，得到关注度判定（含全网首现时间）、0–5 只受影响美股（方向 / 幅度 / 置信度）和操作计划；邮件 + WebSocket 推送 | `apps/raven-delta` |
| Forecast API + MCP | `POST /v1/forecasts {question}` → 概率 + 分析思路 + 证据，输出 JSON、纯文字或 PDF 档案；同时以 MCP 工具形态暴露（`forecast_start` / `forecast_status` / `forecast_result`） | `services/forecast-api` |

引擎运行有计量：每日配额 + 文件事件库邀请码（每码可设次数上限并计量用量）。

## 自主模拟盘交易（纯模拟）

交易 agent 的**纯模拟**孪生体（[`services/paper-agent`](../services/paper-agent)）在同一台 VM 上无人值守地跑一个 $10k 模拟盘——零私钥、零下单端点，唯一网络面是公开市场数据的只读请求：

- **市场盲测评估，每日 3 次** — 每个持仓由独立引擎进程重新预测，进程只看到市场问题和结算规则——不知道持仓、成本价、盘口。
- **净 edge 退出 + 模型无关止损** — 扣费后 edge 转负即平仓；硬止损优先级压过模型。饱和的赢面仓位（价格钉死在持仓有利侧的上限）持有到结算，而不是在天花板上卖出。
- **拟真成交** — 模拟订单按真实盘口逐档成交（真实滑点），并按逐市场 CLOB 实时费率付费，入场费计入回合盈亏；退出用 50% 市价 + 50% maker 限价的混合执行。
- **每日反思** — agent 每天写一份自省报告：退出决策的反事实 α、Brier 校准，以及**相对市场的 Brier 技巧分**——持续回答"agent 到底有没有跑赢市场"。

模拟盘在 [forecasting-agent.com/live-predict-raven](https://forecasting-agent.com/live-predict-raven) 公开复盘（邀请码门）：请求时实时拉取 VM 快照、权益曲线、已平仓回合表、生效中的运行参数。

## 快速开始

通过 AI Agent（Claude Code / Codex / OpenClaw）自然语言快速开始，不需要记命令。

> **前置**：你需要先装好 [Claude Code](https://claude.com/claude-code) 或 [Codex CLI](https://github.com/openai/codex) 任一个，`git clone` 本仓库后在仓库目录里启动它，再开始下面 4 步。

### 1. 准备环境

对 Agent 说：

```
帮我装好 predict-raven 需要的依赖
```

预期：Agent 会跑 `pnpm install` + `pnpm build`，告诉你环境是否就绪。如果你电脑上还没装 Node.js / pnpm，它也会先把这两样装上。这一步不需要 Docker、也不需要真钱包。

### 2. 配置资金

Predict-Raven 支持多种资金管理方式，包括社交登录（Google、TG）和 OKX Agentic Wallet。

Private-key 模式下，Polymarket 钱包凭据可以从 polymarket.com → Settings → Export Wallet 拿到。新建 `.env.live-test`（参考 `.env.example` 模板），把这 5 个字段填进去：

- `WALLET_PROVIDER=private-key`
- `PRIVATE_KEY` — 钱包私钥
- `FUNDER_ADDRESS` — Polymarket proxy wallet 地址
- `SIGNATURE_TYPE` — 签名类型（`0` 或 `1`）
- `CHAIN_ID` — `137`（Polygon mainnet）

OKX Agentic Wallet 模式不需要 `PRIVATE_KEY`，但要先用 `onchainos wallet login/verify` 登录，并设置 `WALLET_PROVIDER=onchainos`、`FUNDER_ADDRESS`（有 collateral/allowance 的 Polymarket deposit/proxy wallet）、`SIGNATURE_TYPE=3`、`CHAIN_ID=137`。

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

> 想看具体的 pnpm 命令（`forecast:*`；旧 `pulse:*` 名保留为兼容别名）、环境变量、归档目录，见 [diagrams/dev-reference.md](diagrams/dev-reference.md)。

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

自定义 Agent 通过 `<PROVIDER>_COMMAND` 配置模板命令，示例和占位符见 [.env.example](../.env.example)。

## 能力档位 — Norns（Urd / Verdandi / Skuld）

模型能力按北欧命运三女神命名为三档，"用哪个模型"从散落在各处 env 的裸 model id 变成一个好记的选择：

| 档位 | Norn | 用途 | Anthropic | OpenAI |
| --- | --- | --- | --- | --- |
| **Urd** | 过去 / 起源 | 轻快——预筛、高频调用 | `claude-haiku-4-5-20251001` | `gpt-4o-mini` |
| **Verdandi** | 现在 | 均衡默认档 | `claude-sonnet-4-6` | `gpt-4o` |
| **Skuld** | 未来 | 旗舰——最深推理、最高质量 | `claude-opus-4-8` | `gpt-4o` |

这是一层轻薄的**别名 / 映射层**（`@autopoly/norns`），不是重写。任何读 model id 的地方都可以改用档位名，按 provider 家族解析成具体模型。**裸 model id 和空默认值原样透传**，所有既有配置行为不变——只有显式使用档位名时才生效。每档还带软深度参数（token 预算、证据/轮次数），驱动方可按档缩放。

适用范围：

- **交易引擎 / provider-runtime**：`CODEX_MODEL` / `CLAUDE_CODE_MODEL` / `OPENCLAW_MODEL` 接受档位名（如 `CLAUDE_CODE_MODEL=skuld`），按 provider 家族解析（codex → openai，claude-code / openclaw → anthropic）。

档位表的单一事实源在 [`packages/norns/src/index.ts`](../packages/norns/src/index.ts)；所有 model id 都可用 env 覆盖。

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

完整规则见 [risk-controls.md](risk-controls.md)。

## 环境变量

完整模板：[.env.example](../.env.example)

分四组理解：

| 组 | 关键变量 | 说明 |
| --- | --- | --- |
| **共享** | `AUTOPOLY_EXECUTION_MODE` `DATABASE_URL` `REDIS_URL` `AUTOPOLY_LOCAL_STATE_FILE` | 执行模式（paper/live）、基础设施连接 |
| **Web** | `ADMIN_PASSWORD` `ORCHESTRATOR_INTERNAL_TOKEN` | 管理员鉴权 |
| **Executor** | `WALLET_PROVIDER` `PRIVATE_KEY` `FUNDER_ADDRESS` `SIGNATURE_TYPE` `CHAIN_ID` `ONCHAINOS_BIN` | Polymarket 钱包与链配置 |
| **Orchestrator** | `AGENT_RUNTIME_PROVIDER` `AGENT_DECISION_STRATEGY` `PULSE_*` `CODEX_*` | Provider 选择、Pulse 抓取、风控参数 |

如果 Polymarket 凭据放在相邻仓库，可以设 `ENV_FILE=../pm-PlaceOrder/.env.aizen`。真实资金测试建议固定使用独立的 `.env.live-test`。

## 资金与账号配置

Polymarket 下单链路有两种 signer 模式。

Private-key 模式至少需要：

- `WALLET_PROVIDER=private-key`
- `PRIVATE_KEY` — 钱包私钥（建议用 Polymarket 的代理钱包而不是主钱包）
- `FUNDER_ADDRESS` — Polymarket proxy wallet 地址（有 collateral 的那一个）
- `SIGNATURE_TYPE` — `0` 或 `1`，取决于钱包类型
- `CHAIN_ID` — `137`（Polygon mainnet）

OKX Agentic Wallet / OnchainOS 模式至少需要：

- `WALLET_PROVIDER=onchainos`（`okx-agentic` 仍作为兼容别名）
- `ONCHAINOS_BIN` — 默认 `onchainos`
- `FUNDER_ADDRESS` — Polymarket deposit/proxy wallet 地址（持有 collateral/allowance）
- `SIGNATURE_TYPE=3` — deposit wallet / POLY_1271
- `CHAIN_ID=137`

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
| `world-cup/` | 市场盲测预测归档、事件清单、Elo / 蒙特卡洛骨干 |
| `paper-agent/` | 模拟盘账本、dossier、每日反思报告 |
| `raven-delta/runs/` | Raven Delta 新闻影响分析归档 |
| `local/paper-state.json` | Paper 默认状态文件 |

失败归档（按 AGENTS 约定）写入 `run-error/`，包含失败阶段、核心上下文、原因摘要和下一步命令。

## 文档索引

- [AGENTS.md](../AGENTS.md) / [CLAUDE.md](../CLAUDE.md) — Agent 协作约定（必读）
- [risk-controls.md](risk-controls.md) — 风控硬规则完整说明
- [.env.example](../.env.example) — 环境变量模板
- [diagrams/onboarding-architecture.md](diagrams/onboarding-architecture.md) — 架构图 + 模块地图
- [diagrams/trading-modes-flowchart.md](diagrams/trading-modes-flowchart.md) — 下单模式流程图
- [diagrams/dev-reference.md](diagrams/dev-reference.md) — 命令速查 / 依赖矩阵 / 部署形态
- [internal/plan/2026-06-09-world-cup-special-plan.md](internal/plan/2026-06-09-world-cup-special-plan.md) — 世界杯预测产品计划

历史 handoff 和一次性探索稿归档在 [archive/README.md](archive/README.md)。
