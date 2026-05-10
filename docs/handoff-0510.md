# Handoff 0510 — 收敛提交前说明

最后更新：2026-05-10 by Codex（Pulse 质量主线）+ Claude (Opus 4.7)（Mode A 主线）

> 本周两条主线并行：
> 1. **Pulse 质量改进**（by Codex）—— `pulse:positions` / market binding / PnL ledger / position research / web snapshot
> 2. **Raven Managed Product Mode A**（by Claude）—— C 端 AI 资管产品 Phase 3a 全套 + dogfood paper-mode smoke test
>
> 下面 §人类 review 入口 → §下次回来要做 全部是 Codex 主线内容；§主线 2 · Mode A 在最末，独立一节，不互相覆盖。

## 人类 review 入口

- 当前改动范围：`git status --short`
- 当前分支状态：`main...origin/main [ahead 43]`
- 主要代码 diff：`git diff --stat`
- 最该人工核对的代码入口：
  - `scripts/pulse-live.ts`
  - `services/orchestrator/src/runtime/pulse-entry-planner.ts`
  - `services/orchestrator/src/lib/execution-planning.ts`
  - `services/orchestrator/src/review/position-review.ts`
  - `apps/web/lib/trading-snapshot.ts`
- position-only Pulse 入口：`ENV_FILE=.env.pizza pnpm pulse:positions -- --json`
- 最近只读复审归档：`runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/`
- 最近 Pulse 报告：`runtime-artifacts/reports/pulse/2026/05/08/pulse-20260508T021044Z-claude-code-full-245b4933-880f-47d7-ae86-75d5ffb8b81e.md`

## 协作盘点来源

- 主会话负责整合文档和核对当前工作区状态。
- Gauss 只读盘点了 `git status` / `git diff` / 关键文件，把改动分成：持仓专用 Pulse、position research、market binding、PnL calibration、执行/性能、Web snapshot、文档/evaluation。
- Lovelace 只读盘点了后续缺口和 commit 前检查项，重点提醒 `git diff --check` 还有 trailing whitespace，以及 `.claude/*`、public JSON、英文 handoff 状态需要提交前人工确认。

## 本轮做了什么

- **已有持仓 review 改成 position-only Pulse**：新增 `pnpm pulse:positions` / `--positions-only`，强制 `recommend-only`，只复审当前持仓，不扫描新市场、不输出新开仓建议。
- **修正 edge 丢失问题**：Pulse 报告中的 Yes/No 概率行现在会被 parser 保留，负 edge / Kelly=0 不再被过滤；`Position Review` 优先使用当前持仓侧的 Pulse edge。
- **持仓上下文补全**：传给 Pulse 的候选 JSON 带当前持仓方向、shares、均价、mark、当前价值、PnL、止损阈值，避免报告写“当前持仓方向数据不足”。
- **规则写入协作约定**：`AGENTS.md`、`claude.md`、`docs/en/AGENTS.md`、`docs/en/CLAUDE.md` 已同步：任何事件概率 / fair probability / edge 估算必须调用 Pulse 流程；已有持仓 review 使用 position-only Pulse。
- **逐仓 PnL 和校准归档**：新增/接入 `position-mark-snapshot.json`、`calibration-ledger.jsonl`、全局 Pulse calibration ledger，run summary 里增加逐仓 mark 归因。
- **现有仓位 factual research**：`pulse-position-research` 会为每个远端持仓抓 Gamma event/market + held-token orderbook，供 position review 和报告引用。
- **执行路径加固**：execution planning 增加 market binding 校验、outcome label 传递、订单簿去重预取；executor queue 支持显式 `execution_amount` / `execution_unit`。
- **持续运行/派发工具**：新增 `agent-persistent-runner` 和 `execution-dispatch`，用于把 recommendation 转为可派发订单计划，支持 mock executor。
- **Web snapshot 页面**：根页面切到 `ProphetsProfitSnapshot`，新增 `/api/public/trading-snapshot`、`trading-snapshot.ts`、`pulse-position-review.json`、`trading-snapshot-config.json` 和对应样式。
- **文档和评估资料**：新增 Pulse quality improvement plan、evaluation 目录、agent swarm prompt、handoff/onboarding 更新。

