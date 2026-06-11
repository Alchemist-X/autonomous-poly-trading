# 乌拉圭 vs 佛得角（2026 世界杯小组赛 H 组）市场盲测预测

- **赛事**：2026 FIFA 世界杯小组赛 H 组，第 37 场
- **开球**：2026-06-21T22:00:00Z（迈阿密当地时间 6 月 21 日 18:00）
- **场地**：硬石体育场（Hard Rock Stadium），美国迈阿密花园 —— 中立场地，双方均无东道主加成
- **生成时间**：2026-06-11（市场盲测：本预测完全独立于任何盘口/赔率数据）

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 乌拉圭胜 | **68%** | 62% – 74% | 中 |
| 平局 | **20%** | 16% – 24% | 中 |
| 佛得角胜 | **12%** | 8% – 17% | 中 |

**一句话观点**：乌拉圭实力、经验与阵容厚度全面占优，常规时间取胜约 68%；但佛得角是组织性很强的世界杯新军，平局与冷门合计仍有约三分之一概率，不宜视为"必然剧本"。

## ② 定义

预测对象为 90 分钟常规时间三路赛果（胜/平/负）。世界杯小组赛无加时与点球，常规时间结束即按当时比分判定。

## ③ 实力画像

| 指标 | 乌拉圭 | 佛得角 |
| --- | --- | --- |
| Elo 评分 | 1892（第 16） | 1578（第 68） |
| Elo 差距 | +314 | — |
| 大赛履历 | 两届世界杯冠军，常客 | 史上首次参加世界杯 |
| 核心球员 | Valverde（皇马）、Araújo（巴萨）、Ugarte（曼联） | 以欧洲二线联赛球员为骨干 |

Elo 来源：eloratings.net（抓取于 2026-06-11，本仓库 `elo-table.json`）。

## ④ 关键因素

1. **Elo 差距 314 分**，统计模型给出乌拉圭约 69% 基准胜率（eloratings.net，2026-06-11）。
2. **乌拉圭主力齐整**：Bielsa 公布 26 人名单，Valverde、Araújo、Ugarte 领衔，Suárez 落选（SI / Republic World，2026-05-31）。
3. **Bentancur 伤情存疑**：托特纳姆中场因严重腿筋伤势自 1 月起缺阵，赶上世界杯仍是未知数（FourFourTwo / Fantasy Football Scout，2026-06-09）。
4. **佛得角为世界杯新军**：Bubista 公布历史首份世界杯名单，大赛经验空白但士气高昂（FIFA.com，约 2026-06-06）。
5. **场地与气候**：迈阿密 6 月湿热，硬石体育场顶棚只遮看台、球场露天；佛得角球员对炎热气候适应性不差，气候不构成乌拉圭的额外优势（miamiandbeaches.com 赛事页，2026-06）。
6. **赛程背景**：这是双方小组赛第二轮——佛得角首战西班牙（6-15），乌拉圭首战沙特（6-16），本场对两队都接近"必须拿分"的中等偏高利害（FOX Sports 赛程页，2026-06）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场地无主场加成）：
  乌拉圭 69.1% / 平局 19.6% / 佛得角 11.3%
- **调整 delta（合计约 -1.1pp，远小于 ±8pp 上限）**：
  - 乌拉圭 -1.1pp：Bentancur 伤情不确定（已引用）；佛得角防守组织性强、新军无包袱，且迈阿密湿热环境不放大实力差。
  - 平局 +0.4pp、佛得角 +0.7pp。
  - 证据总体偏薄（佛得角伤停细节缺失），故只做小幅调整。
- **p_final（归一化后）**：乌拉圭 68% / 平局 20% / 佛得角 12%
- **市场盲测声明**：本预测不参考任何博彩/预测市场价格或赔率，概率仅来自 Elo 统计模型 + 有据可查的小幅证据调整。

## ⑥ 方法、来源与免责声明

**方法**：以 eloratings.net 的 Elo 评分为输入，用 Davidson 三路模型（pA=piA/(piA+piB+0.7*sqrt(piA*piB))，piX=10^(R/400)）得到基准概率；再依据有日期、有来源的球队新闻做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 的参数敏感性（胜率 67.2%–71.1%）及证据稀薄度。

**来源清单**：
1. eloratings.net World.tsv（2026-06-11 抓取）
2. https://www.si.com/soccer/uruguay-2026-world-cup-roster-confirmed-full-list-players （2026-05-31）
3. https://www.republicworld.com/sports/football/fede-valverde-darwin-nunez-named-as-uruguay-announce-fifa-world-cup-2026-squad-luis-suarez-omitted-2026-05-31-126392 （2026-05-31）
4. https://www.fantasyfootballscout.co.uk/2026/06/09/fantasy-fifa-world-cup-2026-team-previews-uruguay （2026-06-09）
5. https://www.fifa.com/en/tournaments/mens/worldcup/articles/cabo-verde-squad-announcement-world-cup-bubista （约 2026-06-06）
6. https://www.miamiandbeaches.com/event/fifa-world-cup-26-uruguay-vs-cabo-verde/30447 （2026-06 查阅）
7. https://www.foxsports.com/stories/soccer/cape-verde-world-cup-2026-schedule-locations-dates-times （2026-06 查阅）

**免责声明**：本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
