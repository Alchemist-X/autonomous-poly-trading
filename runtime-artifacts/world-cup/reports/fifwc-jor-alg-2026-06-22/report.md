# 约旦 vs 阿尔及利亚（2026 世界杯 J 组，2026-06-22）市场盲测预测

> 生成时间：2026-06-11 ｜ 比赛开球（UTC）：2026-06-23T03:00:00Z ｜ 场地：Levi's Stadium（美国圣克拉拉，中立场）
> 事件 slug（仅作结算元数据）：`fifwc-jor-alg-2026-06-22`

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 约旦胜 | **26%** | 20% – 32% | 中 |
| 平局 | **25%** | 20% – 30% | 中 |
| 阿尔及利亚胜 | **49%** | 42% – 56% | 中 |

**一句话观点**：阿尔及利亚 Elo 高出 92 分、阵容齐整且预选赛火力充足，是明显但不压倒性的优势方；约旦热身赛连败加上锋线伤员，三路中阿胜接近五成。

## ② 赛果定义

- 预测对象为 90 分钟（含补时）三路赛果：约旦胜 / 平局 / 阿尔及利亚胜。
- 世界杯小组赛无加时、无点球大战，平局即为最终赛果。

## ③ 实力画像

| 指标 | 约旦 | 阿尔及利亚 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1680（第 52） | 1772（第 29） |
| 世界杯经历 | 首次入围决赛圈 | 多次参赛，非洲区预选 8 胜出线 |
| 核心球员 | Mousa Tamari（雷恩，队内唯一五大联赛球员） | Mahrez（队长，113 场 38 球）、Amoura（预选赛 10 球） |
| 近期状态 | 热身赛 1-4 负瑞士（5-31）、0-2 负哥伦比亚 | 5-31 公布 26 人名单，主力齐整（Bennacer 落选除外） |

两队历史上从未交手（MLSSoccer J 组前瞻）。

## ④ 关键因素

1. **Elo 差距 92 分**：阿尔及利亚 1772 vs 约旦 1680，对应统计模型中阿队约 47% 的基准胜率（eloratings.net，2026-06-11）。
2. **约旦热身连败 + 减员**：1-4 负瑞士（5 月 31 日）、0-2 负哥伦比亚；前锋 Ibrahim Sabra 训练中左踝韧带断裂退队，由 20 岁后卫 Mohammad Taha 顶替（Al Jazeera 2026-06-06；OneFootball 2026 年 6 月）。
3. **阿尔及利亚阵容齐整、火力足**：Petković 5 月 31 日公布名单，Mahrez 领衔出战其"最后一届世界杯"，Amoura 预选赛 8 场 10 球（beIN Sports 2026-05-31）。
4. **小组形势提升胜负欲**：同组有卫冕冠军阿根廷，本场被双方视为争夺小组第二的关键战，双方求胜动机均强，平局倾向不额外上调（MLSSoccer J 组前瞻，2026 年 6 月）。
5. **中立场地**：圣克拉拉 Levi's Stadium，当地 6 月 22 日 20:00 开球，无任何一方主场加成（levisstadium.com）。
6. **约旦首次参加世界杯**：经验劣势存在，但其 Elo 已处第 52 位，近期状态已被模型部分计入。

## ⑤ 模型与调整

- **p_stat（Davidson 三路模型，scale=400，drawNu=0.7，无东道主加成——双方均非东道主）**：
  - 约旦 27.7% / 平局 25.3% / 阿尔及利亚 47.0%
- **证据调整（合计 |Δ| ≈ 4pp ≤ 8pp 上限）**：
  - 约旦 −1.7pp：热身两连败（净负 5 球）+ 锋线伤员退队 + 首届大赛经验缺口；
  - 阿尔及利亚 +2.0pp：名单齐整、核心状态明确、预选赛进攻数据强；
  - 平局 −0.3pp：双方均有强求胜动机，小幅下修后归一化。
- **p_final**：约旦 26% / 平局 25% / 阿尔及利亚 49%。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，数字仅来自 Elo 统计模型加上述有据可查的有限调整。

## ⑥ 方法说明

基于 eloratings.net 2026-06-11 抓取的 Elo 评分，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 `eloToOneXTwo` 一致）计算基准概率；再依据有日期、有来源的公开事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映参数敏感性（drawNu 0.6–0.8 使平局概率在 22.5%–27.9% 间波动；Elo ±25 分使阿胜在 44.3%–49.8% 间波动）以及证据偏薄（两队从未交手、约旦无大赛样本）带来的额外不确定性。

### 来源清单

1. eloratings.net（World.tsv，2026-06-11 抓取）— Elo 评分与排名
2. Al Jazeera（2026-06-06）— 约旦热身赛战绩、首次参赛背景：https://www.aljazeera.com/sports/2026/6/6/jordan-world-cup-2026-preview-players-to-watch-group-matches-and-squad
3. OneFootball（2026 年 6 月）— Sabra 伤退、Taha 替补入队：https://onefootball.com/en/news/ibrahim-sabra-out-mohammad-taha-completes-jordans-2026-world-cup-squad-42984089
4. beIN Sports（2026-05-31）— 阿尔及利亚 26 人名单、Mahrez/Bennacer 动态：https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/vladimir-petkovi-s-official-algeria-squad-for-the-2026-fifa-world-cup-2026-05-31
5. MLSSoccer J 组前瞻（2026 年 6 月）— 小组形势、两队历史无交手、Tamari/Amoura 角色：https://www.mlssoccer.com/news/2026-fifa-world-cup-group-j-preview-argentina-algeria-austria-jordan
6. Levi's Stadium 官网 — 场地与开球时间：https://levisstadium.com/event/fifa-world-cup-group-stage-2026-06-22/

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
