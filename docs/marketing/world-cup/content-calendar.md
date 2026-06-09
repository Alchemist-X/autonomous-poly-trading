# 40 天内容日历（content-calendar）· Website + Discord only

> 英文版见 [content-calendar.en.md](content-calendar.en.md)。
> 用途：上线 40 天的内容节奏蓝本（仅 docs/content）。**已适配为 Website + Discord，去掉所有 X/Twitter 项**（用户决定：暂不上 X）。
> 来源：`docs/internal/plan/2026-06-09-world-cup-special-plan.md` §7（40 天日历、Week-1 清单）、§6（漏斗）、§9（路线图）。
> 时间锚点：今天 2026-06-09，揭幕 6/11，决赛 7/19。

---

## 0. 渠道说明（重要变更）

原计划是"EN/CN X → Website → Discord"单向漏斗。**本次仅 Website + Discord**：
- **Website** = 承接 + 可信度沉淀（比赛报告 + 三方记分牌）。
- **Discord** = 私域/留存 + 唯一的主动分发渠道（每日预测、记分播报、内测）。
- 没有 X 的曝光环，因此**冷启动更依赖 Discord 邀请扩散 + 比赛报告的 SEO/可分享性 + 点播报告（#request-a-report）**。原计划里"OG 卡转发到 X"改为"OG 卡用于比赛报告页分享 + Discord 帖配图"。

---

## 1. 每场比赛节奏（per-match cadence）

| 时点 | 动作 | 落点 | 自动/人工 |
|---|---|---|---|
| **赛前 T-8h** | 预测帖：比赛 / 我们的 P / 市场 P / 研究信号 / 80% 区间 / 报告链接 | Discord `#daily-forecasts`（+ 网站比赛报告已就绪可点） | bot 草稿，admin 发（语气定稿人工，plan §7） |
| **赛后 T+1h** | 结算复盘：实际结果 + 三方 Brier + 命中与否（**输了照发**） | Discord `#leaderboard`（+ 网站记分牌更新） | bot 草稿，admin 发 |
| **每周一次** | 累计 Brier 复盘：三方平均 Brier + 已结算数 + 趋势 | Discord `#leaderboard` + 网站记分牌头条 | bot + admin |
| **长线（持续）** | 夺冠 48 腿 / 金靴等概率漂移更新（如德国夺冠） | 网站长线追踪表 + Discord 不定期 | agent 维护 JSON |

> 模板见 [discord-setup.md](discord-setup.md) §5（预测卡 / 结算复盘 / 周复盘）。比赛报告的完整 7 阶段始终是承接落点。

---

## 2. Week-1 上线 checklist（6/9–6/15，揭幕周）

> 北极星（plan §7 KPI）：**闭环跑通**。不追量，先把"报告→记分→私域"打通。能手动先手动（plan §7"不做"清单）。

- **D0（6/9，今天）**
  - [ ] 网站落地页文案上线（用 [landing-copy.md](landing-copy.md)），页脚挂 disclaimer。
  - [ ] 建 Discord 6 频道 + Rules Screening（用 [discord-setup.md](discord-setup.md) 的 `#rules` / 欢迎语 / 角色）。
  - [ ] 确认 Discord 邀请链接可用，放进网站 CTA。
- **D1（6/10）**
  - [ ] 为 2–3 场揭幕周比赛预生成报告 + PDF（VPS 跑真实 7 阶段，plan §9 Phase 0）。
  - [ ] 三方记分牌底座上线（哪怕先手动 JSON、3 条也行，plan §7 D3–D7）。
  - [ ] 确认线上可登录 + 发首批内测码（`--max-uses 50 --label wc-week1`，plan §7 D1）。
- **D2（6/11，揭幕日）**
  - [ ] **发布旗舰内容**：德国 +3.6pp 回应（用 [germany-response.md](germany-response.md)，先填好揭幕前能定的占位，其余标 TODO）。
  - [ ] 揭幕战预测卡：`fifwc-mex-rsa-2026-06-11`（墨西哥 vs 南非）→ `#daily-forecasts`。
  - [ ] Discord `#announcements` 置顶"我们是谁 / 怎么记分"。
