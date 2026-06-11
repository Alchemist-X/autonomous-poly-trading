# 日本 vs 瑞典 — 2026 世界杯小组赛 F 组（市场盲测预测）

- 生成时间：2026-06-11T13:15:00Z ｜ 开球：2026-06-25T23:00:00Z（美国得州阿灵顿）
- 事件 slug（仅作结算元数据）：`fifwc-jpn-swe-2026-06-25`

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 日本胜 | **0.55** | 0.49 – 0.62 | 中 |
| 平局 | **0.24** | 0.20 – 0.28 | 中 |
| 瑞典胜 | **0.21** | 0.16 – 0.26 | 中 |

**一句话观点**：Elo 差近 200 分加上日本不败势头，日本明显占优；但三笘薫/南野拓実缺阵、瑞典 Gyökeres+Isak 锋线火力高于其 Elo 排名，瑞典爆冷概率不可忽视。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负），小组赛无加时、无点球大战。

## ③ 实力画像

| 项目 | 日本 | 瑞典 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 抓取） | 1906（第 14） | 1712（第 43） |
| 主帅 | 森保一 | Graham Potter |
| 近期状态 | 自 2025 年 9 月起不败，含胜巴西、1-0 胜苏格兰、温布利 1-0 胜英格兰（Daily Maverick，2026-06-08） | 附加赛 88 分钟绝杀波兰晋级，2018 年后首次参赛（BigDSoccer，2026 年 5 月） |
| 本场性质 | 小组第 3 轮；此前两轮分别对阵荷兰/突尼斯，出线形势届时才明朗 | 同左 |

## ④ 关键因素

1. **日本攻击线减员**：三笘薫（腘绳肌伤）落选最终名单，南野拓実（去年 12 月 ACL 撕裂）同样缺席（Al Jazeera，2026-05-15）。
2. **久保建英健康在阵**：1 月腘绳肌伤已恢复，国王杯夺冠赛季状态好；富安健斗时隔近两年回归 26 人名单（Al Jazeera，2026-05-22）。
3. **瑞典双枪压阵**：Gyökeres 随阿森纳英超夺冠、全队最佳射手（各项赛事 19 球）；Isak 入选但赛季伤病多、联赛仅 8 次首发（Free Malaysia Today，2026-05-14；Tribuna，2026-05-12）。
4. **瑞典减员**：Kulusevski 落选 26 人名单（Tribuna，2026-05-12）。
5. **地利大致对冲，按中立场处理**：比赛在阿灵顿（达拉斯地区），日本第 1 轮亦在达拉斯打荷兰，瑞典大本营在得州 Frisco——双方都熟悉当地条件（Al Jazeera，2026-05-22；FMT，2026-05-14）。
6. **第 3 轮变数**：6 月 14/20 两轮结果未知，届时双方动机（已出线轮换 vs 必须抢分）可能显著改变比赛强度——这是本预测最大的不可建模不确定性。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无主办国加成；日本 1906 vs 瑞典 1712）：
  日本胜 0.579 ／ 平 0.232 ／ 瑞典胜 0.190
- **有界调整（净移出日本 -3pp，平 +1pp，瑞典 +2pp，合计在 ±8pp 上限内）**：
  - 日本失去三笘+南野两大攻击点（因素 1），削弱破密集防守能力 → 日本 -3pp；
  - 瑞典 Gyökeres/Isak 的锋线天赋高于其 Elo 第 43 位（瑞典缺席两届大赛，Elo 反映偏旧阵容）→ 瑞典 +2pp、平 +1pp；
  - 日本的不败势头已体现在 Elo 1906 内，不再重复加分。
- **p_final（归一化后）**：日本 0.55 ／ 平 0.24 ／ 瑞典 0.21
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场价格，未参考任何此类数据。

## ⑥ 方法与来源

方法：以 eloratings.net 当日 Elo 为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 的 eloToOneXTwo 一致）得出统计基线；再依据有日期、有出处的新闻事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 的参数敏感性（日本胜 0.560–0.599）叠加证据稀薄度（第 3 轮动机未知、距开赛尚有两周）。

来源清单：
1. eloratings.net World.tsv（2026-06-11 抓取，本仓库 elo-table.json）
2. Al Jazeera，2026-05-15 — 三笘落选/南野 ACL：https://www.aljazeera.com/sports/2026/5/15/mitoma-fails-to-make-japans-2026-world-cup-squad-due-to-hamstring-injury
3. Al Jazeera，2026-05-22 — 日本队预览/赛程/富安回归：https://www.aljazeera.com/sports/2026/5/22/japans-world-cup-2026-team-preview-players-to-watch-group-squad
4. Free Malaysia Today，2026-05-14 — 瑞典名单/Isak 联赛仅 8 次首发/Frisco 大本营：https://www.freemalaysiatoday.com/category/sports/2026/05/14/isak-and-gyokeres-make-swedens-world-cup-roster
5. Tribuna，2026-05-12 — Kulusevski 落选：https://tribuna.com/en/news/2026-05-12-alexander-isak-viktor-gyokeres-named-in-sweden-squad-for-world-cup-dejan-kulusevski-out/
6. Daily Maverick，2026-06-08 — 日本不败战绩（胜巴西/苏格兰/英格兰）：https://www.dailymaverick.co.za/article/2026-06-08-japan-favourites-in-tough-group-f-with-holland-sweden-and-tunisia/
7. BigDSoccer，2026 年 5 月 — Gyökeres 附加赛绝杀波兰/英超夺冠最佳射手：https://www.bigdsoccer.com/sweden-2026-world-cup-preview/

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
