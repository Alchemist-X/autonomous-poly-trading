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
> 最后更新：2026-05-10 by Codex（Pizza snapshot 三套非 production 风格预览已部署到 Vercel preview；正式 `autopoly-pizza-spectator.vercel.app` 未切换；本地/preview build + Playwright 验收通过）

---

## 🔴 P0 — 现在/今天

- [x] **【P00 · 已实现】pulse-direct market binding 校验**：2026-05-05 已修复。`pulse-entry-planner` 不再用同 event URL 直接绑定多 strike 市场；`execution-planning` 增加 P00 gate：marketSlug / tokenId / outcomeLabel / rule threshold 严格一致，bestBid / bestAsk / decision price 允许 3% 以内误差；`pulse-live` 遇到 `blocked_by_market_binding` 在 live 模式 fail-fast。覆盖测试：`pulse-entry-planner.test.ts` / `execution-planning.test.ts` / 全量 `pnpm test` 392 pass。
- [x] **【P0 · v1 已实现】现有仓位独立研究复审**：2026-05-07 `pulse-live` 会在随机 Pulse 候选之外为每个远端持仓生成 `position-research.json`，抓 Gamma event/market payload + held-token orderbook；`Position Review` 优先消费 `positionResearch`，无覆盖仓位不再默认 stale hold，而是标 `fresh-position-research` / `position-research-refreshed`（near stop-loss 仍 reduce）。**残余缺口**：还没有模型级概率重估、评论/外部来源 crawler；当前是 factual refresh + artifact，不要误当完整外部研究 agent。
- [x] **【P0 · 已实现】已有持仓必须走 position-only Pulse 概率/edge 复审**：2026-05-08 新增 `pnpm pulse:positions`（等价 `pulse:live --recommend-only --positions-only`），只针对当前持仓生成 Pulse 报告，不扫描新市场、不输出新开仓建议；候选 JSON 带当前持仓方向 / 数量 / 均价 / mark / PnL，parser 会保留 Yes/No 两侧概率行（edge 可正可负），`Position Review` 优先用持仓侧 Pulse edge。验证归档：`runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/`，7 仓 hold，0 成交，Pulse 复审计划数 12；Crude 因规则/CL 数据不足由 Pulse 明确拒绝估概率，保留 edge=0。
- [x] **【P1 · 已实现】逐仓 PnL 快照 + calibration ledger**：2026-05-07 已实现。`pulse-live` / `pulse:recommend` 会写 `position-mark-snapshot.json`、单轮 `calibration-ledger.jsonl`，并追加 `runtime-artifacts/evaluation/pulse-calibration-ledger.jsonl`；run-summary 会展示逐仓 mark 归因和 unexplained equity residual。
- [ ] **【新主线】Raven Managed Product — Phase 3a 代码全完成，剩 dogfood 启动**。计划全文 [`docs/internal/plan/2026-05-04-raven-managed-product-plan.md`](internal/plan/2026-05-04-raven-managed-product-plan.md) + [`mode-a-phase-3a-plan.md`](internal/plan/2026-05-04-mode-a-phase-3a-plan.md)。**当前 branch = `main`**（HEAD ~`4d417a9`）。
  - ✅ **DB**：Neon PG 17.8 in eu-central-1 (Frankfurt) provisioned 2026-05-05；4 migration 全跑通；连接串写进 `apps/raven-managed/.env.local`（gitignored；密码暴露聊天，dogfood 跑通后 reset）
  - ✅ **Phase 1 + Phase 2 #1-#4**：apps/raven-managed 独立 app + Privy + Safe 推导 + viem 余额 + session signer UI（stub 模式）+ 4 表 schema
  - ✅ **Phase 3a.0**：commit `a6513bc` — Builder code wired into services/executor（**Pizza/no1 别开**：自家钱包大概率被 Polymarket Weekly Rewards Pool 过滤，自引规则）
  - ✅ **Phase 3a.1**：3 commits — `PolymarketRelayerAdapter` 真实现（deploySafe / getBalance / getPositions / placeOrder via session signer + builder code 双重 stamp）
  - ✅ **Phase 3a.2**：commit `2e81400` — `scripts/managed-pulse.ts` + `proposed-decision-mapper.ts`（pulse 桥）
  - ✅ **Phase 3a.3**：commit `7e0b956` — `scripts/managed-pulse-archive.ts` + `services/managed-trading/src/{alerts,risk-events}.ts` + `deploy/managed-pulse.cron.example`
  - ✅ **Tests**：65/65 managed-trading + 全 9 项目 typecheck 绿
  - **Polymarket builder credentials**（active）：address `0x6664...14e` / code `0x30cf...95e` / api key + secret + passphrase 全在 `.env.local`。**fee rate 0%/0% don't change**（头部 builder 全是 0%）

