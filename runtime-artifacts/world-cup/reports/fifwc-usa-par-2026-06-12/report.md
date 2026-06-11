# 2026 世界杯小组赛 D 组：美国 vs 巴拉圭（市场盲测预测）

- **比赛**：United States vs Paraguay，D 组首轮
- **开球时间**：2026-06-13 01:00 UTC（当地 6 月 12 日晚，SoFi Stadium，加州英格尔伍德）
- **事件 slug（仅结算元数据）**：`fifwc-usa-par-2026-06-12`
- **生成时间**：2026-06-11T13:15:00Z

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 美国胜 | **37.7%** | 32% – 43% | 中 |
| 平局 | **25.9%** | 22% – 30% | 中 |
| 巴拉圭胜 | **36.4%** | 31% – 42% | 中 |

**一句话观点**：实力极为接近的均势开局——巴拉圭 Elo 更高但核心恩西索伤疑，美国坐拥东道主主场之利，胜负概率接近五五开，平局风险不可忽视。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负）。小组赛无加时、无点球，常规时间结束即按比分结算。

## ③ 实力画像

| 指标 | 美国 | 巴拉圭 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1726（第 39） | 1834（第 22） |
| 主帅 | Mauricio Pochettino | Gustavo Alfaro |
| 近期状态 | 主力中卫 Richards 伤疑，门将 Freese 已坐稳主力（NBC Sports，2026-06-10） | 6 月 5 日热身 4-0 大胜尼加拉瓜（ESPN，2026-06-05） |
| 背景 | 东道主，全部小组赛在本土进行 | 时隔多届重返世界杯，6 月 1 日公布 26 人名单（FIFA.com，2026-06-01） |

巴拉圭纸面 Elo 高出 108 分，但美国作为东道主在模型中获得 +100 主场修正，两队修正后几乎完全持平。

## ④ 关键因素

1. **恩西索（Julio Enciso）出战成疑**：巴拉圭头号进攻核心 6 月 5 日热身赛被担架抬下，MRI 排除肌肉结构性撕裂，但首战"highly doubtful"（SI，2026-06-10；beIN Sports，2026-06-06）。
2. **美国主力中卫 Richards 难首发**：5 月 17 日踝部两条韧带撕裂，6 月 8 日才恢复合练，预计无法首发，由 Robinson / McKenzie / Freeman 竞争替代（NBC Sports / Sports Mole，2026-06-10）。
3. **东道主主场**：比赛在加州 SoFi Stadium 进行，美国享受真正意义上的主场氛围；这是模型 +100 主场分的现实依据（ESPN，2026-06-10）。
4. **巴拉圭无其他伤病**：除恩西索外，Alfaro 手中阵容齐整（Rotowire 赛前分析，2026-06-10）。
5. **巴拉圭热身状态**：4-0 胜尼加拉瓜展示进攻火力，但对手实力有限，参考价值打折（ESPN，2026-06-05）。
6. **美国核心可用**：Pulisic、Adams 确定首发，Tillman 状态上佳（NBC Sports，2026-06-10）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7；美国为东道主小组赛 Elo +100 → 有效 1826 vs 1834）：
  美国 36.2% / 平 25.9% / 巴拉圭 37.9%
- **调整（上限 ±8pp，本次净移动 3pp）**：恩西索（球队唯一进攻核心）伤疑对巴拉圭的削弱，略大于 Richards（中卫位置有多名替代者）缺阵对美国的削弱；两伤情大部分相互抵消，故仅小幅 +1.5pp 给美国、-1.5pp 给巴拉圭，平局不动。
- **p_final**：美国 37.7% / 平 25.9% / 巴拉圭 36.4%
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，概率仅来自 Elo 统计模型加上述有据可查的有限调整。

## ⑥ 方法说明

以 eloratings.net 世界 Elo 为输入，采用 Davidson 三路概率模型（平局参数 ν=0.7），东道主小组赛加 +100 主场分；再依据带来源、带日期的公开新闻事实做不超过 ±8pp 的有界调整。80% 区间反映参数敏感性（ν 在 0.6–0.8、主场分 ±35 时美国胜率波动约 32.5%–39.9%）及证据厚度。

### 来源清单

1. eloratings.net World.tsv（2026-06-11 抓取）
2. NBC Sports — USMNT lineup versus Paraguay（2026-06-10）：https://www.nbcsports.com/soccer/news/usmnt-lineup-versus-paraguay-who-will-pochettino-choose-for-usa-in-world-cup-opener
3. Sports Mole — Predicted USA lineup vs Paraguay（2026-06-10）：https://www.sportsmole.co.uk/football/usa/world-cup-2026/predicted-lineups/pochettinos-defensive-dilemma-for-us-opener-predicted-usa-lineup-vs-paraguay_598933.html
4. SI — USMNT's First World Cup Opponent Suffers Injury Blow（2026-06-10）：https://www.si.com/soccer/usmnt-first-world-cup-opponent-injury-blow-star-player
5. beIN Sports — Paraguay's Julio Enciso injured ahead of World Cup（2026-06-06）：https://www.beinsports.com/en-au/football/fifa-world-cup-2026/articles/paraguay-s-julio-enciso-injured-ahead-of-world-cup-2026-06-06
6. ESPN — Paraguay 4-0 Nicaragua（2026-06-05）：https://www.espn.com/soccer/match/_/gameId/401871132/nicaragua-paraguay
7. FIFA.com — Paraguay squad announcement（2026-06-01）：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/paraguay-squad-announcement-gustavo-alfaro
8. ESPN — USA at the 2026 World Cup schedule/news（2026-06-10）：https://www.espn.com/soccer/story/_/id/48940468/usa-world-cup-2026-schedule-fixtures-results-scores-group-d-how-watch-news-analysis-injuries

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
