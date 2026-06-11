# 葡萄牙 vs 刚果民主共和国（2026 世界杯 K 组小组赛）— 市场盲测预测

- **赛事**：2026 FIFA 世界杯小组赛 K 组，2026-06-17 17:00 UTC，休斯敦 NRG 体育场（双方均为中立场地）
- **解析元数据**：event slug `fifwc-prt-cdr-2026-06-17`（仅用于结算对照，本预测不参考任何盘口）
- **生成时间**：2026-06-11

## ① 预测结论

| 结果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 葡萄牙胜 | **70.0%** | 64% – 76% | 中 |
| 平局 | **19.8%** | 15% – 25% | 中 |
| 刚果民主共和国胜 | **10.2%** | 7% – 14% | 中 |

**一句话观点**：Elo 差距 337 分叠加葡萄牙全主力出战，本场实力差异显著；刚果（金）的现实路径主要是靠防守拖平，爆冷取胜概率约一成。

## ② 定义

预测对象为 90 分钟（含补时）三路赛果：胜 / 平 / 负。世界杯小组赛无加时、无点球，平局即为最终结果。

## ③ 实力画像

| 指标 | 葡萄牙 | 刚果民主共和国 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 快照） | 1989（第 6） | 1652（第 55） |
| 热身赛 | 2-1 胜智利（06-06）、2-1 胜尼日利亚（06-10，ESPN） | 0-0 平丹麦（06-03）、1-2 负智利（06-09，ESPN） |
| 状态要点 | 26 人名单 5-19 公布，C 罗领衔第 6 次世界杯，无关键缺席（FIFA） | 52 年来首进世界杯（1974 年以扎伊尔身份后首次）；Desabre 执教，Wan-Bissaka、Wissa、Mbemba 在列（FIFA） |

## ④ 关键因素

1. **Elo 差 337 分**：葡萄牙 1989 vs 刚果（金）1652，属于"强队对阵区外中游"量级（eloratings.net，2026-06-11）。
2. **葡萄牙全员可用**：2026-05-19 公布 26 人名单，C 罗从 2-3 月右大腿肌肉伤中恢复并在 6 月热身赛出场；年初有伤的 R. Dias、Leão 等无一缺席世界杯（FIFA 2026-05-19；OneFootball 2026-03；Plataforma 2026-03-25）。
3. **共同对手参照**：智利 6 天内先 1-2 负于葡萄牙、后 2-1 击败刚果（金），方向上印证两队差距（ESPN 2026-06-06 / 2026-06-09）。
4. **刚果（金）防守有组织**：对欧洲强队丹麦顶住 90 分钟拿到 0-0，平局路径并非空想（ESPN 2026-06-03）。
5. **大赛经验不对称**：刚果（金）52 年来首次参赛，首战大场面经验欠缺；但 Wan-Bissaka、Wissa 等英超球员提供了即战力（FIFA 2026-05-18）。
6. **场地中立**：休斯敦 NRG 体育场，双方均无主场加成（FIFA/OneFootball 赛程，2026-05）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无东道主加成；Ra=1989，Rb=1652）：
  葡萄牙 **70.97%** / 平 **18.83%** / 刚果（金）**10.20%**
- **调整（合计 ≤ ±8pp 上限内，实际 ±1pp）**：葡萄牙 −1pp → 平局 +1pp。
  理由：刚果（金）对丹麦的 0-0 显示其低位防守成型，且世界杯首轮普遍偏保守；其余证据（葡萄牙全主力、热身全胜、共同对手参照）均与 Elo 方向一致，不支持更大偏移。
- **p_final**：葡萄牙 **70.0%** / 平 **19.8%** / 刚果（金）**10.2%**
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，未参考任何此类信息。

## ⑥ 方法与来源

**方法**：以 eloratings.net 当日 Elo 为输入，用 Davidson 三路模型（与仓库 packages/sports-model/src/elo.ts 的 eloToOneXTwo 一致）得到统计基线；再用 3 次以内的公开新闻检索收集带日期的事实，做不超过 ±8pp 的有据调整；80% 区间反映 drawNu 0.6–0.8 的参数敏感性（葡胜 69.1%–72.9%）及证据稀薄度（刚果（金）无近期大赛样本），向外加宽。

**来源清单**
1. eloratings.net World.tsv（快照 2026-06-11）— https://www.eloratings.net/World.tsv
2. FIFA.com — Portugal squad announcement（2026-05-19）— https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/cristiano-ronaldo-roberto-martinez-portugal-squad-announcement
3. FIFA.com — Congo DR squad announcement（2026-05-18）— https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/congo-dr-squad-announcement-sebastien-desabre
4. ESPN — Congo DR 0-0 Denmark（2026-06-03）— https://www.espn.com/soccer/match/_/gameId/401871169/denmark-congo-dr
5. ESPN — Congo DR 1-2 Chile（2026-06-09）— https://www.espn.com/soccer/match/_/gameId/401871171/chile-congo-dr
6. ESPN — Portugal 2-1 Chile（2026-06-06）— https://www.espn.com/soccer/match/_/gameId/401862883/chile-portugal
7. ESPN — Portugal 2-1 Nigeria（2026-06-10）— https://www.espn.com/soccer/match/_/gameId/401867372/nigeria-portugal
8. OneFootball / Plataforma Media — 葡萄牙伤情综述（2026-03）— https://onefootball.com/en/news/97-days-to-world-cup-ronaldo-injury-worry-for-portugal-42515839

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
