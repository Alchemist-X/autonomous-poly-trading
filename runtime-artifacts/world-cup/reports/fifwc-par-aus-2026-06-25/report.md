# 巴拉圭 vs 澳大利亚 — 2026 世界杯 D 组（市场盲测预测）

- 比赛：2026-06-25（北京时间 6 月 26 日 10:00，UTC 2026-06-26T02:00）
- 地点：美国加州圣克拉拉 Levi's Stadium（中立场地，第 60 场）
- 结算元数据：事件 slug `fifwc-par-aus-2026-06-25`（仅作标识，本预测不参考任何盘口）

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 巴拉圭胜 | **41%** | 35% – 47% | 低 |
| 平局 | **27%** | 21% – 32% | 低 |
| 澳大利亚胜 | **32%** | 26% – 38% | 低 |

**一句话观点：** Elo 显示巴拉圭小幅占优，但两队各缺一名主力中场、澳大利亚备战充分，41/27/32 的三路分布意味着胜负仍相当开放。

## ② 预测定义

90 分钟（含补时）三路赛果：巴拉圭胜 / 平 / 澳大利亚胜。小组赛无加时、无点球大战。

## ③ 实力画像

- 巴拉圭：Elo 1834（世界第 22），主帅 Gustavo Alfaro，以防守纪律、身体对抗和定位球见长；核心包括 Miguel Almirón、后防 Gustavo Gómez / Omar Alderete。来源：eloratings.net（抓取 2026-06-11）；FIFA.com 巴拉圭队报道（2026-06）。
- 澳大利亚：Elo 1777（世界第 28），主帅 Tony Popovic，6 月 1 日公布 26 人名单；自 4 月起在佛罗里达 Sarasota 长期集训，是全部 48 队中最早抵美备战的球队。来源：eloratings.net（2026-06-11）；fifaworldcupnews.com / fifa-26.com（2026-06-01）。
- Elo 差 57 分，属于"小幅优势"区间，远不足以形成压倒性强弱关系。

## ④ 关键因素

1. **巴拉圭缺 Villasanti**：主力中场 Mathías Villasanti 因 2025 年前交叉韧带（ACL）撕裂落选名单；该伤为旧伤，其缺席效果已部分反映在近期 Elo 战绩里。来源：asunciontimes.com / beinsports.com（2026-06-01）。
2. **澳大利亚缺 McGree**：中场 Riley McGree 腿筋伤退出世界杯，他原被视为澳队中场首发与远射威胁；此伤较新，Elo 尚未消化。来源：ESPN 世界杯伤情追踪（2026-06，持续更新）。
3. **澳大利亚适应性占优**：4 月起的 Sarasota 长周期备战 + 最早抵美，气候/时差适应充分。来源：fifaworldcupnews.com（2026-06-01）。
4. **赛程位置（末轮场次）**：本场为 D 组第 60 号比赛（小组赛第三轮），届时积分形势可能放大或削弱双方求胜动机，存在轮换/保平等不可预知变量。来源：Wikipedia「2026 FIFA World Cup Group D」、fox.com 赛程页（访问 2026-06-11）。
5. **风格匹配**：巴拉圭的防守反击 + 定位球打法对阵实力接近的对手时，平局概率往往不低。来源：mlssoccer.com D 组前瞻（2026-06）。

## ⑤ 模型与调整

- p_stat（Davidson 三路模型，scale=400，drawNu=0.7，中立场地无主场加成）：
  巴拉圭 43.2% / 平 25.7% / 澳大利亚 31.1%
- 证据调整（合计 2pp，远低于 ±8pp 上限）：
  - 巴拉圭 −2pp：McGree 伤退与 Villasanti 缺阵大致对冲，但后者已被 Elo 部分消化、前者未被消化；叠加澳队备战适应优势。
  - 平局 +1pp、澳大利亚 +1pp：风格匹配与末轮变量略增平局与冷门空间。
- p_final：**巴拉圭 41% / 平 27% / 澳大利亚 32%**
- 本预测为**市场盲测**：完全独立于任何博彩盘口、预测市场价格或隐含概率，未参考任何赔率数据。

## ⑥ 方法说明

概率基线来自 eloratings.net 世界 Elo（2026-06-11 抓取）+ Davidson 三路平局模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致：scale=400，drawNu=0.7；东道主仅限墨西哥/美国/加拿大本土小组赛 +100，本场双方均不适用）。在此之上仅依据有来源、有日期的公开事实做不超过 ±8pp 的有限调整。80% 区间反映 drawNu 0.6–0.8 的参数敏感性（巴拉圭胜 41.7%–44.9%）及开赛前 14 天阵容未定、末轮动机不确定带来的额外不确定度。

### 来源清单

1. eloratings.net World.tsv（抓取 2026-06-11）— https://www.eloratings.net/World.tsv
2. FIFA.com — Paraguay squad announcement（Gustavo Alfaro），2026-06 — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/paraguay-squad-announcement-gustavo-alfaro
3. beIN Sports — Gustavo Alfaro and Paraguay Squad for the FIFA World Cup 2026，2026-06-01 — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/gustavo-alfaro-and-paraguay-squad-for-the-fifa-world-cup-2026-2026-06-01
4. Asuncion Times — Paraguay's 2026 World Cup Squad Revealed，2026-06 — https://asunciontimes.com/sport/international-sport/26-names-one-nation-paraguays-2026-world-cup-squad-revealed/
5. fifaworldcupnews.com — Australia World Cup 2026 Squad，2026-06-01 — https://www.fifaworldcupnews.com/australia-world-cup-2026-squad/
6. ESPN — 2026 World Cup injuries tracker，2026-06 — https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info
7. Wikipedia — 2026 FIFA World Cup Group D（访问 2026-06-11）— https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_D ；FOX 赛程页 — https://www.fox.com/soccer/fifa-world-cup/paraguay-vs-australia-jun-25-2026-group-d

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
