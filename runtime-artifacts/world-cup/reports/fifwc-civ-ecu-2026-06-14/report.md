# 科特迪瓦 vs 厄瓜多尔 — 2026 世界杯小组赛 E 组（市场盲测预测）

- **赛事**：2026 FIFA 世界杯小组赛 E 组第 1 轮
- **开球**：2026-06-14 23:00 UTC（费城林肯金融球场，美国东部时间 19:00）
- **生成时间**：2026-06-11T13:15:00Z ｜ resolution slug（仅元数据）：`fifwc-civ-ecu-2026-06-14`

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 科特迪瓦胜 | **16.5%** | 12% – 21% | 中 |
| 平局 | **24.5%** | 19% – 30% | 中 |
| 厄瓜多尔胜 | **59.0%** | 52% – 66% | 中 |

**一句话观点**：Elo 差 243 分使厄瓜多尔明显占优，但科特迪瓦近期状态火热（6 月 4 日 2-1 胜法国），且两支防守型球队的揭幕战大概率偏紧，平局概率高于纯模型值。

## ② 定义

预测 90 分钟（含补时）三路赛果；小组赛无加时、无点球大战。中立场地（美国费城），双方均无东道主加成。

## ③ 实力画像

| 维度 | 科特迪瓦 | 厄瓜多尔 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1695（第 49） | 1938（第 9） |
| 预选赛 | 非洲区出线 | 南美区第 2，仅次于阿根廷；18 轮仅失 5 球（南美最少） |
| 近期热身 | 2-1 胜法国（6-4）、1-0 胜苏格兰、4-0 胜韩国 | 3-0 胜危地马拉（6-7）、5 月 2-1 胜沙特 |
| 核心球员 | Amad Diallo、Kessié、Haller（伤愈状态待察） | Moisés Caicedo、Enner Valencia |

来源：eloratings.net（2026-06-11）；Opta Analyst（2026-06）；Goal.com 赛前预览（2026-06）。

## ④ 关键因素

1. **厄瓜多尔防守极强**：世预赛 18 轮仅失 5 球为南美最少，被 Opta 称为潜在"黑马"；压低净胜球方差、抬高平局概率。（[Opta Analyst](https://theanalyst.com/articles/ecuador-defensive-steel-world-cup-2026-surprise-package)，2026-06）
2. **科特迪瓦状态火热**：6 月 4 日友谊赛 2-1 击败法国，此前 4-0 韩国、1-0 苏格兰；该信息大部分已反映进 6-11 抓取的 Elo，故只做小幅上调。（[Goal.com 预览](https://www.goal.com/en-us/news/ivory-coast-ecuador-world-cup-preview/bltb6fef7b1a695267a)，2026-06）
3. **厄瓜多尔无重大伤停**：6 月 1 日 Beccacece 公布 26 人名单，仅替补前锋 Leonardo Campana 因伤落选；Caicedo 在 6-7 热身赛轮休属保护性安排。（[fifaworldcupnews.com](https://www.fifaworldcupnews.com/ecuador-world-cup-2026-squad-official/)，2026-06-01；[Bolavip](https://bolavip.com/en/soccer/why-is-moises-caicedo-not-starting-today-for-ecuador-vs-guatemala-in-international-friendly-before-2026-world-cup)，2026-06-07）
4. **科特迪瓦阵容基本齐整**：5 月 15 日公布名单，仅 Clément Akpa 因伤退出、5 月 29 日由 Opéri 替补；Haller 赛季饱受伤病但入选。（[FIFA.com](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cote-divoire-squad-announcement-emerse-fae)，2026-05-15）
5. **揭幕战风格预期**：双方均为防守纪律型球队、首战避败动机强，主流赛前分析预期低比分、小差距。（[Goal.com 预览](https://www.goal.com/en-us/news/ivory-coast-ecuador-world-cup-preview/bltb6fef7b1a695267a)，2026-06）

## ⑤ 模型与调整

- **p_stat（Davidson 三路，scale=400，drawNu=0.7，中立场无加成）**：科特迪瓦 15.5% / 平 21.8% / 厄瓜多尔 62.7%。
- **证据调整（合计 |Δ| ≈ 7.4pp ≤ 8pp 上限）**：
  - 平局 +2.7pp：两支防守型球队的低比分揭幕战预期（因素 1、5）；
  - 科特迪瓦 +1.0pp：状态势头略超 Elo 第 49 名所示水平（因素 2，幅度小因 Elo 已计入友谊赛）；
  - 厄瓜多尔 −3.7pp：上述两项的对应扣减；其无伤停（因素 3）阻止更大下调。
- **p_final**：16.5% / 24.5% / 59.0%。
- 本预测为**市场盲测**：完全独立于任何投注或预测市场信息，仅由统计模型加有据可查的证据调整得出。

## ⑥ 方法与来源

方法：以 eloratings.net 2026-06-11 快照为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 一致，scale=400、drawNu=0.7）得 p_stat；再按引用事实做 ≤±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 敏感性（A 15.0–16.0%、平 19.3–24.2%、B 60.8–64.7%）、Elo ±25 分敏感性及证据有限性。

来源清单：

1. eloratings.net World.tsv 快照（2026-06-11）
2. [FIFA.com 科特迪瓦名单公告](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cote-divoire-squad-announcement-emerse-fae)（2026-05-15）
3. [Goal.com 赛前预览](https://www.goal.com/en-us/news/ivory-coast-ecuador-world-cup-preview/bltb6fef7b1a695267a)（2026-06）
4. [Opta Analyst：厄瓜多尔防守分析](https://theanalyst.com/articles/ecuador-defensive-steel-world-cup-2026-surprise-package)（2026-06）
5. [fifaworldcupnews.com 厄瓜多尔名单](https://www.fifaworldcupnews.com/ecuador-world-cup-2026-squad-official/)（2026-06-01）
6. [Bolavip：Caicedo 轮休说明](https://bolavip.com/en/soccer/why-is-moises-caicedo-not-starting-today-for-ecuador-vs-guatemala-in-international-friendly-before-2026-world-cup)（2026-06-07）

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
