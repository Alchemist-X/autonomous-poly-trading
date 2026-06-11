# 2026 世界杯小组赛 G 组：新西兰 vs 比利时（市场盲测预测）

- 生成时间：2026-06-11T13:15:00Z
- 比赛时间：2026-06-26（温哥华当地 20:00 PT，UTC 2026-06-27T03:00:00Z）
- 地点：加拿大温哥华 BC Place（中立场地，无东道主加成）
- 事件标识（仅结算元数据）：`fifwc-nzl-bel-2026-06-26`

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 新西兰胜 | **11.5%** | 8% – 16% | 中 |
| 平局 | **20.5%** | 15% – 26% | 中 |
| 比利时胜 | **68.0%** | 61% – 75% | 中 |

**一句话观点：** 比利时实力占优、约 68% 概率取胜，但小组末轮存在已出线轮换的可能，加上卢卡库等核心带伤，新西兰拿分概率并非可以忽略。

## ② 赛果定义

90 分钟三路赛果（含伤停补时）：A=新西兰胜 / 平局 / B=比利时胜。小组赛无加时、无点球大战。

## ③ 实力画像

| 队伍 | Elo（eloratings.net，2026-06-11 快照） | Elo 排名 | FIFA 排名 |
| --- | --- | --- | --- |
| 新西兰 | 1562 | 72 | 85（ESPN，2026-06 报道） |
| 比利时 | 1894 | 15 | 9（ESPN，2026-06 报道） |

- 比利时核心：德布劳内（34 岁，去年 10 月手术、今年 3 月复出）、多库（本季 50 场 21 次进球参与）、卢卡库（带伤入选）。（FourFourTwo / beIN，2026-05-15）
- 新西兰核心：队长伍德（诺丁汉森林前锋），去年 12 月膝伤手术后已复出并自述完全恢复。（Flashscore，2026-06）

## ④ 关键因素

1. **Elo 差距 332 分**：1894 vs 1562，是小组赛中最悬殊的对位之一。来源：eloratings.net 快照，2026-06-11。
2. **比利时锋线带伤**：5 月 15 日公布名单时德布劳内（眼伤）与卢卡库（髋伤）均在伤停中仍被征召；卢卡库本季因肌肉伤病只踢了约 1 小时正式比赛。来源：beIN Sports，2026-05-15；FourFourTwo。
3. **末轮轮换风险**：本场为 G 组第三轮收官战，比利时此前先后对阵埃及（6-15）与伊朗，若提前出线存在轮换主力的可能。来源：Wikipedia「2026 FIFA World Cup Group G」赛程；FOX Sports 赛程页。
4. **伍德伤愈**：新西兰唯一英超级别射手伍德确认完全康复并已连续比赛一个半月以上。来源：Flashscore，2026-06。
5. **场地中立**：BC Place（温哥华，带顶棚）对双方均为中立场，无东道主 Elo 加成。来源：Destination Vancouver 赛事页。

## ⑤ 模型与调整

- **统计基线 p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，双方无东道主加成）：
  - 新西兰 10.4% / 平局 19.0% / 比利时 70.6%
- **证据调整 delta**（合计约 ±2.6pp，上限 ±8pp）：
  - 比利时 −2.6pp：卢卡库整季近乎未踢、德布劳内复出时间短（因素②）；末轮可能轮换（因素③）。
  - 平局 +1.5pp、新西兰 +1.1pp：上述因素的对应再分配；伍德伤愈维持新西兰反击上限（因素④）。
- **p_final**：新西兰 11.5% / 平局 20.5% / 比利时 68.0%。
- 80% 区间反映参数敏感性（drawNu 0.6–0.8 时平局 16.7%–21.1%、比利时 68.7%–72.5%）+ 末轮动机不确定性 + 证据偏薄。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，概率仅来自 Elo 统计模型与上述有来源的有限调整。

## ⑥ 方法与来源

方法：以 eloratings.net 2026-06-11 Elo 快照为输入，用 Davidson 三路模型（scale=400，drawNu=0.7）得到统计基线；再依据有日期、有来源的球队新闻做不超过 ±8pp 的有界调整并归一化。不使用任何博彩/预测市场数据。

来源清单：
1. eloratings.net World.tsv 快照（2026-06-11），本仓库 `runtime-artifacts/world-cup/elo-table.json`
2. beIN Sports（2026-05-15）：https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/de-bruyne-and-lukaku-named-in-belgium-world-cup-squad-despite-injuries-2026-05-15
3. FourFourTwo 比利时名单页：https://www.fourfourtwo.com/team/belgium-world-cup-2026-squad
4. Flashscore（2026-06）伍德伤愈：https://www.flashscore.com/news/soccer-world-cup-new-zealand-captain-chris-wood-fully-fit-for-2026-world-cup-after-injury-battles/xj5tDLMN/
5. ESPN（2026-06）新西兰名单与排名：https://www.espn.com/soccer/story/_/id/48764554/chris-wood-headlines-new-zealand-2026-world-cup-squad
6. FIFA.com 新西兰名单：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/new-zealand-squad-named
7. Wikipedia「2026 FIFA World Cup Group G」：https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_G

免责声明：本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
