# Agent Handoff — 当前状态 + 待办

> **每次接手项目都先看这份。** 这是 predict-raven 的"会话间共享笔记本"——上一个 agent 干到哪、当前重点是什么、下一步该做啥，都记在这里。
>
> **更新时机**：
> - 每次会话 wrap-up 时（agent 自己更新）
> - 用户说"记一下" / "save this" / "update handoff" 时（agent 立刻更新）
> - 完成 P0 / P1 任务后（marking done + 加新条目）
>
> **更新原则**：保持精简 + actionable，**不是流水账**。具体细节去看 git log / `docs/internal/review/`。
>
> 英文版：[`docs/en/agent-handoff.md`](en/agent-handoff.md)
>
> 最后更新：2026-05-05 by Codex（按用户 review 调整 eval：market identity 严格一致、价格 3% 容差；新增 eval backlog）

---

## 🔴 P0 — 现在/今天

- [ ] **【P00 · 先修再跑 live】修复 pulse-direct market binding 校验**：2026-04-26 runId `5f9b3d43-56b9-481b-a593-a5f64863e26a` 复盘发现原油报告论证的是 `CL hit HIGH $200 by end of June` 的 Buy No（No 价 0.9395 / edge +5.05pp），但 `recommendation.json` / `execution-summary.json` 绑定并成交的是 `$115` strike 的 No（avgPrice 约 0.457）。详见 [`evaluation/runs/2026-04-26-5f9b3d43.md`](../evaluation/runs/2026-04-26-5f9b3d43.md)，eval backlog 见 [`evaluation/backlog.md`](../evaluation/backlog.md)。下次 `pulse:live` 前必须加 pre-execution 校验：marketSlug / tokenId / outcomeLabel / rule threshold 严格一致；bestBid / bestAsk / decision price 允许 3% 以内误差；同一 event 下不同 strike 不能只靠 eventSlug 绑定。
- [ ] **【新主线】Raven Managed Product — Phase 3a 代码全完成，剩 dogfood 启动**。计划全文 [`docs/internal/plan/2026-05-04-raven-managed-product-plan.md`](internal/plan/2026-05-04-raven-managed-product-plan.md) + [`mode-a-phase-3a-plan.md`](internal/plan/2026-05-04-mode-a-phase-3a-plan.md)。**当前 branch = `main`**（HEAD ~`4d417a9`）。
  - ✅ **DB**：Neon PG 17.8 in eu-central-1 (Frankfurt) provisioned 2026-05-05；4 migration 全跑通；连接串写进 `apps/raven-managed/.env.local`（gitignored；密码暴露聊天，dogfood 跑通后 reset）
  - ✅ **Phase 1 + Phase 2 #1-#4**：apps/raven-managed 独立 app + Privy + Safe 推导 + viem 余额 + session signer UI（stub 模式）+ 4 表 schema
  - ✅ **Phase 3a.0**：commit `a6513bc` — Builder code wired into services/executor（**Pizza/no1 别开**：自家钱包大概率被 Polymarket Weekly Rewards Pool 过滤，自引规则）
  - ✅ **Phase 3a.1**：3 commits — `PolymarketRelayerAdapter` 真实现（deploySafe / getBalance / getPositions / placeOrder via session signer + builder code 双重 stamp）
  - ✅ **Phase 3a.2**：commit `2e81400` — `scripts/managed-pulse.ts` + `proposed-decision-mapper.ts`（pulse 桥）
  - ✅ **Phase 3a.3**：commit `7e0b956` — `scripts/managed-pulse-archive.ts` + `services/managed-trading/src/{alerts,risk-events}.ts` + `deploy/managed-pulse.cron.example`
  - ✅ **Tests**：65/65 managed-trading + 全 9 项目 typecheck 绿
  - **Polymarket builder credentials**（active）：address `0x6664...14e` / code `0x30cf...95e` / api key + secret + passphrase 全在 `.env.local`。**fee rate 0%/0% don't change**（头部 builder 全是 0%）

