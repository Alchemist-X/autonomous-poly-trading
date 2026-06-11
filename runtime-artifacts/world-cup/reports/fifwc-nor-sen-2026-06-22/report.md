# 挪威 vs 塞内加尔（2026 世界杯 I 组，第 41 场）市场盲测预测

- 比赛时间：2026-06-22 20:00 EST（UTC 2026-06-23T00:00:00Z）
- 地点：MetLife Stadium（赛期更名 New York New Jersey Stadium），美国新泽西州东卢瑟福 —— 对双方均为中立场
- 事件 slug（仅结算元数据）：`fifwc-nor-sen-2026-06-22`
- 生成时间：2026-06-11T13:15:00Z

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 挪威胜 | **41%** | 34% – 49% | 中 |
| 平局 | **26%** | 20% – 32% | 中 |
| 塞内加尔胜 | **33%** | 26% – 40% | 中 |

**一句话观点**：挪威凭 Elo 差距与哈兰德的火力小幅占优，但卫冕非洲杯冠军塞内加尔大赛经验明显更足，三路概率相当接近，挪威仅轻微领先。

## ② 赛果定义

预测对象为 90 分钟（含补时）的三路赛果：挪威胜 / 平局 / 塞内加尔胜。小组赛无加时与点球。

## ③ 实力画像

| | 挪威 | 塞内加尔 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1914（第 11） | 1860（第 21） |
| 近期状态 | 预选赛强势出线，哈兰德预选赛 16 球（为欧洲区第二名的两倍）；28 年来首进世界杯 | 2026 年 1 月非洲杯夺冠，Mané 当选赛事最佳球员；连续第三届世界杯 |
| 关键球员 | Haaland（曼城）、Ødegaard、Sørloth、Nusa | Mané（利雅得胜利）、E. Mendy、Koulibaly、Gana Gueye |

## ④ 关键因素

1. **Elo 差 54 分、排名 11 vs 21**，中立场下挪威为统计层面小热门（eloratings.net，2026-06-11）。
2. **挪威 5 月 21 日公布 26 人名单，哈兰德健康在列**，无重大伤停报道（olympics.com / fifa.com，2026-05-21）。
3. **塞内加尔是 2026 非洲杯冠军**，Mané（34 岁，末届世界杯）获非洲杯最佳球员，全队大赛经验丰富（aljazeera.com，2026-05-30）。
4. **塞内加尔同样无重大伤停报道**，Pape Thiaw 5 月 21 日公布初选名单，Mendy、Koulibaly、Gana Gueye 等老将齐整（beinsports.com / fifa.com，2026-05-21）。
5. **这是双方第二轮小组赛**：挪威 6 月 16 日先打伊拉克，塞内加尔首战法国；首轮结果可能改变本场的出线压力与轮换策略，目前未知（olympics.com，2026-05；goal.com，2026-06）。
6. **挪威 1998 年后首次参赛，全队几乎无世界杯经验**；塞内加尔过去三届中两次小组出线（olympics.com，2026-05；goal.com，2026-06）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，双方均非东道主、无主场加成）：
  挪威 42.9% / 平局 25.7% / 塞内加尔 31.4%
- **调整（合计约 2pp，远小于 ±8pp 上限）**：挪威 −1.9pp → 塞内加尔 +1.6pp、平局 +0.3pp。
  理由：塞内加尔为现任非洲杯冠军、大赛淘汰赛经验充足，而挪威阵中几乎无人有世界杯经验（来源见④第 3、6 条）；哈兰德的预选赛火力已体现在 Elo 中，不重复加分。双方均无伤停证据，故只做小幅调整。
- **p_final**：挪威 41% / 平局 26% / 塞内加尔 33%。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，未参考任何此类数据。

## ⑥ 方法

以 eloratings.net 的 Elo 分值为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致：scale=400，drawNu=0.7）得出统计基线；再依据带来源、带日期的公开事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 的参数敏感性（挪威 41.4%–44.5%、平局 22.9%–28.3%、塞内加尔 30.3%–32.6%）以及证据薄弱度（首轮结果与首发未知），故在敏感性带宽外进一步放宽。

### 来源清单

1. eloratings.net World.tsv（Elo 分值，抓取于 2026-06-11）— https://www.eloratings.net/World.tsv
2. olympics.com 挪威队世界杯前瞻与名单（2026-05）— https://www.olympics.com/en/news/fifa-world-cup-2026-norway-all-players-full-squad-list-key-stats-and-schedule
3. fifa.com 挪威公布名单（2026-05-21）— https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/norway-squad-announcement-stale-solbakken
4. aljazeera.com 塞内加尔世界杯前瞻（2026-05-30）— https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list
5. beinsports.com 塞内加尔名单（2026-05-21）— https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/pape-thiaw-s-official-senegal-squad-for-the-2026-fifa-world-cup-2026-05-21
6. fifa.com 塞内加尔公布名单（2026-05）— https://www.fifa.com/en/articles/senegal-world-cup-squad-announcement-pape-thiaw
7. goal.com 挪威 vs 塞内加尔场馆与赛程信息（2026-06）— https://www.goal.com/en/news/norway-vs-senegal-world-cup-tickets-how-to-buy/bltf217ffeab77fcc93

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
