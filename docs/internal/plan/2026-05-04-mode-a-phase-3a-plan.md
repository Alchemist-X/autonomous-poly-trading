# Mode A Phase 3a — 实施计划

> 关联：[`2026-05-04-raven-managed-product-plan.md`](2026-05-04-raven-managed-product-plan.md) §5 Phase 3 / [`2026-05-04-betmoar-and-computer-use-research.md`](../review/2026-05-04-betmoar-and-computer-use-research.md) §F
> 状态：执行中 · 2026-05-04
> 用户决策：**做 Mode A**（"Pure Managed AI"）

## 0. Mode A 是什么 + 不是什么

**是**：用户邮箱注册 → Polymarket Safe 自动衍生 → 用户存 USDC.e → 用户授权 Raven session signer → Raven AI 全自动按 daily-pulse 信号在用户 Safe 上下单。**用户的工作就是**：存款、看、提款。

**不是**：用户审批每单（那是 Mode B onboarding ramp）；不是用户跟单 leader（那是 Mode C）；不是 Raven 拿托管资格（始终非托管）。

## 0.1 锁定决策（默认推荐方案，用户未反对）

| 决策点 | 默认 | 理由 |
| --- | --- | --- |
| Session signer scope | **Time-windowed**（24h 有效，server 端 enforce 风控） | UX 顺、性能好；安全靠 Polymarket Safe 合约边界 + per-user spending cap，不靠每单签名 |
| Mode B 审批粒度 | **Plan-level**（一键批 5 单） | 转化高得多 |
| 收入路径 | **6 个月只靠 Polymarket Weekly Rewards Pool** | betmoar 同模式跑到 ~$1M ARR，先证明 PMF 再叠管理费/业绩费 |

## 1. Phase 3a 子任务拆分

按依赖+独立性排：

### 3a.0：Builder Code 接到 services/executor（✅ done 2026-05-04，commit `a6513bc`）

> 对应原 Task #6。让现有 **Pizza 钱包**立即开始累积 builder volume，不等 Mode A 主线。

- 加 `POLYMARKET_BUILDER_*` env vars 到 executor config 读取
- `services/executor/src/lib/polymarket-sdk.ts` 的 FOK / GTC 调用里带 `builderCode + builder credentials`
- typecheck + 不动订单 placement 逻辑（仅 attribution）
- 测试：用现有 underdog / 任意非 pizza 钱包的 env 跑 `pulse:live --recommend-only` dry-run，验 SDK 调用形态

**估时**：1 worktree agent，10-15min。**不依赖 Mode A 其他步骤**。

### 3a.1：PolymarketAdapter 真实现（Mode A 主线第一步）

> `services/managed-trading/src/polymarket-adapter.ts` 当前 `StubPolymarketAdapter` 全部 throw "not implemented"。换上真 SDK 调用。

新建 `class PolymarketRelayerAdapter implements PolymarketAdapter`：
- `deploySafe(eoa)` → `@polymarket/builder-relayer-client` `RelayClient.deploySafe()`（幂等）
- `getBalance(safeAddress)` → 复用 `apps/raven-managed/lib/portfolio.ts` 的 viem 调用（提到 `@autopoly/managed-trading` 共享）
- `getPositions(safeAddress)` → `@polymarket/clob-client` `getMarketOrderBook` + 用户 fills 查询
- `placeOrder(safeAddress, order, sessionSigner)` → 用 session signer 签 + 走 builder relayer + 带 builder code

**关键点**：session signer 私钥不能落盘明文。MVP 阶段用 env 变量（`PRIVY_SESSION_SIGNER_PRIVATE_KEY`）+ KMS 部署文档（Phase 3b 再迁 Turnkey/HSM）。

**估时**：1 worktree agent，1-2h。typecheck + 单元测试，不实际打链。

### 3a.2：Pulse → Dispatcher 桥（✅ done 2026-05-05）

> 把 `services/orchestrator` 跑出来的 daily-pulse 决策喂进 `services/managed-trading` 的 `runPaperPulseForAllAuthorizedUsers`。

