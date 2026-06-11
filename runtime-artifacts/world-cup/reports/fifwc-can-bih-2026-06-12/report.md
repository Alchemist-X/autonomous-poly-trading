# 加拿大 vs 波黑（2026 世界杯 B 组，2026-06-12）市场盲测预测

> 生成时间：2026-06-11T13:15:00Z ｜ 开球：2026-06-12T19:00:00Z（多伦多 BMO Field）
> 本预测为**市场盲测**：完全独立于任何盘口、赔率或预测市场价格，仅基于公开统计模型与新闻证据。

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 加拿大胜 | **63%** | 55% – 70% | 中 |
| 平局 | **23%** | 17% – 28% | 中 |
| 波黑胜 | **14%** | 9% – 20% | 中 |

**一句话观点**：Elo 差约 193 分加主场之利让东道主加拿大明显占优，但队长 Davies 确认缺席揭幕战，胜率应从纯模型值下修至六成出头。

## ② 定义

- 标的为 90 分钟三路赛果（小组赛无加时、无点球大战），含伤停补时。
- 事件 slug（仅作结算元数据）：`fifwc-can-bih-2026-06-12`。

## ③ 实力画像

| 指标 | 加拿大 | 波黑 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1788（第 25） | 1595（第 65） |
| 主帅 | Jesse Marsch | Sergej Barbarez |
| 近期状态 | 2026 年至今不败，近 8 场不败（Sports Mole，2026-06-10） | 近 8 场不败，但附加赛两场均靠点球晋级（Yahoo Sports 预览，2026-06-11） |
| 热身赛 | — | 0-0 北马其顿、1-1 巴拿马，进攻乏力（ESPN，2026-06-10） |

加拿大作为东道主在多伦多主场开赛，模型按惯例加 100 分主场修正（RaEff = 1888）。

## ④ 关键因素

1. **Davies 预计缺席揭幕战**：左腿筋伤（5 月 6 日欧冠对 PSG 受伤），Marsch 称力争第 2/3 场小组赛复出（Yahoo Sports / FOX Sports，2026-06-10）。加拿大失去最强攻击点与队长。
2. **加拿大后防减员**：Bombito（胫骨伤未完全恢复）大概率不出场；Flores 十字韧带断裂退队、Nelson 替补入队（Sports Mole，2026-06-10）。
3. **波黑进攻端疲软**：两场热身仅 1 球（0-0 北马其顿、1-1 巴拿马）；锋线靠 40 岁 Dzeko 搭档 Demirovic，Tabakovic 踝伤大概率不出场（ESPN 2026-06-10；Fantasy Football Scout 2026-06-08）。
4. **主场与氛围**：BMO Field 为加拿大世界杯历史首个本土主场揭幕战，多伦多共承办 6 场世界杯赛事（TSN，2026-06）。
5. **双方均状态不差**：两队各自 8 场不败，波黑下限不低，平局风险不可忽视。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，加拿大 +100 东道主修正）：
  加拿大 67.3% / 平 20.3% / 波黑 12.5%
- **证据调整（合计 |Δ| = 4pp ≤ 8pp 上限）**：
  - 加拿大 −4pp：Davies 缺席（最重磅证据）+ Bombito 缺阵削弱主队上限；
  - 平局 +2.5pp、波黑 +1.5pp：波黑整体不败韧性与加拿大攻击力下降，使僵局/冷门概率小幅上移。
- **p_final**：加拿大 63.3% / 平 22.8% / 波黑 14.0%（发布值四舍五入为 63/23/14）。
- 80% 区间反映参数敏感性（drawNu 0.6–0.8 使加拿大胜率波动 65.4%–69.3%；主场修正 ±35 分波动 64.1%–70.2%）再叠加 Davies 缺席影响幅度的不确定性。
- 本预测为市场盲测，**不含任何市场腿**，p_final 即发布数字。

## ⑥ 方法

以 eloratings.net 世界 Elo 为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致：scale=400，drawNu=0.7）算出基准概率；东道主小组赛主场 +100 分修正；再依据带日期来源的伤停/状态证据做不超过 ±8pp 的有界调整并归一化。全程不读取、不引用任何盘口或赔率数据。

### 来源清单

1. eloratings.net World.tsv（经本地 elo-table.json，抓取 2026-06-11）
2. ESPN 赛前预览 — https://www.espn.com/soccer/story/_/id/48972712/fifa-world-cup-2026-canada-vs-bosnia-herzegovina-kickoff-how-watch-stats-team-news （2026-06-10）
3. Sports Mole 预览 — https://www.sportsmole.co.uk/football/canada/world-cup-2026/preview/canada-vs-bosnia-hvina-prediction-team-news-lineups_598907.html （2026-06-10）
4. Yahoo Sports：Davies 缺席影响 — https://sports.yahoo.com/articles/why-alphonso-davies-missing-2026-213721175.html （2026-06-10）
5. FOX Sports：Davies 带伤入选名单 — https://www.foxsports.com/stories/soccer/alphonso-davies-named-to-canadas-world-cup-squad-despite-hamstring-injury （2026-06）
6. Fantasy Football Scout：波黑队伍预览 — https://www.fantasyfootballscout.co.uk/2026/06/08/fantasy-fifa-world-cup-2026-team-previews-bosnia-herzegovina （2026-06-08）
7. TSN：多伦多球场 6 场世界杯赛事 — https://www.tsn.ca/soccer/fifa-world-cup/article/a-snapshot-look-at-the-six-fifa-world-cup-games-to-be-played-at-toronto-stadium/ （2026-06）

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
