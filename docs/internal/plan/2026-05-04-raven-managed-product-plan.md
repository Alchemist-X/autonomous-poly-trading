# Raven Managed Product 计划（C 端 AI 资管 + Polymarket Builder）

> 关联 task：1–5
> 最后更新：2026-05-04
> 状态：**Phase 1 骨架已完成**（typecheck + `next build` 绿）；Phase 2 待启动

## changelog

- 2026-05-04 ✅ Phase 1 骨架完成：`apps/raven-managed/` 独立 app（端口 3100）、Privy 邮箱登录、`/signup` → `/onboard` → `/dashboard` → `/track-record` 路由、`POST /api/users/register` + `GET /api/users/portfolio`、DB `managed_users` + `managed_deposits` 表 + migration `0002`。**未接入 Polymarket Safe 真实部署 / 未接入 builder-relayer-client / 未启用 session signer**——这些都是 Phase 2 范围。
- 2026-05-04 计划修订：根据用户 inline 批注调整 §1（加 §1.1 适应性约束）、§2（session signer scope 不死锁）、§3（同上）、§7（前端不预留 KYC hook）、§8（实际文件清单）。开 `builder-raven` branch 推进。
- 2026-05-04 决策锁定：Privy / 一路推到 Phase 3 / 仅 builder fee / 独立 app（见 §0）

## 0. 锁定决策（2026-05-04 用户确认）

- **Auth provider**：Privy（邮箱 + embedded EOA + session signer 原生支持）
- **MVP 范围**：一路推到 Phase 3 实盘（多会话推进，单会话只承诺到自然检查点）
- **费用模型**：MVP 阶段**仅收 Polymarket builder fee**（被动分成）；管理费/业绩费等用户量起来再叠加
- **代码组织（2026-05-04 用户追加）**：**新建独立 Next.js app `apps/raven-managed/`**，不复用/不修改现有 `apps/web`（AutoPoly 观测站独立保留）。两 app 共享 `packages/db` / `packages/contracts`，独立部署独立域名。

## 1. 产品目标（一句话）

把 Raven 现有的"单钱包 AI 实盘交易"封装成 C 端可注册的资管产品：用户邮箱注册 → 资金存入自己的 Polymarket Safe（非托管）→ Raven 用 session signer 替用户跑默认 AI 策略 → Raven 作为 Polymarket builder 拿订单分成 + 收取管理/业绩费。

### 1.1 适应性约束（Polymarket Safe 设计还在演进）

Polymarket Safe / 代理钱包的实现还在迭代（V2 已上 2026-04-28，后续可能继续变）。架构必须**对接 Polymarket 官方 SDK 抽象层而非自己重写底层**：

- Safe 部署、approvals 推送、签名类型 = 一律走 `@polymarket/builder-relayer-client`，不自己 hardcode 工厂地址或 CREATE2 salt
- 所有合约交互通过 `@polymarket/clob-client` v2 的高层 API，不直接 encode `CTF Exchange` calldata
- Polymarket 升级新合约 / 改 Safe 实现时，**只需 bump SDK 版本 + 跑回归**，不要触及业务层
- `services/managed-trading/` 里 abstract 一层 `PolymarketAdapter` interface，把"如何部署 Safe / 如何下单 / 如何查仓"都收口在 SDK 调用，业务代码不依赖 Safe 内部实现细节

## 2. 关键约束

- **非托管**：用户资金始终锁在用户自己的 Safe Proxy 里。Raven 的 session signer **scope 跟随 Polymarket builder 官方参考实现**（`Polymarket/privy-safe-builder-example`），不在 SDK 之上额外做白名单收紧——这样所有 Polymarket 功能（下单、redeem、claim winnings、未来新功能）都能用，而不会因为我们手写白名单而把自己锁死。非托管承诺由 Polymarket Safe 本身保证（资金不会跨出用户 Safe 到第三方地址）。
- **真钱实盘**：每个动作不可逆，参考现有 `pulse:live` 的 preflight / hardstop 模式，每用户独立风控。
- **持牌运营**：用户已持有相关资管牌照（确认 `2026-05-04`）——合规问题用户负责，本文档不展开 KYC/AML 流程，前端不预留 KYC hook。
- **复用现有 Raven 基础设施**：Pulse 推理、`services/executor` 风控、`packages/db` 仓位记录、Pizza dashboard 经验全部复用，不从零造。

