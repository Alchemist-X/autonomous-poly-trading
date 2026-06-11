# 克罗地亚 vs 加纳 — 2026 世界杯小组赛 L 组（市场盲测预测）

- **比赛**：2026-06-27 21:00 UTC（费城 Lincoln Financial Field，当地 17:00）
- **生成时间**：2026-06-11 · 预测 ID：`match:fifwc-hrv-gha-2026-06-27`

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 克罗地亚胜 | **75.0%** | 66% – 82% | 中 |
| 平局 | **18.5%** | 12% – 26% | 中 |
| 加纳胜 | **6.5%** | 4% – 11% | 中 |

**一句话观点**：Elo 差距高达 402 分加上加纳核心球员（库杜斯）伤缺，克罗地亚是明显热门；唯一变数是第三轮小组赛克罗地亚可能轮换或已提前出线导致动力下降。

## ② 定义

预测 90 分钟三路赛果（胜/平/负）。小组赛无加时、无点球大战，平局即为最终结果。

## ③ 实力画像

| 指标 | 克罗地亚 | 加纳 | 来源 |
| --- | --- | --- | --- |
| Elo 积分 | 1912 | 1510 | eloratings.net 快照 2026-06-11 |
| Elo 排名 | 第 12 | 第 81 | 同上 |
| 主帅 | 兹拉特科·达利奇 | 卡洛斯·奎罗斯 | beIN Sports 2026-05-18 / ghanafa.org 2026-06 |
| 核心 | 莫德里奇（40 岁，第六届世界杯队长）、格瓦迪奥尔 | 帕尔特伊、塞门约、伊纳基·威廉姆斯 | olympics.com / goal.com 2026-06 |

克罗地亚近两届世界杯分获亚军（2018）与季军（2022），阵容经验丰富；加纳经历换帅（奎罗斯接手），且多名主力伤缺。

## ④ 关键因素

1. **加纳头号球星库杜斯（Mohammed Kudus）因大腿长期伤势无缘世界杯**——加纳进攻创造力大幅下降（goal.com / fourfourtwo，2026-06）。
2. **加纳后防主力萨利苏（ACL 重伤）与吉库均缺席**——首发中卫双双报销，防线深度堪忧（fourfourtwo / goal.com，2026-06）。
3. **帕尔特伊入选但本赛季在比利亚雷亚尔出场时间有限**——中场核心状态存疑（goal.com，2026-06）。
4. **莫德里奇 4 月底颧骨骨折后已恢复，确认以队长身份出战**；格瓦迪奥尔胫骨骨折后 5 月 14 日已复出（olympics.com / uefa.com，2026-05/06）。
5. **科瓦契奇跟腱问题缺席了大部分赛季**，体能状态需持续观察（uefa.com，2026-06）。
6. **本场为 L 组第三轮（第 68 场）**：若克罗地亚前两轮（vs 英格兰、巴拿马）已锁定出线，存在轮换与动力下降风险；中立场地费城，6 月下旬下午高温可能利于节奏放慢（lincolnfinancialfield.com，2026）。

## ⑤ 模型与调整

- **统计基线 p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场地无主场加成）：
  克罗地亚 **75.8%** / 平 **16.7%** / 加纳 **7.5%**（Elo 1912 vs 1510）。
- **证据调整（合计约 3pp，上限 ±8pp）**：
  - 加纳伤情（库杜斯+两名主力中卫缺席、帕尔特伊状态存疑）：加纳胜 −1.5pp，转移至克罗地亚胜/平；
  - 克罗地亚第三轮轮换与老将体能风险（莫德里奇 40 岁、科瓦契奇跟腱）：克罗地亚胜 −1.5pp，转移至平/加纳胜。
- **p_final**：克罗地亚 **75.0%** / 平 **18.5%** / 加纳 **6.5%**。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，概率仅来自 Elo 统计模型与上述有引用依据的有限调整。

## ⑥ 方法说明

基于 eloratings.net 2026-06-11 快照的 Elo 积分，用 Davidson 三路模型（drawNu=0.7）计算基线概率；再依据带来源、带日期的公开球队新闻做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 在 0.6–0.8 间的参数敏感性（克胜 74.1%–77.7%）、Elo 自身噪声及第三轮比赛动机不确定性。

### 来源清单

1. eloratings.net World.tsv（仓库快照 2026-06-11）
2. olympics.com — Croatia at FIFA World Cup 2026 squad（2026-06）：https://www.olympics.com/en/news/fifa-world-cup-2026-croatia-players-squad-list-key-stats-schedule
3. uefa.com — Croatia at the World Cup 2026（2026-06）：https://www.uefa.com/european-qualifiers/news/02a6-20d159312e19-b662016c6c47-1000--croatia-at-the-world-cup-2026-squad-fixtures-group-and-hi/
4. goal.com — Ghana squad World Cup 2026（2026-06）：https://www.goal.com/en-us/lists/ghana-squad-world-cup-2026/blt96bf719b2e716a5e
5. fourfourtwo.com — Ghana World Cup 2026 squad（2026-06）：https://www.fourfourtwo.com/team/ghana-world-cup-2026-squad
6. ghanafa.org — Carlos Queiroz names 2026 FIFA World Cup squad（2026-06）：https://www.ghanafa.org/carlos-queiroz-names-2026-fifa-world-cup-squad
7. beinsports.com — Dalić's official Croatia squad（2026-05-18）：https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/zlatko-dali-s-official-croatia-squad-for-the-2026-fifa-world-cup-2026-05-18
8. lincolnfinancialfield.com — Croatia vs Ghana (Group L)（2026）：https://www.lincolnfinancialfield.com/events/croatia-vs-ghana-group-l/

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
