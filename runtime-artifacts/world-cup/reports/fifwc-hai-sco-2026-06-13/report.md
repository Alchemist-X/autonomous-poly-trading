# 海地 vs 苏格兰（2026 世界杯 C 组小组赛）市场盲测预测

- 比赛：2026-06-13（美东 21:00）/ UTC 2026-06-14T01:00:00Z
- 地点：吉列体育场（Gillette Stadium，马萨诸塞州福克斯堡），中立场地
- 事件标识（仅结算元数据）：`fifwc-hai-sco-2026-06-13`
- 生成时间：2026-06-11T13:15:00Z

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 海地胜 | **18.5%** | 14% – 24% | 中 |
| 平局 | **23.5%** | 19% – 28% | 中 |
| 苏格兰胜 | **58.0%** | 51% – 65% | 中 |

**一句话观点：** 苏格兰凭 234 分的 Elo 差距是明显强方，但 Gilmour 伤退、Adams 存疑，加上海地新归化班底被 Elo 低估，胜率应略低于纯模型值。

## ② 定义

90 分钟三路赛果（含补时，不含加时/点球）；小组赛无加时。三个互斥结果：海地胜 / 平局 / 苏格兰胜。

## ③ 实力画像

| | 海地 | 苏格兰 |
| --- | --- | --- |
| Elo（2026-06-11，eloratings.net） | 1548（第 73） | 1782（第 26） |
| 世界杯履历 | 史上第二次决赛圈，1974 年后首次 | 28 年来首次（1998 年后） |
| 预选赛 | 10 场 6 胜，进 20 球 | 4 胜 1 平 1 负小组头名，末轮 4-2 胜丹麦 |
| 热身赛 | 4-0 胜新西兰，末战 1-2 负秘鲁 | 5-30 友谊赛 4-1 胜库拉索 |

来源：eloratings.net（经 elo-table.json，抓取于 2026-06-11）；Sky Sports C 组指南 <https://www.skysports.com/football/news/12098/13543087/>；Olympics.com 海地队页 <https://www.olympics.com/en/news/fifa-world-cup-2026-haiti-players-squad-list-key-stats-schedule>。

## ④ 关键因素

1. **苏格兰中场核心 Billy Gilmour（那不勒斯）伤退整届赛事**（2026-05-30 友谊赛受伤，由 Tyler Fletcher 替补入队）——削弱控场能力。ESPN <https://www.espn.com/soccer/story/_/id/48814281/>，2026-06。
2. **前锋 Ché Adams（都灵）大腿伤势，赶赛存疑**。ESPN <https://www.espn.com/soccer/story/_/id/48701669/>，2026-06。
3. **Robertson、McTominay 均健康入选**，McTominay 预选赛末轮倒钩破丹麦，状态在线。ESPN <https://www.espn.com/soccer/story/_/id/48814281/>，2026-06。
4. **海地获大量旅欧侨民球员补强**：Wilson Isidor（桑德兰，2026-03 改披海地战袍首秀）、Jean-Ricner Bellegarde（狼队）——Elo 对这批新援的反映滞后。Haitian Times <https://haitiantimes.com/2026/05/16/haiti-team-roster-2026-fifa-world-cup/>，2026-05-16。
5. **海地头牌 Duckens Nazon**（队史射手王，76 场 44 球，预选赛 6 球含对哥斯达黎加帽子戏法）。FourFourTwo <https://www.fourfourtwo.com/team/haiti-world-cup-2026-squad>，2026-06。
6. **赛事格局**：同组有巴西、摩洛哥，两队现实目标是争小组第三晋级名额，本场对双方都是关键战，无放水动机。Sky Sports <https://www.skysports.com/football/news/12098/13543087/>，2026-06。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场地无主场加成）：海地 16.1% / 平 22.1% / 苏格兰 61.8%。
- **调整（合计 ≤ ±8pp）**：苏格兰 −4.0pp（Gilmour 伤退 + Adams 存疑）；海地 +2.5pp、平局 +1.5pp（归化补强未入 Elo、热身状态尚可）。位移总和为零，无需再归一化。
- **p_final**：海地 18.5% / 平 23.5% / 苏格兰 58.0%。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，仅由统计模型 + 有据可查的事实调整生成。

## ⑥ 方法、来源与免责声明

**方法**：以 eloratings.net 世界 Elo 为输入，用 Davidson 三路平局模型（drawNu=0.7）得出基准概率；再依据带日期与出处的公开新闻事实做不超过 ±8pp 的有界调整。80% 区间反映参数敏感性（drawNu 0.6–0.8 使三路各移动约 ±1–3pp）与证据单薄度（海地真实实力因阵容换血而高度不确定）。

**来源清单**：
1. eloratings.net World.tsv（经本仓库 elo-table.json，2026-06-11 抓取）
2. Sky Sports — World Cup 2026 Group C guide（2026-06）
3. ESPN — Scotland World Cup squad announced（2026-06）
4. ESPN — Scotland at the 2026 World Cup hub（2026-06）
5. Olympics.com — Haiti at FIFA World Cup 2026（2026-06）
6. Haitian Times — Haiti unveils 2026 FIFA World Cup roster（2026-05-16）
7. FourFourTwo — Haiti World Cup 2026 squad（2026-06）
8. FOX Sports — Haiti World Cup 2026 schedule（场地与开球时间，2026-06）

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