- [ ] **【dogfood 启动清单 — 5 件用户操作】**（按依赖排序，DB 已搞定）：
  1. **Polygon RPC URL**：Alchemy / QuickNode / Infura 任一免费 tier，5min 注册，URL 替换 `apps/raven-managed/.env.local` 的 `POLYGON_RPC_URL=`（公共 `polygon-rpc.com` 也能用，限流严）
  2. **Privy dashboard 配 session signers**：登 https://dashboard.privy.io → app cmkqta0kl043dla0dg9zfaufm → Authentication → 启用 Session Signers / chainId 137 → 拿 `NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID` 给主会话 + 创建 server signer 私钥写进 `.env.local` 的 `PRIVY_SESSION_SIGNER_PRIVATE_KEY=`
  3. **起 dev server + no1 connect-wallet 注册**：`pnpm --filter @autopoly/raven-managed dev` → localhost:3100 → "Continue with wallet" → 用 no1 私钥连进 Privy → 走完 onboard → dashboard 点 "Enable AI trading"（stub 模式翻 DB）
  4. **给衍生 Safe 充 USDC.e**：no1 的 EOA 衍生出来的 Safe 如果跟你之前 Polymarket 用的同地址，钱已经在；否则从 no1 转 $20-30
  5. **第一次 paper-mode 跑通**：`DATABASE_URL=... pnpm managed:pulse --json` → 看 `runtime-artifacts/managed-pulse/<ts>/<userId>/summary.md` 验证

- [ ] **【可后做不阻塞 dogfood】review 这一轮新建的 6 个文档**：
  - `docs/internal/plan/2026-05-04-raven-managed-product-plan.md`（产品计划主文件）
  - `docs/internal/plan/2026-05-04-mode-a-phase-3a-plan.md`（Mode A 实施计划）
  - `docs/internal/plan/2026-05-04-design-elements-inventory.md`（设计清单 + 5 待拍板方向）
  - `docs/internal/review/2026-05-04-betmoar-and-computer-use-research.md`（betmoar 调研 + CU 选型）
  - `apps/raven-managed/app/page.tsx`（landing 文案 + Lucide icons + raven 品牌 mark）
  - `packages/db/src/migrations/000{2,3}_*.sql`（DB lifecycle / risk_tier 命名）
- [ ] **【用户下次会话亲自做】人为 review 所有本轮新建/重写的中间产生分析文档**：检查格式与内容是否合理。范围至少包括：
  - `docs/agent-onboarding.md` / `docs/agent-handoff.md`（中英）
  - `docs/internal/plan/2026-04-28-v2-cutover-runbook.md`
  - `docs/diagrams/dev-reference.md`（中英）
  - `claude.md` / `AGENTS.md`（中英 4 份）的"项目执行要点"节
  - 主 README.md（含 Quick Start 重写 + 系统设计）
  - 用户特别想 review 的是 **格式 + 内容呈现** 是否符合期望
- [ ] **2026-04-28 11:00 UTC · V2 cutover 当天操作**：暂停所有 cron → 等官方宣布切换完成 → 验证 SDK 连通 → 重启服务。详细步骤见 [`docs/internal/plan/2026-04-28-v2-cutover-runbook.md`](internal/plan/2026-04-28-v2-cutover-runbook.md)
- [ ] **wrap pizza 钱包的 USDC.e → pUSD**（V2 切换前必做，否则 4/28 之后 preflight 会看到 collateral=0）。手动操作：登 polymarket.com UI 找 "Migrate to pUSD" 入口

## 🟡 P1 — 本周

