# 乌兹别克斯坦 vs 哥伦比亚 — 2026 世界杯小组赛 K 组（市场盲测预测）

- **比赛**：2026-06-17（UTC 开球 2026-06-18T02:00:00Z），墨西哥城阿兹特克体育场（中立场地，海拔约 2,200 米）
- **事件标识**（仅作结算元数据）：`fifwc-uzb-col-2026-06-17`
- **生成时间**：2026-06-11T13:15:00Z

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 乌兹别克斯坦胜 | **12.5%** | 8% – 18% | 中 |
| 平局 | **22.0%** | 17% – 28% | 中 |
| 哥伦比亚胜 | **65.5%** | 57% – 74% | 中 |

**一句话观点**：哥伦比亚实力、状态与阵容完整度全面占优，约 65% 概率取胜；乌兹别克斯坦世界杯首秀且队长舒穆罗多夫带伤出战成疑，靠防守拖平是其最现实的出路。

## ② 赛果定义

90 分钟法定时间三路赛果（胜/平/负），含补时；小组赛无加时无点球。

## ③ 实力画像

| | 乌兹别克斯坦 | 哥伦比亚 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1714（第 42） | 1982（第 7） |
| 近况 | 近 5 场友谊赛 2 胜 1 平 2 负；6 月 8 日 1-2 负荷兰 | 近 5 场 3 胜；6 月 8 日 2-0 胜约旦 |
| 核心 | Shomurodov（队长，国家队史射手王 44 球，伤情存疑）、Khusanov（曼城中卫） | James Rodríguez（队长）、Luis Díaz（拜仁，南美区预选赛 7 球射手榜第二） |
| 主帅/风格 | 卡纳瓦罗，防守型 5-4-1 | Néstor Lorenzo，进攻主导 |
| 背景 | 历史首次晋级世界杯正赛 | 2014 年八强班底传承，全主力出战 |

来源：eloratings.net（2026-06-11）；ESPN（2026-06-08）；Goal.com 赛前预览（2026-06）；FIFA.com 哥伦比亚名单公告（2026-06）。

## ④ 关键因素

1. **Elo 差距 268 分**（1982 vs 1714），统计模型直接给出哥伦比亚约 65% 基准胜率。（eloratings.net，2026-06-11）
2. **乌兹别克斯坦队长 Shomurodov 伤情**：6 月 8 日对荷兰友谊赛第 24 分钟伤退，世界杯首战出场存疑；他是球队唯一的顶级终结点。（ESPN，2026-06-08）
3. **哥伦比亚阵容完整、状态上佳**：26 人名单无伤病报告，J罗与迪亚斯领衔，6 月 8 日 2-0 完胜约旦，J罗表现亮眼。（FIFA.com / beIN Sports，2026-06-08）
4. **卡纳瓦罗的防守型 5-4-1**：弱队低位防守打法在世界杯小组赛首轮有抬高平局概率的历史倾向。（heavy.com 荷兰战首发报道，2026-06-08）
5. **中立高原场地**：阿兹特克海拔约 2,200 米，对两队都是客场；哥伦比亚国内联赛球员有高原经验，乌兹别克斯坦无明显高原适应优势，此项基本中性、略偏哥伦比亚。（Goal.com / Yahoo Sports，2026-06）
6. **首秀心理**：乌兹别克斯坦历史首场世界杯正赛，动机极强但大赛经验为零，方向性影响不确定，不做调整。（Goal.com，2026-06）

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主办国加成）：
  乌兹 13.9% / 平 21.1% / 哥伦比亚 65.0%
- **调整（合计 |Δ| ≈ 2.8pp，上限 ±8pp）**：
  - Shomurodov 伤情存疑 + 哥伦比亚全员健康状态佳：乌兹 −1.4pp，哥伦比亚 +0.5pp
  - 5-4-1 防守型布阵 + 世界杯首轮普遍偏保守：平局 +0.9pp
- **p_final**：乌兹 **12.5%** / 平 **22.0%** / 哥伦比亚 **65.5%**
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，概率仅来自 Elo 统计模型加上述有据可查的有界调整。

## ⑥ 方法说明

以 eloratings.net 世界 Elo 为输入，用 Davidson 三路模型（与仓库 packages/sports-model/src/elo.ts 的 eloToOneXTwo 一致：scale=400，drawNu=0.7）得到基准概率；主办国（墨/美/加）小组赛才有 +100 主场加成，本场两队均非主办国，按中立处理。随后仅依据有日期、有来源的事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映参数敏感性（drawNu 0.6–0.8 使三路基准摆动约 ±2–3pp）及赛前一周伤情与首发的不确定性。

### 来源清单

1. eloratings.net World.tsv（抓取于 2026-06-11）— Elo 与排名
2. ESPN：Netherlands 2-1 Uzbekistan（2026-06-08）— 友谊赛结果、Shomurodov 伤退 — https://www.espn.com/soccer/match/_/gameId/401871814/uzbekistan-netherlands
3. Goal.com：Uzbekistan vs Colombia World Cup Preview（2026-06）— 赛程、场地、两队近况 — https://www.goal.com/en-us/news/uzbekistan-colombia-world-cup-preview/bltd5f07d2b89067908
4. FIFA.com：Diaz and James headline Colombia squad（2026-06）— 哥伦比亚 26 人名单 — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/colombia-squad-announced
5. beIN Sports：James Rodríguez shining against Jordan（2026-06-08）— 哥伦比亚状态 — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/james-rodr%C3%ADguez-undisputed-leader-of-colombia-on-the-road-to-the-2026-world-cup-after-shining-against-jordan-2026-06-08
6. heavy.com：Netherlands vs Uzbekistan team news（2026-06-08）— 卡纳瓦罗 5-4-1 阵型 — https://heavy.com/sports/soccer/how-to-watch-netherlands-vs-uzbekistan-live-today-team-news-lineups-stats-and-tv-guide/

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
