# 西班牙 vs 佛得角 — 2026 世界杯小组赛 H 组（市场盲测预测）

- **比赛**：2026-06-15 16:00 UTC（亚特兰大 Mercedes-Benz Stadium，当地时间 12:00）
- **事件标识**（仅作结算元数据）：`fifwc-esp-cvi-2026-06-15`
- **生成时间**：2026-06-11T13:15:00Z

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 西班牙胜 | **82.5%** | 78% – 87% | 高 |
| 平局 | **14.0%** | 10% – 18% | 高 |
| 佛得角胜 | **3.5%** | 2% – 6% | 高 |

**一句话观点**：Elo 世界第一的西班牙对阵史上首次参赛、几乎没有五大联赛球员的佛得角，实力差距巨大；主力边锋伤情与近期两场热身平局让平局概率较纯模型值略微上调，但西班牙胜仍是绝对主导情景。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负）。小组赛无加时与点球，常规时间结束即按比分结算。

## ③ 实力画像

| 指标 | 西班牙 | 佛得角 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 2157（第 1） | 1578（第 68） |
| 世界杯经历 | 2010 冠军、2024 欧洲杯冠军班底 | 史上首次参赛 |
| 阵容来源 | 主力遍布欧洲豪门（本届无皇马球员） | 仅 1 名五大联赛球员（Logan Costa，比利亚雷亚尔） |
| 近期热身 | 平埃及、平伊拉克，6 月 8 日 3-1 胜秘鲁 | 非洲区预选赛历史性出线后备战 |

## ④ 关键因素

1. **Elo 差距 579 分**：2157 vs 1578，戴维森三路模型直接给出西班牙约 86% 统计胜率（来源：eloratings.net World.tsv，抓取 2026-06-11）。
2. **西班牙边锋伤情**：Lamine Yamal、Nico Williams 缺席 6 月 8 日对秘鲁热身、留营恢复，主帅 De la Fuente 称三名伤员（含 Merino）预计 6 月 15 日可用但可能限制出场时间（来源：ESPN，2026-06-09/10）。
3. **Fermín López 伤缺整届世界杯**：右脚跖骨骨折需手术（来源：ESPN/UPI 伤情汇总，2026-06-10）。
4. **西班牙热身赛走势**：此前与埃及（Elo 1696）、伊拉克（Elo 1607）两场闷平——对手实力档位与佛得角（1578）相当，提示面对低位收缩防守时破门并非必然；随后 3-1 击败秘鲁完成调整（来源：Al Jazeera，2026-06-09）。
5. **佛得角阵容深度有限**：5 月 19 日公布 26 人名单，核心为 36 岁老将 Ryan Mendes 与 Casa Pia 前锋 Dailon Livramento，旅欧顶级联赛球员仅 1 人（来源：beIN Sports，2026-05-19；FourFourTwo）。
6. **场地与天气**：Mercedes-Benz Stadium 为可闭合屋顶球场，气候因素影响可忽略；中立场地，无任何东道主加成（来源：olympics.com 赛程页，2026-05）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无东道主加成）：
  西班牙 **85.6%** / 平 **11.3%** / 佛得角 **3.1%**
- **调整（合计 3.1pp，上限 ±8pp）**：
  - 西班牙 −3.1pp：Yamal/Williams 可能限时出场 + Fermín 缺阵 + 对同档对手（埃及/伊拉克）热身两连平的"攻坚乏力"信号；
  - 平局 +2.7pp、佛得角 +0.4pp：佛得角大概率深度收缩，僵局风险略高于模型基线；但其阵容厚度极薄，爆冷取胜的证据不足，仅作微调。
- **p_final**：西班牙 **82.5%** / 平 **14.0%** / 佛得角 **3.5%**（已归一化）。
- **80% 区间来源**：drawNu 在 0.6–0.8 之间的敏感性（西班牙胜 84.3%–87.0%、平 9.9%–12.7%）+ 伤情落地与证据厚度的不确定性。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，概率仅来自 Elo/统计模型加有据可查的有限调整。

## ⑥ 方法说明

以 eloratings.net 当日 Elo 为输入，用 Davidson 三路扩展（与仓库 packages/sports-model/src/elo.ts 的 eloToOneXTwo 一致：piA=10^(Ra/400)，pDraw=0.7·sqrt(piA·piB)/denom）得出统计基线；再用近期公开新闻（官方/主流媒体，不含任何赔率页面）做不超过 ±8pp 的有界调整并归一化。区间反映模型参数敏感性与证据稀薄度。

### 来源清单

1. eloratings.net World.tsv（抓取 2026-06-11）— Elo 与排名
2. ESPN：Yamal/Nico Williams 缺席末场热身留营恢复（2026-06-09）— https://www.espn.com/soccer/story/_/id/48993924/lamine-yamal-nico-williams-left-spain-last-world-cup-warmup
3. ESPN：西班牙 26 人名单确认，无皇马球员（2026-06）— https://www.espn.com/soccer/story/_/id/48870392/spain-world-cup-2026-squad-confirmed-lamine-yamal-stars-no-real-madrid-players
4. ESPN/UPI：世界杯伤情汇总，Fermín López 跖骨骨折出局（2026-06-10）— https://www.upi.com/Sports_News/Soccer/2026/06/10/World-Cup-injuries-Spain-Argentina-Iceland/4671780927848/
5. Al Jazeera：西班牙 3-1 秘鲁，此前平埃及、伊拉克（2026-06-09）— https://www.aljazeera.com/sports/2026/6/9/spain-cruise-past-peru-in-final-world-cup-2026-warm-up-match
6. beIN Sports：Bubista 公布佛得角 26 人名单（2026-05-19）— https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/bubista-s-official-cabo-verde-squad-for-the-2026-fifa-world-cup-2026-05-19
7. olympics.com / FourFourTwo：佛得角首次参赛、阵容构成与赛程场地（2026-05）— https://www.olympics.com/en/news/fifa-world-cup-2026-cabo-verde-all-players-full-squad-list-key-stats-schedule

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
