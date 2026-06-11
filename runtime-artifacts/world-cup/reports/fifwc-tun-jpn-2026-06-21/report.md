# 突尼斯 vs 日本 — 2026 世界杯小组赛 F 组（市场盲测预测）

- **比赛**：突尼斯 vs 日本，F 组第 2 轮，蒙特雷 BBVA 球场（墨西哥）
- **开球**：2026-06-21 04:00 UTC（当地时间 6 月 20 日 22:00）
- **生成时间**：2026-06-11 | **预测性质**：市场盲测，完全独立于任何盘口/赔率

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 突尼斯胜 | **12%** | 9% – 16% | 中 |
| 平局 | **21%** | 17% – 26% | 中 |
| 日本胜 | **67%** | 60% – 73% | 中 |

**一句话观点**：日本 Elo 高出 278 分构成压倒性实力差，三笘薰、南野拓实双双伤缺被突尼斯换帅动荡与热身赛 0-5 惨败大致抵消，日本约 2/3 概率取胜。

## ② 定义

预测对象为 90 分钟（含补时）三路赛果；小组赛无加时、无点球大战。平局即按平局结算。

## ③ 实力画像

| 队伍 | Elo（eloratings.net，2026-06-11 快照） | Elo 世界排名 |
| --- | --- | --- |
| 日本 | 1906 | 14 |
| 突尼斯 | 1628 | 58 |

- 日本：26 人名单由久保建英领衔，远藤航、镰田大地在列，富安健斗时隔近两年回归（FIFA/World Soccer Talk，2026-05）。首战荷兰后移师蒙特雷打突尼斯（ESPN，2026-05-15）。
- 突尼斯：主帅拉穆希（Sabri Lamouchi）2026 年 1 月才接手，至今只带队 2 场；萨西、梅里亚、马卢尔、斯利蒂等老将集体落选（FIFA，2026-05；Squawka）。

## ④ 关键因素

1. **日本双翼伤缺**：三笘薰（腿筋伤）确定无缘世界杯，南野拓实同样伤退——进攻宽度与一对一爆点削弱（Al Jazeera，2026-05-15；ESPN，2026-05-15）。
2. **突尼斯换帅动荡**：拉穆希 1 月上任仅带队 2 场，且大幅清洗功勋老将，磨合度存疑（FIFA，2026-05）。
3. **突尼斯热身赛崩盘**：6 月热身 1-0 负奥地利、0-5 惨败比利时，对强队的防守稳定性堪忧（FIFA 热身赛汇总，2026-06）。
4. **场地与适应**：突尼斯两场小组赛均在蒙特雷 BBVA 球场（6/15 对瑞典、6/21 对日本），有场地适应小优势；当地夜场开球（22:00），高温影响有限（Wikipedia Group F，2026-06-11 查阅）。
5. **日本板凳深度**：即便缺三笘/南野，久保、镰田、堂安等攻击群仍属亚洲顶配，伤缺冲击部分被深度吸收（World Soccer Talk，2026-05）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主办国加成）：
  突尼斯 13.3% / 平局 20.7% / 日本 66.0%
- **调整（合计 |Δ|≈2.6pp，上限 ±8pp）**：
  - 日本伤缺三笘+南野：日本 −2pp 方向；
  - 突尼斯新帅磨合 + 0-5 惨败 + 老将清洗：突尼斯 −2.5pp 方向；
  - 突尼斯蒙特雷场地适应：突尼斯 +0.5pp 方向；
  - 净效果：突尼斯 −1.3pp、平局 +0.3pp、日本 +1.0pp。
- **p_final**：突尼斯 12% / 平局 21% / 日本 67%。
- 本预测为**市场盲测**：全程未获取、未参考任何博彩/预测市场价格或赔率，概率仅来自 Elo 统计模型 + 有界证据调整。

## ⑥ 方法、来源与免责声明

**方法**：以 eloratings.net 2026-06-11 Elo 快照输入 Davidson 三路模型（pi_A=10^(Ra/400)，平局参数 nu=0.7）得 p_stat；再依据带来源日期的公开事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映 nu∈[0.6,0.8] 的参数敏感性叠加证据稀薄度（开赛前 10 天，名单/状态仍可能变化）。

**来源清单**：
1. eloratings.net World.tsv（2026-06-11 快照，本仓库 elo-table.json）
2. Al Jazeera — Mitoma fails to make Japan's 2026 World Cup squad（2026-05-15）：https://www.aljazeera.com/sports/2026/5/15/mitoma-fails-to-make-japans-2026-world-cup-squad-due-to-hamstring-injury
3. ESPN — Mitoma ruled out, Tomiyasu recalled（2026-05-15）：https://www.espn.com/soccer/story/_/id/48775615/kaoru-mitoma-ruled-world-cup-injury-takehiro-tomiyasu-recalled-japan-squad
4. FIFA — Lamouchi names much-changed Tunisia squad（2026-05）：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/tunisia-squad-named-sabri-lamouchi
5. FIFA — 各队世界杯热身赛汇总（2026-06）：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/pre-tournament-warm-up-results-fixtures-scorers
6. Squawka — Tunisia World Cup 2026 squad & tactical analysis（2026-06）：https://www.squawka.com/en/news/world-cup/tunisia-world-cup-2026-fixtures-squad-analysis/
7. Wikipedia — 2026 FIFA World Cup Group F（2026-06-11 查阅）：https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_F

**免责声明**：本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
