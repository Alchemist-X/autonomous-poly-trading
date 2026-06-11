# 阿尔及利亚 vs 奥地利 — 2026 世界杯 J 组（市场盲测预测）

- 比赛：2026-06-27（UTC 开球 2026-06-28T02:00:00Z），堪萨斯城 Arrowhead 球场（中立场地）
- 事件 slug（仅作结算元数据）：`fifwc-alg-aut-2026-06-27`
- 生成时间：2026-06-11 · 预测类型：**市场盲测**（完全独立于任何盘口/赔率数据）

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 阿尔及利亚胜 | **32.5%** | 26% – 39% | 中 |
| 平局 | **26.2%** | 22% – 30% | 中 |
| 奥地利胜 | **41.3%** | 34% – 48% | 中 |

**一句话观点：** 奥地利凭 Elo 优势小幅领跑，但 Baumgartner 伤退削弱其进攻端，而刚客场击败荷兰的阿尔及利亚状态正佳，三路结果均无明显把握。

## ② 定义

预测对象为 90 分钟（含补时）三路赛果：胜 / 平 / 负。小组赛无加时与点球。

## ③ 实力画像

| | 阿尔及利亚 | 奥地利 |
| --- | --- | --- |
| Elo（本地 elo-table.json，源自 eloratings.net，2026-06-11 快照） | 1772（第 29） | 1830（第 23） |
| 主帅 / 体系 | Petković，预计 4-3-3（Mahrez、Gouiri、Amoura 三叉戟） | Rangnick，Alaba 伤愈回归任队长 |
| 近期战绩 | 6/3 客场 1-0 胜荷兰（Hadj Moussa 进球） | 6/1 1-0 胜突尼斯；此前 1-0 胜韩国、3 月 5-1 胜加纳 |

来源：Olympics.com 阿尔及利亚前瞻（2026-06）、Squawka 奥地利分析（2026-06）、heavy.com（2026-06-11）、ESPN（2026-06-01）。

## ④ 关键因素

1. **奥地利核心攻击手 Baumgartner 因伤无缘世界杯**（赛季 13 个德甲进球、生涯最佳状态），Sabitzer 需顶替其职责 — ANI News，2026-06-02；roundtable.io，2026-06。
2. **阿尔及利亚 6 月 3 日客场 1-0 击败荷兰**，世界杯前热身状态出色 — heavy.com / africasoccer.com，2026-06-11。
3. **阿尔及利亚中场减员**：Boudaoui 因伤缺席，Bennacer 落选大名单；边后卫位置因伤病深度不足 — heavy.com（2026-06-11）、Dailysports（2026-05）、Olympics.com（2026-06）。
4. **奥地利热身赛三连胜且零封**（突尼斯 1-0、韩国 1-0、加纳 5-1），Alaba 伤愈回归 — ESPN（2026-06-01）、Squawka（2026-06）。
5. **第三轮小组赛、中立场地**：堪萨斯城当地 21:00 开球（晚场，高温影响有限）；J 组同组有阿根廷，末轮出线形势可能影响双方动机，但目前无法预判 — AXS / Wikipedia（访问于 2026-06-11）。
6. 历史交锋：两队世界杯仅 1982 年交手一次，奥地利 2-0 胜（参考性弱）— Wikipedia（访问于 2026-06-11）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场地无主办国加成）：
  阿尔及利亚 31.0% / 平 25.7% / 奥地利 43.3%（Elo 差 −58）。
- **调整 delta（合计 4pp，上限 ±8pp）**：阿尔及利亚 +1.5pp、平 +0.5pp、奥地利 −2.0pp。
  理由：Baumgartner 伤退是两队中分量最重的单点减员（因素 1），叠加阿尔及利亚击败荷兰的状态信号（因素 2）；但阿尔及利亚自身中场/边后卫减员（因素 3）与奥地利整体热身战绩（因素 4）部分对冲，故只做小幅调整。
- **p_final**：阿尔及利亚 32.5% / 平 26.2% / 奥地利 41.3%。
- 本预测为**市场盲测**：全程未读取、未参考任何博彩赔率或预测市场价格，概率仅来自 Elo 统计模型与上述有据可查的有限调整。

## ⑥ 方法、来源与免责声明

**方法：** 以 eloratings.net 风格 Elo（本地快照）输入 Davidson 三路模型得 p_stat；再依据带来源、带日期的球队新闻做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 的参数敏感度（平局 22.8%–28.3%）、约 ±40 Elo 的评分不确定性（两边胜率各约 ±4pp）及证据有限性。

**来源清单：**
1. 本地 `runtime-artifacts/world-cup/elo-table.json`（eloratings.net 快照，2026-06-11）
2. https://www.aninews.in/news/sports/football/austrias-christoph-baumgartner-ruled-of-fifa-world-cup-due-to-injury20260602165204/ （2026-06-02）
3. https://www.espn.com/soccer/match/_/gameId/401856597/tunisia-austria （2026-06-01）
4. https://www.squawka.com/en/news/world-cup/austria-world-cup-2026-fixtures-squad-analysis/ （2026-06 访问）
5. https://www.olympics.com/en/news/fifa-world-cup-2026-algeria-preview-full-squad-list-key-stats-schedule （2026-06 访问）
6. https://dailysports.net/news/algeria-announce-2026-world-cup-squad-as-riyad-mahrez-returns-and-ismael-bennacer-misses-out/ （2026-05）
7. https://heavy.com/sports/soccer/how-to-watch-algeria-vs-bolivia-live-today-world-cup-warm-up-preview-stats-team-news/ （2026-06-11）
8. https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_J （2026-06-11 访问）

**免责声明：** 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
