# 佛得角 vs 沙特阿拉伯 — 2026 世界杯小组赛 H 组（市场盲测预测）

- **比赛**：2026 FIFA 世界杯小组赛第 65 场，H 组第三轮
- **开球时间**：2026-06-27T00:00:00Z（休斯敦当地 6 月 26 日 19:00）
- **场地**：NRG 体育场，休斯敦（中立场地，可闭合屋顶）
- **生成时间**：2026-06-11 · 事件标识（仅作结算元数据）：`fifwc-cvi-ksa-2026-06-26`

## ① 预测结论

| 结果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 佛得角胜 | **36.2%** | 31% – 42% | 低 |
| 平局 | **25.9%** | 21% – 31% | 低 |
| 沙特阿拉伯胜 | **37.9%** | 32% – 44% | 低 |

**一句话观点**：Elo 仅差 2 分（1578 vs 1576）的真五五开对决——沙特凭三届世界杯经验略占上风，佛得角首秀且主力阵容老化，平局概率同样不容忽视。

## ② 定义

预测对象为 90 分钟（含补时）三路赛果：佛得角胜 / 平局 / 沙特胜。小组赛无加时无点球。

## ③ 实力画像

| 指标 | 佛得角 | 沙特阿拉伯 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1578（第 68） | 1576（第 69） |
| 世界杯经历 | 历史首次参赛 | 连续第三届（2022 曾胜阿根廷的核心仍在） |
| 主帅 | Bubista（长期执教，稳定） | Georgios Donis（4 月中旬刚接手，仅率队打了 3 场：1 胜 1 平 1 负） |

来源：eloratings.net（经本仓库 `elo-table.json`，2026-06-11）；FourFourTwo / Al Arabiya（2026-05-25）；FIFA.com（2026-05-18）。

## ④ 关键因素

1. **Elo 几乎完全持平**：1578 vs 1576，排名 68 vs 69，纯模型上接近抛硬币。（eloratings.net，2026-06-11）
2. **沙特临阵换帅**：4 月 17 日解雇雷纳尔，希腊教头 Donis 开赛前数周才接手，仅执教 3 场（1W1D1L），磨合风险真实存在。（Al Arabiya / FourFourTwo，2026-05-25）
3. **佛得角主力脊柱老化**：Vozinha（40）、Stopira（38）、Ryan Mendes（36）、Rodrigues（35），高强度赛会制第三战体能存疑；后卫 Logan Costa 5 月 17 日才从十字韧带重伤复出。（Olympics.com / FIFA.com，2026-05-18 起）
4. **沙特经验与核心延续**：队长 Al-Dawsari（108 次出场）领衔，Al-Buraikan 预选赛进球主力，2022 击败阿根廷的班底大部保留。（Al Arabiya，2026-05-25）
5. **第三轮利害关系**：H 组另两队为西班牙与乌拉圭，本场很可能直接决定两队的出线/第三名晋级资格，双方求胜动机大体对称。（Squawka / ESPN，2026 年 5-6 月）
6. **场地中立、室内恒温**：NRG 体育场可闭合屋顶，6 月底休斯敦高温对两队影响中性。（NRG Park 赛事页，2026-06）

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主场加成）：
  佛得角 37.25% / 平局 25.93% / 沙特 36.82%
- **证据调整（合计 ≤ ±8pp 上限内，实际仅 1pp）**：沙特的世界杯赛会经验 + 佛得角首秀且脊柱老化（因素 3、4）→ 佛得角 −1pp、沙特 +1pp；沙特临阵换帅（因素 2）为反向证据，限制了调整幅度。证据总体偏薄且相互抵消，故只做最小幅度修正。
- **p_final**：佛得角 36.2% / 平局 25.9% / 沙特 37.9%（已归一化）。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，仅基于统计模型与公开新闻证据。

## ⑥ 方法、来源与免责声明

**方法**：以 eloratings.net 世界 Elo 为输入，用 Davidson 三路模型（drawNu=0.7）生成统计基线；再依据带日期与来源的公开事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映参数敏感性（drawNu 0.6–0.8 使平局基线在 23.1%–28.6% 间波动）与证据稀薄度。

**来源清单**：

1. eloratings.net World.tsv（经 `runtime-artifacts/world-cup/elo-table.json`，抓取于 2026-06-11）
2. FIFA.com — Cabo Verde squad announcement（2026-05-18）：https://www.fifa.com/en/tournaments/mens/worldcup/articles/cabo-verde-squad-announcement-world-cup-bubista
3. Olympics.com — Cabo Verde at FIFA World Cup 2026：https://www.olympics.com/en/news/fifa-world-cup-2026-cabo-verde-all-players-full-squad-list-key-stats-schedule
4. Al Arabiya — Saudi Arabia's FIFA World Cup 2026 squad（2026-05-25）：https://english.alarabiya.net/amp/sports/2026/05/25/saudi-arabia-s-fifa-world-cup-2026-squad-who-s-in-and-who-s-out
5. FourFourTwo — Saudi Arabia World Cup 2026 squad：https://www.fourfourtwo.com/team/saudi-arabia-world-cup-2026-squad
6. Squawka — Saudi Arabia World Cup 2026 fixtures & analysis：https://www.squawka.com/en/news/world-cup/saudi-arabia-world-cup-2026-fixtures-squad-analysis/
7. NRG Park — 赛事页（场地确认）：https://www.nrgpark.com/event/cabo-verde-vs-saudi-arabia/

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