- ✅ 新增 `scripts/managed-pulse.ts` — 读最新 `runtime-artifacts/pulse-live/<ts>/recommendation.json`，自动选最近的 archive，也可显式 `--recommendation <path>`
- ✅ 抽出 `services/managed-trading/src/proposed-decision-mapper.ts` — 纯函数，按 `tokenId` join `executablePlans` × `decisions`，处理 confidence 归一化（`medium-high` → `high`）+ side/action 边界 + NaN/越界 prob 防御
- ✅ Paper mode 默认 / env `MANAGED_TRADING_MODE=live` 走真 SDK adapter；缺 builder 凭证或 session signer key 在 config 加载时直接抛
- ✅ Stub adapter 默认（paper mode）；`MANAGED_TRADING_USE_REAL_BALANCES=true` 强制用真 RPC 读 USDC.e（dogfood 用）
- ✅ 新增 18 个 mapper 单测（`services/managed-trading/src/proposed-decision-mapper.test.ts`），全包 4 个测试文件 55 tests pass
- ✅ Stdout 只输出最终 JSON summary；进度 / 警告全走 stderr，pipe 友好
- 新增 `pnpm managed:pulse` 命令；live 模式必须显式 env，不靠 CLI flag
- TODO(3a.3) 标记已留：cron + alerting webhook + `runtime-artifacts/managed-pulse/<ts>-<userId>/` 归档目录

**实际**：1 worktree agent，~1h。

### 3a.3：Cron + 观测 + 报警（Mode A 上线前最后一步）

- 复用现有 cron 调度（`scripts/pulse-live.ts` 的形态）
- 每用户日志到 `runtime-artifacts/managed-pulse/<ts>-<userId>/`
- 失败时写 `risk_events`（已有表）+ 推 stub Slack webhook（env `MANAGED_TRADING_ALERT_WEBHOOK`）
- live mode 上线 checklist 写进 `docs/internal/plan/2026-05-XX-mode-a-cutover-runbook.md`

**估时**：1 worktree agent，2-3h。

### 3a.4：内部 dogfood（先于公开发布）

- 用 1 个非 Pizza 测试账户走完整 Privy → Safe → 入金 $20-30 → 启 AI → 跑 1 周 → 提款
- 每日抽查决策合理性 + 三方对账（链上 / Polymarket CLOB / managed_decisions 表）

**这一步用户必须参与**——不是 agent 能做的。

## 2. 估时合计

| 子任务 | Agent 工期 | 实际墙钟 |
| --- | --- | --- |
| 3a.0 Builder Code → executor | 10-15min | 同上 |
| 3a.1 Adapter 真实现 | 1-2h | 同上 |
| 3a.2 Pulse → Dispatcher 桥 | 1-2h | 同上 |
| 3a.3 Cron + 观测 + 报警 | 2-3h | 同上 |
| 3a.4 内部 dogfood | n/a | **1 周观察期** |

总 agent 工期 4-7h；**真正等 dogfood 是 1 周**。

## 3. 风险面（Mode A 上线前必须检查）

| 风险 | 缓解 |
| --- | --- |
| Session signer 私钥泄露 | KMS / Turnkey 长期方案；MVP env 变量 + per-user spending cap + 异常下单频率 alert |
| 用户撤回 session signer 中途 | 每次 dispatcher 调用前 check `session_signer_revoked_at`；revoked 时 status=`revoked` 不 retry |
| Builder rewards 对账歧义 | 双源记账：CLOB API fills + 链上 OrderFilled events，daily diff |
| 用户 Safe USDC 不足 | preflight skip + 写 risk_event |
| 多用户并发同标的滑点 | dispatcher 串行执行 + 每标的总仓位 cap |
| Polymarket SDK V2 升级再回归 | adapter 走 SDK 抽象层，不 hardcode 合约地址 |
| 高频 cron 撞 Polymarket rate limit | 用户串行 + per-user 分散到不同时间窗 |

## 4. 上线门槛（Phase 3a → 公开 Beta 之前必须满足）

- [ ] 3a.0/3a.1/3a.2/3a.3 全部 commit + typecheck + build green
- [ ] 19 unit tests 全过 + 加新 adapter / bridge / cron 单测覆盖
- [ ] 1 周 dogfood 跑通（3a.4），至少 5 笔真单成功 + 1 次失败优雅处理
- [ ] 三方对账脚本日跑无 diff
- [ ] Privy session signer 在 production dashboard 配好（用户操作）
- [ ] `docs/internal/plan/mode-a-cutover-runbook.md` 写完
- [ ] 用户授权一个公开 demo 账号 + 余额（$50-100）作为最初的展示位

## 5. 不做的事（边界）

- **不做** Mode B（用户审批 ramp）—— 留 Phase 3b
- **不做** copy trading 槽位 —— 永久不做
- **不做** 付费 tier —— 6 个月后再说
- **不做** 移动端 / PWA —— Web only
- **不做** 多链（Hyperliquid 等）—— Phase 4

---

**下一步**：3a.0 worktree agent → merge → 3a.1 → merge → 3a.2 → merge → 3a.3 → merge → wrap-up + handoff for dogfood
