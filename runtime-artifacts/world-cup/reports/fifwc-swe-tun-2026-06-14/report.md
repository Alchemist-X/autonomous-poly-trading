# 瑞典 vs 突尼斯（2026 世界杯 F 组，2026-06-14）市场盲测预测

> 生成时间：2026-06-11T13:15:00Z ｜ 事件 slug（仅作结算元数据）：`fifwc-swe-tun-2026-06-14` ｜ 开球：2026-06-15T02:00:00Z（蒙特雷当地 6 月 14 日晚 8 点）

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 瑞典胜 | **48%** | 42% – 54% | 中 |
| 平局 | **26%** | 21% – 31% | 中 |
| 突尼斯胜 | **26%** | 21% – 31% | 中 |

**一句话观点**：瑞典凭约克雷斯+伊萨克的锋线档次优势小幅占优，但突尼斯防守极稳且瑞典自身状态起伏大，这是一场"弱优势"对局，三路都不该被排除。

## ② 定义

- 标的为 90 分钟（含补时）三路赛果；小组赛无加时、无点球大战。
- 中立场地：墨西哥蒙特雷 Estadio BBVA，双方均非东道主，模型不加主场分。

## ③ 实力画像

| | 瑞典 | 突尼斯 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 快照） | 1712（第 43） | 1628（第 58） |
| 主帅 | 格雷厄姆·波特（预选赛期间接手） | 萨布里·拉穆奇（2026 年 1 月上任） |
| 近期轨迹 | 预选赛小组垫底仅 2 分，靠附加赛连克乌克兰、波兰晋级（约克雷斯戴帽+88 分钟绝杀） | 预选赛零失球出线（首支做到的球队），但非洲杯 1 月 16 强出局后换帅 |

来源：eloratings.net（2026-06-11）、The Analyst/Opta 瑞典前瞻、FIFA.com 突尼斯名单公告。

## ④ 关键因素

1. **瑞典锋线档次明显高于其 Elo 排名**：约克雷斯刚随阿森纳拿下 2025-26 英超冠军，附加赛对乌克兰戴帽、对波兰 88 分钟绝杀；伊萨克同样在阵（The Analyst，访问 2026-06-11）。
2. **伊萨克体能存疑**：转会利物浦后伤病不断，2025-26 英超仅首发 8 场（Sky Sports，访问 2026-06-11）。
3. **库卢塞夫斯基因伤落选**瑞典名单，中前场创造力打折（FourFourTwo 名单页，访问 2026-06-11）。
4. **突尼斯防守极稳但临阵换帅**：预选赛零失球，却在 1 月非洲杯 16 强负于马里后解雇特拉贝尔西；拉穆奇 1 月接手、备战时间有限，名单大幅轮换，3 月热身仅胜海地（FIFA.com / Squawka，访问 2026-06-11）。
5. **瑞典预选赛常规阶段极差**（小组垫底、不胜瑞士/科索沃/斯洛文尼亚），说明球队下限很低——此因素已大体反映在 Elo 中（BigDSoccer，访问 2026-06-11）。
6. **蒙特雷 6 月 14 日炎热**（白天最高约 37–39°C），晚 8 点开球缓解部分影响；高温微利于北非球队（weather.com 月度预报，访问 2026-06-11）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，Elo 1712 vs 1628，中立无主场分）：瑞典 46.2% / 平 25.4% / 突尼斯 28.5%。
- **证据调整（合计 |Δ|≈4.9pp，上限 ±8pp）**：
  - 瑞典 +1.8pp：锋线天赋（因素 1）高于 Elo 隐含水平，且附加赛展示了关键球能力；部分被因素 2、3 抵消。
  - 平局 +0.6pp：突尼斯零失球的低失球风格（因素 4）拉高小比分/平局概率。
  - 突尼斯 −2.5pp：换帅后磨合不足、名单大改（因素 4）压低赢球上限；高温（因素 6）只给予很小回补。
- **p_final**：瑞典 48% / 平 26% / 突尼斯 26%。
- 80% 区间反映 drawNu 0.6–0.8 敏感性（统计层瑞典 44.6–47.9%、平 22.6–28.0%、突尼斯 27.5–29.5%）再叠加证据稀薄度（赛前 3 天、首发未公布）。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，概率仅来自 Elo/Davidson 统计模型加上述有据调整。

## ⑥ 方法与来源

方法：以 eloratings.net 2026-06-11 Elo 快照输入 Davidson 三路模型（与仓库 packages/sports-model/src/elo.ts 的 eloToOneXTwo 一致，scale=400、drawNu=0.7；东道主小组赛 +100，本场不适用）得 p_stat；再用 3 次限额网络检索收集的 6 条带来源事实做不超过 ±8pp 的有界调整并归一化；区间由参数敏感性+证据稀薄度给出。

来源清单（均为访问日期 2026-06-11）：
1. https://www.eloratings.net/World.tsv （Elo 快照）
2. https://theanalyst.com/articles/sweden-world-cup-2026-preview-gyokeres-isak-potter
3. https://www.skysports.com/football/news/11095/13463183/jonas-olsson-on-isak-gyokeres
4. https://www.fourfourtwo.com/team/sweden-world-cup-2026-squad
5. https://www.bigdsoccer.com/sweden-2026-world-cup-preview/
6. https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/tunisia-squad-named-sabri-lamouchi
7. https://www.squawka.com/en/news/world-cup/tunisia-world-cup-2026-fixtures-squad-analysis/
8. https://www.mlssoccer.com/news/2026-fifa-world-cup-group-f-preview-netherlands-japan-sweden-tunisia
9. https://weather.com/weather/monthly/l/17234:25:MX

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