- [x] ~~**接 Polymarket Builder Code**~~ ✅ commit `a6513bc`（2026-05-04，Phase 3a.0）。executor 现在按 `POLYMARKET_BUILDER_*` 5 个 env 自动给 FOK/GTC 单挂 builderCode。**用户操作**：把 5 个 env vars 抄进 `.env.pizza`（或当前在跑的钱包 env），下次 `pulse:live` 自动开始累积 builder volume
- [ ] **wrap pizza 钱包 usdce → pUSD**：V2 cutover 后 collateral=0，必须 wrap。手动登 polymarket.com UI 找 "Migrate to pUSD"
- [ ] **`fees.ts` 接入 V2 SDK 动态费率**：使用已新增的 `fetchDynamicFeeParams(client, conditionID)` helper（见 `services/orchestrator/src/lib/fees.ts:328`），把 sizing 路径里的静态查表替换掉。前置条件：`PlannedExecution` plumb 进 `conditionId` 字段（当前没有）
- [ ] **Mode A 主线 Phase 3a.4（dogfood）**：见 [`docs/internal/plan/2026-05-04-mode-a-phase-3a-plan.md`](internal/plan/2026-05-04-mode-a-phase-3a-plan.md)。
  - ✅ 3a.0 Builder Code (commit `a6513bc`) / ✅ 3a.1 PolymarketAdapter 真实现 / ✅ 3a.2 pulse 桥 (`scripts/managed-pulse.ts` + `proposed-decision-mapper.ts`，2026-05-05) / ✅ 3a.3 cron + 观测 + 报警（2026-05-05，65 tests pass）
  - 下一步：3a.4 dogfood — 用非 Pizza 测试账户走 1 周（用户必须亲自参与）
  - **观测 / 报警入口**：
    - alert webhook env: `MANAGED_TRADING_ALERT_WEBHOOK`（未设静默 no-op）
    - cron 配置 example: [`deploy/managed-pulse.cron.example`](../deploy/managed-pulse.cron.example)（默认 12:30 UTC，artifact-only 不自动启用）
    - 每用户日志: `runtime-artifacts/managed-pulse/<runBatchId>/<userId>/{decisions.json,summary.md}`
    - 顶层 run summary: `runtime-artifacts/managed-pulse/<runBatchId>/run-summary.md`
    - 失败 risk_events: event types `managed_pulse_failure` / `managed_pulse_user_failure`
  - **本地运行新桥**：`pnpm managed:pulse` (paper 默认) / `pnpm managed:pulse --json` / `pnpm managed:pulse --recommendation <path>` 显式指定 pulse 输出
  - **live 模式启用条件**：env `MANAGED_TRADING_MODE=live` + 5 个 `POLYMARKET_BUILDER_*` + `PRIVY_SESSION_SIGNER_PRIVATE_KEY`，缺一在 config 加载时立即抛

## 🟢 P2 — 后续 / 优化项

- [ ] **Computer Use 集成（监控/事件交易方向）**：用户标注 P2（2026-05-04）。两个候选 pilot 见 [`docs/internal/review/2026-05-04-betmoar-and-computer-use-research.md`](internal/review/2026-05-04-betmoar-and-computer-use-research.md) §D：① UMA 仲裁监控（read-only，比市场早知道 resolution 翻盘 = 提前减仓） ② Privy onboarding QA on testnet。**当前不启动**——等 Mode A 主线跑通再考虑
- [ ] **申请 Polymarket Verified tier**（优化项，不阻塞 MVP）：mail builder@polymarket.com 附 API key `019df336-1894-76e8-bd11-8582cde25c3a` + Pizza dashboard URL 当业绩证明。批下来后才能拿 Weekly Rewards Pool 的 USDC 分成（约 0.5-1% routed volume）。Unverified 也能正常下单 + 走 builder code，只是不进奖励池

- [ ] **Vercel 项目改名** `autopoly-pizza-spectator` → `predict-raven`：Vercel dashboard → Project Settings → Name。改完 README 顶部 spectator URL 也要更新成 `predict-raven.vercel.app`
- [ ] **README banner 升级 1200×630 PNG**：当前是 1254×1254 正方形，Twitter 卡片会上下裁剪。做一张横版替换 GitHub Settings → Social Preview
- [ ] **CONTRIBUTING.md + Google 表单**：用户说后续做
- [ ] **删 `claude.md` 小写、规范化为 `CLAUDE.md` 大写**：macOS 大小写不敏感视为同一文件。用 `git mv -f claude.md _CLAUDE.md && git mv _CLAUDE.md CLAUDE.md` 二步法

## ⛔ 已完成 / 不要重做（决策已定）

