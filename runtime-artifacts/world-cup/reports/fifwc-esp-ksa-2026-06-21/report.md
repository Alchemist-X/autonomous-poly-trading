# 西班牙 vs 沙特阿拉伯 — 2026 世界杯 H 组（市场盲测预测）

- 比赛：2026-06-21 16:00 UTC，美国亚特兰大 Mercedes-Benz Stadium（H 组第二轮）
- 事件 slug（仅结算元数据）：`fifwc-esp-ksa-2026-06-21`
- 生成时间：2026-06-11T13:15:00Z ｜ 预测性质：**市场盲测**，完全独立于任何盘口/赔率

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 西班牙胜 | **84.0%** | 79% – 88% | 中 |
| 平局 | **12.6%** | 9% – 16% | 中 |
| 沙特胜 | **3.4%** | 2% – 6% | 中 |

**一句话观点：** Elo 第 1（2157）对第 69（1576）的 581 分鸿沟使西班牙胜为压倒性基准；沙特临阵换帅但防守尚有韧性、西班牙核心球员伤愈程度存在小幅不确定，仅做约 2 个百分点的温和下调。

## ② 定义

90 分钟法定时间三路赛果（含补时，不含加时/点球）；小组赛无加时，平局即为平局。

## ③ 实力画像

- 西班牙：Elo 2157，世界第 1（eloratings.net，2026-06-11 抓取）。卫冕欧洲杯班底，主帅 De la Fuente，26 人名单已公布（无皇马球员，Yamal 领衔）。来源：ESPN，2026-06 上旬。
- 沙特阿拉伯：Elo 1576，世界第 69（同上）。连续第三次晋级世界杯，经第四轮附加赛才出线；历史上七次参赛未能突破淘汰赛瓶颈。来源：FIFA / Goal.com，2026-06。

## ④ 关键因素

1. **西班牙伤情整体可控但有尾部风险**：Fermín López 跖骨骨折确定缺席；Yamal（腹股沟/腘绳肌）自 4 月 22 日后未出场，队医预计 6 月 15 日首战可用、可能限制出场时间；Merino 应力性骨折恢复中。主帅称"如无意外首战几乎全员可用，否则第二场也能赶上"——本场为第二轮，可用性更高。来源：ESPN 伤情追踪 / ESPN 名单稿，2026-06 上旬。
2. **沙特临阵换帅**：4 月 17 日解雇 Renard，希腊教头 Georgios Donis 赛前数周接手，仅带队 3 场（1 胜 1 平 1 负），磨合时间极短。来源：Goal.com / FourFourTwo，2026-05/06。
3. **沙特热身赛喜忧参半**：5 月 30 日 1-2 负厄瓜多尔，6 月 5 日 3-0 胜波多黎各，6 月 9 日 0-0 平塞内加尔（对手有红牌）——对强队的防守组织尚可。来源：Outlook India / FourFourTwo，2026-06-09。
4. **场地中性、室内可控**：亚特兰大 Mercedes-Benz Stadium 为固定顶棚、空调球场，当地正午开球的炎热因素被基本消除，不利于"环境削弱强队"的叙事。来源：FOX Sports，2026-06。
5. **赛程态势**：西班牙 6 月 15 日先打佛得角、沙特同期先打乌拉圭；第二轮西班牙大概率仍需净胜分巩固头名，全力争胜动机充足。来源：Wikipedia H 组页，2026-06。

## ⑤ 模型与调整

- p_stat（Davidson 三路，scale=400，drawNu=0.7，中性场无主办国加成）：**西 85.7% / 平 11.3% / 沙 3.0%**
- 调整（合计约 2.1pp，远低于 ±8pp 上限）：
  - 西 −1.7pp：Yamal 4 月底以来无比赛节奏 + Fermín 缺席 + Merino 刚复出（因素 1）
  - 平 +1.3pp、沙 +0.4pp：沙特对塞内加尔零封显示低位防守可堆人（因素 3）；但换帅动荡（因素 2）抵消了更大上调
- p_final：**西 84.0% / 平 12.6% / 沙 3.4%**
- 本预测为**市场盲测**：不参考、不引用任何博彩盘口、预测市场价格或隐含概率。

## ⑥ 方法

概率基准来自 eloratings.net 当日 Elo 经 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致；drawNu=0.7）映射为胜/平/负；再依据带来源的公开事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 的参数敏感性（西 84.4–87.1%）叠加赛前证据稀薄带来的额外不确定性。

### 来源清单

1. eloratings.net World.tsv（2026-06-11 抓取，模型输入）
2. ESPN — Spain World Cup 2026 squad confirmed（2026-06 上旬）：https://www.espn.com/soccer/story/_/id/48870392/spain-world-cup-2026-squad-confirmed-lamine-yamal-stars-no-real-madrid-players
3. ESPN — 2026 World Cup injuries tracker（2026-06）：https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info
4. FOX Sports — Saudi Arabia WC2026 schedule/venue（2026-06）：https://www.foxsports.com/stories/soccer/saudi-arabia-world-cup-2026-schedule-locations-dates-times
5. Goal.com — World Cup 2026 Ultimate Guide: Saudi Arabia（2026-06）：https://www.goal.com/en-sa/world-cup-teams/group-h/world-cup-2026-guide-saudi-arabia/O~blta4d1aa8150596e24
6. FourFourTwo — Saudi Arabia WC2026 squad / Donis record（2026-06）：https://www.fourfourtwo.com/team/saudi-arabia-world-cup-2026-squad
7. Outlook India — Saudi Arabia 0-0 Senegal（2026-06-09）：https://www.outlookindia.com/sports/football/saudi-arabia-vs-senegal-live-score-international-friendly-2026-updates-highlights-texas

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
