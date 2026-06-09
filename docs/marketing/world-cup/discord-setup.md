# Discord 服务器搭建（discord-setup）

> 英文版见 [discord-setup.en.md](discord-setup.en.md)。
> 用途：世界杯私域 Discord 的搭建蓝本（仅 docs/content）。渠道：Website + Discord（暂不上 X/Twitter）。
> 来源：`docs/internal/plan/2026-06-09-world-cup-special-plan.md` §7（6 频道 + 自动播报）、§8（disclaimer + 同意）。

---

## 1. 6 个频道（plan §7）

| 频道 | 类型 | 用途 | 谁能发言 |
|---|---|---|---|
| `#announcements` | 公告（只读） | 上线、记分牌里程碑、内测批次、重大变更 | 仅 admin |
| `#daily-forecasts` | 文字 | 每场赛前 T-8h 预测帖 + 链接到比赛报告 | bot + admin 发，member 可讨论（建独立 thread） |
| `#leaderboard` | 文字（只读为主） | 三方对照 Brier 记分牌自动播报 + 每周累计复盘 | bot + admin |
| `#request-a-report` | 文字 | member 点播想看的比赛/事件；我们优先做成公开报告 | 全员可发 |
| `#beta` | 文字 | 内测申请、邀请码发放说明、配额/用法答疑 | beta + admin（member 可见说明置顶） |
| `#general` | 文字 | 闲聊、自我介绍、跑题足球话题 | 全员 |

> 命名保持英文（频道名跨语言通用）；频道内文案中英混排，CN 内容复用网站文案语气。

---

## 2. `#rules` 频道文本（入群同意，MANDATORY）

> 用作 Discord 的 Rules Screening（入群必须勾选同意才可发言）。同意记录需回写 `app_users.metadata`（与网站同意口径一致）。

```
欢迎来到「独立 AI 超级预测器」世界杯社区。发言前请先同意以下规则：

1. 这是一个概率研究 / 教育社区。我们公开 AI 对世界杯的概率分析，并用公开 Brier 记分牌验证准不准。
2. 这里不是荐单/跟单社区。禁止索要或发布"稳赚/必中/跟单/今日推荐"类内容，禁止发布任何博彩平台充值/下注/affiliate 链接。
3. 我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
4. Forecasts are probabilities, not certainties. 预测是概率，不是确定结果；输了我们也照记。
5. 尊重他人、不刷屏、不发垃圾/诈骗信息。
6. 年龄与法律：预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律。本社区面向 18 岁及以上用户（18+）。
7. 你在 #request-a-report 等频道留下的内容可能被用于生成公开报告。

✅ 勾选即表示你已年满 18 岁、已阅读并同意以上规则与免责声明。

免责声明：本社区提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
```

---

## 3. 欢迎消息（新成员自动 DM / `#general` 置顶）

```
👋 欢迎！这里是「独立 AI 超级预测器」的世界杯社区。

我们做的事：用一套 7 阶段推理引擎，独立给出每场世界杯的概率，并把它和市场、和 Kimi 公布的概率放在同一张记分牌上逐场公开结算。

三步上手：
1️⃣ 看 #daily-forecasts —— 每场赛前的预测帖，附完整报告链接（免费、无需登录）。
2️⃣ 看 #leaderboard —— 三方对照 Brier 记分牌，我们准不准一目了然（输了也照记）。
3️⃣ 想自己跑分析？去 #beta 申请邀请码；想看某场比赛？去 #request-a-report 留言。

⚠️ 这是研究/教育社区，不是荐单。Forecasts are probabilities, not certainties. 我们不接受也不撮合任何投注。18+。
```

---

## 4. 角色结构（roles）

| 角色 | 怎么获得 | 权限 |
|---|---|---|
| `admin` | 团队成员，手动指派 | 全权限：管频道、发公告、管 bot、踢人/封禁 |
| `bot` | 自动播报机器人账号 | 在 `#daily-forecasts` / `#leaderboard` / `#announcements` 发帖；不参与人类频道 |
| `beta` | 用有效邀请码激活账号后指派（手动或 bot 校验后授予） | 解锁 `#beta` 发言；标识"已激活内测" |
| `member` | 通过 Rules Screening 即获得 | 可在 `#request-a-report` / `#general` / forecast threads 发言 |

> MVP 阶段 `beta` 角色可先手动指派（Week-1 不做复杂自动化，见 plan §7"不做"清单）。后续再考虑邀请码激活后自动授予。

---

## 5. 自动播报机器人计划（auto-broadcast bot）

> 目标：把"赛前预测 → 赛后记分 → 每周累计"自动同步到 Discord，人工每天露面 1 次即可（plan §7 分工）。**MVP 能手动先手动**，bot 是逐步替代手动的目标态。

### 每场比赛自动播报内容

| 时点 | 频道 | 内容 | 数据来源 |
|---|---|---|---|
| **赛前 T-8h** | `#daily-forecasts` | 预测卡：比赛 / 我们的 P / 市场 P / 研究信号(edge) / 80% 置信区间 / 报告链接 | `forecast_reports` 表（match_slug） |
| **赛后 T+1h** | `#leaderboard` | 结算复盘：实际结果 + 三方各自 Brier 分（我们 / Kimi / 市场）+ 命中与否 | `resolved_outcome` 回填后重算 |
| **每周一次** | `#leaderboard` | 累计 Brier 复盘：三方至今平均 Brier、已结算场次数、趋势 | 记分牌聚合 |

### 预测卡帖子模板（赛前 T-8h）

```
⚽ {主队} vs {客队} · {开赛本地时间}
📊 我们的概率：{我方 P} （80% 区间 {ci_low}–{ci_high}）
📈 市场（Polymarket 隐含，研究参照）：{市场 P}
🔍 研究信号（model − market）：{edge} pp
👉 完整 7 阶段报告：{报告链接}
—— Forecasts are probabilities, not certainties. 不构成投注建议。18+
```

### 结算复盘帖模板（赛后 T+1h）

```
✅ 结果：{实际结果}
🏅 本场 Brier（越低越准）：我们 {brier_us} · Kimi {brier_kimi} · 市场 {brier_mkt}
{我们这场是赢/平/输的一句中性点评——输了照发}
👉 记分牌全表：/world-cup/leaderboard
—— 研究记分，不接受也不撮合任何投注。
```

### 实现备注（给执行的人，不在本 docs 范围内写代码）

- bot 只读 `forecast_reports`（及记分牌聚合）渲染消息，**不调用任何下单/资金接口**。
- Kimi 那一列在播报里必须标注"Kimi 公布数据，引用对照"，无 Kimi 公开数字的场次留空或标 N/A。
- 任何"我们错了"的赛后帖，发布键归 human（plan §7 分工：语气定稿人工管）；bot 可生成草稿，admin 一键确认。
- 自动播报频率异常 / 数据缺失要告警到 admin（plan §7：配额/异常报警 agent 自主）。

---

## 免责声明（MANDATORY — `#rules` 与 bot 模板均已内嵌；服务器描述也应带短版）

> 本社区提供基于公开数据的**概率估计与研究分析**，**不构成任何金融、投资或投注建议**。所有预测均为**概率而非确定性结果**；过往表现不代表未来。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。18+。
