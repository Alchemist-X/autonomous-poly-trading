# 摩洛哥 vs 海地（2026 世界杯小组赛 C 组）市场盲测预测

- 比赛：2026-06-24 22:00 UTC（亚特兰大，梅赛德斯-奔驰体育场，C 组第三轮）
- 事件标识（仅作结算元数据）：`fifwc-mar-hai-2026-06-24`
- 生成时间：2026-06-11T13:15:00Z ｜ 预测方式：**市场盲测**（完全独立于任何盘口/赔率）

## ① 预测结论

| 结果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 摩洛哥胜 | **63%** | 56% – 70% | 中 |
| 平局 | **22%** | 16% – 28% | 中 |
| 海地胜 | **15%** | 9% – 21% | 中 |

**一句话观点：** 摩洛哥实力与大赛底蕴全面占优，但主力中卫缺阵、换帅磨合与末轮可能的轮换，加上海地近期状态火热，让冷门概率略高于纯模型值。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负）。小组赛无加时、无点球大战，补时计入 90 分钟赛果。

## ③ 实力画像

| 指标 | 摩洛哥 | 海地 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1827（第 24） | 1548（第 73） |
| 近期大赛 | AFCON 2025 冠军（经 CAF 裁决获得，2026-03-18，Euronews） | 史上第二次晋级世界杯（CONCACAF 小组头名，Wikipedia） |
| 热身赛状态 | 6/10 公布最终名单，两人伤退（Morocco World News） | 6/2 4-0 大胜新西兰（ESPN） |

场地为亚特兰大梅赛德斯-奔驰体育场（带顶棚、可控温），天气因素基本中性；双方均非东道主，无主场 Elo 加成。

## ④ 关键因素

1. **摩洛哥主力中卫 Aguerd 伤退**：因体能未恢复退出世界杯名单，由 Saâdane 替补入选；边锋 Ezzalzouli 同日伤退（Morocco World News / Wikipedia squads，2026-06-10）。
2. **摩洛哥换帅磨合期**：功勋主帅 Regragui 于 2026 年 3 月离任，U20 世界杯冠军教头 Ouahbi 接任，大赛执教经验有限（Al Jazeera，2026-06-03）。
3. **摩洛哥大赛底蕴仍在**：AFCON 2025 打入决赛并最终获冠军头衔（场上加时不敌塞内加尔后经 CAF 改判 3-0），阵容深度远胜海地（Euronews，2026-03-18）。
4. **海地状态火热**：6 月 2 日热身赛 4-0 大胜新西兰；预选赛末轮 2-0 击败尼加拉瓜以小组头名直通（ESPN，2026-06-02；Wikipedia，2025-11）。
5. **海地阵容升级未必被 Elo 充分捕捉**：桑德兰前锋 Isidor 今年 3 月改披海地战袍，狼队中场 Bellegarde 在列（Olympics.com，2026-06）。
6. **末轮悬念不确定**：此为 C 组末轮（同组有巴西、苏格兰），双方届时出线形势未知；若摩洛哥提前出线可能轮换，若海地仍有理论希望则动力更足——此不确定性推高平/冷门尾部。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无 host bonus）：
  摩洛哥 66.0% / 平 20.7% / 海地 13.3%（Elo 1827 vs 1548）。
- **证据调整 delta（合计 -3.0pp 摩洛哥 → +1.5pp 平 / +1.5pp 海地，上限 ±8pp）**：
  理由：摩洛哥两将伤退 + 新帅磨合 + 末轮轮换风险（因素 1/2/6）；海地状态与新援上行（因素 4/5）。摩洛哥的 AFCON 表现已基本反映在 Elo 中，不再额外加分。证据总体偏薄（末轮形势未知），故 delta 取小值。
- **p_final：摩洛哥 63% / 平 22% / 海地 15%。**
- 本预测为**市场盲测**：全程未参考任何博彩赔率、预测市场价格或隐含概率，概率仅来自 Elo 统计模型与上述有源证据的有界调整。

## ⑥ 方法与来源

方法：以 eloratings.net 世界 Elo 为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 `eloToOneXTwo` 一致）得到统计基线；再按带日期、可溯源的球队新闻做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 的参数敏感性（胜率约 ±2pp、平局约 ±2.3pp）叠加证据稀薄度（末轮形势、轮换未知）后放宽。

来源清单：
1. eloratings.net World.tsv（抓取于 2026-06-11）
2. Morocco World News — Aguerd 伤退、Saâdane 入替（2026-06-10）：https://www.moroccoworldnews.com/2026/06/317989/aguerd-ruled-out-of-moroccos-2026-world-cup-squad-marwane-saadane-called-up/
3. Wikipedia — 2026 FIFA World Cup squads（Ezzalzouli/Aguerd 伤退记录，2026-06-10）：https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads
4. Al Jazeera — 摩洛哥世界杯前瞻、换帅（2026-06-03）：https://www.aljazeera.com/sports/2026/6/3/morocco-world-cup-2026-preview-players-to-watch-group-and-squad-list
5. Euronews — 摩洛哥获 AFCON 2025 冠军（2026-03-18）：https://www.euronews.com/2026/03/18/morocco-declared-afcon-2025-winners-after-caf-overturns-final-defeat-to-senegal
6. ESPN — 海地 4-0 新西兰（2026-06-02）：https://www.espn.com/soccer/match/_/gameId/401871830/new-zealand-haiti
7. Olympics.com — 海地名单与关键球员（2026-06）：https://www.olympics.com/en/news/fifa-world-cup-2026-haiti-players-squad-list-key-stats-schedule
8. Wikipedia — 海地国家队（预选赛出线，2025-11）：https://en.wikipedia.org/wiki/Haiti_national_football_team

免责声明：本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
