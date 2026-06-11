# 南非 vs 韩国 —— 2026 世界杯小组赛 A 组（市场盲测预测）

- **赛事**：2026 FIFA 世界杯小组赛 A 组第三轮
- **开球（UTC）**：2026-06-25T01:00:00Z（当地 6 月 24 日晚，墨西哥蒙特雷 Estadio BBVA）
- **生成时间**：2026-06-11T13:15:00Z ｜ 事件 slug（仅结算元数据）：`fifwc-rsa-kr-2026-06-24`

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 南非胜 | **16.6%** | 11% – 23% | 中 |
| 平局 | **22.9%** | 17% – 29% | 中 |
| 韩国胜 | **60.5%** | 50% – 69% | 中 |

**一句话观点**：Elo 差距 241 分使韩国成为明显占优一方，约六成胜率；但第三轮出线形势未定带来轮换不确定性，南非爆冷与逼平的合计概率仍接近四成。

## ② 赛果定义

90 分钟（含补时）三路赛果：胜 / 平 / 负。小组赛无加时、无点球大战，平局即为最终结果。

## ③ 实力画像

| 队伍 | Elo（2026-06-11） | Elo 排名 | 备注 |
| --- | --- | --- | --- |
| 南非 | 1517 | 80 | 26 人名单中 19 人来自南非本土联赛，主帅 Hugo Broos（Daily Maverick, 2026-05-27） |
| 韩国 | 1758 | 33 | 孙兴慜（33 岁，LAFC）第四次出战世界杯并任队长，状态出色（ESPN, 2026-05/06） |

Elo 来源：eloratings.net World.tsv 快照（fetched 2026-06-11T12:24:51Z）。

## ④ 关键因素

1. **Elo 差距 241 分**（1758 vs 1517），是本场基准概率的主导因素（eloratings.net，2026-06-11）。
2. **韩国中场黄仁范（Feyenoord）有踝伤隐患**，仍被洪明甫征召；中卫曹侑珉伤退、6 月 2 日由赵渭济替补入队（Olympics.com，2026-06：https://www.olympics.com/en/news/fifa-world-cup-2026-republic-of-korea-all-players-full-squad-list-key-stats-schedule）。
3. **南非左后卫 Aubrey Modiba 已恢复合练**，预计可出战，无其他重大伤情（The South African，2026-06：https://www.thesouthafrican.com/sport/soccer/soccer-world-cup/bafana-bafana-world-cup-daily-experienced-star-returns-from-injury/）。
4. **两队三场小组赛均在墨西哥进行**，至第三轮双方对当地气候/海拔适应度相当；蒙特雷海拔约 540 米，环境因素基本中性（beIN Sports, 2026-05-16：https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/south-korea-and-heung-min-son-at-the-2026-fifa-world-cup-squad-fixtures-and-everything-to-know-2026-05-16；Wikipedia：https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_A）。
5. **第三轮出线形势未知**（截至 2026-06-11 首轮尚在进行）：若韩国届时已提前出线可能轮换，反之南非若需抢分会搏命——这是区间偏宽的主因。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，双方均非东道主、无主场加成）：南非 15.6% / 平 21.9% / 韩国 62.5%。
- **调整**（合计 2pp，上限 ±8pp）：韩国 −2pp → 南非 +1pp、平局 +1pp。理由：黄仁范伤情隐患 + 中卫减员（因素 2），以及第三轮韩国潜在轮换的不对称风险（因素 5）；南非无重大减员（因素 3）。证据总体偏薄，故只做小幅调整。
- **p_final**：南非 16.6% / 平 22.9% / 韩国 60.5%。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，仅基于 Elo 统计模型与上述引用事实。

## ⑥ 方法说明

以 eloratings.net 的 Elo 评分为输入，采用 Davidson 三路概率模型（与仓库 packages/sports-model/src/elo.ts 的 eloToOneXTwo 一致：scale=400，drawNu=0.7；东道主小组赛 +100 Elo，本场双方均不适用）。在统计基线上仅依据带来源、带日期的公开事实做不超过 ±8pp 的有界调整后归一化。80% 区间反映 drawNu 0.6–0.8 的参数敏感性，叠加证据稀薄度与第三轮出线形势未知的额外不确定性。

### 来源清单

1. eloratings.net World.tsv 快照，2026-06-11 — https://www.eloratings.net/World.tsv
2. Daily Maverick — 南非 26 人名单，2026-05-27 — https://www.dailymaverick.co.za/article/2026-05-27-here-they-are-the-26-players-representing-sa-at-the-world-cup/
3. The South African — Modiba 复出训练，2026-06 — https://www.thesouthafrican.com/sport/soccer/soccer-world-cup/bafana-bafana-world-cup-daily-experienced-star-returns-from-injury/
4. ESPN — 韩国名单 / 孙兴慜，2026-05/06 — https://www.espn.com/soccer/story/_/id/48788433/son-heung-min-south-korea-world-cup-squad-lee-kang-kim-min-jae
5. Olympics.com — 韩国伤情与赛程，2026-06 — https://www.olympics.com/en/news/fifa-world-cup-2026-republic-of-korea-all-players-full-squad-list-key-stats-schedule
6. beIN Sports — 韩国小组赛全部在墨西哥，2026-05-16 — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/south-korea-and-heung-min-son-at-the-2026-fifa-world-cup-squad-fixtures-and-everything-to-know-2026-05-16
7. Wikipedia — 2026 World Cup Group A（场地：蒙特雷 Estadio BBVA） — https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_A

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