- [x] ~~**Phase 3a.4 paper-mode 端到端 SMOKE TEST**~~ ✅ 2026-05-07 完成，commit `<pending>`：
  - no1 (`0xe14e...dff1`) 通过直接 SQL INSERT 注册成 managed_user `74a27990-300a-4d09-8e7b-af52a5c65906`（跳过浏览器 + Privy 模态——签名只能在 wallet 端做，私钥不应该上服务器）
  - Safe 推导验证：no1 EOA → `0xC78873...2936` ✅ **完全匹配** `.env.no1` 的 FUNDER_ADDRESS，证明 3a.1 PolymarketRelayerAdapter 推导逻辑对
  - 实测 publicnode RPC 读链上余额：no1 Safe = $3.96 USDC.e（之前充的钱还在）
  - 用 `2026-04-26T060306Z` pulse recommendation.json 跑 `managed:pulse --json --recommendation <path>`：3 decisions 全 skip（balanced tier 15% cap → $0.59 < $5 min notional）—— **这是正确的风控行为**，bankroll 太小 AI 即使看到 99% conf 的原油单也不强行下
  - DB 验证：`managed_paper_runs` 写了 1 row（completed，2 秒跑完），`managed_decisions` 写了 3 rows（全 skipped，原因 `blocked_by_min_notional`）
  - 归档：`runtime-artifacts/managed-pulse/2026-05-07T08-23-06Z-484e1667/`
  - **关键发现**：`https://polygon-rpc.com` 公共 RPC 现在返回 401（"API key disabled"），切到 `https://polygon-bor-rpc.publicnode.com`（也有 `drpc.org` / `1rpc.io/matic` 备选）。已写进 `.env.local`

- [ ] **【dogfood 下一步 — 看你想走哪条】**：
  1. **A. 给 no1 Safe 充 $30+ USDC.e** → paper-mode 重跑会真的"keep" 部分 decision，验证完整 happy path（不是只验"被 skip"）
  2. **B. 做 Privy 真 connect-wallet 注册流程**（不是直接 INSERT）→ 验证 onboard 端到端 UX。需要你拿 no1 私钥导入 MetaMask 后浏览器走一遍
  3. **C. 直接进 live mode**（拿 1 个真单）→ 需要 Privy dashboard 启用 session signers + 拿 `PRIVY_SESSION_SIGNER_PRIVATE_KEY`，把 `MANAGED_TRADING_MODE=live`。最 risky 但最有信息量
  4. **D. 等几天看 cron 跑通**（搭好 cron 让 paper-mode 每天自动 run）→ 验证 cron 调度 + alert webhook + 归档累积

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
- [x] **【P1 · 已实现】Polymarket 读取默认 in-process + 订单簿去重预取**：2026-05-07 `POLY_CLI_ENABLED` 改成显式 `true` 才走 `pnpm exec tsx scripts/poly-cli.ts`，默认直接用 in-process SDK；`POLY_CLI_STRICT=true` 仍可强制隔离 bridge。`pulse-live` 新增单轮 `readBook` / `computeAvgCost` Promise cache；`buildExecutionPlan` 对 open/close/reduce 的 unique tokenId 做 bounded-concurrency prefetch，避免同一轮重复读 CLOB / 重复 spawn。
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
- [x] **promote prophets-profit 复刻页到 production**：2026-05-10 已切正式 `https://autopoly-pizza-spectator.vercel.app`。当前页面保留 prophets-profit 外观，但数据来自 Pizza Polymarket 公开钱包接口 + bundled Pulse position review 摘要，不再使用源站 Kalshi 静态快照。
- [x] **Pizza snapshot 三套非 production 风格预览**：2026-05-10 已完成，仅部署到 Vercel preview，未 promote production。预览地址：`https://autopoly-pizza-spectator-eixznt54x-alchemist-xs-projects.vercel.app/previews/pizza-ledger-folio`、`/previews/pizza-ledger-terminal`、`/previews/pizza-ledger-exchange`。最终 preview deploy `dpl_D3VdKtc1YZ6YTxXSn2qRg7DGgC1P`，运行时 env 显式指向 Pizza 钱包 `0x6664...614e` + `INITIAL_BANKROLL_USD=500`；中间 preview `dpl_BLwwnqngFevVbmHFSPBQo2LyTyxz` 因 Vercel preview env 指到错误钱包只显示 0 fills，不作为评审入口。
- [ ] **自动刷新 `pulse-position-review.json`**：当前 `apps/web/public/pulse-position-review.json` 是从 2026-05-08 position-only Pulse 归档手动抽取的公开摘要；下次跑 `pnpm pulse:positions` 后应加脚本自动导出并随部署更新，否则 rationale 可能落后于实时持仓。
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

