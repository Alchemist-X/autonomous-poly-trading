# 新西兰 vs 埃及 — 2026 世界杯小组赛 G 组（市场盲测预测）

- **比赛**：2026-06-21（UTC 开球 2026-06-22T01:00:00Z），温哥华 BC Place（中立场地）
- **结算口径**：90 分钟三路赛果（胜/平/负），小组赛无加时
- **事件标识（仅结算元数据）**：`fifwc-nzl-egy-2026-06-21`
- **生成时间**：2026-06-11

## ① 预测结论

| 结果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 新西兰胜 | **22.5%** | 17% – 29% | 中 |
| 平局 | **24.0%** | 19% – 29% | 中 |
| 埃及胜 | **53.5%** | 46% – 60% | 中 |

**一句话观点**：埃及凭借萨拉赫领衔的整体实力与约 134 分的 Elo 优势占据上风（约 53.5%），但新西兰阵容齐整、伍德复出，爆冷与守平的合计概率接近一半，不宜视为悬念已定。

## ② 定义

预测对象为 90 分钟内三路赛果（含伤停补时，不含加时/点球）；世界杯小组赛不设加时，平局即为最终结果。

## ③ 实力画像

| 指标 | 新西兰 | 埃及 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1562（第 72） | 1696（第 48） |
| FIFA 排名（ESPN 报道引述，2026-06） | 约第 50+ 区间 | 第 29 |
| 热身赛（2026-06-06） | 0-1 负英格兰（坦帕） | 1-2 负巴西（克利夫兰） |
| 核心球员 | 克里斯·伍德（诺丁汉森林，34 岁，12 月膝伤术后复出） | 萨拉赫（队长）、马尔穆什（曼城） |

两队最后一场热身赛均小负于世界顶级强队，输球但表现不失体面；埃及对巴西一度由 Ziko 扳平。

## ④ 关键因素

1. **Elo 差距 134 分**：埃及 1696 vs 新西兰 1562，统计模型给出埃及约 51.6% 的基线胜率（eloratings.net，2026-06-11）。
2. **萨拉赫伤愈领衔**：5 月曾因腿筋伤势缺阵约四周，现已恢复并出任队长，与曼城前锋马尔穆什搭档锋线（Al Jazeera，2026-05-21；olympics.com，2026-06）。
3. **埃及热身赛硬仗不落下风**：6 月 6 日 1-2 小负巴西，开场即由 Ziko 扳平，状态可用（ESPN，2026-06-06）。
4. **伍德复出但成色待验**：新西兰队长伍德 12 月接受左膝手术，自称“完全恢复”，但 34 岁高龄 + 术后回归时间不长，国际强度下的锐度存疑（ESPN / Flashscore，2026-05/06）。
5. **新西兰热身仅 0-1 小负英格兰**（2026-06-06，坦帕），防守组织有韧性（ESPN，2026-06-06）。
6. **中立场地**：BC Place（温哥华）非任何一方主场，无东道主加成；两队 6/15 各有一场首轮小组赛（新西兰 vs 伊朗、埃及 vs 比利时），本场为各自第二战，出线压力视首轮结果而定（赛程：nzfootball.co.nz / vanfc26.com）。

## ⑤ 模型与调整

- **p_stat（Davidson 三路模型，scale=400，drawNu=0.7，无东道主加成）**：新西兰 23.9% / 平 24.6% / 埃及 51.6%。
- **调整（合计约 ±3.8pp，上限 ±8pp）**：埃及 +1.9pp、新西兰 −1.4pp、平局 −0.6pp。理由：埃及锋线个体质量（萨拉赫伤愈 + 马尔穆什）与对巴西的热身表现略优于 Elo 基线所含信息；新西兰头号得分手伍德术后回归时间短、比赛节奏存疑。证据总体偏薄，故调整幅度保持温和。
- **p_final**：新西兰 22.5% / 平 24.0% / 埃及 53.5%。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，未参考亦未引用任何此类数据。

## ⑥ 方法说明

基线概率来自世界足球 Elo 评分（eloratings.net，2026-06-11 快照）输入 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致：scale=400，drawNu=0.7）；随后基于公开新闻证据做不超过 ±8pp 的有界调整并归一化。80% 区间反映模型参数敏感性（drawNu 0.6–0.8 下埃及胜率约 49.8%–53.5% 波动）与证据稀薄度（首轮小组赛尚未进行，双方状态信息有限）。

### 来源清单

1. eloratings.net World.tsv（快照 2026-06-11，本地 `elo-table.json`）
2. Al Jazeera — 萨拉赫出任队长、埃及世界杯名单（2026-05-21）：https://www.aljazeera.com/sports/2026/5/21/mohamed-salah-to-captain-egypt-as-squad-announced-for-fifa-world-cup-2026
3. olympics.com — 埃及全名单与赛程、萨拉赫伤愈（2026-06）：https://www.olympics.com/en/news/fifa-world-cup-2026-mohamed-salah-and-egypt-chase-first-ever-quarter-final-berth-all-players-full-squad-list-key-stats-and-schedule
4. ESPN — 巴西 2-1 埃及（2026-06-06）：https://www.espn.com/soccer/match/_/gameId/401861998/egypt-brazil
5. ESPN — 伍德领衔新西兰名单（2026-05/06）：https://www.espn.com/soccer/story/_/id/48764554/chris-wood-headlines-new-zealand-2026-world-cup-squad
6. Flashscore — 伍德自述完全恢复（2026-06）：https://www.flashscore.com/news/soccer-world-cup-new-zealand-captain-chris-wood-fully-fit-for-2026-world-cup-after-injury-battles/xj5tDLMN/
7. ESPN — 英格兰 1-0 新西兰热身赛（2026-06-06）：https://www.espn.com/soccer/story/_/id/48967413/england-new-zealand-kickoff-how-watch-stats-team-news-pre-fifa-world-cup-2026-international-friendly
8. 温哥华 BC Place 赛程（2026-06）：https://vanfc26.com/schedule

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
