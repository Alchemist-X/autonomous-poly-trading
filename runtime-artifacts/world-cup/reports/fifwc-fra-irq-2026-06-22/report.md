# 法国 vs 伊拉克（2026 世界杯小组赛 I 组）市场盲测预测

- **赛事**：2026 FIFA 世界杯小组赛 I 组第 42 场，法国 vs 伊拉克
- **开球**：2026-06-22 21:00 UTC（费城当地 17:00），费城林肯金融球场（中立场地）
- **生成时间**：2026-06-11 · **预测类型**：市场盲测（完全独立于任何盘口/赔率）

## ① 预测结论

| 赛果（90 分钟） | p_final | 80% 区间 | 置信档 |
| --- | --- | --- | --- |
| 法国胜 | **77.5%** | 71% – 83% | 中 |
| 平局 | **16.0%** | 11% – 21% | 中 |
| 伊拉克胜 | **6.5%** | 4% – 10% | 中 |

**一句话观点**：Elo 差距高达 456 分、法国近乎全主力，法国大概率取胜；伊拉克 40 年后重返世界杯且主帅阿诺德擅长防守组织，给平局留出小幅空间。

## ② 定义

预测对象为 90 分钟三路赛果（胜/平/负）。小组赛无加时、无点球大战，常规时间结束即定胜平负。

## ③ 实力画像

| 项目 | 法国 | 伊拉克 |
| --- | --- | --- |
| Elo 评分 | 2063（世界第 3） | 1607（世界第 63） |
| 数据来源 | eloratings.net 快照 2026-06-11（runtime-artifacts/world-cup/elo-table.json，源 https://www.eloratings.net/World.tsv） | 同左 |
| 近期背景 | 2022 亚军班底，姆巴佩领衔，志在第三冠（Al Jazeera, 2026-06-02） | 1986 年以来首次晋级世界杯正赛；附加赛绝杀玻利维亚（FIFA.com, 2026-06） |

## ④ 关键因素

1. **Elo 差距 456 分**：2063 vs 1607，Davidson 模型基础胜率法国约 79%。来源：eloratings.net（快照 2026-06-11）。
2. **姆巴佩伤愈入选并担任队长**：此前大腿伤情一度引发担忧，最终随队出征第三届世界杯，且在皇马状态高位（法国队史 56 球，仅次吉鲁）。来源：CBC Sports / ESPN，2026-06 上旬。
3. **法国缺席名单有限**：卡马文加（赛季伤病反复）、埃基蒂凯（4 月跟腱重伤）、科洛·穆阿尼落选，但板凳深度足以覆盖。来源：ESPN，2026-06。
4. **伊拉克主帅格雷厄姆·阿诺德**：2025 年 5 月接手，曾率澳大利亚征战 2022 世界杯并以防守组织见长，预计对法国摆低位防线。来源：FIFA.com / FourFourTwo，2026-06。
5. **伊拉克阵容关键点**：100 场老门将贾拉勒·哈桑任队长；有英超经历的阿里·哈马迪与预选赛 8 球的侯赛因是进攻支点。来源：FourFourTwo，2026-06。
6. **中立场地确认**：费城林肯金融球场，6 月 22 日 17:00 当地开球，午后高温对双方对等，不施加主办国修正。来源：lincolnfinancialfield.com / ESPN 赛程页。

## ⑤ 模型与调整

- **p_stat（Davidson 三路模型，scale=400，drawNu=0.7，中立场地无主办国加成）**：法国 79.3% / 平 14.9% / 伊拉克 5.8%。
- **调整（合计 1.8pp，远低于 ±8pp 上限，证据偏薄故幅度小）**：
  - 法国 −1.8pp：姆巴佩近期大腿伤情的残余不确定性 + 三名轮换深度球员缺席；
  - 平局 +1.1pp、伊拉克 +0.7pp：阿诺德的低位防守体系 + 40 年首回世界杯的极限动员。
- **p_final**：法国 77.5% / 平 16.0% / 伊拉克 6.5%（归一化后）。
- **本预测为市场盲测**：全程未读取、未参考任何博彩赔率或预测市场价格，概率仅来自 Elo 统计模型加上述有限证据修正。
- 区间反映参数敏感性（drawNu 0.6–0.8 时法国 77.7%–81.0%、平 13.1%–16.7%）叠加伊拉克对阵顶级球队样本稀少带来的额外不确定性。

## ⑥ 方法与来源

**方法**：以 eloratings.net 2026-06-11 评分为输入，用 Davidson 三路模型（与仓库 packages/sports-model/src/elo.ts 的 eloToOneXTwo 一致）计算基础概率；再依据带日期来源的事实做不超过 ±8pp 的有限修正并归一化；80% 区间由模型参数敏感性与证据稀薄度共同决定。

**来源清单**：
1. eloratings.net World.tsv（本地快照 2026-06-11）
2. Al Jazeera — France World Cup 2026 preview（2026-06-02）https://www.aljazeera.com/sports/2026/6/2/france-world-cup-2026-preview-players-to-watch-group-matches-and-squad
3. ESPN — France 2026 World Cup squad（2026-06）https://www.espn.com/soccer/story/_/id/48771039/france-2026-world-cup-squad-mbappe-camavinga-kolo-muani-dembele
4. CBC Sports — World Cup injury scares（2026-06）https://www.cbc.ca/sports/soccer/worldcup/injuries-2026-fifa-world-cup-messi-mbappe-yamal-davies-9.7221543
5. FIFA.com — Iraq preliminary squad / Graham Arnold（2026-06）https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/iraq-preliminary-squad-announcement-graham-arnold
6. FourFourTwo — Iraq World Cup 2026 squad（2026-06）https://www.fourfourtwo.com/team/iraq-world-cup-2026-squad
7. Wikipedia — 2026 FIFA World Cup Group I https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_I
8. Lincoln Financial Field — France vs Iraq (Group I) 赛事页 https://www.lincolnfinancialfield.com/events/france-vs-iraq-group-i/

**免责声明**：本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
