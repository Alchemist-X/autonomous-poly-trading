# 0317 远程部署 Handoff

英文版见 [handoff-0317.en.md](handoff-0317.en.md)。

最后更新：2026-03-17

## 1. 这份 handoff 的目标

这份文档是写给一个“完全不了解本仓库、不了解 skill、也不了解当前进度”的远程 Agent。

目标不是继续本地探索，而是让它在远程服务器上尽快完成下面这件事：

- 把这个仓库拉下来并 build 成功
- 先跑通一个每天自动执行的 Polymarket 自主交易闭环
- 再逐步升级到“自主调整持仓 + 监控 + 止损”的完整路径

当前主诉求可以理解成 3 个模块：

1. `Pulse`
   - 核心输入源
   - 负责发现新的推荐
2. `Market Monitor / Portfolio Monitor`
   - 检查当前持仓是否异常、是否值得继续持有、是否需要调仓
   - 推理逻辑尽量复用 pulse
3. `Stop Loss / 预警`
   - 盯数据源变化与持仓风险
   - 需要时触发减仓/平仓/停机

## 2. 先说结论：现在最稳的远程接手路径

如果远程 Agent 的目标是“尽快在服务器上先跑起来”，推荐顺序是：

1. 先部署 `pulse:live`
   - 它不依赖本地 `Postgres` / `Redis`
   - 最容易在远程机上闭环
   - 适合先做每日定时任务
2. 第一阶段先用 `--recommend-only`
   - 验证 pulse、provider、归档、日志、推荐质量
   - 不直接碰真实下单
3. 确认推荐稳定后，再去掉 `--recommend-only`
   - 让它开始真实执行
4. 如果目标是“自动调仓 + 自动止损 + 完整 portfolio monitor”
   - 不能停留在 pulse-live
   - 需要继续打通 `orchestrator + executor + Postgres + Redis` 的完整服务路径

原因很简单：

- `pulse:live` 是当前最容易远程 build 和跑通的链路
- 但它现在还不是“完整自主调仓系统”
- 当前 `pulse-direct` 会对已有仓位默认输出 `hold`，并明确写着“除非补 dedicated exit engine，否则不主动调整已有仓位”
- 当前真正的 `sync portfolio + stop-loss + snapshot` 在 `executor queue worker` 这条完整服务链里

所以：

- 如果你只想先实现“每天自动跑一次，有推荐就执行”，从 `pulse:live` 开始
- 如果你要的是“真的会自主管理老仓位”，最终必须推进完整服务化路径

## 3. 当前仓库状态回看

当前 Git 基线：

- 本地 `HEAD` / `origin/main`：`b2e87ff`
- commit message：`fix: surface pulse-live execution mode and strategy`

当前仓库已经具备这些基础能力：

- `pnpm` monorepo 已搭好
- `apps/web`、`services/orchestrator`、`services/executor`、`services/rough-loop` 都存在
- provider runtime 已经接成 `codex | openclaw`
- pulse 已经不是 mock fallback，而是真实抓取并落盘
- 真实小额下单已经成功做过一次
- `pulse:live` 已经能生成 preflight / recommendation / execution summary 归档

当前不要误判的点：

- `rough-loop` 是代码任务循环，不是生产交易主链路
- `rough-loop` 文档里也明确说了默认不处理真实交易、生产部署和私钥操作
- 因此远程交易部署不要把 `rough-loop` 当成主入口

## 4. 已验证结果

### 4.1 基础校验

根据 [progress.md](progress.md) 与当前仓库记录，已经验证通过过：

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

另外，2026-03-17 又完成了两轮 Rough Loop 回归任务：

- `RL-002`
  - `services/orchestrator/src/runtime/provider-runtime.test.ts` 通过
- `RL-003`
  - `scripts/pulse-live.test.ts` 已覆盖 `execution mode` / `decision strategy` 输出契约

### 4.2 真实下单结果

最近一次明确记下来的真实小额单：

- 市场：`tur-kas-eyu-2026-03-15-kas`
- 动作：`BUY NO`
- 请求金额：`$1`
- 状态：`matched`
- 订单 ID：`0x4ec470917138126104a097a3fdaa506d61860e15c1dad9c2d21bbaf5678f1921`

对应仓位已成功回读：