## 最近验证

- `pnpm test -- services/orchestrator/src/runtime/pulse-entry-planner.test.ts services/orchestrator/src/runtime/pulse-direct-runtime.test.ts services/orchestrator/src/review/position-review.test.ts`
  - 实际跑完整 Vitest suite：48 files / 402 tests pass。
- `pnpm typecheck`
  - 9 个 workspace projects 通过。
- `ENV_FILE=.env.pizza pnpm pulse:positions -- --json`
  - 成功，`recommend-only`，`executablePlans=0`，没有下单。

## 最近持仓复审结论

- 7 个持仓全部为 No / hold。
- 有正 edge 的 6 仓：Delcy +9.5pp、Finland +4.15pp、Measles +4.0pp、France +2.85pp、England +2.05pp、Leclerc +1.45pp。
- Crude edge=0 不是漏算：Pulse 明确拒绝在规则和 CL 数据缺失时估 AI 概率；下次要先补抓结算规则、WTI/CL 现价、波动率和相关新闻。

## 提交前注意

- `git status` 里包含 `.claude/settings.local.json` 和 `.claude/worktrees/`。这些看起来是本地 agent/Claude 工作区状态，提交前请人工确认是否应排除。
- 子 agent 只读检查发现：`git diff --check` 当前会在 `docs/internal/review/review-and-plan.md:237-247` 报 trailing whitespace，commit 前建议清理。
- `docs/en/agent-handoff.md` 仍有 “Translation pending” 提示；英文版已经追加 2026-05-08/05-10 内容，commit 前确认这句是否还准确。
- Web snapshot 新增 public JSON 是当前展示数据源；如果要提交它，确认这是期望的静态快照，不是临时导出。
- `apps/web/public/pulse-position-review.json` 是从 2026-05-08 position-only Pulse 归档抽取的公开摘要；下次跑 `pulse:positions` 后需要自动或手动刷新，否则前端 rationale 会落后于真实持仓复审。
- 这批改动跨度很大，建议至少拆成 4 个 commit：
  - Pulse 持仓/edge 流程：`pulse:positions`、position-only Pulse、parser/runtime/position-review。
  - 执行/派发加固：market binding、订单簿 prefetch/cache、poly-cli 默认关闭、queue worker execution amount、persistent runner/dispatch。
  - Web snapshot：`ProphetsProfitSnapshot`、`/api/public/trading-snapshot`、public JSON、favicon、样式。
  - 文档/评估资料：AGENTS/CLAUDE 规则、handoff、evaluation、plan/review 文档。
- 不要用 `pulse:live` 复核概率。已有持仓复审统一用 `pulse:positions`；找新机会才用 `pulse:recommend`。

## 下次回来要做（主线 1 · Pulse 质量）

- 补齐 Crude 市场规则和 CL/WTI 数据后，重跑 `pulse:positions`，确认是否能生成非零 edge。
- 对 Web snapshot 跑一次本地页面验收，确认移动端/桌面布局和 API 数据都正常。
- 提交前重新跑 `pnpm typecheck` 和全量 `pnpm test`；若 web 改动继续保留，补一个前端 smoke 或截图验证。
- 决定 `.claude/worktrees/`、`.claude/settings.local.json`、runtime 产物、public snapshot JSON 的提交策略。
- 把 `pulse-position-review.json` 的生成从手动快照变成 `pulse:positions` 成功后的稳定导出步骤。
- push 前看一遍 `docs/agent-handoff.md` 和本文件，确认没有过期路径或错误 run id。

---

## 主线 2 · Raven Managed Product (Mode A) — by Claude (Opus 4.7)

### 这轮做了什么

**起点**：Phase 1 仅有空壳。**终点**：Mode A Phase 3a 全部技术 task 落地 + 端到端 paper-mode smoke test 跑通。

#### 阶段 1：产品定型（2026-05-04）

- 调研 betmoar：`$817M 累计 routed volume / 非托管 / $0/$0 fee / 无 copy trading / 无付费 tier / 100% 收入靠 Polymarket Weekly Rewards Pool`。落地 [`docs/internal/review/2026-05-04-betmoar-and-computer-use-research.md`](internal/review/2026-05-04-betmoar-and-computer-use-research.md)
- 锁定 Mode A "Pure Managed AI"——betmoar 故意没做的领域。详见 [`docs/internal/plan/2026-05-04-mode-a-phase-3a-plan.md`](internal/plan/2026-05-04-mode-a-phase-3a-plan.md)
- Computer Use 调研降为 P2

