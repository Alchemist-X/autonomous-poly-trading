# 市场盲测：苏格兰 vs 巴西（2026 世界杯 C 组，第 49 场）

- 生成时间：2026-06-11T13:15:00Z ｜ 开球：2026-06-24T22:00:00Z（迈阿密硬石体育场，当地 18:00）
- 事件 slug（仅作结算元数据）：`fifwc-sco-bra-2026-06-24`

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 苏格兰胜 | **15.8%** | 11% – 21% | 中 |
| 平局 | **23.3%** | 19% – 28% | 中 |
| 巴西胜 | **60.9%** | 53% – 68% | 中 |

**一句话观点**：Elo 差距 209 分叠加苏格兰中场核心吉尔莫尔伤退、巴西阵容深度完整且内马尔预计小组赛内复出，巴西约六成胜率；苏格兰爆冷需依赖低事件数防守战。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负）。小组赛无加时、无点球大战；补时计入 90 分钟赛果。

## ③ 实力画像

| 指标 | 苏格兰 | 巴西 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1782（第 26） | 1991（第 5） |
| 主帅 | 史蒂夫·克拉克 | 卡洛·安切洛蒂 |
| 近期状态 | 队史首次冲击小组出线（Sky Sports，2026-06） | 安帅 12 战 7 胜 2 平 3 负，最近 2-1 胜埃及（Al Jazeera，2026-05-28） |
| 大赛底蕴 | 从未小组出线 | 5 次夺冠 |

场地：迈阿密硬石体育场，中立场（双方均非东道主，模型不加主场分）。苏格兰大本营在北卡夏洛特（ESPN，2026-06）。

## ④ 关键因素

1. **吉尔莫尔（Billy Gilmour）膝伤退出世界杯**，由弗莱彻替补入队——苏格兰失去中场出球核心，控场能力下降（Scottish FA 官网，2026-06）。
2. **切·亚当斯（Ché Adams）大腿伤势成疑**，苏格兰锋线选择受限（ESPN / The Scotsman，2026-06）。
3. **内马尔 2 级肌肉拉伤，预计缺席 2-3 周**；安切洛蒂称"第一场赶不上也能赶上第二场"——到 6 月 24 日第三轮大概率可出场，但状态存疑（ESPN，2026-06）。
4. **巴西 26 人名单深度极强**：维尼修斯、拉菲尼亚、卡塞米罗、布鲁诺·吉马良斯、库尼亚、马丁内利等悉数入选；维斯利伤退由埃德森递补（FourFourTwo / beIN，2026-05-18 至 2026-06-07）。
5. **第三轮变数**：巴西前两轮先打摩洛哥、海地，若提前出线可能轮换，略利于平局与苏格兰；但纯属赛程推演，未计入大幅调整（FIFA 赛程，2026-06）。
6. **迈阿密 6 月傍晚高温高湿**，对苏格兰球员的适应性挑战大于巴西（场地与开球时间为公开赛程事实；影响幅度保守处理）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主场分）：
  苏格兰 17.8% / 平 22.8% / 巴西 59.4%
- **证据调整（合计 |Δ| ≈ 4pp，上限 ±8pp）**：
  - 苏格兰 −2.0pp：吉尔莫尔伤退 + 亚当斯伤疑（因素 1、2）
  - 巴西 +1.5pp：阵容深度完整、内马尔可能复出（因素 3、4）
  - 平局 +0.5pp：巴西第三轮潜在轮换（因素 5）
- **p_final**：苏格兰 15.8% / 平 23.3% / 巴西 60.9%
- 80% 区间反映：drawNu 0.6–0.8 敏感性（平局 ±2.5pp）、Elo 输入不确定性（±25–50 分）、开赛前 13 天阵容与出线形势未定。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，未参考亦不引用任何此类数据。

## ⑥ 方法与来源

方法：以 eloratings.net 当日 Elo 为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致）得到统计基线；再依据带来源、带日期的公开事实做不超过 ±8pp 的有界调整并归一化。不使用任何博彩/预测市场数据。

来源清单：
1. eloratings.net World.tsv（2026-06-11 抓取，`elo-table.json`）
2. Scottish FA — FIFA World Cup 2026 squad update（吉尔莫尔伤退）：https://www.scottishfa.co.uk/en/news/fifa-world-cup-2026-squad-update （2026-06）
3. ESPN — Scotland at the 2026 World Cup（赛程/大本营/亚当斯伤情）：https://www.espn.com/soccer/story/_/id/48701669/ （2026-06）
4. ESPN — Ancelotti on Neymar injury（2 级拉伤、复出窗口）：https://www.espn.com/soccer/story/_/id/48922562/ （2026-06）
5. FourFourTwo — Brazil World Cup 2026 squad：https://www.fourfourtwo.com/team/brazil-world-cup-2026-squad （2026-06）
6. beIN Sports — Brazil official squad（2026-05-18）：https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/carlo-ancelotti-s-official-brazil-squad-for-the-2026-fifa-world-cup-2026-05-18
7. Al Jazeera — Brazil team preview（安帅战绩、近况，2026-05-28）：https://www.aljazeera.com/sports/2026/5/28/brazils-world-cup-2026-team-preview-players-to-watch-group-matches-squad
8. Sky Sports — Scotland at World Cup 2026（克拉克目标，2026-06）：https://www.skysports.com/football/news/36621/13551871/

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