- Outcome：`No`
- 持仓数量：`2.040815`
- 平均成本：`0.49`

### 4.3 最近一次 pulse-live 远程友好闭环

`2026-03-17` 的一轮 `pulse:live` 归档显示：

- runId：`8c1f79e9-37f3-4706-8009-4dd6924def96`
- 归档目录：
  - `runtime-artifacts/pulse-live/2026-03-17T024012Z-8c1f79e9-37f3-4706-8009-4dd6924def96/`
- preflight：
  - `executionMode=live`
  - `collateralBalanceUsd=41.7019`
  - `remotePositionCount=12`
  - `decisionStrategy=pulse-direct`
- recommendation：
  - pulse markdown 已生成
  - pulse json 已生成
  - runtime log 已生成
- execution summary：
  - 本轮 `executed=[]`
  - 也就是流程已跑通，但这轮没有真的发出新订单

这个结果非常重要：

- 它说明 pulse-live 路径的”拉取远端持仓 -> 跑 pulse -> 生成建议 -> 归档”已经能闭环
- 但它不代表“当前策略已经会自动调仓”

### 4.4 最近一次 full live 路径失败结果

`2026-03-16` 的 `live:test` 失败归档显示：

- 目录：
  - `runtime-artifacts/live-test/2026-03-16T092641Z-pending/`
- 错误摘要：
  - `Failed query: select 1`
  - 后续 `halt write failed`

这代表：

- 带 `DB/Redis` 的完整 live 路径还没有在当前环境里完成稳定闭环验证
- 远程 Agent 不应该直接假设“全服务生产路径已经 ready”

## 5. 当前能力边界

这部分一定要看清楚，否则远程 Agent 很容易部署错方向。

### 5.1 已经有的

- `Pulse`
  - 已接真实抓取
  - 已有统一归档
- `provider-runtime`
  - 已能输出结构化 `TradeDecisionSet`
- `pulse-direct`
  - 已能直接把 pulse 报告转成可执行决策
- `pulse:live`
  - 已能在无 DB/Redis 情况下直接跑一轮 live 流程
- `executor sync + stop-loss`
  - 已存在于 queue worker 中
- `drawdown halt`
  - 已存在于完整服务路径中

### 5.2 还没有完全打通的

- `pulse-direct` 目前会对现有仓位默认给 `hold`
  - 这不是 bug，是当前实现边界
  - 也就是它还没有 dedicated exit / rebalance engine
- `Portfolio Monitor / Review / Rebalance`
  - 目前更多是“能力分散在代码里”
  - 报告设计文档已写，但未完整接成独立产物链路
- `live:test`
  - 全服务闭环还没完成最终验证
- `openclaw`
  - 接口在，但没有本机完整试跑记录

### 5.3 这意味着什么

如果远程目标只是：

- 每天自动跑
- 看有没有 pulse 推荐
- 有机会就自动开新仓

那可以先用：

- `AGENT_DECISION_STRATEGY=pulse-direct`
- `pnpm pulse:live`

如果远程目标是：

- 自动复审已有仓位
- 自动 `reduce / close / rotate`
- 自动 stop-loss
- 自动 portfolio snapshot / halt / sync

那必须继续推进：

- `provider-runtime` 的真实持仓复审能力
- `executor queue worker` 这条完整服务路径
- `orchestrator + executor + DB + Redis` 常驻部署

## 6. 用户描述的三个模块，对应到当前代码哪里

### 6.1 Pulse

主入口：

- [services/orchestrator/src/pulse/market-pulse.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/pulse/market-pulse.ts)
- [services/orchestrator/src/pulse/full-pulse.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/pulse/full-pulse.ts)

### 6.2 Market Monitor / Portfolio Monitor

当前真实落点不是独立服务，而是：

- [services/executor/src/workers/queue-worker.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/workers/queue-worker.ts)

里面已经包含：

- sync remote positions
- snapshot
- drawdown halt
- stop-loss 卖出

另外，产品/归档设计说明已经写在：

- [Illustration/portfolio-ops-report-design.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/Illustration/portfolio-ops-report-design.md)

### 6.3 Stop Loss / 预警

当前直接执行 stop-loss 的代码在：

- [services/executor/src/workers/queue-worker.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/workers/queue-worker.ts)
- [services/executor/src/lib/risk.test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/lib/risk.test.ts)

