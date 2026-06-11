# 伊拉克 vs 挪威 — 2026 世界杯小组赛 I 组（市场盲测预测）

- 比赛：2026-06-16 22:00 UTC，福克斯堡 Gillette Stadium（中立场地）
- 事件标识（仅作结算元数据）：`fifwc-irq-nor-2026-06-16`
- 生成时间：2026-06-11T13:15:00Z

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 伊拉克胜 | **13%** | 8% – 18% | 中 |
| 平局 | **21%** | 15% – 27% | 中 |
| 挪威胜 | **66%** | 57% – 74% | 中 |

**一句话观点：** 挪威凭借哈兰德领衔的攻击群与 307 分的 Elo 差距明显占优（约三分之二胜算），但伊拉克刚逼平西班牙，低位防守有搏平局的现实可能。

## ② 定义

90 分钟三路赛果（含补时，不含加时/点球）；世界杯小组赛无加时，平局即为最终结果。

## ③ 实力画像

| 项目 | 伊拉克 | 挪威 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1607（第 63） | 1914（第 11） |
| 主帅 | Graham Arnold（FIFA 官网） | Ståle Solbakken（FIFA 官网） |
| 近期热身 | 1-1 西班牙（6/4）、0-2 委内瑞拉（6/10） | 3-1 瑞典（6/1）、1-1 摩洛哥（6/7） |
| 背景 | 通过附加赛晋级，时隔多年再进正赛 | 1998 年后首次晋级，预选赛哈兰德 16 球 |

## ④ 关键因素

1. **Elo 差距 307 分**：挪威 1914 vs 伊拉克 1607，模型基线即给挪威约 68.5% 胜算（eloratings.net，2026-06-11）。
2. **哈兰德状态极佳**：欧洲区预选赛 16 球（断层第一），46 场打进 50 个国家队进球，史上最快（Al Jazeera，2026-05-26）。
3. **伊拉克逼平西班牙**：6 月 4 日拉科鲁尼亚 1-1 战平 Elo 第 1 的西班牙，显示 Arnold 的低位防守体系有效（ESPN，2026-06-04）。
4. **伊拉克末战告负但无伤**：6 月 10 日 0-2 负委内瑞拉，但全队零伤病、无停赛（Iraqi News，2026-06-10）。
5. **厄德高赛季伤病缠身**：本季至少 5 次受伤、缺席 3 月友谊赛，但 6 月 7 日对摩洛哥已出场（Olympics.com；ESPN，2026-06-07）。
6. **中立场地**：福克斯堡，无任何一方东道主加成（FIFA 赛程）。

## ⑤ 模型与调整

- **p_stat（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主场加成）：**
  伊拉克 11.7% / 平局 19.8% / 挪威 68.5%
- **调整（合计 2.5pp，上限 ±8pp）：** 伊拉克 +1.3pp、平局 +1.2pp、挪威 −2.5pp。
  理由：伊拉克逼平西班牙显示低位防守成色（因素 3），挪威热身被摩洛哥逼平、厄德高整季伤病存在状态疑问（因素 5）；但挪威预选赛统治力已体现在 Elo 中，且伊拉克末战告负，故仅作小幅修正。
- **p_final：** 伊拉克 13% / 平局 21% / 挪威 66%。
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，概率仅来自 Elo 统计模型加有据可依的有限调整。

## ⑥ 方法

以 eloratings.net 的 Elo 分值为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致：scale=400，drawNu=0.7）得到统计基线；再依据带来源、带日期的公开事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映参数敏感性（drawNu 0.6–0.8 下挪威胜 66.6%–70.5%、平局 17.5%–22.0%）与证据稀薄度（双方均长期缺席世界杯、揭幕战样本不确定性较高），故在参数带之外进一步加宽。

### 来源清单

1. eloratings.net World.tsv（2026-06-11 抓取，本地 `elo-table.json`）
2. ESPN：Spain 1-1 Iraq（2026-06-04）— https://www.espn.com/soccer/match/_/gameId/401871471/iraq-spain
3. Iraqi News：伊拉克 0-2 委内瑞拉、零伤病（2026-06-10）— https://www.iraqinews.com/sports/iraq-venezuela-friendly-result-graham-arnold-world-cup-2026/
4. Al Jazeera：挪威世界杯前瞻（2026-05-26）— https://www.aljazeera.com/sports/2026/5/26/norway-world-cup-2026-preview-players-to-watch-group-matches-squad-list
5. ESPN：Norway 3-1 Sweden（2026-06-01）— https://www.espn.com/soccer/match/_/gameId/401864055/sweden-norway
6. ESPN：Morocco 1-1 Norway（2026-06-07）— https://www.espn.com/soccer/match/_/gameId/401866598/norway-morocco
7. Olympics.com：挪威全名单与厄德高伤情背景 — https://www.olympics.com/en/news/fifa-world-cup-2026-norway-all-players-full-squad-list-key-stats-and-schedule
8. FIFA：伊拉克初选名单（Graham Arnold）— https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/iraq-preliminary-squad-announcement-graham-arnold

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
