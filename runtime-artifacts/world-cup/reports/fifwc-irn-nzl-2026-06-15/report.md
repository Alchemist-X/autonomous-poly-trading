# 伊朗 vs 新西兰 — 2026 世界杯小组赛 G 组（市场盲测预测）

- **比赛**：IR Iran vs New Zealand，G 组第 1 轮（Match 15）
- **开球（UTC）**：2026-06-16T01:00:00Z（当地 6 月 15 日 18:00，SoFi Stadium，洛杉矶英格尔伍德）
- **生成时间**：2026-06-11 | 事件标识（仅作结算元数据）：`fifwc-irn-nzl-2026-06-15`

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 伊朗胜 | **62%** | 56% – 68% | 中 |
| 平局 | **22%** | 17% – 27% | 中 |
| 新西兰胜 | **16%** | 12% – 22% | 中 |

**一句话观点**：伊朗在实力、经验与阵容稳定性上全面占优，约六成胜率；新西兰高度依赖刚伤愈复出的 Chris Wood，爆冷空间有限，但平局风险不可忽视。

## ② 定义

90 分钟（含补时）三路赛果：伊朗胜 / 平局 / 新西兰胜。小组赛无加时、无点球大战。

## ③ 实力画像

| 维度 | 伊朗 | 新西兰 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 快照） | 1772（第 29） | 1562（第 72） |
| FIFA 排名（olympics.com 转引） | 约第 20 | 第 85 |
| 世界杯履历 | 连续第 3 届、总第 7 届 | 2010 年后首次、总第 3 届 |
| 预选赛 | 亚洲区提前出线，防守数据居前列 | 大洋洲区统治级出线 |

伊朗核心 Taremi（Olympiacos，100+ 国家队出场）领衔，阵容班底稳定；新西兰由 Bazeley 执教，队长 Wood（诺丁汉森林，88 场 45 球）是几乎唯一的稳定进球点。

## ④ 关键因素

1. **Elo 差距 210 分**，统计模型基线即给伊朗约 59% 胜率（eloratings.net 快照，2026-06-11）。
2. **Wood 状态存疑**：整季受伤病困扰，2026 年 4 月才复出；赛前最后热身对英格兰打了 78 分钟，是 2024 年 11 月以来单场最多（RNZ，2026-06；ESPN，2026-05-14）。新西兰最大攻击点未达满状态。
3. **伊朗少了 Azmoun**：6 月 1 日公布的最终名单未带 Azmoun（3 月起已被排除出队），锋线深度略减，但 Taremi、Jahanbakhsh、Ghayedi 在列（FIFA.com / Flashscore，2026-06-01）。
4. **赛果权重高**：G 组有强队比利时压阵，这场是伊朗三场小组赛中"最可拿分"的一场，赢球对争小组第二意义重大，动力充足（Wikipedia Group G，访问 2026-06-11）。
5. **场地中立**：SoFi Stadium（封闭式屋顶）、当地傍晚开球，天气与气候因素基本中性（Ticketmaster/FOX Sports 赛程页，访问 2026-06-11）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，双方均非东道主、无主场加成）：伊朗 59.5% / 平 22.8% / 新西兰 17.8%。
- **证据调整**（总幅度约 ±5pp，上限 ±8pp）：Wood 伤愈未满状态 + 新西兰 16 年未打世界杯的级别差（-1.8pp 新西兰、-0.8pp 平局），部分被伊朗失去 Azmoun 的深度损失抵消（净 +2.5pp 伊朗）。
- **p_final**：伊朗 62% / 平 22% / 新西兰 16%。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，未参考、未引用任何博彩或交易数据。

## ⑥ 方法、来源与免责声明

**方法**：以 eloratings.net Elo 分差输入 Davidson 三路概率模型得到统计基线；再依据有来源、有日期的球队事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu（0.6–0.8）参数敏感性与证据稀薄度（drawNu 敏感带：伊朗 57.6%–61.5%、平 20.2%–25.2%、新西兰 17.2%–18.4%，再外扩覆盖证据不确定性）。

**来源清单**：
1. eloratings.net（World.tsv 快照，2026-06-11）
2. FIFA.com — 伊朗最终名单（2026-06-01）：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/ir-iran-squad-named
3. Flashscore — Taremi 领衔、Azmoun 落选（2026-06-01）：https://www.flashscore.com/news/soccer-world-championship-taremi-and-jahanbakhsh-lead-iran-s-world-cup-squad-with-azmoun-overlooked/pGYQ1OUq/
4. FIFA.com — 新西兰名单（2026-05-14）：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/new-zealand-squad-named
5. ESPN — Wood 领衔新西兰名单、伤病背景（2026-05-14）：https://www.espn.com/soccer/story/_/id/48764554/chris-wood-headlines-new-zealand-2026-world-cup-squad
6. RNZ — Wood 对英格兰 78 分钟、复出进程（2026-06）：https://www.rnz.co.nz/news/sport/597710/will-chris-wood-be-unleashed-at-the-football-world-cup
7. Wikipedia — 2026 FIFA World Cup Group G（访问 2026-06-11）：https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_G
8. Olympics.com — 新西兰 FIFA 排名与赛程（访问 2026-06-11）：https://www.olympics.com/en/news/fifa-world-cup-2026-new-zealand-all-players-full-squad-list-key-stats-schedule

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
