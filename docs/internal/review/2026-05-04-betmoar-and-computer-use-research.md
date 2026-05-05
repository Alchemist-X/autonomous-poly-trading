# Research — betmoar 运行模式 + Computer Use 集成可能性

> 2 个 sub-agent 并发调研合并稿 · 2026-05-04
> 完整报告参见会话记录；本文件是可执行结论。

---

## Part 1 — betmoar 运行模式

### 关键事实纠正（之前数据过期）

- **累计 routed volume：$817M**（不是早期的 $50M）
- **trailing 30-day：$29.42M**（[builders.polymarket.com](https://builders.polymarket.com/) 实时榜单，#1 builder）
- 是 #2 PolyCop（$134M lifetime）的 6.1×

### 商业模式已确认


| 维度            | 事实                                                                                                            | 来源                              |
| ------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 托管            | **完全非托管**——funds 在用户自己的 Polymarket proxy 钱包里                                                                  | betmoar.fun/polymarket-terminal |
| 产品形态          | **Web Terminal + Discord Bot + Telegram alerts**——三个 surface，**没有** copy trading、没有 paid tier、没有 managed fund | docs.betmoar.fun                |
| 收入            | 100% 靠 Polymarket Weekly Rewards Pool（约 0.5-1% routed volume）；user fee = $0/$0；无订阅、无 token、无明确 grant 公示       | chainstory.co + polytrackhq.app |
| 团队            | 匿名，无名公开                                                                                                       | chainstory.co                   |
| Onboarding 痛点 | 用户必须先有 Polymarket 账号 → export 私钥 → 导入 MetaMask → 接 betmoar                                                    | docs.betmoar.fun                |
| 竞品反例          | 三方目录（polymark.et 等）说有 copy trading，**但 betmoar 自家所有 surface 都没有**                                             | 直接核对 betmoar.fun                |


### 6 个 Raven 可选模式（按 Raven 锁定决策过滤后）

Raven 锁定：非托管 + AI managed + builder code 收入 + Privy 邮箱/Google/Twitter onboarding。


| Mode                           | 描述                                               | 差异化                       | 工程量 | 与 betmoar 关系                    |
| ------------------------------ | ------------------------------------------------ | ------------------------- | --- | ------------------------------- |
| **A. Pure Managed AI**         | 用户存款 → 授权 session signer → AI 全自动跑               | **最高**（Polymarket 生态没有同类） | 中   | betmoar 故意不做的领域                 |
| **B. AI 提案 + 用户审批**            | AI 出 daily plan，用户点 approve 才执行                  | 低（看起来像 smart terminal）    | 低   | 不冲突                             |
| C. AI + Copy slot              | Bankroll 拆 70/30，30% 跟单 leader                   | 中（白地）                     | 高   | betmoar 也不做（concentration risk） |
| D. AI + Power Terminal         | AI default + Betmoar 风格终端 + 都带 builder code      | 低（正面对刚 betmoar）           | 高   | **直接竞争**                        |
| E. Tiered (Free AI / Paid Pro) | 免费 AI + 付费定制 mandates / copy slots / Telegram 私频 | 中                         | 中-高 | betmoar 故意 0 美元，可能客户也不愿付        |
| F. Pure Signal-only            | 抛弃 trading，只发信号                                  | n/a                       | 低   | **背离 Raven 锁定决策**               |


### 推荐执行路径

- **Phase 3a（4-6 周）：Mode A 先上**——Phase 2 已经把 session signer + builder code + Privy onboarding 都铺好，A 是顺势完成。差异化最强，没人在做。
- **Phase 3b（4-8 周后）：Mode B 当 onboarding ramp 包 Mode A**——新用户头 5 天先 approve-style，过 N 次后自动升级到 A。同后端、不同 gate。
- **暂时不做**：C、D、E、F。理由各异（详见会话记录长稿）。

### 待用户拍板的 3 个 Mode A 子决策

1. **Session signer scope**：per-trade 一次性签 vs time-windowed（24h，server 侧 enforce caps）？前者更安全、后者更便宜更快
2. **Mode B 审批粒度**：每单审批 vs plan-level（一键批 5 单）？plan-level 转化高得多
3. **6 个月内只靠 builder rewards 收入 OK 吗**？ vs 同时上一个 $X/月 paid tier

---

## Part 2 — Computer Use 集成可能性（**用户标注 P2，后续监控/事件交易方向**）

> **状态更新（2026-05-04 用户决策）**：Computer Use 整体降到 P2，作为**后续监控 / 事件交易方向**的 TODO。Mode A 主线不依赖任何 CU 集成。下面 §C / §D / §E 内容保留作未来选型参考；当前不启动任何 CU pilot。


### 当下状态（May 2026）

- **最佳模型**：`claude-opus-4-7`（Apr 2026 出）= 78.0% OSWorld-Verified；`sonnet-4-6` = cost-effective 选项
- **真实世界场景成功率**：~50-60%（modal/loading state 干扰）；benchmark ~75%；人类 ~87%
- **延迟**：每动作 2-5s；50 动作任务 = 2-4min（**不能放 HTTP 同步路径**）
- **成本**：每动作 Sonnet $0.006-0.011；典型 50-100 动作任务 $0.60-$1.80
- **限制**：无内置 CAPTCHA solver、prompt-injection 风险（Anthropic 官方 explicit warning）、多 tab 需要 app 层编排、登录流程官方建议谨慎
- **架构**：dockerized cron 是主部署方式；admin-only 工具是 Raven 应该用的 framing

### 8 个集成场景的 verdict


| #      | 场景                                    | 月成本        | 工期       | Verdict            | 原因                                                                    |
| ------ | ------------------------------------- | ---------- | -------- | ------------------ | --------------------------------------------------------------------- |
| C1     | News scraping (Bloomberg/Reuters/NYT) | $1k+       | 1-2w     | 🔴 Skip            | 法律风险（NYT/Anthropic 诉讼）+ ToS 违反                                        |
| C2     | Polymarket leaderboard 抓取             | $900       | 3-5d     | 🔴 Skip            | **Polymarket 自家有 API**——CU over-engineering                           |
| **C3** | **UMA 仲裁监控**                          | **$20-60** | **4-7d** | **🟢 Pilot**       | **唯一 API 不能覆盖的部分**（Discord rationale + Twitter evidence + UMA UI 三合一） |
| C4     | Manual trade fallback                 | varies     | 1w       | 🔴 Skip            | **Catastrophic**——25% 误点率 × 真钱 + 3min 延迟                              |
| **C5** | **Privy onboarding QA on testnet**    | **$25**    | **1w**   | **🟢 Pilot**       | Modal/iframe 重的流程是 vision-driven 比 DOM-driven 强的典型场景                  |
| C6     | 视觉 QA augmentation                    | $50        | +3d      | 🟡 Maybe           | C5 之后再扩；常用场景用 Stagehand 更便宜                                           |
| C7     | 竞品监控（betmoar 等 landing）               | $55        | 2d       | 🟡 用 Playwright 替代 | Playwright + screenshot diff 几乎免费就够                                   |
| C8     | 客服查用户 Safe                            | $30+ticket | 1w       | 🔴 Skip            | **建 admin panel 直查自己后端，不要爬自己产品**                                      |


### Top 2 推荐 + kill-switch

#### D1. UMA 仲裁监控（**最优先**）

- **为什么先做**：(a) 没有 API 能拿到 Discord rationale + Twitter evidence + UMA UI 这一套；(b) read-only 零资金风险；(c) 直接挂上 Raven 的核心优势——比市场提前知道 resolution 翻盘 = 提前减仓
- **MVP 1 周**：dockerized cron（Anthropic 官方 reference container 起步）→ 监控 Raven 已持仓的 Polymarket 标的，进入 disputed 状态时触发 CU run → 抓 UMA 投票 + Twitter + Discord rationale → 写 Markdown summary 推 Slack/email
- **预算**：Sonnet $5-15/周
- **kill-switch**：连续 2 次 vote tally 幻觉 / Anthropic injection classifier 报警 / 月支出 > $100 / 30 天没出过有效 alert → 全部 disable

#### D2. Privy onboarding E2E QA on testnet（次优先，可并行）

- **为什么**：Privy + Safe deploy + USDC bridge 涉及 email OTP、modal、iframe、签名 UI——Playwright DOM selector 经常坏；vision-driven CU 抗 UI churn 是它最强项
- **MVP 1 周**：每晚 cron → 起 Anthropic CU container → 跑 Privy 邮箱注册 → Polygon Amoy testnet Safe 部署 → 桥 testnet USDC → 开 AI trading toggle → 验证 dashboard
- **预算**：~$25/月
- **kill-switch**：1 周 > 3 次假阳性 / 任何一次跑到 mainnet → 全停 + audit / Privy & Safe 自家 Playwright fixture 出来 → 迁回 Stagehand

### 默认工具链建议（除上面 2 个 CU pilot 外）

> "Browser-ish" 任务的默认选择**不是 CU**：

- **DOM 可见 + 不被 anti-bot 墙挡**：Stagehand v3 + Sonnet 4.6（~~75% 成功率，~~$0.05-0.20/run，比 CU 快 + 便宜 + 维护好）
- **撞 Cloudflare Turnstile / 需 residential proxy**：加 Browserbase 当 runtime，仍用 Stagehand 驱动
- **以上都不行（canvas chart / image-only UI / D2 这种 modal 地狱）**：才用 Anthropic CU 的 dockerized cron

### 5 件不要用 CU 做的事

1. ❌ 真钱实盘 fallback（违反 CLAUDE.md §6 fail-fast）
2. ❌ 用户钱包 / PII scraping（建 admin panel 查自己后端）
3. ❌ 绕付费墙抓新闻（NYT 诉讼活跃，CFAA 风险）
4. ❌ HTTP 同步后端（2-4min 延迟，Vercel timeout）
5. ❌ pilot 阶段连任何 mainnet 钱包（资金有任何风险都不行）

---

## 合并行动建议（**已按 2026-05-04 用户决策更新**）

| 顺序 | 动作 | 工期 | 状态 |
| --- | --- | --- | --- |
| 1 | **Mode A Phase 3a.0 — Builder code 接入 executor**（Pizza 钱包） | 10-15min | ✅ done (commit `a6513bc`) |
| 2 | **Mode A Phase 3a.1 — PolymarketAdapter 真实现** | 1-2h | 进行中 |
| 3 | Mode A Phase 3a.2 — Pulse → Dispatcher 桥 | 1-2h | 待 3a.1 完成 |
| 4 | Mode A Phase 3a.3 — Cron + 观测 + 报警 | 2-3h | 待 3a.2 完成 |
| 5 | Mode A Phase 3a.4 — 用户内部 dogfood 1 周 | 1 周 | 待用户参与 |
| **P2** | **Computer Use D1 / D2** — 后续监控/事件交易方向，不阻塞 Mode A | 各 1 周 | **延后**（用户决策 2026-05-04）|


---

## 来源

完整 URL 列表见调研 agent 原始报告（保存在 conversation log）。两个 agent ID：

- betmoar 调研：`a094020f9a3a0b037`
- Computer Use 调研：`afb9b0ae67552cc85`

