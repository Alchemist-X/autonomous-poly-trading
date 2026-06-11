# 乌拉圭 vs 西班牙 — 2026 世界杯小组赛 H 组（市场盲测预测）

- **赛事**：2026 FIFA 世界杯小组赛 H 组第 3 轮（第 66 场）
- **开球时间**：2026-06-27T00:00:00Z（当地 6 月 26 日，墨西哥瓜达拉哈拉体育场）
- **生成时间**：2026-06-11T13:15:00Z ｜ 解析元数据 slug：`fifwc-ury-esp-2026-06-26`

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 乌拉圭胜 | **15.1%** | 11% – 20% | 中 |
| 平局 | **23.1%** | 17% – 29% | 中 |
| 西班牙胜 | **61.8%** | 54% – 70% | 中 |

**一句话观点**：西班牙 Elo 世界第一、实力差距明显，是清晰的更强一方；但这是小组末轮、双方很可能已提前出线，叠加西班牙伤情隐患，平局概率略高于纯模型值。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负），小组赛无加时与点球；以官方结果为准。

## ③ 实力画像

| 项目 | 乌拉圭 | 西班牙 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 快照） | 1892（#16） | 2157（#1） |
| 近期定位 | 南美区预选第 4，曾击败巴西、阿根廷（MLSSoccer，2026-06） | 卫冕欧洲杯冠军，公认夺冠热门之一（MLSSoccer，2026-06） |
| 主帅 | 贝尔萨（高强度逼抢体系） | 德拉富恩特（控球传切体系） |

## ④ 关键因素

1. **末轮赛程结构**：双方前两轮对手均为佛得角（Elo 1578）与沙特（Elo 1576），实力差距大，末轮相遇时双方大概率已确保出线，存在轮换与"够用即可"倾向，此类比赛平局率历史上偏高。（来源：Wikipedia 2026 FIFA World Cup Group H，访问 2026-06-11）
2. **西班牙伤情**：预选赛头号射手 Merino 今年 2 月接受右脚应力性骨折手术、能否赶上存疑；Yamal 整季多次受伤（赛季末腿筋问题）；Nico Williams 刚从腿筋伤势恢复。主帅称对首战出场"没有疑虑"，但末轮状态仍有不确定性。（来源：Al Jazeera，2026-06-06）
3. **乌拉圭伤情**：Bentancur 自 1 月起因严重腿筋伤势缺阵，复出是与时间赛跑；De Arrascaeta / De la Cruz 为替代选项。（来源：FourFourTwo，2026-06，名单 2026-05-31 公布）
4. **乌拉圭大赛抗强能力**：贝尔萨治下预选赛击败过巴西和阿根廷，具备对顶级强队拿分的纪录。（来源：MLSSoccer Group H preview，2026-06）
5. **场地**：瓜达拉哈拉（海拔约 1500 米）对双方均为中立场，无东道主加成。（来源：FOX Sports 赛程页，2026-06）
6. **历史交锋**：两次世界杯交手均为平局（1950 年 2-2、1990 年 0-0），仅作背景参考、不计入调整。（来源：Wikipedia Group H，访问 2026-06-11）

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主场加成；乌拉圭 1892 vs 西班牙 2157）：
  - 乌拉圭 14.1% ／ 平局 21.1% ／ 西班牙 64.8%
- **有界调整**（合计 |δ| = 6pp ≤ 8pp 上限）：乌拉圭 +1pp、平局 +2pp、西班牙 −3pp
  - 理由：末轮双方大概率已出线带来的轮换/保平倾向（因素 1）；西班牙伤情不确定性略大于乌拉圭（因素 2 vs 3）；乌拉圭对强队有拿分纪录（因素 4）。证据偏结构性而非硬消息，故调整幅度保守。
- **p_final**：乌拉圭 15.1% ／ 平局 23.1% ／ 西班牙 61.8%
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，未参考亦不引用任何此类数据。

## ⑥ 方法与来源

**方法**：以 eloratings.net 评分为基础，用 Davidson 三路模型（与仓库 packages/sports-model/src/elo.ts 的 eloToOneXTwo 一致）计算统计基线；随后仅依据有来源、有日期的公开事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 参数敏感性（基线摆动约 ±2–4pp）及距开球 15 天的阵容/出线形势不确定性。

**来源清单**：
1. eloratings.net World.tsv（快照 2026-06-11，本仓库 elo-table.json）
2. Al Jazeera — Spain at World Cup 2026 preview（2026-06-06）https://www.aljazeera.com/sports/2026/6/6/spains-world-cup-2026-team-preview-players-to-watch-group-matches-squad
3. FourFourTwo — Uruguay squad World Cup 2026（2026-06，名单 2026-05-31 公布）https://www.fourfourtwo.com/team/uruguay-world-cup-2026-squad
4. MLSSoccer — 2026 FIFA World Cup Group H preview（2026-06）https://www.mlssoccer.com/competitions/fifa-world-cup/news/2026-fifa-world-cup-group-h-preview-spain-cape-verde-saudi-arabia-uruguay
5. Wikipedia — 2026 FIFA World Cup Group H（访问 2026-06-11）https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_H
6. FOX Sports — Uruguay World Cup 2026 schedule（2026-06）https://www.foxsports.com/stories/soccer/uruguay-world-cup-2026-schedule-locations-dates-times

**免责声明**：本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