## 3. 架构（Polymarket 官方支持的形态）

```
用户邮箱 → Privy embedded wallet (EOA)
        ↓ deterministic CREATE2
       Polymarket Safe Proxy（用户资金所在地，USDC.e）
        ↓ 用户一次性授权
       Privy session signer（Raven 后端持有，scope 受限）
        ↓ Raven AI 决策
   @polymarket/builder-relayer-client + @polymarket/clob-client
        ↓ builder code = Raven
       Polymarket CLOB 订单 → 成交分成入 Raven builder 账户
```

### 关键依赖（Polymarket 官方 SDK）

- `@privy-io/react-auth` — 邮箱登录 + 嵌入式 EOA
- `@polymarket/clob-client` — 下单 / 查询订单
- `@polymarket/builder-relayer-client` — Safe 部署 + token approvals + builder 归因
- `@polymarket/builder-signing-sdk` — 后端 HMAC 签名（保护 builder 凭证）
- `viem` / `ethers v5`

参考实现：`Polymarket/privy-safe-builder-example`（官方仓库）

### Session signer 模型

- 用户首次开启"AI 自动交易"时，签 EIP-712 消息授权 Raven 后端的 session pubkey
- 授权 scope **跟随 Polymarket builder 参考实现，不自己加白名单收紧**——所有 Polymarket 功能（trade/redeem/claim/未来新功能）默认全可用，避免 SDK 升级时被白名单卡住
- 可选 spending cap（per-user 风控）、可选过期时间（用户自定）、随时可链上撤销
- Raven 后端 session privkey 必须在 KMS / HSM / Turnkey 这种隔离环境里，不允许明文落盘
- 非托管承诺的根基不靠"我们自己加白名单"，而靠 **Polymarket Safe 本身的合约设计**（Safe 的资金路径只能流向 Polymarket 自有合约，不能转给第三方地址）

## 4. 风险面（必须在代码里体现）

| 风险 | 缓解 |
| --- | --- |
| Raven session key 被盗 → 攻击者刷量榨干用户钱 | KMS 托管 + per-user spending cap + 异常下单频率 alert |
| 用户在 Raven 决策中途撤销 session signer | 后端每次下单前检查 session validity，失败时归档为 `revoked` 状态而非 retry |
| Builder fee 对账歧义（Polymarket 后台 vs 链上） | 双源记账：CLOB API 的 fill 记录 + 链上 `OrderFilled` event，每日自动 diff |
| 用户 Safe USDC 余额不足 / approvals 缺失 | 下单前 preflight，余额/授权不足直接 skip 并通知用户 |
| 多用户并发跑 daily-pulse 导致同一标的滑点放大 | 订单按用户分散到不同时间窗 + 每标的总仓位 cap |
| 中国/美国/受限地区合规 | 前端 geo-block + ToS 强制勾选；用户自有牌照覆盖范围由用户确认 |

## 5. 阶段拆分

### Phase 1（前端骨架，1–2 周）— 不真下单

**目标**：用户可注册、可入金、可看到自己的 Safe 余额；Raven 不做任何交易决策。

- **新建 `apps/raven-managed/`**（独立 Next.js 16 app，不动 `apps/web`）
  - `/` landing 页（产品介绍 + CTA → /signup）
  - `/signup` Privy 邮箱登录
  - `/onboard` 自动部署 Safe Proxy + 拉起 USDC.e 入金（Polygon 桥引导）
  - `/dashboard` 用户视图：余额、approvals 状态、"开启 AI 自动交易"开关（默认关闭，Phase 2 才生效）
  - API：`POST /api/users`（首登创建）、`GET /api/users/:id/portfolio`（链上读取）
- DB：`packages/db` 加 `managed_users` 表（id, privy_id, eoa, safe, status, created_at）—— 与 AutoPoly 现有表共库共 schema，不冲突
- `apps/web` 维持现状（AutoPoly 观测站）

