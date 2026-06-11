# 荷兰 vs 日本 — 2026 世界杯小组赛 F 组（市场盲测预测）

- 比赛：2026-06-14 20:00 UTC（当地 15:00），AT&T 体育场，美国得克萨斯州阿灵顿（中立场地，闭顶空调）
- 事件标识（仅结算元数据）：`fifwc-nld-jpn-2026-06-14`
- 生成时间：2026-06-11T13:15:00Z　·　预测类型：90 分钟三路赛果（小组赛无加时）

## ① 预测结论

| 结果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 荷兰胜 | **38.6%** | 32% – 45% | 中 |
| 平局 | **26.8%** | 22% – 31% | 中 |
| 日本胜 | **34.6%** | 29% – 41% | 中 |

**一句话观点：** 荷兰纸面实力略占优，但后防与门将伤情叠加，状态火热、中场骨架完整的日本足以把这场揭幕战拖入接近五五开的胶着局面。

## ② 定义

预测 90 分钟法定时间三路赛果（胜/平/负）；小组赛无加时、无点球大战。本预测为**市场盲测**：完全独立于任何盘口、赔率或预测市场价格，仅基于统计模型与公开新闻证据。

## ③ 实力画像

| 队伍 | Elo（2026-06-11） | Elo 排名 | 概况 |
| --- | --- | --- | --- |
| 荷兰 | 1948 | 8 | 欧洲一线强队，但近期伤病集中在后防线与门将位置 |
| 日本 | 1906 | 14 | 亚洲头名梯队，近期状态出色（2026 年 3 月温布利 1-0 客胜英格兰），Elo 已计入近期战绩 |

来源：eloratings.net（仓库快照 `elo-table.json`，抓取于 2026-06-11）；英格兰之战见 Al Jazeera 2026-05-15 报道。

## ④ 关键因素

1. **荷兰后卫 Jurriën Timber 因腹股沟伤势退出世界杯**，由 Geertruida 替补入队 — FIFA 官网 / ESPN，2026-06（赛前一周）。<https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/netherlands-call-up-geertruida-jurrien-timber>
2. **荷兰主力门将 Bart Verbruggen 出战成疑**：周三（6 月 10 日）缺席训练，Koeman 称按天评估、有望赶上 14 日揭幕战 — ESPN，2026-06-10。<https://www.espn.com/soccer/story/_/id/49022242/netherlands-bart-verbruggen-injury-2026-world-cup-japan>
3. **日本核心边锋三笘薰因腿筋伤势落选最终 26 人名单**，主帅森保一确认其难以在赛会期间恢复 — Al Jazeera，2026-05-15。<https://www.aljazeera.com/sports/2026/5/15/mitoma-fails-to-make-japans-2026-world-cup-squad-due-to-hamstring-injury>
4. **日本队长远藤航伤愈复出**，入选最终名单并出任队长，中场骨架完整 — Nippon.com（2026 年 6 月名单数据页）。<https://www.nippon.com/en/japan-data/h02782/>
5. **场地因素中性化**：AT&T 体育场为可闭合屋顶 + 空调场馆，世界杯期间预计闭顶控温，得州 6 月高温（均值约 33°C）对两队影响均被大幅削弱 — AT&T Stadium 官网 / Wikipedia。<https://attstadium.com/events/fifa-world-cup-group-1/>　<https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_F>
6. ESPN 世界杯伤情追踪页另列出荷兰多名球员带伤备战（如 Depay 腿筋问题），整体可用度低于纸面 — ESPN injuries tracker，2026-06。<https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info>

## ⑤ 模型与调整

**统计基线 p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场地、双方均无东道主加成）：

- piA=10^(1948/400)，piB=10^(1906/400)，sq=√(piA·piB)，denom=piA+piB+0.7·sq
- p_stat = 荷兰 41.6% / 平局 25.8% / 日本 32.6%

**有界调整（上限 ±8pp，实际使用 3pp）：**

| 方向 | 幅度 | 理由 |
| --- | --- | --- |
| 荷兰 | −3.0pp | Timber 退赛 + 主力门将 Verbruggen 出战成疑 + 多人带伤（因素 1/2/6），后防完整度受损明确 |
| 平局 | +1.0pp | 双方均有核心减员、强强相遇首战求稳倾向 |
| 日本 | +2.0pp | 阵容齐整度相对更好（远藤复出，因素 4）；三笘缺阵（因素 3）部分抵消利好，故只给小幅上调 |

注：日本近期高光战绩（含 3 月胜英格兰）已反映在 6 月 11 日 Elo 快照中，不重复计入调整，避免双重计数。

**p_final = 荷兰 38.6% / 平局 26.8% / 日本 34.6%**

本预测为**市场盲测**，全程未获取、未参考任何博彩赔率或预测市场价格；p_final 即为发布数字，无市场合成腿。

## ⑥ 方法、来源与免责声明

**方法：** 以 eloratings.net 的 Elo 评分为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致，scale=400，drawNu=0.7）得出统计基线；再依据带来源、带日期的公开新闻事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 在 0.6–0.8 间的参数敏感度（基线荷兰胜 40.1%–43.2%、平 23.0%–28.4%、日本胜 31.5%–33.9%）加上证据厚度（门将伤情未定）带来的额外不确定性。

**来源清单：**

1. eloratings.net World.tsv（快照 2026-06-11）
2. FIFA.com — Geertruida 替补入队 / Timber 退赛（2026-06）
3. ESPN — Verbruggen 伤情（2026-06-10）
4. ESPN — 世界杯伤情追踪（2026-06，持续更新）
5. Al Jazeera — 三笘薰落选（2026-05-15）
6. Nippon.com — 日本最终名单与队长（2026-06）
7. Wikipedia / AT&T Stadium 官网 — 赛程与场馆信息（2026-06）

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
