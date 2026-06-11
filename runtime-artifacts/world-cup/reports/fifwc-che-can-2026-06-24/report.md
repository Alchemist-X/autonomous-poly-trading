# 瑞士 vs 加拿大 — 2026 世界杯 B 组（市场盲测预测）

- 比赛：2026-06-24 19:00 UTC，BC Place，温哥华（加拿大主场）
- 事件 slug（仅作结算元数据）：`fifwc-che-can-2026-06-24`
- 生成时间：2026-06-11 · 预测口径：90 分钟三路赛果（小组赛无加时/点球）

## ① 预测结论

| 结果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 瑞士胜 | **40.4%** | 34% – 47% | 中 |
| 平局 | **26.4%** | 21% – 31% | 中 |
| 加拿大胜 | **33.2%** | 26% – 40% | 中 |

**一句话观点：** 瑞士阵容齐整、状态稳定而小幅占优，但加拿大坐拥温哥华主场，三路概率非常接近，属于势均力敌的小组头名之争。

## ② 定义

预测对象为 90 分钟法定时间三路赛果（含伤停补时）；小组赛不设加时与点球。

## ③ 实力画像

| 项目 | 瑞士 | 加拿大 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1891（第 17） | 1788（第 25），主办国小组赛 +100 → 有效 1888 |
| 核心 | Xhaka（145 次出场，第 4 次世界杯）、Embolo（预选赛队内最佳射手 4 球） | Jonathan David（尤文图斯赛季 8 球 5 助攻）、Davies（伤情存疑） |
| 近期 | 5/31 友谊赛 4-1 胜约旦（圣加仑） | 开赛前伤病潮（详见下） |

来源：eloratings.net（2026-06-11）；FIFA 官网瑞士名单公告（2026-05-20）；olympics.com 瑞士名单与关键数据（2026-05/06）；FOX Sports 加拿大名单分析（2026-06）。

## ④ 关键因素

1. **加拿大伤病潮（利瑞士）**：主力中卫 Bombito（2025-10 腿部骨折）据报被移出名单；Flores 5/31 伤退、6/9 由 Nelson 替补入队；中场 Koné 训练中发烧离场。来源：SI（2026-06）、Daily Hive（2026-06-10）。
2. **Davies 出场成疑但有转机（中性偏利瑞士）**：2025-03 ACL 撕裂后又两度腿筋拉伤，首战出场可能性低；但 6/10 已重返合练，至 6/24（小组第三轮）有约两周恢复窗口。来源：ESPN、Daily Hive（2026-06）。
3. **瑞士阵容齐整、状态平稳（利瑞士）**：5/20 公布 26 人名单无重大伤病争议，Yakin 信任 Xhaka/Akanji/Embolo 老将轴心；5/31 友谊赛 4-1 胜约旦。来源：FIFA 官网（2026-05-20）、UEFA.com。
4. **加拿大主场 + 历史性出线动力（利加拿大）**：比赛在温哥华 BC Place 进行，为 B 组末轮，很可能直接决定小组头名；加拿大力争队史首次世界杯淘汰赛。来源：Wikipedia 2026 World Cup Group B、FIFA Match Centre、Destination Vancouver。
5. **Jonathan David 状态健康（利加拿大）**：髋部伤势康复后完成尤文首季（8 球 5 助攻），无新伤报告。来源：FOX Sports（2026-06）。

## ⑤ 模型与调整

- **p_stat（Davidson 三路模型，scale=400，drawNu=0.7，加拿大主办国小组赛 +100）**：瑞士 37.4% / 平 25.9% / 加拿大 36.7%。
- **证据调整（合计 7pp，上限 ±8pp）**：瑞士 +3.0pp、平 +0.5pp、加拿大 −3.5pp。理由：加拿大多名主力伤缺/存疑（因素 1、2）而瑞士齐整（因素 3）；但 Davies 有两周恢复窗口、David 健康、主场优势已计入模型，故不打满上限。
- **p_final（归一化后）**：瑞士 40.4% / 平 26.4% / 加拿大 33.2%。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，仅基于 Elo 统计模型与公开新闻证据。

## ⑥ 方法说明

Elo 取自 eloratings.net（2026-06-11 抓取存档 `elo-table.json`）；三路概率用 Davidson 模型（piA=10^(R/400)，平局参数 ν=0.7）；主办国（墨/美/加）小组赛主场 +100 Elo。80% 区间反映参数敏感性（ν 在 0.6–0.8 之间瑞士胜率波动 36.0%–38.8%；主场加成 ±35 时波动 33.7%–41.1%）加上 13 天后的阵容不确定性。证据调整上限 ±8pp，证据薄弱处不调整。

### 来源清单

1. eloratings.net World.tsv（抓取 2026-06-11）
2. ESPN — Davies 入选名单与伤情担忧（2026-06）：espn.com/soccer/story/_/id/48914937
3. SI — Bombito 赛前因伤离队（2026-06）：si.com/soccer/canada-loses-star-player-injury-eve-2026-world-cup
4. SI — Flores 伤退、Nelson 替补入队（2026-06-09）：si.com/soccer/canada-names-injury-replacement-before-world-cup-opener
5. Daily Hive — 加拿大伤情汇总：Davies 重返合练、Koné 发烧（2026-06-10）：dailyhive.com/vancouver/canada-injury-updates-fifa-world-cup-opener
6. FOX Sports — 加拿大名单赢家输家分析、David 状态（2026-06）：foxsports.com/stories/soccer/winners-and-losers-from-canadas-world-cup-squad
7. FIFA — 瑞士名单公告（2026-05-20）：fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/switzerland-squad-announcement-murat-yakin
8. olympics.com — 瑞士全名单与关键数据（2026-05/06）：olympics.com/en/news/fifa-world-cup-2026-switzerland-players-squad-list-key-stats-schedule
9. Wikipedia — 2026 FIFA World Cup Group B（赛程/场馆）：en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_B

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