#### 阶段 2：技术落地（2026-05-04 → 05-07，14 commits）

| Commit | 内容 |
| --- | --- |
| `a6513bc` | **3a.0** Builder code → executor（Pizza/no1 不开，自家钱包大概率被过滤） |
| `12cd3f5` `18ade8a` `c642986` | **3a.1** `PolymarketRelayerAdapter` 真实现：deploySafe / getBalance / getPositions / placeOrder |
| `2e81400` | **3a.2** Pulse → Dispatcher 桥：`scripts/managed-pulse.ts` + `proposed-decision-mapper.ts` |
| `7e0b956` | **3a.3** Cron + 观测 + 报警：`alerts.ts` + `risk-events.ts` + `managed-pulse-archive.ts` + `deploy/managed-pulse.cron.example` |
| `4c51edf` | **3a.4** paper-mode 端到端 smoke test ✅ |

#### 阶段 3：UI / 设计资源（10 commits）

`1184a2d` Raven Violet 配色 → `f826291` Inter + JetBrains Mono → `7704b40` Lucide icons 替换 emoji → `68b8ac6` 品牌 mark SVG ×6 → `b646b4f` OG image → `da78405` tone-of-voice 重写 → `2f6e37c`-`eadbf55` Tier 1 组件库（10 个） → `6a75d59` Onboard mechanism diagram → `607511e` 设计哲学 §1 重写

#### 阶段 4：基础设施 + 工作流（4 commits）

- `13494c8` CLAUDE.md §9 Playwright visual QA 工作流（前端任务强制截图 + 读图自评）
- `5dd4917` pin playwright@1.56.1 workspace devDep
- `30fec5f` Privy 加 Twitter + Google 登录方法
- `4d417a9` Neon PG 17.8 in **eu-central-1 Frankfurt**：4 migration 全跑通，14 表就位

#### 关键里程碑：dogfood paper-mode smoke test（2026-05-07）

跑通 end-to-end pipeline，**0 bug**。归档 `runtime-artifacts/managed-pulse/2026-05-07T08-23-06Z-484e1667/`。

```
✅ Neon DB 连通（Frankfurt）
✅ pulse 解析（3 decision）
✅ 用户 = no1 (`0xe14e...dff1`)
✅ Safe 推导 = `0xC78873...2936` ✅ 完全匹配 .env.no1 FUNDER_ADDRESS
✅ 链上余额读取 (publicnode RPC) = $3.96 USDC.e
✅ 风控 caps 应用（balanced tier 15% × $3.96 = $0.59）
✅ 3 decision 全 skip — 因 < $5 min notional（这是正确风控行为）
✅ run 持久化 + 归档 + DB 行 全部正确
✅ exit 0
```

**关键发现**：`polygon-rpc.com` 公共 RPC 现在 401。已切到 `polygon-bor-rpc.publicnode.com`（备用 `drpc.org` / `1rpc.io/matic`）。已写 `.env.local`。

### 当前状态

- Branch: `main`（HEAD `4c51edf`，未 push 25 commits）
- Tests: 65/65 managed-trading + 全 9 项目 typecheck 绿
- Build: `apps/raven-managed` `next build` 12 routes 全 prerender
- Polymarket builder credentials: address `0x6664...14e` / code `0x30cf...95e`，全在 `.env.local`，fee rate 0%/0% **don't change**

### 下次回来要做（主线 2 · Mode A）

#### 🔴 阻塞 dogfood happy path（用户 1 件事）

- **给 no1 Safe 充 $30+ USDC.e**：地址 `0xC78873644E582cb950f1Af880C4F3eF3c11f2936`，**用 USDC.e（不是 pUSD）**。充完跑 `pnpm managed:pulse --json --recommendation runtime-artifacts/pulse-live/2026-04-26T060306Z-5f9b3d43.../recommendation.json`，期望 ≥ 1 个 decision `kept`。

