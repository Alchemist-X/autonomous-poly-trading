# 法国 vs 塞内加尔 — 2026 世界杯小组赛 I 组（市场盲测预测）

- 比赛时间：2026-06-16 19:00 UTC（美东 15:00）
- 场地：MetLife Stadium，东卢瑟福（新泽西，中性场地，无主办国加成）
- 事件 slug（仅作结算元数据）：`fifwc-fra-sen-2026-06-16`
- 报告生成：2026-06-11 · 置信档：**中**

## ① 预测结论

| 赛果 | p_final | 80% 区间 |
| --- | --- | --- |
| 法国胜 | **0.57** | 0.51 – 0.63 |
| 平局 | **0.24** | 0.19 – 0.28 |
| 塞内加尔胜 | **0.19** | 0.15 – 0.24 |

**一句话观点**：法国凭约 200 分的 Elo 优势明显占优，但塞内加尔是非洲杯刚出炉的亚军、阵容齐整状态正盛，逼平与爆冷的合计概率超过四成，不容轻视。

## ② 预测定义

90 分钟法定时间三路赛果（含补时、不含加时/点球）；2026 世界杯小组赛无加时。

## ③ 实力画像

| 项目 | 法国 | 塞内加尔 |
| --- | --- | --- |
| Elo（eloratings.net，2026-06-11 拉取） | 2063（第 3） | 1860（第 21） |
| 大赛背景 | 2018 冠军、2022 亚军，连续第 8 次晋级决赛圈 | 连续第 3 次晋级；2026 非洲杯亚军 |
| 核心 | 姆巴佩、登贝莱（金球奖得主）、杜埃、奥利塞 | 马内、库利巴利、尼古拉斯·杰克逊（拜仁） |

## ④ 关键因素

1. **法国大名单近乎全主力**：姆巴佩虽整个赛季多次受伤病困扰，但伤愈入选；卡马文加、科洛·穆阿尼落选属轮换深度损失，影响有限。（ESPN，2026-06；CBC，2026-06）
2. **塞内加尔状态正盛**：2026 年 1 月非洲杯打进决赛获亚军，34 岁的马内当选赛事最佳球员，领导力与状态俱在。（Al Jazeera，2026-05-30）
3. **塞内加尔阵容齐整且有经验**：5 月 21 日公布 28 人初选名单，马内、库利巴利领衔，多人国家队出场过百；锋线由拜仁前锋杰克逊带队。（Al Jazeera，2026-05-21；MLSSoccer I 组前瞻，2026-06）
4. **中性场地**：MetLife 球场不属于任何一队主场，模型不加主办国加成；两队在北美都有可观侨民球迷，氛围影响视为中性。（metlifestadium.com 赛事页，2026-06）
5. **历史注脚**：2002 年世界杯揭幕战塞内加尔 1-0 爆冷击败卫冕冠军法国——仅作背景，不直接进入概率调整。（Wikipedia: 2026 FIFA World Cup Group I）

## ⑤ 模型与调整

- **统计基线 p_stat**（Davidson 三路模型，scale=400，drawNu=0.7，无主办国加成）：
  法国 0.588 / 平局 0.229 / 塞内加尔 0.183
- **证据调整 delta**（上限 ±8pp，本次合计 ±2pp）：
  法国 −2pp，平局 +1pp，塞内加尔 +1pp。理由：姆巴佩赛季内反复伤停带来的状态不确定性（因素 1），叠加塞内加尔非洲杯亚军级状态与阵容完整度（因素 2、3）；证据总体偏薄，故只做小幅调整。
- **p_final**：法国 0.57 / 平局 0.24 / 塞内加尔 0.19
- **本预测为市场盲测**：完全独立于任何盘口、赔率或预测市场报价，概率仅来自 Elo 统计模型加上述有据可依的小幅调整。

## ⑥ 方法说明

以 eloratings.net 世界 Elo（2026-06-11 快照）为输入，用 Davidson 三路模型（drawNu=0.7）换算 90 分钟胜平负基线概率；再依据带来源、带日期的公开事实做不超过 ±8pp 的有界调整并归一化。80% 区间反映参数敏感性（drawNu 在 0.6–0.8 间扫描使法国胜率基线在 0.57–0.61 间波动）与赛前证据偏薄（首发、临场伤情未定）的额外不确定性。

### 来源清单

1. eloratings.net（World.tsv，2026-06-11 拉取，本仓库 `elo-table.json`）
2. ESPN — France 2026 World Cup squad（2026-06）：https://www.espn.com/soccer/story/_/id/48771039/france-2026-world-cup-squad-mbappe-camavinga-kolo-muani-dembele
3. CBC Sports — 世界杯伤情（2026-06）：https://www.cbc.ca/sports/soccer/worldcup/injuries-2026-fifa-world-cup-messi-mbappe-yamal-davies-9.7221543
4. Al Jazeera — 塞内加尔初选名单（2026-05-21）：https://www.aljazeera.com/sports/2026/5/21/sadio-mane-kalidou-koulibaly-star-picks-in-senegals-world-cup-squad
5. Al Jazeera — 塞内加尔球队前瞻（2026-05-30）：https://www.aljazeera.com/sports/2026/5/30/senegals-world-cup-2026-team-preview-players-to-watch-group-squad-list
6. Al Jazeera — 法国球队前瞻（2026-06-02）：https://www.aljazeera.com/sports/2026/6/2/france-world-cup-2026-preview-players-to-watch-group-matches-and-squad
7. MLSSoccer — I 组前瞻（2026-06）：https://www.mlssoccer.com/competitions/fifa-world-cup/news/2026-fifa-world-cup-group-i-preview-france-senegal-iraq-norway
8. MetLife Stadium 官方赛事页（2026-06）：https://www.metlifestadium.com/events/detail/fifa-world-cup-2026-france-vs-senegal

### 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
