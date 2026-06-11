# 世界杯小组赛预测：土耳其 vs 巴拉圭（D 组）

- **比赛**：2026-06-19（当地）/ 开球 2026-06-20 03:00 UTC，旧金山湾区（圣克拉拉）
- **事件标识**（仅结算元数据）：`fifwc-tur-par-2026-06-19`
- **生成时间**：2026-06-11T13:15:00Z　**预测类型**：市场盲测（不参考任何盘口/赔率）

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 土耳其胜 | **45%** | 40% – 50% | 中 |
| 平局 | **26%** | 21% – 31% | 中 |
| 巴拉圭胜 | **29%** | 24% – 34% | 中 |

**一句话观点**：土耳其凭 Elo 优势与锋线状态略占上风，但巴拉圭防线老练扎实，平局与冷门空间不小。

## ② 定义

90 分钟法定时间三路赛果（含伤停补时）；小组赛无加时、无点球大战。中立场地（美国为东道主，但两队均非东道主，无主场加成）。

## ③ 实力画像

| 项目 | 土耳其 | 巴拉圭 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1911（第 13） | 1834（第 22） |
| 主帅 | Vincenzo Montella | Gustavo Alfaro |
| 核心 | Çalhanoğlu、Arda Güler、Kenan Yıldız | Almirón、Enciso、Gómez、Alderete |
| 背景 | 时隔 24 年重返世界杯 | 2010 年后首次参赛（16 年） |

土耳其热身赛 2-1 击败委内瑞拉（2026-06-06，迈阿密），Yılmaz、Akgün 进球、Güler 助攻（ESPN）。巴拉圭 6 月 1 日公布 26 人名单，仅 3 名本土联赛球员，防线以 Gómez（帕尔梅拉斯）、Alderete（桑德兰）为核心（FIFA.com / beIN）。

## ④ 关键因素

1. **Elo 差 77 分、中立场**：土耳其 1911 vs 巴拉圭 1834，构成温和优势而非压倒优势（eloratings.net，2026-06-11）。
2. **土耳其锋线状态**：Yıldız 本赛季俱乐部+国家队 14 球，Güler 串联出色；热身赛 2-1 胜委内瑞拉（ESPN，2026-06-06；Squawka/DAZN，2026-06）。
3. **巴拉圭防守骨架完整**：Alfaro 体系依赖 Gómez、Alderete 的老练防线，风格偏紧凑低失误（FIFA.com，2026-06-01）。
4. **双方均无重大伤停报告**：截至 2026-06-11，两队 26 人名单完整公布，未检索到关键球员伤缺消息（Daily Sabah 2026-06-02；FIFA.com 2026-06-01）。
5. **赛程语境**：这是双方第二轮小组赛（巴拉圭 6-12 先打美国、土耳其 6-14 先打澳大利亚），届时积分形势可能改变求胜欲，目前无法预知（DAZN 组别指南）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无加成）：土耳其 45.4% / 平 25.5% / 巴拉圭 29.1%。
- **调整 delta**：合计约 ±1pp（远低于 ±8pp 上限）。理由：土耳其进攻端状态利好与巴拉圭防线稳固大体相互抵消；双方均无伤停；两队首战均未踢，证据偏薄，故仅做四舍五入级微调。
- **p_final**：45% / 26% / 29%。
- **本预测为市场盲测**：完全独立于任何博彩盘口、预测市场价格或隐含概率，数字仅来自 Elo 统计模型 + 有限的证据化调整。

## ⑥ 方法、来源与免责声明

**方法**：以 eloratings.net 当日 Elo 为输入，Davidson 三路模型（pA=πA/D，pDraw=0.7·√(πA·πB)/D，π=10^(R/400)）产出基准概率；再以带来源的事实做不超过 ±8pp 的有界调整。80% 区间反映 drawNu 0.6–0.8 的参数敏感性（土耳其胜 43.8–47.1%、平 22.7–28.1%、巴拉圭胜 28.1–30.2%）外加证据稀薄度的额外放宽。

**来源**：
1. eloratings.net World.tsv（抓取 2026-06-11）— https://www.eloratings.net/
2. ESPN：Venezuela 1-2 Türkiye（2026-06-06）— https://www.espn.com/soccer/match/_/gameId/401871361/turkiye-venezuela
3. Daily Sabah：土耳其 26 人名单（2026-06-02）— https://www.dailysabah.com/sports/football/turkiye-unveil-26-player-squad-for-historic-2026-world-cup-return
4. UEFA.com：Türkiye at the World Cup 2026 — https://www.uefa.com/european-qualifiers/news/02a6-20d15969649d-c1471bfa3c52-1000--turkiye-at-the-world-cup-2026-squad-fixtures-group-and-hi/
5. FIFA.com：巴拉圭名单公布（2026-06-01）— https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/paraguay-squad-announcement-gustavo-alfaro
6. beIN SPORTS：巴拉圭 26 人名单（2026-06-01）— https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/gustavo-alfaro-and-paraguay-squad-for-the-fifa-world-cup-2026-2026-06-01
7. DAZN：Group D 指南（2026-06）— https://www.dazn.com/en-US/news/soccer/fifa-world-cup-26-group-d-usa-usmnt-paraguay-australia-turkey/xucnh2uim7z91nqmddlsd3eby

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
