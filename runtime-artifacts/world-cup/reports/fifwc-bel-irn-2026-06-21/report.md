# 比利时 vs 伊朗（2026 世界杯 G 组）市场盲测预测

- 赛事：2026 FIFA 世界杯小组赛 G 组，第 39 场
- 开球：2026-06-21T19:00:00Z（SoFi 体育场，洛杉矶 Inglewood）
- 事件 slug（仅结算元数据）：`fifwc-bel-irn-2026-06-21`
- 生成时间：2026-06-11T13:15:00Z ｜ 预测类型：**市场盲测**（完全独立于任何盘口/赔率）

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 比利时胜 | **51.8%** | 45% – 58% | 中 |
| 平局 | **24.3%** | 20% – 29% | 中 |
| 伊朗胜 | **23.9%** | 19% – 30% | 中 |

**一句话观点**：比利时 Elo 高出 122 分、纸面实力明显占优，但德布劳内/卢卡库的伤病状态与伊朗的整体韧性让这场更接近"六成把握"而非碾压局。

## ② 定义

90 分钟三路赛果（含补时，不含加时/点球）；小组赛无加时。以官方结算为准。

## ③ 实力画像

| 项目 | 比利时 | 伊朗 |
| --- | --- | --- |
| Elo（2026-06-11，eloratings.net） | 1894（第 15） | 1772（第 29） |
| 主帅 | Rudi Garcia | Amir Ghalenoei |
| 核心 | 德布劳内（预选赛 6 球）、库尔图瓦、多库 | 塔雷米（奥林匹亚科斯 15 场 10 球） |
| 关键缺口 | KDB/卢卡库带伤入选，状态存疑 | 阿兹蒙整队除名（91 场 57 球的空缺） |

来源：eloratings.net（经本地 `elo-table.json`，抓取于 2026-06-11）；beIN Sports 2026-05-15；Flashscore 2026-06-01。

## ④ 关键因素

1. **Elo 差 122 分**：比利时 1894 vs 伊朗 1772，中立场下统计模型给比利时约 50% 胜率（eloratings.net，2026-06-11）。
2. **比利时双核带伤**：德布劳内（眼伤，那不勒斯）与卢卡库（髋伤，本赛季各项赛事仅 7 场）均带伤入选 5 月 15 日公布的 26 人名单（beIN Sports，2026-05-15）。
3. **伊朗失去阿兹蒙**：被完全排除在名单外，91 场 57 球的二号射手空缺，进攻端实质降级（Flashscore / allfootball，2026-06-01）。
4. **塔雷米状态在线**：奥林匹亚科斯 15 场 10 球，第三次出战世界杯，伊朗进攻仍有牙齿（Flashscore，2026-06-01；SI 前瞻）。
5. **伊朗球迷无票务配额**：美方撤销伊朗球迷票务配额（Al Jazeera，2026-06-09），洛杉矶现场氛围对伊朗无加成。
6. **第二轮小组赛**：G 组 6 月 15 日开打，本场为两队第二战，首战结果将影响战意（Wikipedia Group G；ESPN 赛程）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主办国加成）：
  比利时 50.3% / 平 24.8% / 伊朗 24.9%
- **调整 delta（上限 ±8pp，实际净 ±1.5pp）**：
  - 伊朗 -1.0pp：阿兹蒙除名是最实质的单点损失；
  - 比利时 +1.5pp、平局 -0.5pp：KDB/卢卡库虽带伤但均入选且有一个月恢复期，预选赛状态（KDB 6 球）支持纸面优势兑现；塔雷米的状态部分对冲伊朗损失，故净调整很小。
- **p_final**：比利时 51.8% / 平 24.3% / 伊朗 23.9%。
- 本预测为**市场盲测**，全程未读取、未参考任何博彩或预测市场价格，数字仅来自 Elo 统计模型 + 有据可查的有限调整。

## ⑥ 方法与来源

方法：以 eloratings.net 当日 Elo 为输入，Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 `eloToOneXTwo` 一致）输出统计基线；再依据带日期来源的球队新闻做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 的参数敏感性与证据稀薄度。

来源清单：
1. eloratings.net World.tsv（抓取 2026-06-11，本地 `elo-table.json`）
2. beIN Sports，比利时 26 人名单与 KDB/卢卡库伤情，2026-05-15 — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/de-bruyne-and-lukaku-named-in-belgium-world-cup-squad-despite-injuries-2026-05-15
3. Flashscore，伊朗名单：塔雷米领衔、阿兹蒙落选，2026-06-01 — https://www.flashscore.com/news/soccer-world-championship-taremi-and-jahanbakhsh-lead-iran-s-world-cup-squad-with-azmoun-overlooked/pGYQ1OUq/
4. Sports Illustrated，伊朗 2026 世界杯前瞻 — https://www.si.com/soccer/iran-2026-world-cup-preview
5. Al Jazeera，美方撤销伊朗球迷票务配额，2026-06-09 — https://www.aljazeera.com/sports/2026/6/9/iran-says-us-have-revoked-world-cup-ticket-allocation-for-their-supporters
6. ESPN，赛程页（2026-06-21，比利时 vs 伊朗） — https://www.espn.com/soccer/match/_/gameId/760451/iran-belgium

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
