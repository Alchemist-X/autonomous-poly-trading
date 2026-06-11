# 奥地利 vs 约旦 — 2026 世界杯小组赛 J 组（市场盲测预测）

- 比赛时间：2026-06-17 04:00 UTC（美国加州圣克拉拉 Levi's Stadium，当地 6 月 16 日晚）
- 事件标识（仅结算元数据）：`fifwc-aut-jor-2026-06-17`
- 生成时间：2026-06-11T13:15:00Z ｜ 预测类型：**市场盲测**（完全独立于任何盘口/赔率）

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 奥地利胜 | **0.55** | 0.48 – 0.62 | 中 |
| 平局 | **0.24** | 0.19 – 0.29 | 中 |
| 约旦胜 | **0.21** | 0.15 – 0.27 | 中 |

**一句话观点**：Elo 差 150 分加上约旦近 5 场不胜、丢 11 球的防守状态，奥地利约 55% 优势明显，但 Baumgartner 伤退令奥地利创造力打折，约旦爆冷窗口并未关死。

## ② 定义

预测对象为 90 分钟（含补时）三路赛果：胜 / 平 / 负。小组赛无加时、无点球大战，平局即为最终赛果。

## ③ 实力画像

| | 奥地利 | 约旦 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1830（第 23） | 1680（第 52） |
| 主帅 | Ralf Rangnick | Jamal Sellami（摩洛哥籍） |
| 世界杯履历 | 1998 年后首次重返决赛圈 | 历史首次参赛 |
| 近况 | 5 月 18 日公布 26 人名单，队长 Alaba 伤愈回归（UEFA.com） | 近 5 场 0 胜（2 平 3 负），失 11 球（Goal.com 赛前瞻） |

## ④ 关键因素

1. **奥地利核心中场 Baumgartner 因髋部股直肌腱伤势缺席整届世界杯**，Rangnick 暂未递补，进攻组织受损（roundtable.io，2026 年 6 月）。
2. **约旦近 5 场不胜**：6 月 7 日 0-2 负哥伦比亚、5 月底 1-4 负瑞士，近 5 场共丢 11 球，热身赛防守暴露明显（Goal.com 赛前瞻，2026-06）。注：这些结果已部分计入最新 Elo。
3. **约旦主力前锋 Al-Naimat 因 ACL 重伤缺席**（2025 年 12 月阿拉伯杯受伤）；亚洲区预选赛 9 球的 Ali Olwan 伤愈回归（Al Jazeera，2026-06-06）。
4. **约旦头牌 Al-Taamari（雷恩）状态出色**：法甲赛季 7 球 11 助攻，是约旦反击转换的主要威胁（Al Jazeera，2026-06-06）。
5. **中立场地**：Levi's Stadium（圣克拉拉），双方均无主场加成；奥地利 Wöber、Lawal 因伤未入选（UEFA.com，2026-05）。
6. **出线压力**：同组有阿根廷、阿尔及利亚，48 队赛制下首战拿分对双方出线路径都关键（MLSSoccer.com J 组前瞻）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无东道主加成）：
  奥地利 0.533 / 平 0.242 / 约旦 0.225（Elo 1830 vs 1680）。
- **证据调整（上限 ±8pp，实际净移动约 ±2pp）**：
  - 约旦防守端证据偏负（近 5 场丢 11 球 + 主力前锋缺席）→ 约旦 −1.5pp；
  - 奥地利 Baumgartner 整届缺席部分抵消其优势 → 奥地利仅 +2pp（而非更大上调）；
  - 平局 −0.5pp。证据互有抵消，故调整幅度保持克制。
- **p_final（归一化后）**：奥地利 0.553 / 平 0.237 / 约旦 0.210 → 发布值 0.55 / 0.24 / 0.21。
- **本预测为市场盲测**：全程未读取、未引用任何博彩或预测市场价格/赔率，概率仅来自 Elo 统计模型与上述有据可查的有限调整。

## ⑥ 方法说明

以 eloratings.net 2026-06-11 快照为基础，用 Davidson 三路模型（drawNu=0.7）把 Elo 分差映射为胜/平/负概率；再依据带来源、带日期的球队新闻做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 在 0.6–0.8 间的参数敏感性、阵容未最终确认及约旦首次参赛带来的样本不确定性。

### 来源清单

1. eloratings.net World.tsv（2026-06-11 抓取，elo-table.json）
2. Goal.com — Austria vs Jordan World Cup Preview（2026-06）：https://www.goal.com/en/news/austria-jordan-world-cup-preview/blt7c1bb3d0f0243ac5
3. UEFA.com — Austria at the World Cup 2026（2026-05/06）：https://www.uefa.com/european-qualifiers/news/02a6-20d159406296-f54718194327-1000--austria-at-the-world-cup-2026-squad-fixtures-group-and-hi/
4. roundtable.io — Austria Faces World Cup Realigned by Baumgartner Injury（2026-06）：https://roundtable.io/sports/soccer/bundesliga/rb-leipzig/austria-faces-world-cup-realigned-by-baumgartner-injury
5. Al Jazeera — Jordan World Cup 2026 preview（2026-06-06）：https://www.aljazeera.com/sports/2026/6/6/jordan-world-cup-2026-preview-players-to-watch-group-matches-and-squad
6. Elbotola — Sellami names Jordan final squad（2026-06-02）：https://m.elbotola.com/en/article/2026-06-02-09-43-150.html
7. FIFA Match Centre — Austria vs Jordan（场地/开球时间）：https://www.fifa.com/en/match-centre/match/17/285023/289273/400021498

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
