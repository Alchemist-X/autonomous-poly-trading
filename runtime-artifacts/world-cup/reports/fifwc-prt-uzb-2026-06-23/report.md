# 世界杯小组赛预测：葡萄牙 vs 乌兹别克斯坦（K组，2026-06-23）

> 市场盲测报告：本预测完全独立于任何盘口、赔率或预测市场数据，仅基于统计模型与公开新闻证据。
> 生成时间：2026-06-11（开赛前 12 天，两队首轮小组赛尚未进行）

## ① 预测结论

| 赛果（90分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 葡萄牙胜 | **68.0%** | 60% – 74% | 中 |
| 平局 | **19.5%** | 15% – 25% | 中 |
| 乌兹别克斯坦胜 | **12.5%** | 8% – 18% | 中 |

**一句话观点：** 葡萄牙实力、状态与大赛经验全面占优，模型给出约 68% 胜率；世界杯首秀的乌兹别克斯坦更可能以防守姿态争取平局而非爆冷取胜。

## ② 定义

- 标的：2026-06-23 17:00 UTC（休斯敦当地中午）K 组第 47 场，葡萄牙 vs 乌兹别克斯坦。
- 三路赛果按 **90 分钟常规时间**（含补时）判定；小组赛无加时、无点球。
- 结算元数据：事件 slug `fifwc-prt-uzb-2026-06-23`（仅作标识，不引用任何价格）。

## ③ 实力画像

| 指标 | 葡萄牙 | 乌兹别克斯坦 |
| --- | --- | --- |
| Elo（本仓库 elo-table.json 快照，源 eloratings.net） | 1989（第 6） | 1714（第 42） |
| 大赛履历 | 现任欧国联卫冕冠军（2025-06 决赛点球胜西班牙，半决赛 2-1 德国） | **世界杯首次参赛**（本届四支新军之一） |
| 近期状态 | 近 5 场 3 胜，打进 13 球失 4 球；6 月热身赛 2-1 尼日利亚 | 卡纳瓦罗 6 月 2 日公布 26 人名单，15 人来自国内联赛 |
| 核心球员 | C 罗（5 月 19 日入选，第 6 次世界杯，队长）、B 费、莱奥等 | 舒穆罗多夫（队长，国家队 44 球）、库萨诺夫（曼城中卫）、法伊祖拉耶夫 |

来源：FIFA（2026-05-19）、Al Jazeera（2026-06-08）、beIN Sports（2026-06-02）、Olympics.com（2026-06）。

## ④ 关键因素

1. **Elo 差距 275 分**：1989 vs 1714，中立场 Davidson 模型直接给出葡萄牙约 65.7% 基准胜率（elo-table.json 快照，源 eloratings.net，2026-06）。
2. **C 罗伤愈入选**：3 月曾因腿筋拉伤缺席热身赛（Plataforma Media，2026-03-25），但 5 月 19 日正式入选并任队长，预计休斯敦首发（FIFA，2026-05-19）。
3. **葡萄牙状态上佳**：欧国联卫冕冠军，近 5 场 3 胜进 13 球，6 月热身 2-1 尼日利亚（Al Jazeera 2026-06-08；Outlook India 2026-06）。
4. **乌兹别克防线隐忧**：头号球星、曼城中卫库萨诺夫本赛季因伤出场时间有限，比赛状态存疑（beIN Sports，2026-06-02）。
5. **新军经验劣势**：乌兹别克斯坦为世界杯首秀，26 人中 15 人效力国内联赛，顶级大赛对抗经验有限（FIFA 队史页 2026；beIN Sports 2026-06-02）。
6. **场地因素中性化**：NRG 体育场可开合屋顶 + 全场空调，6 月中午场预计闭顶恒温，休斯敦酷热对两队影响被抵消，不构成调整理由（Football Ground Guide，2026-06）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主场加成——两队均非东道主）：
  葡萄牙 65.7% / 平局 20.8% / 乌兹别克斯坦 13.5%。
- **证据调整 delta（合计 +2.3pp，远低于 ±8pp 上限）**：葡萄牙 +2.3pp，平局 −1.3pp，乌兹别克 −1.0pp。
  理由：葡萄牙满状态满编（因素 2、3）叠加乌方核心中卫状态存疑与新军经验劣势（因素 4、5）；但 Elo 已涵盖大部分实力差，且乌队首轮（6/18 对哥伦比亚）结果未知，证据偏薄，故只做小幅调整。
- **p_final（归一化后）**：葡萄牙 **68.0%** / 平局 **19.5%** / 乌兹别克斯坦 **12.5%**。
- **区间口径**：drawNu 在 0.6–0.8 间扫描使三路各移动 2–4pp；葡萄牙 Elo ±50 使胜率在 61%–70% 间波动；叠加赛前 12 天阵容/首轮结果不确定性后取 80% 区间如上表。本场无主场加成参数，故不含 ±35 加成敏感项。
- **本预测为市场盲测**：全程未读取、未参考任何博彩赔率或预测市场价格，p_final 即发布数字。

## ⑥ 方法与来源

方法：以 eloratings.net 的 Elo 快照为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致）得出统计基准概率；再以截至 2026-06-11 的有来源新闻证据做不超过 ±8pp 的有界调整并归一化；80% 区间反映模型参数敏感性与证据厚度。

来源清单：
1. FIFA — 葡萄牙名单公布（2026-05-19）：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cristiano-ronaldo-roberto-martinez-portugal-squad-announcement
2. beIN Sports — 乌兹别克斯坦世界杯指南（2026-06-02）：https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/uzbekistan-at-the-2026-fifa-world-cup-squad-schedule-and-everything-you-need-to-know-2026-06-02
3. Al Jazeera — 葡萄牙世界杯前瞻（2026-06-08）：https://www.aljazeera.com/sports/2026/6/8/portugal-world-cup-2026-preview-players-to-watch-group-matches-and-squad
4. Plataforma Media — C 罗肌肉伤情（2026-03-25）：https://www.plataformamedia.com/en/2026/03/25/ronaldo-portugal-muscle-injury-world-cup-2026/
5. FIFA — 乌兹别克斯坦队史与赛程（2026）：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/uzbekistan-team-profile-history
6. Football Ground Guide — 2026 世界杯空调球场（2026-06）：https://footballgroundguide.com/news/which-2026-world-cup-stadiums-have-air-conditioning.html
7. Outlook India — 葡萄牙 2-1 尼日利亚热身赛（2026-06）：https://www.outlookindia.com/sports/football/portugal-vs-nigeria-live-score-international-friendly-2026-updates-highlights-leiria
8. eloratings.net Elo 快照（经仓库 runtime-artifacts/world-cup/elo-table.json，2026-06）

免责声明：本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