- ✅ **Design philosophy §1 重写**（2026-05-04）：[`docs/internal/plan/2026-05-04-design-elements-inventory.md`](internal/plan/2026-05-04-design-elements-inventory.md) §1 由"7 条抽象原则 + 后果列表"改成"4 条具体规则 + ✅长这样/❌不长这样对照"。规则收口为：不做 gamification / 默认展示真数据 / Marketing 和 app 两套规则 / 解释机制不只说 benefit。下游 §2-§9 未动
- ✅ **Polymarket V2 SDK 迁移**（commit `48181a5`）：执行器侧已切到 `@polymarket/clob-client-v2@1.0.2`，构造改 options 形式，SignatureType 兼容，CTF 地址 unchanged。无回归
- ✅ **README 大幅瘦身 + Quick Start 提前**（commit `70aa9c1` `8994ad1`）：从 570 → ~290 行，删掉"三条运行链路"和过长的 manifesto
- ✅ **Repo 重命名 `autonomous-poly-trading` → `predict-raven`** + 本地目录 `~/dev-proj/predict-raven/`（symlink 兼容旧路径）
- ✅ **Repo 根目录瘦身**（commit `24a9b0a`）：33 → 23 entries。`.en.md` 进 `docs/en/`，build configs 进 `config/`，`docker-compose` 进 `deploy/`，`Illustration/` → `docs/diagrams/`，`Plan/` → `docs/internal/plan/`，`Wasted/` → `docs/archive/`，`E2E Test Driven Development/` → `e2e/`
- ✅ **CLAUDE.md / AGENTS.md Tier 2 trim**（commit `abb2c60`）：从 181 → 138 行，加了"项目执行要点"专属节
- ✅ **GitHub Social Preview** 已设成 raven logo
- ✅ **MIT LICENSE** 已加
- ✅ **rough-loop.md 留根目录**（B 方案明确取舍）：3 个 ts 硬编码路径，挪走风险高于收益

## 📝 已知踩过的坑（避免重复）

- `claude --print` 子进程偶尔 0 字节挂 5+ 分钟 → 不是失败，等
- 移动 `vitest.config.ts` 到 `config/` 后必须 `root: REPO_ROOT` 否则找不到 `@autopoly/*` workspace 包
- `git mv` 整目录时未追踪文件不会被 git 移动，要手动 `mv`
- 4/24 跑 v2 smoke 时 no1 钱包 USDC.e 有 $3.96 但 pUSD 为 0 → 验证 SDK 接入正常但下单需要先 wrap

## 🔄 上次会话留下的上下文（2026-05-04）

- 用户决策（plan §0 锁定）：Privy / 一路推到 Phase 3 / **MVP 仅靠 Polymarket Weekly Rewards Pool**（不向用户收 builder fee） / 新建独立 app `apps/raven-managed/`（不动 `apps/web`）
- 营收模型修正：原方案"收 builder fee"是错的。头部 70% 市占率的 betmoar / Based Prediction / Stand.trade 全是 \$0。靠 Polymarket Weekly Rewards Pool（约 0.5-1% of routed volume）赚钱
- 设计原则锁定：**产品界面内不用 AI 生图**（crypto-native 用户对 Midjourney 出来的东西敏感）；off-product marketing 才用 AI 生图。详见 design-elements-inventory §3
- 已有 6 commit on `builder-raven`：`c51cea5` Phase 1 / `22fa56f` revenue model / `11a5554` Safe / `40a7678` viem balance / `ec8c15c` managed-trading skeleton / `11e64f5` design inventory / `1a3406b` build+typecheck fixes
- ⚠️ **worktree 拓扑陷阱**：`/Users/Aincrad/dev-proj/autonomous-poly-trading` 是 `predict-raven` 的 symlink；`/Users/Aincrad/dev-proj/predict-raven-aw` worktree 上有别的 session 的 WIP，**不要强删**
- 历史上下文（2026-04-26）：实盘跑了 `daily:pulse` 3 单全成（finland eurovision / crude oil / france world cup），net $548 → $529

## 📌 引用速查

| 我想知道... | 去看 |
| --- | --- |
| 第一次接手项目（仅一次） | [`docs/agent-onboarding.md`](agent-onboarding.md) |
| 风控完整规则 | [`docs/risk-controls.md`](risk-controls.md) |
| 命令速查 / 部署 | [`docs/diagrams/dev-reference.md`](diagrams/dev-reference.md) |
| 历史 review / decision | [`docs/internal/review/`](internal/review/) |
| 最近一次 pulse-live 跑了啥 | `runtime-artifacts/pulse-live/` 下最新目录 |
