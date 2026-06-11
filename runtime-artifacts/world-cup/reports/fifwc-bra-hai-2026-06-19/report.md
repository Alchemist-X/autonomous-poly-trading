# 巴西 vs 海地（2026 世界杯 C 组，2026-06-19）市场盲测预测

> 生成时间：2026-06-11 ｜ 开球：2026-06-20T00:30:00Z（费城林肯金融球场，当地 6 月 19 日晚）
> 本预测为**市场盲测**：完全独立于任何盘口、赔率或预测市场价格。

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 巴西胜 | **76.5%** | 70% – 83% | 中 |
| 平局 | **16.9%** | 12% – 21% | 中 |
| 海地胜 | **6.6%** | 4% – 10% | 中 |

**一句话观点：** 巴西与海地 Elo 差距高达 443 分，即便内马尔伤情存疑，巴西仍以约 76% 概率强势领跑，海地爆冷空间很小。

## ② 定义

- 标的：小组赛 90 分钟（含补时）三路赛果，小组赛无加时、无点球大战。
- 解析元数据：事件 slug `fifwc-bra-hai-2026-06-19`（仅作结算标识，与价格无关）。

## ③ 实力画像

| 队伍 | Elo（2026-06-11） | Elo 排名 | 备注 |
| --- | --- | --- | --- |
| 巴西 | 1991 | 5 | 安切洛蒂执教，主力含维尼修斯、拉菲尼亚、库尼亚等（来源：FIFA 官方名单，2026-06-02） |
| 海地 | 1548 | 73 | 米涅执教，队长门将普拉西德；纳宗为队史射手王（来源：FIFA 官方名单，2026-06-02） |

Elo 来源：eloratings.net（抓取于 2026-06-11）。

## ④ 关键因素

1. **Elo 差距 443 分**，统计模型直接给出巴西约 78.5% 基础胜率（eloratings.net，2026-06-11）。
2. **内马尔二级小腿拉伤**，缺席赛前最后两场热身；若赶不上 6 月 13 日对摩洛哥的揭幕战，教练组目标是让他赶上本场对海地（FourFourTwo，2026-06；fourfourtwo.com/team/brazil-world-cup-2026-squad）。
3. **巴西后卫韦斯利 6 月 7 日因伤退出**，已补招替代者；整体阵容深度仍居世界前列（FourFourTwo，2026-06-07）。
4. **海地获英超级别补强**：桑德兰前锋伊西多尔 2026 年 3 月改披海地战袍，狼队中场贝勒加德入选；这部分提升可能尚未完全反映进 Elo（FourFourTwo，2026-06；fourfourtwo.com/team/haiti-world-cup-2026-squad）。
5. **海地的小组出线策略**普遍预期押在苏格兰与摩洛哥两战，对巴西预计采取低位防守、控制净胜球（FourFourTwo，2026-06）。
6. **场地为中立场**：费城林肯金融球场，当地 6 月 19 日晚间开球，夜场气温影响有限；巴西无东道主加成（FIFA 赛程页 / Ticketmaster，2026-06）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主场加成）：
  巴西 78.5% / 平局 15.4% / 海地 6.1%。
- **证据化调整（合计 2pp，上限 ±8pp）：**
  - 巴西 −2.0pp：内马尔出战成疑、韦斯利退队，主力磨合存在小幅不确定性；
  - 平局 +1.5pp、海地 +0.5pp：海地新增英超即战力（伊西多尔 3 月才完成会籍切换，Elo 可能滞后），且预期摆出低位防守。
- **p_final：巴西 76.5% / 平局 16.9% / 海地 6.6%。**
- 80% 区间反映：drawNu 在 0.6–0.8 间的敏感性（巴西胜率 76.8%–80.3%）、证据偏薄与调整本身的不确定性。
- 本预测为**市场盲测**，全程未参考任何盘口、赔率或预测市场定价。

## ⑥ 方法与来源

**方法：** 以 eloratings.net 世界 Elo 为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致，scale=400，drawNu=0.7）计算基础概率；再以公开报道的伤停、阵容与动机证据做不超过 ±8pp 的有界调整并归一化。无任何市场数据参与。

**来源清单：**
1. eloratings.net 世界 Elo（抓取 2026-06-11）— https://www.eloratings.net/
2. FourFourTwo 巴西世界杯名单与伤情 — https://www.fourfourtwo.com/team/brazil-world-cup-2026-squad （2026-06）
3. FIFA 官方：巴西名单公告 — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/brazil-squad-announcement-carlo-ancelotti （2026-06-02）
4. FourFourTwo 海地世界杯名单 — https://www.fourfourtwo.com/team/haiti-world-cup-2026-squad （2026-06）
5. FIFA 官方：海地名单公告 — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/haiti-squad-announcement-sebastien-migne （2026-06-02）
6. FIFA 赛程页（场地与开球时间） — https://www.fifa.com/en/match-centre/match/17/285023/289273/400021457 （2026-06）
7. Wikipedia：2026 世界杯 C 组 — https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_C （2026-06）

**免责声明：** 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