**完成标准**：本地起 dev，邮箱注册 → 看到分配的 Safe 地址 → 转入 USDC.e → 余额刷新展示。**不联通任何下单逻辑**。

### Phase 2（Paper trading + session signer 联调，2–3 周）

- 用户 dashboard 增加"授权 AI 自动交易"按钮 → 触发 Privy session signer 授权
- `services/managed-trading` 接入现有 `daily-pulse` 信号：每个授权用户都跑一次 Pulse 决策（按其风险偏好缩放仓位）
- **Paper mode 优先**：决策结果只写 db、不真下单，dashboard 展示"虚拟仓位"
- builder client 集成：用 `@polymarket/builder-relayer-client` 在 staging 上 dry-run

**完成标准**：3 个测试账户（含真钱小额账户）开启 AI → 看到 paper 模式决策记录每日产出，所有 builder client 调用在 dry-run 通过。

### Phase 3（实盘 + 费用账本，2–3 周）

- 加 per-user 风控（复用 `services/executor` 现有的 15%/80%/30%/22 仓上限，按用户 bankroll 缩放）
- 切到 live：session signer 真签真下单，订单带 Raven builder code
- 费用账本：管理费（按月扣 X% AUM）+ 业绩费（高水位法 Y% of profit）+ builder fee（Polymarket 月结自动入账）
- 用户提现流程：用户在自己的 Safe 直接提，Raven 不参与，但 dashboard 给一键引导

**完成标准**：1 个真钱账户跑满一个完整周期（入金 → AI 交易 → 月底结算管理费 → 用户提现），所有数字三方对账（链上 / Polymarket CLOB / Raven db）一致。

### Phase 4（可选，扩展）

- Hyperliquid builder code 接入（perp 扩展）
- 多策略选择（保守 / 平衡 / 激进）
- Referral：用户拉新分润
- 移动端 PWA

## 6. 开放决策

全部已在 §0 锁定。后续如需调整费用模型 / 切换 auth，需在本文件追加 changelog 条目。

## 7. 不做的事（明确边界）

- 不做 Raven 自有钱包托管（监管风险过高，用户已选非托管路径）
- 不做 KYC/AML 系统（用户牌照覆盖，本期前端只做 ToS 勾选 + geo-block）
- 不做提币功能（用户从自己的 Safe 自助提，Raven 没有钱，也没必要做）
- 不重写 Pulse 决策引擎（Phase 2 直接复用 `daily-pulse`，每用户独立风控参数即可）
- 不做客服 / 工单系统（MVP 用 email + Discord）

## 8. 文件改动一览（实际，Phase 1 已落地）

新增：
- `apps/raven-managed/`（独立 Next.js 16 app，端口 3100）
  - `app/page.tsx` — landing
  - `app/signup/page.tsx`
  - `app/onboard/page.tsx`
  - `app/dashboard/page.tsx`
  - `app/track-record/page.tsx`（外链至 AutoPoly 观测站）
  - `app/api/users/register/route.ts`
  - `app/api/users/portfolio/route.ts`
  - `components/providers.tsx`、`components/top-bar.tsx`
  - `lib/privy-server.ts`
  - `app/globals.css`、`app/layout.tsx`
- `packages/db/src/migrations/0002_managed_users.sql`
- 在 `packages/db/src/schema.ts` 追加 `managedUsers` + `managedDeposits`

依赖新增（Phase 1 实际安装）：
- `@privy-io/react-auth@2.25`、`@privy-io/server-auth@1.18`、`viem`

Phase 2 待新增（不动 `apps/web`）：
- `services/managed-trading/`（新 service，daily-pulse 多用户分发器）
- `packages/db` 增 `managed_orders`、`managed_decisions`、`managed_fills` 表
- `apps/raven-managed/` 增 session signer 授权页 + Polymarket Safe 真实部署
- 依赖：`@polymarket/clob-client`、`@polymarket/builder-relayer-client`、`@polymarket/builder-signing-sdk`

---

**当前状态**：Phase 1 已完成且 build 绿，进入 Phase 2 准备阶段。下一步 = `services/managed-trading/` 服务骨架 + Polymarket builder SDK 集成 + session signer 授权流程接入。