### 6.4 决策 runtime

当前主要有两条：

- [services/orchestrator/src/runtime/pulse-direct-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/pulse-direct-runtime.ts)
- [services/orchestrator/src/runtime/provider-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/provider-runtime.ts)

建议理解为：

- `pulse-direct`
  - 更容易先跑起来
  - 但对已有仓位更保守
- `provider-runtime`
  - 理论上更适合做 review / reduce / close / rebalance
  - 但真实生产闭环验证还不够

## 7. 远程服务器部署建议

### 7.1 方案 A：先落最小可用每日自动交易

适用场景：

- 先要远程每日自动跑起来
- 先不要引入 Postgres / Redis
- 先接受“推荐为主，调仓能力有限”

远程机前置要求：

- Node.js `20+`
- `corepack`
- `pnpm@10.28.1`
- `git`
- 可用的 `codex` CLI
- 机器能访问 Polymarket

建议命令：

```bash
git clone https://github.com/Alchemist-X/autonomous-poly-trading.git
cd autonomous-poly-trading

corepack enable
corepack prepare pnpm@10.28.1 --activate

cp .env.example .env
pnpm install
pnpm vendor:sync

pnpm typecheck
pnpm test
pnpm build
```

然后准备两层环境变量：

1. 根 `.env`
   - 放共享非敏感配置
2. 独立钱包 env 文件
   - 不提交 Git
   - 通过 `ENV_FILE=/secure/path/wallet.env` 指定

远程初始建议值：

```bash
AUTOPOLY_EXECUTION_MODE=live
AGENT_RUNTIME_PROVIDER=codex
AGENT_DECISION_STRATEGY=pulse-direct
PULSE_SOURCE_REPO=all-polymarket-skill
PULSE_SOURCE_REPO_DIR=vendor/repos/all-polymarket-skill
CODEX_SKILL_ROOT_DIR=vendor/repos/all-polymarket-skill
CODEX_SKILL_LOCALE=zh
CODEX_SKILLS=polymarket-market-pulse,portfolio-review-polymarket,poly-position-monitor,poly-resolution-tracking,api-trade-polymarket
PULSE_LIVE_MAX_BUY_TOKENS=1
PULSE_LIVE_MIN_TRADE_USD=0.01
PROVIDER_TIMEOUT_SECONDS=0
PULSE_REPORT_TIMEOUT_SECONDS=0
```

第一次只跑推荐：

```bash
ENV_FILE=/secure/path/pizza.env pnpm pulse:live -- --recommend-only
```

确认以下产物存在后，再决定是否开启真实执行：

- `runtime-artifacts/pulse-live/<timestamp>-<runId>/preflight.json`
- `runtime-artifacts/pulse-live/<timestamp>-<runId>/recommendation.json`
- `runtime-artifacts/reports/pulse/YYYY/MM/DD/*.md`
- `runtime-artifacts/reports/pulse/YYYY/MM/DD/*.json`
- `runtime-artifacts/reports/runtime-log/YYYY/MM/DD/*.md`

确认无误后，开始真实执行：

```bash
ENV_FILE=/secure/path/pizza.env pnpm pulse:live
```

### 7.2 方案 B：如果要每天自动运行

对于 pulse-live 路径，推荐直接用系统 cron 或 systemd timer。

最简单的 cron 示例：

```cron
15 9 * * * cd /srv/autonomous-poly-trading && ENV_FILE=/secure/path/pizza.env pnpm pulse:live >> /var/log/autopoly-pulse-live.log 2>&1
```

如果要先观察 3 到 7 天，再放开真实下单，可以先用：

```cron
15 9 * * * cd /srv/autonomous-poly-trading && ENV_FILE=/secure/path/pizza.env pnpm pulse:live -- --recommend-only >> /var/log/autopoly-pulse-live.log 2>&1
```

### 7.3 方案 C：如果目标是完整自主调仓系统

当目标升级为：

- 自动调仓
- 自动 stop-loss
- 自动 sync
- 自动 snapshot
- halted 状态管理
- 站内可视化

远程应切换到常驻服务部署，而不是每天只跑一次脚本。

建议形态：

- `apps/web`
  - 部署到 Vercel
- `services/orchestrator`
  - 常驻在云主机
