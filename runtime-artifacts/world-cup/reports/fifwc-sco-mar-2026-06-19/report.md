# 苏格兰 vs 摩洛哥 — 2026 世界杯小组赛 C 组（市场盲测预测）

- **比赛**：苏格兰 vs 摩洛哥，C 组第 2 轮
- **开球**：2026-06-19 22:00 UTC（Foxborough，吉列体育场，美国波士顿地区）
- **事件标识**（仅作结算元数据）：`fifwc-sco-mar-2026-06-19`
- **生成时间**：2026-06-11T13:15:00Z

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 苏格兰胜 | **31%** | 26% – 36% | 中 |
| 平局 | **26%** | 21% – 31% | 中 |
| 摩洛哥胜 | **43%** | 37% – 49% | 中 |

**一句话观点**：摩洛哥凭更高 Elo、大赛经验与核心状态略占上风（约 43%），但苏格兰阵容齐整、并非陪跑（约 31%），平局概率可观（26%）——这是一场关系小组第二名归属的均势关键战。

## ② 定义

90 分钟三路赛果（含伤停补时）；小组赛无加时、无点球大战，常规时间战平即判定为"平局"。

## ③ 实力画像

| 队伍 | Elo（eloratings.net，2026-06-11 抓取） | Elo 排名 | 近期状态 |
| --- | --- | --- | --- |
| 苏格兰 | 1782 | 26 | 时隔 28 年重返世界杯决赛圈（UEFA.com）；5 月 30 日热身 4-1 胜库拉索（Sky Sports） |
| 摩洛哥 | 1827 | 24 | 2025 年 12 月非洲杯（本土）打入决赛（Olympics.com）；Hakimi 为非洲足球先生、2025 欧冠冠军成员 |

## ④ 关键因素

1. **Elo 差距 45 分、中立场地**：摩洛哥 1827 vs 苏格兰 1782，统计模型在中立场下给摩洛哥明显但不压倒的优势。（来源：eloratings.net，2026-06-11）
2. **苏格兰中场核心 Gilmour 受伤**：Billy Gilmour 在 5 月 30 日对库拉索热身赛中伤退，球衣号显示 Tyler Fletcher 顶替 8 号位，中场控制力受损。（来源：Sky Sports，2026-06）
3. **苏格兰主力框架齐整**：McTominay、Robertson、McGinn 均入选并可出战；Hanley 带轻伤入队。（来源：ESPN，2026-06）
4. **摩洛哥主力锋霸缺席 + 新帅风险**：En-Nesyri 落选 26 人名单；主帅由 Mohamed Ouahbi 接任，首次执教成年队世界杯，存在不确定性。（来源：ESPN / FourFourTwo，2026-06）
5. **赛程与利害关系**：摩洛哥 6 月 13 日首战巴西、苏格兰 6 月 14 日首战海地，本场（6 月 19 日 Foxborough）大概率直接影响小组第二归属。（来源：MLSSoccer.com / Wikipedia，2026-06）
6. **Hakimi 体能存疑但可出战**：队长 Hakimi 带轻伤入队，俱乐部赛季（含欧冠决赛）刚结束，休整时间偏短。（来源：Olympics.com，2026-06）

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无东道主加成）：
  苏格兰 32.3% / 平局 25.8% / 摩洛哥 41.9%
- **证据调整 delta**（上限 ±8pp，实际使用约 ±1.3pp）：
  - 苏格兰 −1.3pp：Gilmour 伤缺削弱中场（因素 2）；
  - 摩洛哥 +1.1pp：核心 Hakimi/Diaz 状态与大赛履历更硬（因素 1、6）；但 En-Nesyri 缺席与新帅风险（因素 4）抵消了更大上调；
  - 平局 +0.2pp：双方利害一致、均势对抗。
- **p_final**：苏格兰 31% / 平局 26% / 摩洛哥 43%。
- 80% 区间反映参数敏感性（drawNu 0.6–0.8 使平局基线在 22.9%–28.4% 间波动）+ 首发未公布、新帅打法未知的证据稀薄度。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，概率仅来自 Elo/Davidson 统计模型与有界证据调整。

## ⑥ 方法与来源

**方法**：以 eloratings.net 世界 Elo 为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 `eloToOneXTwo` 一致，scale=400，drawNu=0.7）得到统计基线；再以公开新闻中可引用的伤停/状态/赛程事实做不超过 ±8pp 的有界调整并归一化；80% 区间综合参数敏感性与证据稀薄度。

**来源清单**（均检索于 2026-06-11）：
1. eloratings.net — World Elo 表（2026-06-11 抓取，https://www.eloratings.net/World.tsv）
2. ESPN — Scotland World Cup squad announced：https://www.espn.com/soccer/story/_/id/48814281/scotland-world-cup-squad-announced-scott-mctominay-ross-stewart
3. Sky Sports — Scotland squad numbers revealed（含 Gilmour 伤情）：https://www.skysports.com/football/news/12017/13550179/world-cup-2026-scotland-squad-numbers-revealed-with-angus-gunn-handed-no-1-jersey-ahead-of-craig-gordon
4. ESPN — Morocco squad: Hakimi, Brahim Diaz headline; En-Nesyri out：https://www.espn.com/espn/story/_/id/48883710/achraf-hakimi-brahim-diaz-headline-morocco-squad-fifa-world-cup-youssef-en-nesyri-out
5. Olympics.com — Morocco WC 2026 preview：https://www.olympics.com/en/news/fifa-world-cup-2026-morocco-all-players-full-squad-list-key-stats-schedule
6. FourFourTwo — Morocco squad: Ouahbi's 26-man roster：https://www.fourfourtwo.com/team/morocco-world-cup-2026-squad
7. MLSSoccer.com — Group C preview：https://www.mlssoccer.com/competitions/fifa-world-cup/news/2026-fifa-world-cup-group-c-preview-brazil-haiti-morocco-scotland ；UEFA.com — Scotland at the World Cup 2026：https://www.uefa.com/european-qualifiers/news/02a6-20d159741fe9-a2a8fac9839d-1000--scotland-at-the-world-cup-2026-squad-fixtures-group-and-hi/

**免责声明**：本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
