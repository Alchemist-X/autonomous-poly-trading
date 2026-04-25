# 进度记录

英文版见 [progress.en.md](progress.en.md)。

最后更新：2026-03-14

## 当前状态

这个仓库已经具备一个 v1 基础版本，目标是支撑“云端自主运行 + 网站围观 + 服务层硬风控”的 Polymarket 交易系统。

目前代码库已经完成 monorepo 结构搭建，包含：

- `apps/web`
  - 面向 Vercel 的围观站和管理员页面
- `services/orchestrator`
  - 调度、风控、任务编排、管理员动作
- `services/executor`
  - Polymarket 执行、同步、live ops
- `packages/contracts`
  - 决策结构和内部契约 schema
- `packages/db`
  - 数据库 schema、查询、种子、迁移
- `vendor`
  - 外部仓库锁定清单

## 已实现

### 1. 网站侧

公开页面已经具备：

- 总览页
- 持仓页
- 成交页
- runs 列表页
- run 详情页
- reports 页
- backtests 页

管理员页面已经具备以下控制项：

- `pause`
- `resume`
- `run-now`
- `cancel-open-orders`
- `flatten`

### 2. 数据模型

数据库中已经建立核心表：

- `agent_runs`
- `agent_decisions`
- `execution_events`
- `positions`
- `portfolio_snapshots`
- `risk_events`
- `resolution_checks`
- `artifacts`
- `system_state`

### 3. 后端服务基础

已经完成：

- orchestrator 基础服务
- executor 基础服务
- 共享 contracts
- 风控逻辑基础实现
- vendor 同步脚本
- 数据库种子和查询层
- `codex/openclaw` provider runtime 配置骨架
- 真正的 pulse 抓取、存储和命名空间落盘
- 试运行入口 `pnpm trial:run`

### 4. 风控规则

当前已落地的硬规则包括：

- 单仓 `30%` 止损
- 总资金相对高水位 `20%` 回撤停机
- pulse 风险标记存在时禁止新开仓
- `open` 只能使用 pulse candidates 中的 `token_id`
- `hold/close/reduce` 只能作用于当前持仓
- 统一风险文档已写入 [risk-controls.md](risk-controls.md)

### 5. 凭据加载

已经支持从相邻仓库自动发现 `.env.aizen`，用于本地开发环境连接真实 Polymarket 钱包。

### 6. 实盘测试工具

已经具备：

- 余额检查脚本
- 市场与盘口检查脚本
- 不超过 `$1` 的 capped live trade 脚本

### 7. E2E TDD 工作区

已经新增 `E2E Test Driven Development/`，包含：

- 双语总文档
- `suite` 独立测试 package
- local-lite fake orchestrator
- 动态 mock state 驱动
- Playwright 录屏与 trace
- remote-real 场景入口

## 已验证

目前已经验证通过的内容：

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- 成功发现真实钱包环境文件 `../pm-PlaceOrder/.env.aizen`
- 成功读取真实 USDC 余额
- 成功提交一次不超过 `$1` 的真实下单
- 成功从 Polymarket 账户状态中读回该笔仓位
- 成功完成一次 `codex` trial run，使用真实 pulse 抓取和结构化决策输出

## 最近一次真实测试单

最近一次小额实盘测试结果如下：

- 市场：`tur-kas-eyu-2026-03-15-kas`
- 动作：`BUY NO`
- 请求金额：`$1`
- 订单状态：`matched`
- 订单 ID：`0x4ec470917138126104a097a3fdaa506d61860e15c1dad9c2d21bbaf5678f1921`

回读到的仓位信息：

- Outcome：`No`
- 持仓数量：`2.040815`
- 平均成本：`0.49`

## 最近一次 Codex 试运行

本次试运行使用：

- provider：`codex`
- skill：`polymarket-market-pulse`
- locale：`zh`
- pulse：真实 `fetch_markets.py` 抓取
- mock pulse fallback：已关闭

本次试运行结果：

- pulse candidates：`12`
- pulse risk flags：`0`
- 保留决策数：`5`
- 其中 `hold`：`3`
- 其中 `open`：`2`

本次落盘产物：

- Pulse Markdown：`reports/pulse/2026/03/14/pulse-20260314T015337Z-codex-full-99fcf009-a9ac-42e4-bae9-222c894d7d77.md`
- Pulse JSON：`reports/pulse/2026/03/14/pulse-20260314T015337Z-codex-full-99fcf009-a9ac-42e4-bae9-222c894d7d77.json`
- Runtime Log：`reports/runtime-log/2026/03/14/runtime-log-20260314T015454Z-codex-full-99fcf009-a9ac-42e4-bae9-222c894d7d77.md`

## 在真实测试中修掉的问题

这次实盘测试过程中，已经顺手修掉几个关键问题：

- CLOB 认证优先尝试 `deriveApiKey()`，再回退到 `createOrDeriveApiKey()`
- 订单簿读取不再盲信数组第一档，而是显式计算真实 best bid / best ask
- 市场筛选优先使用更合适的 `markets` 接口做预筛选
- live check 支持显式传入 `--slug`，便于安全地指定目标市场

## 还没完成的部分

目前还缺这些关键环节：

- 没有完成 Docker 运行态验证，因为当前机器未安装 Docker
- `codex` 的完整生产决策闭环还没彻底接通
- `openclaw` 运行接口已接好，但本机没有 CLI，尚未完成试跑
- 外部 vendor 仓库虽然已经锁定，但很多能力还没有真正接入完整调度链路
- Vercel 和云主机生产部署还没完成

## 下一步优先级

1. 打通真实 `codex` 决策闭环
2. 把 market pulse / backtesting / resolution tracking 真正接入 orchestrator
3. 完成 `openclaw` CLI 接入与同构试运行
4. 部署 Postgres、Redis、orchestrator、executor
5. 把 web 部署到 Vercel
6. 在扩大量化范围前，先完成更长时间的 dry-run
