# 加纳 vs 巴拿马 —— 2026 世界杯 L 组小组赛（市场盲测预测）

- **赛事**：FIFA 2026 世界杯小组赛 L 组（同组：英格兰、克罗地亚）
- **开球**：2026-06-17T23:00:00Z（多伦多 BMO Field，当地 6 月 17 日 19:00）
- **生成时间**：2026-06-11 ｜ **resolution 元数据**：`fifwc-gha-pan-2026-06-17`

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 加纳胜 | **15.5%** | 11% – 21% | 中 |
| 平局 | **23.0%** | 18% – 28% | 中 |
| 巴拿马胜 | **61.5%** | 54% – 69% | 中 |

**一句话观点**：Elo 差距（巴拿马 1730 vs 加纳 1510）与阵容信息同向——加纳缺 Kudus/Salisu、Partey 状态存疑且临阵换帅，巴拿马约六成胜率，平局是主要对冲赛果。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负）；小组赛无加时、无点球大战，补时计入 90 分钟赛果。

## ③ 实力画像

| 队伍 | Elo（2026-06-11 快照） | Elo 排名 | 近况摘要 |
| --- | --- | --- | --- |
| 加纳 | 1510 | 81 | 2026 年 3 月 1-5 负奥地利、1-2 负德国；2022-11 以来未胜过欧洲/南美球队（SI, 2026-05-14） |
| 巴拿马 | 1730 | 38 | Christiansen 体系稳定，5 月 26 日公布 26 人名单，老将 Godoy（157 次出场）领衔（FIFA/Newsroom Panama, 2026-05-26） |

Elo 来源：eloratings.net World.tsv 快照（本仓库 `elo-table.json`，抓取于 2026-06-11）。

## ④ 关键因素

1. **加纳双核报销**：Kudus（股四头肌伤复发）与 Salisu（1 月 ACL 断裂）均无缘世界杯（ESPN，2026-06 大名单公布）。
2. **Partey 出战存疑**：腹股沟问题严重限制训练强度与比赛准备（ESPN/加纳媒体，2026-06）。
3. **加纳临阵换帅**：Otto Addo 在开赛前约 72 天被解职，Queiroz 于 2026 年 4 月接手，备战混乱（SI，2026-05-14）。
4. **加纳并非无牌可打**：Semenyo（曼城，2 月英超月最佳）与 Iñaki Williams 仍在阵中，下限不至于崩盘（ESPN，2026-06）。
5. **巴拿马的隐忧**：核心中场 Carrasquilla 在墨联决赛前后有腹股沟伤情（Yahoo Sports，2026-05/06）。
6. **场地中立**：多伦多为中立场地，双方均无东道主加成；两队都视此役为争小组第二/最佳第三的关键战（FOX Sports 赛程，2026-06）。

## ⑤ 模型与调整

- **p_stat（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主场加成）**：
  加纳 17.1% / 平 22.5% / 巴拿马 60.5%。
- **证据调整（合计 ≤ ±8pp 约束内，实际约 ±1.5pp）**：
  - 加纳 −1.5pp、巴拿马 +1.0pp、平局 +0.5pp。
  - 理由：Kudus/Salisu 缺阵与 Partey 存疑属于阵容层面新增信息（Elo 只含赛果不含名单），叠加换帅动荡，小幅利空加纳；但加纳近期惨败已大部分计入 Elo（避免重复计算），且巴拿马自身有 Carrasquilla 伤情对冲，故调整幅度刻意保守。
- **p_final**：加纳 15.5% / 平 23.0% / 巴拿马 61.5%。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，未参考任何博彩/做市数据。

## ⑥ 方法说明

以 eloratings.net 的 Elo 分值为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 `eloToOneXTwo` 一致：scale=400，drawNu=0.7）得到统计基线；再以带来源、带日期的公开新闻做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 的参数敏感性（统计基线下加纳 16.5–17.6%、平 19.9–24.9%、巴拿马 58.6–62.5%）加上证据单薄度与名单不确定性的额外展宽。

### 来源清单

1. eloratings.net World.tsv 快照（elo-table.json，抓取 2026-06-11）：https://www.eloratings.net/World.tsv
2. ESPN：加纳大名单，Kudus/Salisu 伤缺、Partey 存疑（2026-06）：https://www.espn.com/espn/story/_/id/48878999/antoine-semenyo-thomas-partey-headline-ghana-provisional-fifa-world-cup-squad-injured-mohammed-kudus-out
3. Sports Illustrated：加纳备战混乱、3 月友谊赛战绩、换帅时间线（2026-05-14）：https://www.si.com/soccer/ghana-2026-world-cup-preview
4. FIFA.com：巴拿马公布大名单（2026-05-26）：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/panama-squad-announcement-thomas-christiansen
5. Newsroom Panama：巴拿马 26 人名单细节（2026-05-26）：https://newsroompanama.com/2026/05/26/the-26-players-called-up-for-the-2026-world-cup-the-panama-national-football-team/
6. Yahoo Sports：巴拿马阵容与 Carrasquilla 伤情（2026-05/06）：https://sports.yahoo.com/articles/panama-2026-world-cup-squad-064000504.html
7. FOX Sports：赛程与场地确认（2026-06）：https://www.foxsports.com/stories/soccer/ghana-world-cup-2026-schedule-locations-dates-times

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