## 🪵 仍在用的 git worktree（2026-05-10 整理后保留）

> 主 worktree 是 `/Users/Aincrad/dev-proj/predict-raven`（branch `main`）。下面是别的实验分支留的 worktree——不要 force-remove，里面有未合并价值代码。
> 已清理的 2 个废稿 worktree：`spike/karpathy-autoresearch`（8 周前）+ `exp/pulse-timeout-calibration`（7 周前 base 太旧），分支已删

- **`/Users/Aincrad/dev-proj/predict-raven-aw`** (1.2GB, branch `raven-aw`, 22fa56f)
  - 24 个 modified + 4 个 untracked（最大价值：`services/executor/src/lib/okx-agentic-wallet.{ts,test.ts}` + `docs/agentic-wallet-setup.md`）
  - 状态：**未合并的 OKX agentic-wallet 实验**（独立于 Mode A / Pulse 主线）。也有一些 live-test scripts 改动 + env-file 工具
  - 下一步：判断 OKX wallet 集成要不要继续；如要，独立 cherry-pick 进 main；如废，整个清掉（释放 1.2GB）

- **`/Users/Aincrad/dev-proj/predict-raven-persistence-plan`** (679MB, branch `codex/persistent-runtime-plan`, d939b6e)
  - 5 modified + 5 untracked（关键：`services/orchestrator/src/runtime/raven-agent-loop.{ts,test.ts}` + `docs/internal/plan/2026-05-04-persistent-runtime-plan.{md,en.md}`）
  - 状态：**部分已合并**——`scripts/agent-persistent-runner.ts` 已经在 main（commit `6d1ca6c`）。`raven-agent-loop` 模块还没合
  - 下一步：把 `raven-agent-loop` 独立 cherry-pick 进 main 或废弃整个 worktree

## 📝 已知踩过的坑（避免重复）

- `claude --print` 子进程偶尔 0 字节挂 5+ 分钟 → 不是失败，等
- 移动 `vitest.config.ts` 到 `config/` 后必须 `root: REPO_ROOT` 否则找不到 `@autopoly/*` workspace 包
- `git mv` 整目录时未追踪文件不会被 git 移动，要手动 `mv`
- 4/24 跑 v2 smoke 时 no1 钱包 USDC.e 有 $3.96 但 pUSD 为 0 → 验证 SDK 接入正常但下单需要先 wrap

## 🔄 上次会话留下的上下文（2026-05-10）

- 用户要求“风格和原版网站不一样、信息和布局基本不变、先做三个版本预览、不要直接投 production”。已新增三个 preview route：`/previews/pizza-ledger-folio`（纸面研究简报）、`/previews/pizza-ledger-terminal`（深色 operator terminal）、`/previews/pizza-ledger-exchange`（清爽券商看板）。实现方式是 `ProphetsProfitSnapshot` 支持 `variant="folio" | "terminal" | "exchange"` 和 preview-only `as="div"`，避免在 preview shell 的 `<main>` 内嵌套 `<main>`；首页默认仍是 `variant="original"`。
- Preview 部署：最终可评审 URL 是 `https://autopoly-pizza-spectator-eixznt54x-alchemist-xs-projects.vercel.app`（deploy `dpl_D3VdKtc1YZ6YTxXSn2qRg7DGgC1P`，`target=preview`，`status=Ready`）。没有执行 `vercel deploy --prod`，正式 alias `https://autopoly-pizza-spectator.vercel.app` 未切换。
- 验证：`pnpm --filter @autopoly/web typecheck` pass；`pnpm --filter @autopoly/web build` pass；本地 `http://localhost:3007` 和 Vercel preview 三条 route 全部 Playwright 通过，console/page error 为 0，手机宽度 `overflowPx=0`，并确认显示 Pizza 标记 `$500.00` starting capital / `34 fills`。实时 mark 验收时 preview 显示 `ending_nav≈$554.25`、`roi≈+10.85%`。截图：`output/playwright/pizza-preview-{folio,terminal,exchange}.png` 和 `output/playwright/pizza-preview-live-{folio,terminal,exchange}.png`。
- 用户确认切正式并要求适配自己的数据。`apps/web` 根路径 `/` 仍使用 prophets-profit 的 "Live Trading Snapshot" 外观，但数据源已改为 `GET /api/public/trading-snapshot`，由 `apps/web/lib/trading-snapshot.ts` 聚合 Polymarket public wallet `overview / positions / closed-positions / activity`、`public/equity-history.json`、`public/pulse-position-review.json`。
- 已删除源站 Kalshi 静态 `paper-trades.json`，避免线上混用。新增 `apps/web/public/trading-snapshot-config.json`，用于 production 环境没有 `INITIAL_BANKROLL_USD` 时把 Pizza 起始资金固定为 `$500`；否则线上会误用 equity history 第一条 `$20` 计算 ROI。
- 当前 production 数据口径：正式 API 返回 `starting_capital=$500`、`ending_nav≈$556.98`、`net_pnl≈+$56.98`、`roi≈+11.40%`、`34` fills、`20` markets、`7` open。`pulse-position-review.json` 来自 `runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/recommendation.json`，只包含公开 review 摘要和来源链接。
- Production deploy：`dpl_8is51ocvNuE2H1pxkpBe5UEiEES1`，正式 alias `https://autopoly-pizza-spectator.vercel.app`；中间旧 production `dpl_3uM7bQnMp3p3G6U22wSuKVXvtNLR` 曾暴露过 `$20` 起始资金口径，已由最终部署修正。
- 验证：`pnpm --filter @autopoly/web typecheck` pass；`pnpm --filter @autopoly/web build` pass；本地 `http://localhost:3007` 和 production Playwright 首屏/筛选/搜索/展开 Delcy rationale 通过；production `/api/public/trading-snapshot` 返回 200；Playwright console error 0。截图：`output/playwright/pizza-adapted-local.png`、`output/playwright/pizza-adapted-production.png`。
- 本轮没有运行 `pulse:live` / `daily:pulse`，没有真实下单；只读取现有 Pulse 归档和 Polymarket 公开接口。

