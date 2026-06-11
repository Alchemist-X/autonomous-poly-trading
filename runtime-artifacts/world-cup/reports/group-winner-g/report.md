# 2026 世界杯 G 组头名预测（Belgium / Egypt / Iran / New Zealand）

> 市场盲（market-blind）研究报告：本预测完全独立于任何博彩/预测市场数据，概率仅来自 Elo 蒙特卡洛统计模型 + 有界证据调整。生成时间：2026-06-11T13:15:00Z。

## ① 结论：G 组头名概率

| 球队 | 统计基线 | 调整 | 最终概率 |
| --- | --- | --- | --- |
| 比利时 Belgium | 67.65% | −3.0pp | **64.65%** |
| 伊朗 Iran | 22.29% | +1.5pp | **23.79%** |
| 埃及 Egypt | 8.89% | +1.5pp | **10.39%** |
| 新西兰 New Zealand | 1.17% | 0 | **1.17%** |

**一句话观点：** 比利时凭明显的 Elo 实力差距最有可能拿下 G 组头名（约 65%），但卢卡库/德布劳内/库尔图瓦的伤病隐患让伊朗（约 24%）保留掀翻的空间。

## ② 定义

「G 组头名」= FIFA 2026 世界杯小组赛结束后 G 组最终积分榜第 1 名。排名规则依次为：积分 → 净胜球 → 进球数 → 同分球队间对赛成绩 → 公平竞赛分 → 抽签。G 组赛程：6/15 比利时–埃及、伊朗–新西兰；6/21 比利时–伊朗、新西兰–埃及；6/26 埃及–伊朗、新西兰–比利时。

## ③ 各队简评（仅从 Elo / 状态 / 赛程角度）

- **比利时（Elo 1894，世界第 15）**：组内 Elo 断层领先（比第二名伊朗高 122 分），三场对手均明显弱于自身，是头名的最可能人选。隐患在阵容核心的体能与伤病：卢卡库本赛季因反复肌肉伤势几乎没踢过正式比赛，德布劳内在那不勒斯赛季末因眼伤缺阵，库尔图瓦也刚走出伤病困扰的赛季——这是基线下调 3pp 的依据。
- **伊朗（Elo 1772，世界第 29）**：组内第二强，6/1 按期公布最终名单，备战流程完整。关键变量是 6/21 洛杉矶对比利时的直接对话：若比利时锋线哑火，伊朗赢下该场即很可能抢下头名，故获得下调份额中的 +1.5pp。
- **埃及（Elo 1696，世界第 48）**：萨拉赫以队长身份领衔，与曼城的马尔穆什组成的锋线质量高于其 Elo 排名所体现的水平（Elo 更多反映其防守型、低进球的预选赛风格），全员健康、无名单争议，+1.5pp。头名路径需要 6/15 直接击败比利时，难度仍大。
- **新西兰（Elo 1562，世界第 72）**：组内实力垫底，与其余三队 Elo 差距均超过 130 分，头名概率仅约 1%，无证据支持调整。

## ④ 方法

1. **统计基线**：纯 Elo 泊松蒙特卡洛，100,000 次全赛事模拟（seed 20260611），Elo 取 eloratings.net 2026-06-11 快照；两队进球为独立泊松，λ 由 Elo 逻辑斯蒂期望切分 2.6 球基准；东道主（墨/美/加）仅小组赛 +100 Elo；小组排名按积分→净胜球→进球→同分队间小循环→抽签模拟。模型不含任何市场输入。
2. **有界调整**：单队上限 ±4pp，须有引用证据。本次：比利时 −3.0pp（核心球员伤病/缺训证据），伊朗 +1.5pp、埃及 +1.5pp（直接受益方 + 阵容完整证据），调整净和为 0，总和保持 1。

## 来源

1. eloratings.net World.tsv 快照（2026-06-11，本地归档 elo-table.json）— 四队 Elo 与排名
2. FotMob《De Bruyne and Lukaku named in Belgium World Cup squad despite injuries》（名单公布日 2026-05-15）— https://www.fotmob.com/news/18d3fh2himo601nk0xh84p4fky-de-bruyne-lukaku-named-belgium-world-cup-squad-despite-injuries
3. The Analyst (Opta) 比利时前瞻 — https://theanalyst.com/articles/belgium-next-golden-generation-world-cup-2026-preview
4. Al Jazeera《Mohamed Salah to captain Egypt as squad announced》（2026-05-21）— https://www.aljazeera.com/sports/2026/5/21/mohamed-salah-to-captain-egypt-as-squad-announced-for-fifa-world-cup-2026
5. Olympics.com 埃及名单与赛程 — https://www.olympics.com/en/news/fifa-world-cup-2026-mohamed-salah-and-egypt-chase-first-ever-quarter-final-berth-all-players-full-squad-list-key-stats-and-schedule
6. Wikipedia《2026 FIFA World Cup squads》（伊朗 6/1 最终名单等名单日期）— https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads

## 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
