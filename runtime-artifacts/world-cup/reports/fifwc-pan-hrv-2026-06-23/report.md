# 巴拿马 vs 克罗地亚 — 2026 世界杯 L 组（市场盲测预测）

- **比赛**：2026-06-23 23:00 UTC（多伦多 BMO Field，东部时间 19:00）
- **事件标识**（仅作结算元数据）：`fifwc-pan-hrv-2026-06-23`
- **生成时间**：2026-06-11 · 预测性质：**市场盲测**（完全独立于任何盘口/赔率数据）

## ① 预测结论

| 赛果 | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 巴拿马胜 | **21.5%** | 15% – 28% | 中 |
| 平局 | **24.0%** | 19% – 29% | 中 |
| 克罗地亚胜 | **54.5%** | 46% – 63% | 中 |

**一句话观点**：克罗地亚凭 182 分 Elo 优势与完整主力阵容明显占优，但巴拿马近两年大赛战绩扎实、又坐拥北美准主场氛围，爆冷概率不可忽视。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负）；世界杯小组赛无加时与点球，补时计入 90 分钟赛果。

## ③ 实力画像

| 队伍 | Elo | Elo 排名 | 近况摘要 |
| --- | --- | --- | --- |
| 巴拿马 | 1730 | 38 | 2025 中北美国联决赛队伍；最近一战 2-1 胜南非（MLSSoccer L 组前瞻，2026-06） |
| 克罗地亚 | 1912 | 12 | 近 5 场 3 胜，含 3 月对哥伦比亚取得积极结果（MLSSoccer L 组前瞻，2026-06） |

Elo 来源：eloratings.net（2026-06-11 抓取）。克罗地亚拥有 2018 亚军、2022 季军的大赛底蕴；巴拿马为第二次参加世界杯。两队此前从未在成年国家队层面交手（首次对话）。

## ④ 关键因素

1. **Elo 差距 182 分**：1912 vs 1730，统计模型给出克罗地亚约 57% 胜率基线（eloratings.net，2026-06-11）。
2. **莫德里奇伤愈出战第五届世界杯**：40 岁队长上月颧骨骨折，预计赶上 6 月 17 日首战英格兰，状态存在小幅不确定性（ESPN，2026-06）。
3. **格瓦迪奥尔已复出**：1 月右胫骨骨折后于 5 月 14 日代表曼城复出，克罗地亚防线核心齐整（ESPN，2026-05-14）。
4. **巴拿马核心卡拉斯基亚带伤疑问**：进攻发动机 Carrasquilla 在 5 月底名单公布前的墨西哥联赛决赛中腹股沟受伤（Olympics.com，2026-05-26）。
5. **巴拿马"准主场"与赛程便利**：第 1、2 轮均在多伦多（6/18 对加纳、6/23 对克罗地亚），无需跨城奔波，CONCACAF 球队在北美氛围占优（FIFA 赛程 / MLSSoccer 前瞻，2026-06）。
6. **巴拿马上行轨迹**：2023 金杯亚军、2025 国联决赛，较 2018 首秀显著升级（FIFA 队史档案，2026）。

## ⑤ 模型与调整

- **p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，中立场无东道主加成）：巴拿马 19.9% / 平局 23.5% / 克罗地亚 56.7%
- **调整**（合计约 2.2pp 自克罗地亚移向巴拿马与平局，远小于 ±8pp 上限）：
  - 巴拿马 +1.6pp：近期状态佳 + 多伦多准主场与同城连战便利（因素 5、6）
  - 平局 +0.5pp：克罗地亚核心高龄、莫德里奇刚伤愈，且两队首次交手信息少（因素 2）
  - 克罗地亚 -2.1pp；Gvardiol 复出与阵容厚度（因素 3）限制下调幅度
  - 巴拿马 Carrasquilla 伤情（因素 4）与上调部分对冲，故净调整保持小幅
- **p_final**：巴拿马 21.5% / 平局 24.0% / 克罗地亚 54.5%
- 本预测为**市场盲测**：全程未读取、未引用任何博彩赔率或预测市场价格，概率仅来自 Elo 统计模型 + 有界证据调整。

## ⑥ 方法、来源与免责声明

**方法**：以 eloratings.net 世界 Elo 为输入，用 Davidson 三路模型（与仓库 `packages/sports-model/src/elo.ts` 一致，scale=400，drawNu=0.7）得 p_stat；再依据带来源日期的公开事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映 drawNu 0.6–0.8 敏感性、Elo ±25 不确定性与证据稀薄度。

**来源清单**：
1. eloratings.net World.tsv（2026-06-11 抓取）：https://www.eloratings.net/World.tsv
2. ESPN — Modrić 第五次世界杯、伤情与 Gvardiol 复出（2026-06）：https://www.espn.com/soccer/story/_/id/48807700/luka-modric-set-5th-world-cup-part-croatia-squad
3. Olympics.com — 巴拿马 26 人名单与 Carrasquilla 伤情（2026-05-26）：https://www.olympics.com/en/news/fifa-world-cup-2026-panama-all-players-full-squad-list-key-stats-and-schedule
4. FIFA.com — 巴拿马名单官宣（2026-05-26）：https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/panama-squad-announcement-thomas-christiansen
5. MLSSoccer.com — L 组前瞻（近期战绩、首次交手、赛程）：https://www.mlssoccer.com/competitions/fifa-world-cup/news/2026-fifa-world-cup-group-l-preview-england-croatia-ghana-panama
6. Olympics.com — 克罗地亚名单与队报（2026-06）：https://www.olympics.com/en/news/fifa-world-cup-2026-croatia-players-squad-list-key-stats-schedule

> 本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