## 🔄 更早会话留下的上下文（2026-05-08）

- 2026-05-08 用户明确要求：任何事件概率 / fair probability / edge 必须调用 Pulse 流程；review 当前持仓时是“用 Pulse 分析已有持仓”，不是扫市场找新标的。`AGENTS.md` / `claude.md` / `docs/en/AGENTS.md` / `docs/en/CLAUDE.md` 已同步写入这条规则。
- `pnpm pulse:positions` 已落地：入口在 `scripts/pulse-live.ts`，positions-only 强制 recommend-only；`market-pulse.ts` 生成 existing-position snapshot；`pulse-direct-runtime.ts` 不合成新开仓，只把已有持仓 review 决策写入 final decisions；`pulse-entry-planner.ts` position-only 模式保留所有概率行，不因负 edge / Kelly=0 丢掉。
- 最近一次只读复审：`ENV_FILE=.env.pizza pnpm pulse:positions -- --json` 成功，归档 `runtime-artifacts/pulse-live/2026-05-08T020947Z-245b4933-880f-47d7-ae86-75d5ffb8b81e/`；Pulse 报告 `runtime-artifacts/reports/pulse/2026/05/08/pulse-20260508T021044Z-claude-code-full-245b4933-880f-47d7-ae86-75d5ffb8b81e.md`。没有下单。
- 当前 7 仓全部 No / hold；有正 edge 的 6 仓：Delcy +9.5pp、Finland +4.15pp、Measles +4.0pp、France +2.85pp、England +2.05pp、Leclerc +1.45pp；Crude edge=0 是因为 Pulse 明确写“AI 概率未评估，规则/CL 数据不足”，下次优先补抓规则和 WTI/CL 数据。
- 验证：`pnpm test -- services/orchestrator/src/runtime/pulse-entry-planner.test.ts services/orchestrator/src/runtime/pulse-direct-runtime.test.ts services/orchestrator/src/review/position-review.test.ts` 实际跑完整 suite，48 files / 402 tests pass；`pnpm typecheck` pass。

## 🔄 更早会话留下的上下文（2026-05-07）

- pulse 质量本轮新增：`scripts/pulse-evaluation-ledger.ts` 负责逐仓 mark attribution + calibration ledger；`scripts/pulse-live.ts` 在 recommend-only/live 成功路径写入对应 artifact；`scripts/live-run-summary.ts` 显示逐仓 PnL 归因。
- 现有仓位复审 v1 已有独立研究入口：`scripts/pulse-position-research.ts` 逐仓抓 Gamma event/market + held-token orderbook，`scripts/pulse-live.ts` 写 `position-research.json`，`position-review` 对未被随机 Pulse 覆盖的仓位标 `fresh-position-research`。仍缺：模型级概率重估、评论/外部来源 crawler。
- Polymarket 性能本轮改动：默认 in-process SDK；poly-cli 变成显式 opt-in fallback；`pulse-live` 单轮缓存 book/avgCost；`buildExecutionPlan` 对 unique tokenId 并发预取订单簿。
- 验证：`pnpm typecheck` 通过；`pnpm test -- services/orchestrator/src/review/position-review.test.ts services/orchestrator/src/review/position-research.test.ts services/orchestrator/src/lib/execution-planning.test.ts` 实际跑完整 vitest suite，47 files / 400 tests 通过。没有跑 `pulse:live`，没有真实下单。

## 🔄 更早会话留下的上下文（2026-05-04）

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
