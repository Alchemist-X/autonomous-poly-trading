# 突尼斯 vs 荷兰（2026 世界杯小组赛 F 组）市场盲测预测

- 比赛：2026-06-25 23:00 UTC 开球（美国中部时间 6 月 25 日 18:00），F 组第三轮
- 事件标识（仅作结算元数据）：`fifwc-tun-nld-2026-06-25`
- 生成时间：2026-06-11（开赛前 14 天）

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 突尼斯胜 | **9.0%** | 6% – 13% | 中 |
| 平局 | **18.4%** | 14% – 24% | 中 |
| 荷兰胜 | **72.6%** | 66% – 78% | 中 |

**一句话观点：** 荷兰 Elo 高出 320 分且突尼斯热身赛崩盘（0-5 负比利时），蒂姆贝尔伤缺影响有限，荷兰胜率约七成出头；主要不确定性是第三轮双方出线形势未知、荷兰可能轮换。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负）。小组赛无加时、无点球大战，平局即为最终赛果。

## ③ 实力画像

| 指标 | 突尼斯 | 荷兰 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1628 | 1948 |
| Elo 世界排名 | 58 | 8 |
| 近期状态 | 热身赛 0-1 奥地利、0-5 比利时；2026 年初换帅 | 蒂姆贝尔伤退，其余主力齐整，6 月 13 日首战日本 |

- 突尼斯 2026 年初非洲杯 16 强不敌马里后换帅，Sabri Lamouchi 接任，磨合时间有限（来源：Squawka，检索于 2026-06-11）。
- 荷兰主帅科曼的阵容除蒂姆贝尔外基本齐整，德容等核心在列（来源：FIFA.com / ESPN，2026-06）。

## ④ 关键因素

1. **Elo 差 320 分**：荷兰 1948（第 8）vs 突尼斯 1628（第 58），属强弱分明的对位（eloratings.net，2026-06-11）。
2. **突尼斯热身赛崩盘**：6 月 6 日最后一场热身 0-5 惨败比利时，主帅 Lamouchi 赛后向球迷道歉，称"感到羞愧"；此前还 0-1 负于奥地利（GHANAsoccernet / Football365，2026-06-07）。
3. **荷兰后卫蒂姆贝尔伤退**：腹股沟伤势，KNVB 于 6 月 8 日确认其无缘世界杯，桑德兰后卫 Geertruida 补招入队；科曼表示少了他"只剩七名后卫"（ESPN / FIFA.com，2026-06-08）——荷兰防线深度小幅受损，但有现成替代者。
4. **突尼斯换帅磨合期**：Lamouchi 2026 年初才接手，5 月 15 日公布大名单时已做大幅调整（FIFA.com，2026-05-15）。
5. **第三轮形势未知（不确定性来源）**：荷兰若前两轮（6/13 日本、6/19 前后瑞典）已提前出线，可能轮换主力；突尼斯届时可能已出局或背水一战。该因素今日无法定向，仅放大区间。
6. **场地**：堪萨斯城 Arrowhead Stadium，中立场地，双方均无主场加成（Squawka，检索于 2026-06-11）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，无主办国加成——两队均非东道主）：
  突尼斯 11.0% / 平 19.4% / 荷兰 69.6%
- **证据调整 delta**（上限 ±8pp，本次合计 6pp）：
  - 突尼斯 −2.0pp、平 −1.0pp、荷兰 +3.0pp
  - 理由：突尼斯热身赛两连败（含 0-5）+ 换帅磨合期，为强负面信号；荷兰蒂姆贝尔伤缺为小幅反向因素，部分抵消后净向荷兰倾斜。
- **p_final**：突尼斯 9.0% / 平 18.4% / 荷兰 72.6%
- 区间反映 drawNu 0.6–0.8 的参数敏感性（荷兰胜约 67.7%–71.6%）、证据样本偏薄、以及第三轮轮换/出线形势未知。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，概率仅来自 Elo 统计模型加有据可查的有限调整。

## ⑥ 方法与来源

方法：以 eloratings.net 当日 Elo 为输入，用 Davidson 三路模型生成基准概率；再依据带来源、带日期的公开事实做不超过 ±8pp 的有界调整并归一化；80% 区间综合参数敏感性与证据厚度给出。

来源清单：
1. eloratings.net World.tsv（抓取于 2026-06-11）— https://www.eloratings.net/World.tsv
2. ESPN：蒂姆贝尔无缘世界杯（2026-06-08）— https://www.espn.com/soccer/story/_/id/49001511/netherlands-arsenal-defender-jurrien-timber-miss-world-cup-injury
3. FIFA.com：荷兰补招 Geertruida（2026-06-08）— https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/netherlands-call-up-geertruida-jurrien-timber
4. GHANAsoccernet：Lamouchi 为 0-5 负比利时道歉（2026-06-07）— https://ghanasoccernet.com/tunisia-coach-lamouchi-ashamed-after-heavy-pre-world-cup-friendly-defeat-to-belgium
5. Football365：世界杯热身赛赛果汇总（2026-06）— https://www.football365.com/news/world-cup-2026-warm-up-friendly-fixtures-results-kick-off-times-what-tv-channel
6. Squawka：突尼斯世界杯前瞻（检索于 2026-06-11）— https://www.squawka.com/en/news/world-cup/tunisia-world-cup-2026-fixtures-squad-analysis/
7. FIFA.com：Lamouchi 公布突尼斯大名单（2026-05-15）— https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/tunisia-squad-named-sabri-lamouchi
8. ESPN：2026 世界杯伤病追踪（检索于 2026-06-11）— https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
