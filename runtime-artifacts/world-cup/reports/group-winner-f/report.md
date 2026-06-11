# 2026 世界杯 F 组头名预测（市场盲版）

- **问题**：F 组（荷兰、日本、瑞典、突尼斯）谁以小组第一身份完成小组赛？
- **结算事件 slug（仅作结算元数据）**：`world-cup-group-f-winner`
- **生成时间**：2026-06-11T13:15:00Z；英文版 [`report.en.md`](report.en.md)；机器可读 [`prediction.json`](prediction.json)
- 本预测完全独立于任何盘口与预测市场，概率仅来自统计模型 + 有界证据调整。

## ① 结论

| 球队 | 模型基线 p_stat | 调整后 p_adj | 调整 |
| --- | --- | --- | --- |
| **荷兰** | 55.91% | **54.41%** | −1.5pp |
| **日本** | 39.10% | **38.10%** | −1.0pp |
| **瑞典** | 3.91% | **5.91%** | +2.0pp |
| **突尼斯** | 1.08% | **1.58%** | +0.5pp |

**一句话观点**：荷兰凭 Elo 第 8 的实力底盘和更厚的轮换深度，约 54% 概率拿下 F 组头名；日本（约 38%）因三笘薫整届缺阵攻击力受损，6 月 14 日荷日直接对话基本决定组头归属，瑞典只是外围搅局者。置信档：**中**（荷日 Elo 差仅 42 分，且两强各有减员）。

## ② 定义与结算标准

- 预测对象：FIFA 2026 世界杯 F 组**最终积分榜第 1 名**。
- 排名规则（FIFA 小组赛同分裁定顺序）：积分 → 净胜球 → 进球数 → 相关队间对赛成绩 → 公平竞赛分 → 抽签。
- 小组赛程：6-14 荷兰 vs 日本、瑞典 vs 突尼斯；6-20 荷兰 vs 瑞典；6-21 突尼斯 vs 日本；6-25 日本 vs 瑞典、突尼斯 vs 荷兰（赛程见 FIFA 官方）。

## ③ 各队简评（仅 Elo / 状态 / 赛程视角）

- **荷兰**（Elo 1948，第 8）：组内实力最强，且对日本之外两队 Elo 差 ≥236 分。隐忧是减员面较宽：西蒙斯、斯豪滕（均 ACL）赛季报销，廷贝尔退出名单由海尔特雷达替补（FIFA.com），主力门将费尔布鲁根能否赶上揭幕战存疑、德佩带腘绳肌问题进队（ESPN）。深度足以消化，但压缩了对日本的优势幅度。
- **日本**（Elo 1906，第 14）：与荷兰差距不大，理论上有真实的争头名能力；但头号边路爆点三笘薫因腘绳肌伤势落选整届赛事（Al Jazeera，主帅森保一称"重大打击"），南野拓実 ACL 同样缺席，进攻端少了最能打破僵局的两人。
- **瑞典**（Elo 1712，第 43）：与两强差距 194+ 分，争头名需在直接对话中爆冷且净胜球占优；两强双双减员让这一尾部情形概率略有抬升，但仍是小概率。
- **突尼斯**（Elo 1628，第 58）：组内 Elo 垫底，需两场以上爆冷才可能登顶，接近彩票级事件。

## ④ 方法

1. **统计基线**：100,000 次全赛事纯 Elo 泊松蒙特卡洛模拟（seed 20260611）。比赛进球为独立泊松，λ 由 Elo 逻辑斯蒂期望切分 2.6 球基准；东道主仅小组赛 +100 Elo（F 组无东道主，不受影响）；小组排名按积分→净胜球→进球→同分小循环→抽签。评分来自 eloratings.net 2026-06-11 快照，**无任何市场输入**。
2. **有界调整**：每队上限 ±4pp 且必须有引用证据。实际：荷兰 −1.5pp（多人缺席 + 门将存疑）、日本 −1.0pp（三笘、南野整届缺阵）、瑞典 +2.0pp / 突尼斯 +0.5pp（两强同时减员的概率外溢），调整后重归一化，总和 = 1。

## 来源

1. eloratings.net World.tsv（Elo 评分快照，2026-06-11 拉取）：https://www.eloratings.net/World.tsv
2. Al Jazeera《Mitoma fails to make Japan's 2026 World Cup squad》（2026-05-15）：https://www.aljazeera.com/sports/2026/5/15/mitoma-fails-to-make-japans-2026-world-cup-squad-due-to-hamstring-injury
3. ESPN《Kaoru Mitoma ruled out of World Cup, Tomiyasu recalled》（2026-05-15）：https://www.espn.com/soccer/story/_/id/48775615/kaoru-mitoma-ruled-world-cup-injury-takehiro-tomiyasu-recalled-japan-squad
4. FIFA.com《Netherlands call up Geertruida after Jurrien Timber withdrawal》（2026-06-11 检索）：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/netherlands-call-up-geertruida-jurrien-timber
5. ESPN《Netherlands keeper Verbruggen a doubt for World Cup opener》（2026-06-11 检索）：https://www.espn.com/soccer/story/_/id/49022242/netherlands-bart-verbruggen-injury-2026-world-cup-japan
6. ESPN《2026 World Cup injuries tracker》（2026-06-11 检索）：https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info

## 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