- **D3–D7（6/12–6/15）**
  - [ ] 跑通 ≥3 场全链路（赛前卡 → 赛后复盘 → 记分入表）。揭幕周锚定 `fifwc-mex-rsa-2026-06-11` + `fifwc-kr-cze`（韩国 vs 捷克）建基线（plan §7 W1）。
  - [ ] 验证一次完整漏斗：在 `#request-a-report` 收到点播 → 发报告链接 → 用户登录 → 发码 → 激活 → 成功跑一次 custom run。
  - [ ] 上线 `/world-cup/leaderboard`（哪怕 3 条已结算）。
  - [ ] 攒齐**首批 ~20 场小组赛 cached 报告**（plan §9 Phase 0："先跑 ~20 场热门小组赛"）。
- **不做（Week-1）：** OG 自动渲染打磨、付费分层、复杂机器人、投放（plan §7）。无 X，所以也不做任何 X 账号/置顶。

---

## 3. 周节奏（W1–W6，贴真实赛程）

| 周 | 日期 | 阶段 | 重点比赛（plan §7 点名） | 内容重心 |
|---|---|---|---|---|
| **W1** | 6/9–6/15 | 揭幕周 | `fifwc-mex-rsa-2026-06-11`、`fifwc-kr-cze` | 建记分牌底座、跑通闭环、发德国旗舰内容、攒 ~20 场 cached 报告 |
| **W2** | 6/16–6/22 | 小组赛走量 | `fifwc-bra-mar`（巴西 vs 摩洛哥）、`fifwc-arg-alg`（阿根廷 vs 阿尔及利亚） | 流量峰值，抓反共识冷门；每场预测卡 + 复盘准时 |
| **W3** | 6/23–6/27 | 小组赛收尾 | `fifwc-fra-sen`（法国 vs 塞内加尔）、`fifwc-esp-ksa`（西班牙 vs 沙特） | 记分牌斜率（plan §7 目标 Brier<0.25）；每 3 天累计 Brier 复盘 |
| **W4** | 6/28–7/4 | 淘汰赛 R32/R16 | 每场高制作深度报告 | 每场"7 阶段全摊开"深度帖（Discord 长贴 + 网站报告） |
| **W5** | 7/5–7/11 | QF/SF 临近 | 8 强 / 4 强 | 留存 + 深度；vs 市场 edge 为正（plan §7 目标） |
| **W6** | 7/12–7/19 | SF → Final | 决赛 `<<TODO: final slug>>` | 决赛全程深度报告 + **Brier 总结作对外引用资产**（plan §9 Phase 3） |

> 长线 call 全程更新：夺冠 48 腿（含德国）/ 金靴概率漂移，随分组/淘汰赛进程重算。

---

## 4. 每周固定动作（贯穿全程）

- **每场：** 赛前 T-8h 预测卡（`#daily-forecasts`）+ 赛后 T+1h 复盘记分（`#leaderboard`）。
- **每 3 天：** 累计 Brier 复盘贴（飞轮，风雨无阻，plan §7）。
- **每周 1 次：** "7 阶段全摊开"深度帖（CN/EN，网站长文 + Discord）。
- **人工每天露面 1 次：** admin 在 Discord 出现，答 `#request-a-report` / `#beta`（plan §7）。
- **唯一不可妥协：** Brier 公开且不造假；输了照发（plan §7）。

---

## 5. 分工（human vs agent，plan §7）

- **Agent 自主：** 赛前/赛后帖草稿（CN+EN）、OG 卡生成、定时 Discord 播报、维护记分牌 JSON + 重算 Brier、FAQ 自动答、配额异常报警。
- **Human 必管：** 发布键 / 语气定稿（尤其"我们错了"复盘）、邀请码发放策略、任何真钱动作、Discord 账号所有权（plan §10 Open Question Q5：账号谁持有需先确认）。

---

## 免责声明（MANDATORY — 每条对外帖与本日历对应的所有内容均须带短版）

> 本内容提供基于公开数据的**概率估计与研究分析**，**不构成任何金融、投资或投注建议**。所有预测均为**概率而非确定性结果**；过往表现不代表未来。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。18+。
