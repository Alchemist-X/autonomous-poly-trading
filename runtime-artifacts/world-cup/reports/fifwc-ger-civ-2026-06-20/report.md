# 德国 vs 科特迪瓦 — 小组赛 E 组（2026-06-20，多伦多）市场盲测预测

> 生成时间：2026-06-11T13:15:00Z ｜ 开球：2026-06-20T20:00:00Z（UTC）｜ 事件标识（仅结算元数据）：`fifwc-ger-civ-2026-06-20`

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 德国胜 | **63.5%** | 57% – 70% | 中 |
| 平局 | **21.5%** | 18% – 26% | 中 |
| 科特迪瓦胜 | **15.0%** | 11% – 20% | 中 |

**一句话观点：** Elo 差 237 分加上德国五连胜的临场状态，模型给德国约 64% 胜率；科特迪瓦预选赛不败、阵容齐整，保留约 15% 爆冷空间，平局约 21%。

## ② 定义

- 预测对象为 90 分钟（含补时）三路赛果：德国胜 / 平 / 科特迪瓦胜。
- 世界杯小组赛无加时、无点球大战，平局即为最终赛果。
- 比赛地点多伦多（加拿大），对两队均为中立场地，模型不加主场分。

## ③ 实力画像

| 指标 | 德国 | 科特迪瓦 | 来源 |
| --- | --- | --- | --- |
| Elo 评分 | 1932（第 10） | 1695（第 49） | 内部 Elo 快照 `elo-table.json`（基于 eloratings.net，2026-06-11） |
| 近期状态 | 近 5 场全胜（含 3-27 客胜瑞士 4-3；5-31 vs 芬兰、6-6 vs 美国热身） | 非洲区预选 F 组 8 胜 2 平不败、净胜 +25，头名直通 | ESPN/Fotmob 战绩页（检索 2026-06-11）；Olympics.com（检索 2026-06-11） |
| 背景 | 4 届世界杯冠军，纸面阵容 E 组最强 | 2014 年后首次晋级决赛圈，前三次均小组出局 | Olympics.com（检索 2026-06-11） |

## ④ 关键因素

1. **Elo 差 237 分**：1932 vs 1695，纯统计模型即给德国约 62% 三路胜率（eloratings.net 快照，2026-06-11）。
2. **德国状态火热但有小伤情**：近 5 场全胜；Lennart Karl 大腿肌纤维撕裂退出、由 Ouédraogo 替补入队，属轮换级损失；诺伊尔小腿拉伤但预计赶上 6-14 首战，到 6-20 本场大概率无碍（Sports Mole / Bundesliga.com，检索 2026-06-11）。
3. **科特迪瓦底子不差**：预选赛 8 胜 2 平不败晋级，Kessié、Ndicka、Pépé、Singo 等主力悉数入选，新星 Diomande（莱比锡）补强边路（FIFA.com 名单公告，检索 2026-06-11）。
4. **Haller 落选**：经验型中锋未入名单，关键战破密集防守的兜底选项减少（Goal.com / FourFourTwo，检索 2026-06-11）。
5. **赛程背景**：双方 6-14 各打首战（德国 vs 库拉索、科特迪瓦 vs 厄瓜多尔），本场为第二轮，首战结果可能改变出线压力分布——这是 9 天后才能落地的不确定性，已计入区间而非中位数（FIFA 赛程，检索 2026-06-11）。

## ⑤ 模型与调整

- **p_stat（Davidson 三路 Elo，scale=400，drawNu=0.7，中立场无主场分）**：德国 62.1% / 平 22.0% / 科特迪瓦 15.9%。
- **证据调整（上限 ±8pp，本次合计 +1.5pp）**：德国 +1.5pp（五连胜状态 + 主力框架齐整，伤情仅边缘轮换；科特迪瓦少一个 Haller 型终结点）；平局 −0.5pp、科特迪瓦 −1.0pp，归一化后得 p_final。证据总体偏薄且双方利好大致对冲（科特迪瓦预选不败已反映在 Elo 内），故调整刻意保持小幅。
- **p_final：德国 63.5% / 平 21.5% / 科特迪瓦 15.0%。**
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，未参考亦不引用任何此类数据。

## ⑥ 方法说明

概率由两部分构成：(1) 基于 eloratings.net 评分快照的 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 `eloToOneXTwo` 一致：piA=10^(Ra/400)，平局项 ν·√(piA·piB)，ν=0.7；主办国主场分仅适用于墨/美/加在本国小组赛，本场不适用）；(2) 以带来源、带日期的公开事实为依据的有界调整（±8pp 上限）。80% 区间反映 drawNu 在 0.6–0.8 间的参数敏感性（德国胜 60.2%–64.2%）、Elo ±50 分的输入不确定性（57.2%–66.8%），以及开赛前 9 天阵容未定的证据稀薄度。

### 来源清单

1. 内部 Elo 快照 `runtime-artifacts/world-cup/elo-table.json`（基于 eloratings.net，2026-06-11）
2. Sports Mole — 德国伤情（Karl 退出 / Neuer 小腿）：https://www.sportsmole.co.uk/football/germany/injury-news/news/huge-shock-how-nagelsmann-has-reacted-to-devastating-germany-injury-blow-before-world-cup_598752.html（检索 2026-06-11）
3. Bundesliga.com — 诺伊尔回归德国队：https://www.bundesliga.com/en/bundesliga/news/germany-squad-world-cup-2026-manuel-neuer-nagelsmann-37487（检索 2026-06-11）
4. FIFA.com — 科特迪瓦名单公告：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cote-divoire-squad-announcement-emerse-fae（检索 2026-06-11）
5. Olympics.com — 科特迪瓦预选战绩与赛程：https://www.olympics.com/en/news/fifa-world-cup-2026-cote-ivoire-all-players-full-squad-list-key-stats-schedule（检索 2026-06-11）
6. FourFourTwo — 德国 26 人名单：https://www.fourfourtwo.com/team/germany-world-cup-2026-squad（检索 2026-06-11）
7. ESPN — 德国 2026 年战绩：https://www.espn.com/soccer/team/results/_/id/481/germany（检索 2026-06-11）

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
