# 2026 FIFA 世界杯 C 组头名预测（Brazil / Morocco / Scotland / Haiti）

- 预测 ID：`group-winner:c` ｜ 生成时间：2026-06-11T13:15:00Z
- 口径：**完全独立于任何博彩/预测市场（market-blind）**。概率仅来自 Elo 蒙特卡洛统计模型 + 有限的、有引用依据的证据修正。

## ① 结论

| 球队 | 模型基线 | 调整后概率 |
| --- | --- | --- |
| 巴西 Brazil | 72.8% | **70.8%** |
| 摩洛哥 Morocco | 16.9% | **16.9%** |
| 苏格兰 Scotland | 10.1% | **12.1%** |
| 海地 Haiti | 0.3% | **0.3%** |

**一句话观点：** 巴西 Elo 断层领先（1991 vs 摩洛哥 1827），约七成概率拿下 C 组头名；但罗德里戈、埃斯特旺、Wesley 伤缺加内马尔首战存疑，摩洛哥与阵容完整的苏格兰合计仍握有约三成翻盘空间。

## ② 问题定义

"C 组头名" = 2026 FIFA 世界杯小组赛结束后，C 组**最终积分榜第 1 名**。排名规则依次：积分 → 净胜球 → 进球数 → 相互对赛成绩 → 公平竞赛积分 → 抽签。

小组赛程（UTC）：06-13 巴西 vs 摩洛哥、海地 vs 苏格兰；06-19 苏格兰 vs 摩洛哥、巴西 vs 海地；06-24 摩洛哥 vs 海地、苏格兰 vs 巴西（末轮同时开球）。

## ③ 各队简评（仅 Elo / 状态 / 赛程视角）

- **巴西**（Elo 1991，世界第 5）：组内 Elo 领先第二名 164 分，三个对手实力均明显在其之下；06-13 首战直接对话摩洛哥，赢下即基本锁定头名走势。隐忧是阵容扰动：罗德里戈（ACL）长期报销、埃斯特旺伤缺、右后卫 Wesley 赛前伤退换人，34 岁的内马尔 5 月中旬小腿受伤、首战出场存疑。
- **摩洛哥**（Elo 1827，第 24）：阿什拉夫·哈基米、布拉欣·迪亚斯领衔，是组内对巴西最有威胁的挑战者；但开赛前数日中卫阿格尔德与边锋埃扎祖利因伤退出，主力中锋恩内斯里落选，自身减员大致抵消了巴西伤病带来的相对利好。头名概率高度取决于首战结果。
- **苏格兰**（Elo 1782，第 26）：与摩洛哥 Elo 仅差 45 分，且截至发稿无重大伤停报道、阵容完整；若 06-19 击败摩洛哥并在末轮拿分于巴西，头名并非空谈。本次 +2pp 上调反映"两强减员、苏格兰满员"的相对变化。
- **海地**（Elo 1548，第 73）：组内 Elo 断档垫底，纯模型下头名概率仅 0.3%，需要极端连环冷门才可能成立；维持基线不变。

## ④ 方法

1. **统计基线**：100,000 次全赛事纯 Elo 泊松蒙特卡洛（seed 20260611，eloratings.net 2026-06-11 快照）。每场进球为独立泊松，λ = 2.6 × Elo 逻辑期望；小组排名按积分 → 净胜球 → 进球 → 并列球队间小循环 → 随机抽签；东道主 Elo 加成只作用于东道主所在组的小组赛，与 C 组无关；**不含任何市场输入**。基线：巴西 72.75% / 摩洛哥 16.89% / 苏格兰 10.07% / 海地 0.30%。
2. **有限证据修正**（单队上限 ±4pp，修正后归一化为 1）：巴西 −2pp（多名主力/轮换伤缺 + 内马尔出场存疑，纯 Elo 无法感知阵容可用性）；摩洛哥 0（自身三人减员与巴西削弱的利好近似抵消）；苏格兰 +2pp（组内唯一无减员报道的竞争者）；海地不变。调整为零和转移，四队概率和保持 1。

## 来源

1. eloratings.net World Football Elo Ratings 快照（Elo 与排名）— https://www.eloratings.net/World.tsv （2026-06-11）
2. FIFA 官网：巴西 26 人名单公布 — https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/brazil-squad-announcement-carlo-ancelotti （2026-06-11 查阅）
3. beIN SPORTS：Wesley 伤退、阿塔兰塔中场 Ederson 替补入队 — https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/wesley-suffers-injury-as-brazil-names-replacement-for-fifa-world-cup-squad-2026-06-07 （2026-06-07）
4. ESPN 2026 世界杯伤病追踪（罗德里戈 ACL 报销；内马尔 5-28 起小腿伤休 3 周内；埃斯特旺伤缺）— https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info （2026-06-11 查阅）
5. ESPN：摩洛哥世界杯名单，哈基米、布拉欣·迪亚斯领衔，恩内斯里落选 — https://www.espn.com/espn/story/_/id/48883710/achraf-hakimi-brahim-diaz-headline-morocco-squad-fifa-world-cup-youssef-en-nesyri-out （2026-06-11 查阅）
6. GHANAsoccernet：阿格尔德与埃扎祖利开赛前因伤退出摩洛哥名单 — https://ghanasoccernet.com/2026-world-cup-morocco-suffer-double-injury-blow-as-nayef-aguerd-and-abde-ezzalzouli-withdraw-from-squad （2026-06-11 查阅）
7. Goal.com：2026 世界杯 C 组摩洛哥指南（赛程与分组）— https://www.goal.com/en/world-cup-teams/group-c/world-cup-2026-guide-morocco/O~blt4970f3f09e30e066 （2026-06-11 查阅）

## 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
