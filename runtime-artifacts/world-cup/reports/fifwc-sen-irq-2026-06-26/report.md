# 塞内加尔 vs 伊拉克 — 2026 世界杯 I 组（市场盲测预测）

- **比赛**：2026-06-26 19:00 UTC（多伦多当地 15:00），BMO Field，多伦多，加拿大（小组赛第 3 轮，第 62 场）
- **生成时间**：2026-06-11T13:15:00Z ｜ **方法**：Elo + Davidson 三路模型 + 有界证据调整（市场盲测）

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 塞内加尔胜 | **65%** | 57% – 72% | 中 |
| 平局 | **22%** | 17% – 27% | 中 |
| 伊拉克胜 | **13%** | 9% – 19% | 中 |

**一句话观点**：非洲杯冠军塞内加尔满员出战、Elo 高出 253 分，对小组最弱的伊拉克占据明显优势，但末轮出线形势未知带来轮换变数。

## ② 定义

90 分钟三路赛果（胜/平/负），小组赛无加时、无点球；补时计入。中立场地（加拿大非任一参赛方主场，无东道主加成）。

## ③ 实力画像

| | 塞内加尔 | 伊拉克 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 快照） | 1860（第 21） | 1607（第 63） |
| 近期状态 | 2026 年 1 月非洲杯夺冠，马内当选赛事最佳球员（[Al Jazeera, 2026-05-30](https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list)） | 经洲际附加赛绝杀玻利维亚晋级；阿诺德 2025 年 5 月接手后扭转出线危局（[Olympics.com](https://www.olympics.com/en/news/fifa-world-cup-2026-iraq-players-squad-list-key-stats-schedule)） |
| 核心 | 马内（34 岁，队长）、库利巴利、帕普·萨尔 | 艾门·侯赛因（亚洲区预选赛 8 球）、阿里·哈马迪（伊普斯维奇） |

## ④ 关键因素

1. **Elo 差 253 分**：1860 vs 1607，统计模型直接给出塞内加尔约 64% 基准胜率（eloratings.net，2026-06-11 抓取）。
2. **塞内加尔伤员归队**：帕普·萨尔、哈比卜·迪亚拉伤愈，世界杯可满状态出战；盖耶虽缺席赛季末段仍入选（[Al Jazeera, 2026-05-30](https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list)）。
3. **马内回归领衔名单**：5 月 21 日公布的名单由马内、库利巴利领衔（[Al Jazeera, 2026-05-21](https://www.aljazeera.com/sports/2026/5/21/sadio-mane-kalidou-koulibaly-star-picks-in-senegals-world-cup-squad)）。
4. **库利巴利老化迹象**：34 岁，非洲杯小组赛对贝宁染红、决赛停赛缺席（[Al Jazeera, 2026-05-30](https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list)）——小幅防线风险。
5. **伊拉克阵容深度有限**：阿诺德 6 月 1 日确认 26 人名单，多数球员效力国内联赛，旅欧核心为伊克巴尔（乌得勒支）、哈马迪（伊普斯维奇）等少数人（[FIFA.com, 2026-06-01](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/iraq-preliminary-squad-announcement-graham-arnold)）。
6. **末轮变数**：此为 I 组（法国、塞内加尔、挪威、伊拉克）末轮，开球时双方出线形势未知；若塞内加尔提前出线可能轮换（[Goal.com 场地信息](https://www.goal.com/en-us/news/how-to-buy-senegal-vs-iraq-world-cup-tickets/blt0f1c916245673614)）。

## ⑤ 模型与调整

- **p_stat**（Davidson，scale=400，drawNu=0.7，中立场无加成）：塞内加尔 63.6% / 平 21.5% / 伊拉克 14.8%。
- **调整（合计 |Δ| ≈ 4pp，上限 ±8pp）**：
  - 塞内加尔 +1.4pp：非洲杯冠军势头 + 主力伤愈满员（因素 2、3）；
  - 平局 +0.5pp：末轮出线形势未知、可能轮换（因素 6）；
  - 伊拉克 −1.9pp：阵容深度与对手差距大、无利好消息对冲（因素 5）。
- **p_final**：塞内加尔 65% / 平 22% / 伊拉克 13%。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，仅基于统计模型与公开新闻证据。

## ⑥ 方法与来源

方法：以 eloratings.net 当日 Elo 为输入，用 Davidson 三路模型（drawNu=0.7）算基准概率；再依据带日期来源的事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 敏感性、Elo ±25 不确定性及证据稀薄度。

来源清单：
1. eloratings.net World.tsv（2026-06-11 抓取，本仓库 elo-table.json）
2. [Al Jazeera 塞内加尔队伍前瞻](https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list)（2026-05-30）
3. [Al Jazeera 塞内加尔名单](https://www.aljazeera.com/sports/2026/5/21/sadio-mane-kalidou-koulibaly-star-picks-in-senegals-world-cup-squad)（2026-05-21）
4. [FIFA.com 伊拉克名单公布](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/iraq-preliminary-squad-announcement-graham-arnold)（2026-06-01）
5. [Olympics.com 伊拉克球队介绍](https://www.olympics.com/en/news/fifa-world-cup-2026-iraq-players-squad-list-key-stats-schedule)（2026-06）
6. [Goal.com 场地/开球时间](https://www.goal.com/en-us/news/how-to-buy-senegal-vs-iraq-world-cup-tickets/blt0f1c916245673614)（2026-06）

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