- `services/executor`
  - 常驻在同一台云主机
- `Postgres`
  - 托管库或 Docker
- `Redis`
  - 托管或 Docker

此时调度方式不是外部 cron 调 `live:test`，而是：

- 常驻跑 `orchestrator`
- 由 `AGENT_POLL_CRON`、`BACKTEST_CRON`、`SYNC_INTERVAL_SECONDS` 等内部调度
- 常驻跑 `executor` 处理 queue 和 sync/stop-loss

但注意：

- 当前这条完整路径还没有做完最终远程稳定性验证
- 不要在没有单独 smoke 验证的情况下直接把真实资金长期托管给它

## 8. 远程 Agent 最容易踩的坑

### 8.1 不要把 rough-loop 当交易入口

它是代码任务循环，不是生产交易 daemon。

### 8.2 `live:test` 和 `pulse:live` 不是一个东西

- `live:test`
  - 依赖 DB/Redis
  - preflight 更严格
  - 当前最新记录里没有完成稳定闭环
- `pulse:live`
  - 不依赖 DB/Redis
  - 当前更适合作为远程第一阶段

### 8.3 当前钱包如果已经有仓位，`live:test` 会被 preflight 拦住

`live:test` 的 preflight 要求：

- 远端地址没有 open positions
- 数据库里也没有本地 open positions
- `INITIAL_BANKROLL_USD=20`
- `MAX_TRADE_PCT<=0.1`
- `MAX_EVENT_EXPOSURE_PCT<=0.3`

而最新 pulse-live 归档显示当前测试钱包有：

- `remotePositionCount=12`

所以：

- 如果远程要测 `live:test`，请换干净钱包，或先把仓位清空并同步本地状态

### 8.4 当前 GitHub 仓库不一定包含本地未提交改动

当前工作树里还有未提交内容，例如：

- `Illustration/portfolio-ops-report-design.md`
- `Illustration/portfolio-ops-report-design.en.md`
- `services/executor/src/workers/queue-worker.test.ts`

如果远程 Agent 是直接从 GitHub clone：

- 它默认拿不到这些本地未提交文件
- 如果这些文件也需要进入远程部署上下文，请先 push

## 9. 推荐的远程接手顺序

1. clone 仓库并确认当前 commit 基线
2. `pnpm install && pnpm vendor:sync`
3. 配置 `codex` CLI 与独立钱包 env
4. 先跑：
   - `ENV_FILE=/secure/path/pizza.env pnpm pulse:live -- --recommend-only`
5. 检查归档、推荐质量、pulse 产物和 runtime log
6. 再跑：
   - `ENV_FILE=/secure/path/pizza.env pnpm pulse:live`
7. 连续观察数天
8. 如果确认要上“自动调仓/止损/监控”
   - 切换到完整服务部署路线
   - 优先补齐 `provider-runtime` 与 portfolio monitor / review / rebalance 的真实回归验证

## 10. 远程 Agent 第一个应该读的文件

如果远程 clone 后发现其中某些文档不存在，先回看上面的“GitHub 不一定包含本地未提交改动”提醒，不要直接假设路径写错了。

- [README.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/README.md)
- [progress.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/progress.md)
- [risk-controls.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/risk-controls.md)
- [Illustration/portfolio-ops-report-design.md](/Users/Aincrad/dev-proj/autonomous-poly-trading/Illustration/portfolio-ops-report-design.md)
- [services/orchestrator/src/runtime/pulse-direct-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/pulse-direct-runtime.ts)
- [services/orchestrator/src/runtime/provider-runtime.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/orchestrator/src/runtime/provider-runtime.ts)
- [services/executor/src/workers/queue-worker.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/services/executor/src/workers/queue-worker.ts)
- [scripts/pulse-live.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/scripts/pulse-live.ts)
- [scripts/live-test.ts](/Users/Aincrad/dev-proj/autonomous-poly-trading/scripts/live-test.ts)

## 11. 一句话交接

当前仓库已经能让远程 Agent 先把 `Pulse -> recommendation -> archive -> optional execute` 这条 pulse-live 链路每天跑起来，但”自动调整已有持仓 + 自动 stop-loss + 完整 portfolio monitor”仍然主要落在完整服务路径里，还没有完成最终生产闭环验证。
