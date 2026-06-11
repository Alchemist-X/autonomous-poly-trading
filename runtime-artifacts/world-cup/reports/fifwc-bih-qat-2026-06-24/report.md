# 波黑 vs 卡塔尔 — 2026 世界杯 B 组（市场盲测预测）

- **比赛**：2026-06-24 19:00 UTC，Lumen Field（西雅图，中立场地），B 组第三轮
- **生成时间**：2026-06-11T13:15:00Z ｜ 预测性质：**市场盲测**（完全独立于任何盘口/赔率）

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 波黑胜 | **53.8%** | 46% – 61% | 中 |
| 平局 | **24.7%** | 19% – 30% | 中 |
| 卡塔尔胜 | **21.5%** | 15% – 28% | 中 |

**一句话观点**：Elo 差 174 分让波黑成为明显占优一方，但哲科伤情未明与小组末轮变数限制了把握度，波黑胜率约 54%。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负）；小组赛无加时与点球，补时计入 90 分钟赛果。

## ③ 实力画像

- **波黑**：Elo 1595（世界第 65），数据取自 eloratings.net（2026-06-11 抓取）。经附加赛点球淘汰意大利（2026-03-31）晋级，队史核心哲科（40 岁，73 球队史射手王）状态存疑。来源：eloratings.net；mlssoccer.com（B 组前瞻）。
- **卡塔尔**：Elo 1421（世界第 96），同源同日。主帅洛佩特吉 2025 年夏上任以来仅 2 胜，且自 2025 年 12 月后无正式比赛，6 月初友谊赛 0-1 负爱尔兰。来源：fourfourtwo.com（2026-06）；mlssoccer.com。

## ④ 关键因素

1. **哲科肩伤反复**：3 月受伤后累计仅出场 64 分钟，缺席世界杯前最后一场热身赛，能否及时复出存疑（northerntribune.ca，2026-06；sportsmole.co.uk，2026-06）。本场为第三轮，较揭幕战多约 12 天恢复期，影响打折。
2. **波黑锋线深度受损**：Tabakovic 跖骨骨折恢复中、Sunjic 有肌肉问题；替补中锋 Demirovic（斯图加特）可顶替（sportsmole.co.uk，2026-06）。
3. **卡塔尔状态低迷**：洛佩特吉执教至今仅 2 胜，6 月 2 日公布 26 人名单，6 月初友谊赛 0-1 负爱尔兰（fourfourtwo.com，2026-06；qna.org.qa，2026-06-02）。
4. **卡塔尔缺乏正式比赛**：自 2025 年 12 月以来没打过任何正式比赛，比赛节奏存疑；进攻依赖 Almoez Ali（亚洲区预选 12 球）与 Akram Afif（mlssoccer.com，2026；olympics.com，2026）。
5. **中立场地**：西雅图 Lumen Field，双方均无主场加成（soundersfc.com，2025-12）。
6. **末轮变数**：6 月 24 日为 B 组末轮（同组同时开球），届时双方出线形势可能改变轮换与战意，目前无法预判，计入区间不计入点估计。

## ⑤ 模型与调整

- **p_stat（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主场加成）**：
  波黑 55.8% / 平 23.7% / 卡塔尔 20.5%（Ra=1595，Rb=1421）。
- **证据调整（上限 ±8pp，实际 ±2pp）**：哲科伤情与波黑锋线减员带来下行风险（−2pp 波黑），卡塔尔的低迷状态与长期缺赛已大体反映在 1421 的低 Elo 中，不再重复加扣；平局 +1pp、卡塔尔 +1pp。
- **p_final**：波黑 53.8% / 平 24.7% / 卡塔尔 21.5%。
- 本预测为**市场盲测**：全程未读取、未参考任何博彩或预测市场价格，概率仅来自 Elo 统计模型与上述有据可查的有限调整。

## ⑥ 方法与来源

方法：以 eloratings.net 2026-06-11 快照为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致）得出基准概率；再依据带日期来源的球队情报做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 的参数敏感度（波黑胜 54.0%–57.8%）、伤情不确定性与末轮战意变数。

来源清单：
1. https://www.eloratings.net/World.tsv （2026-06-11 抓取）
2. https://northerntribune.ca/world-cup-2026-edin-dzeko-injury/ （2026-06）
3. https://www.sportsmole.co.uk/football/canada/world-cup-2026/predicted-lineups/dzeko-seeking-an-improbable-return-predicted-bosnia-herzegovina-lineup-vs-canada_598905.html （2026-06）
4. https://www.fourfourtwo.com/team/qatar-world-cup-2026-squad （2026-06）
5. https://qna.org.qa/en/News-Area/News/2026-6/2/2026-world-cup-qatar-coach-announces-final-squad （2026-06-02）
6. https://www.mlssoccer.com/news/2026-fifa-world-cup-group-b-preview-canada-bosnia-herzegovina-qatar-switzerland （2026-06）
7. https://www.soundersfc.com/news/bosnia-and-herzegovina-to-face-qatar-at-lumen-field-after-securing-final-group-b-spot-for-2026-fifa-world-cup （2025-12）

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
