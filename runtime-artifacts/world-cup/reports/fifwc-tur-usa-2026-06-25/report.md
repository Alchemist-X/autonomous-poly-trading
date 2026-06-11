# 土耳其 vs 美国 — 2026 世界杯 D 组第三轮（市场盲测预测）

- **比赛**：2026-06-25（UTC 2026-06-26T02:00），SoFi 体育场，英格尔伍德（洛杉矶）
- **事件标识**（仅作结算元数据）：`fifwc-tur-usa-2026-06-25`
- **生成时间**：2026-06-11 | **置信档：中**

## ① 预测结论

| 赛果 | p_final | 80% 区间 |
| --- | --- | --- |
| 土耳其胜 | **45%** | 39% – 52% |
| 平局 | **26%** | 21% – 29% |
| 美国胜 | **29%** | 23% – 34% |

**一句话观点**：土耳其纸面实力（Elo 高出 185 分）明显占优，但美国坐拥东道主主场之利，土耳其胜率约 45%，平局加美国胜合计约 55%，悬念不小。

## ② 定义

90 分钟法定时间三路赛果（含伤停补时）；世界杯小组赛无加时、无点球大战，平局即为有效结果。

## ③ 实力画像

| 项目 | 土耳其 | 美国 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1911（第 13） | 1726（第 39） |
| 主帅 | Vincenzo Montella | Mauricio Pochettino |
| 核心 | Çalhanoğlu（队长）、Güler、Yıldız | Pulisic（84 场国家队）、Adams、McKennie |
| 场地属性 | 客场（无中立加成） | 东道主，小组赛全部在本土，本场即主场 |

土耳其名单 6 月 2 日公布（beIN Sports）；美国名单 5 月下旬公布，13 人有 2022 世界杯 16 强经验（NPR/ESPN）。

## ④ 关键因素

1. **Elo 差距 185 分**：土耳其 1911 vs 美国 1726，纸面差距相当于强队对中游队。（来源：eloratings.net，2026-06-11）
2. **美国主场**：本场在洛杉矶 SoFi 体育场，是美国小组赛第三战、全程本土作战；模型已给 +100 主场加成。（来源：sofistadium.com / NBC Sports，2026-06）
3. **土耳其核心伤病史**：Çalhanoğlu 5 月左腿比目鱼肌拉伤、Güler 4 月右腿股二头肌伤（预计休 4 周、赶上 6-13 揭幕战），二人预期可出战但带近期肌肉伤隐患。（来源：Daily Sabah，2026-05）
4. **美国伤缺**：主力后腰 Johnny Cardoso 与前锋 Agyemang 因伤无缘世界杯；Richards 脚伤不重。（来源：ESPN，2026-05-26）
5. **第三轮变数**：本场为小组末轮，出线形势取决于前两轮（撰写时尚未开打），轮换与战意暂不可知，预测不确定性相应放大。（来源：NBC Sports 赛程，2026-06）

## ⑤ 模型与调整

- **p_stat（Davidson 三路 Elo 模型，scale=400，drawNu=0.7，美国 +100 东道主加成）**：土耳其 46.3% / 平 25.4% / 美国 28.4%
- **调整**：土耳其 −1.3pp（两名核心创造者近两月均有肌肉伤史，赛会制密集赛程下有复发风险），平局 +0.6pp、美国 +0.6pp（美国自身亦缺 Cardoso/Agyemang，故回拨幅度有限）；总调整 1.3pp，远低于 ±8pp 上限——距离开赛尚有两周、末轮战意未知，证据偏薄，刻意保持小幅。
- **p_final**：土耳其 45% / 平 26% / 美国 29%
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，未参考亦不引用任何博彩数据。

## ⑥ 方法说明

基于 eloratings.net 世界 Elo 评分，用 Davidson 三路模型（drawNu=0.7）将评分差转为胜/平/负概率，东道主小组赛主场加 100 分；再依据有日期、有来源的公开事实做不超过 ±8pp 的有界调整。80% 区间反映参数敏感性（drawNu 0.6–0.8、主场加成 ±35）及证据稀薄度。

**来源清单**：

1. eloratings.net（World.tsv，2026-06-11 抓取）
2. Daily Sabah — Türkiye fret over Çalhanoğlu, Güler fitness（2026-05）— https://www.dailysabah.com/sports/football/turkiye-fret-over-calhanoglu-guler-fitness-ahead-of-crucial-summer
3. beIN Sports — Montella 官方名单（2026-06-02）— https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/vincenzo-montella-s-official-turkey-squad-for-the-2026-fifa-world-cup-2026-06-02
4. ESPN — USMNT names 2026 World Cup roster（2026-05-26）— https://www.espn.com/soccer/story/_/id/48882389/usa-2026-world-cup-roster-christian-pulisic-squad-mckennie-adams
5. NPR — US World Cup roster（2026-05-26）— https://www.npr.org/2026/05/26/nx-s1-5835318/2026-world-cup-us-roster-usmnt
6. SoFi Stadium 官网 — Türkiye vs. USA 赛事页（2026-06）— https://www.sofistadium.com/events/detail/fifa-world-cup-turkiye-vs-usa
7. NBC Sports — 2026 World Cup schedule（2026-06）— https://www.nbcsports.com/soccer/news/2026-world-cup-schedule-kick-off-times-stadiums-dates-groups-how-to-watch-live-bracket

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