#### 🟠 阻塞 live mode 第一笔真单

- **Privy dashboard 启用 session signers**：登 https://dashboard.privy.io → app `cmkqta0kl043dla0dg9zfaufm` → Authentication → Session signers → 启用 + chainId 137 → 拿 `signerId` + 创 server signer key → 写进 `.env.local` 的 `NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID` + `PRIVY_SESSION_SIGNER_PRIVATE_KEY` → 切 `MANAGED_TRADING_MODE=live` → 跑 `pnpm managed:pulse --json`

#### 🟡 不阻塞的 backlog

- **B**：浏览器走 Privy connect-wallet 真注册（验 onboard UX，不只 INSERT DB）
- **D**：搭 cron 让 paper-mode 每天自动跑（验调度 + alert webhook + 归档累积）
- 设计资源 §2 五核心方向拍板（color / typography / icons / logo / tone）后落 §9.1 整套
- Polymarket Verified tier 申请（mail builder@polymarket.com）→ 进 Weekly Rewards Pool

### 已踩过的坑（避免重复）

- `polygon-rpc.com` 公共 RPC 401 → 用 publicnode
- 私钥 / API secret 不上聊天（这一轮 Privy app secret + Polymarket builder secret + Neon DB password 都暴露过；dogfood 跑通后建议都 rotate）
- Pizza/no1 自家钱包**不要**给自己挂 builder code（自引大概率被过滤）
- `next build` 绿 ≠ hydration 成功；前端任务必须按 CLAUDE.md §9 跑 `scripts/visual-qa.mjs`
- worktree 多发时 `predict-raven` symlink 自己会被切回 `main`，注意切回工作分支后再操作
- `.claude/worktrees/` 累积到 9.2GB，**已加入 .gitignore**（2026-05-10）

### 文件树新增 / 改动核心入口

```
apps/raven-managed/                    # 新独立 Next.js app（端口 3100）
├── app/{page,signup,onboard,dashboard,track-record}.tsx
├── app/api/users/{register,portfolio,session-signer}/route.ts
├── app/{icon,apple-icon,opengraph-image,twitter-image}.tsx
├── components/ui/                     # Tier 1 组件库（10 个）
├── components/{providers,top-bar,mechanism-diagram}.tsx
├── lib/{cn,polymarket-safe,portfolio,privy-server,session-signer}.ts
└── public/brand/                      # 5 SVG: mark / wordmark / lockup / mono

services/managed-trading/              # 新 service
├── src/polymarket-relayer-adapter.ts  # 3a.1 真实现
├── src/dispatcher.ts                  # 多用户 paper/live runner
├── src/risk-manager.ts                # per-tier caps
├── src/proposed-decision-mapper.ts    # 3a.2 桥的 mapper
├── src/{alerts,risk-events}.ts        # 3a.3 报警 + DB
└── src/*.test.ts                      # 65 tests

scripts/{managed-pulse,managed-pulse-archive,visual-qa}.{ts,mjs}
packages/db/src/migrations/000{2,3}_*.sql
deploy/managed-pulse.cron.example
docs/internal/plan/2026-05-04-{raven-managed-product,mode-a-phase-3a,design-elements-inventory}.md
docs/internal/review/2026-05-04-betmoar-and-computer-use-research.md
```

---

## 综合下一轮入口（两条主线汇总）

| 优先 | 任务 | 主线 | 阻塞依赖 |
| --- | --- | --- | --- |
| 🔴 | no1 Safe 充 $30+ USDC.e | Mode A | 用户操作 |
| 🔴 | Crude 市场规则 + CL/WTI 数据补全 | Pulse | 调研 |
| 🟠 | Privy session signer 配置 → live mode 第一单 | Mode A | 用户操作 |
| 🟠 | Pulse pulse-position-research 自动跑 + 输出 | Pulse | Codex |
| 🟡 | Web snapshot 本地页面验收 | Pulse | Codex |
| 🟡 | Privy connect-wallet 真注册 + cron 部署 | Mode A | 用户操作 |
| 🟢 | 设计资源 §2 五方向拍板 → §9.1 落地 | Mode A | 用户拍板 |
| 🟢 | Polymarket Verified tier 申请 | Mode A | mail builder@polymarket.com |
