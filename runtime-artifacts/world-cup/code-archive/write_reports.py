#!/usr/bin/env python3
"""Write the reach-qf bilingual report deliverables (required by the site importer)."""
OUT = '/Users/Aincrad/dev-proj/predict-raven/runtime-artifacts/world-cup/reports/reach-qf'

table_cn = open('/tmp/qf_table_cn.md').read()
table_en = open('/tmp/qf_table_en.md').read()

CN = '''# 2026 世界杯八强池预测（Reach Quarter-finals，全 48 队）

生成时间：2026-06-11T13:15:00Z ｜ 模型：纯 Elo 蒙特卡洛（10 万次）+ 有界证据调整 ｜ 英文版：`report.en.md`

## ① 最可能的八强名单

按调整后概率，最可能进入 1/4 决赛的 8 支球队：

**西班牙（73.2%）、阿根廷（70.2%）、法国（65.0%）、英格兰（55.8%）、葡萄牙（43.6%）、巴西（41.1%）、哥伦比亚（40.4%）、荷兰（39.0%）**

这 8 队恰好就是 Elo 前八，合计约拿走 8 个八强名额中的 4.28 个。

**一句话观点：** 最可能的八强是西班牙、阿根廷、法国、英格兰、葡萄牙、巴西、哥伦比亚、荷兰——但没有任何球队超过 75%，48 队扩军让八强名额比以往任何一届都更分散：即使是 Elo 世界第一的西班牙，也有约四分之一的概率倒在 1/4 决赛门前。

## ② 完整 48 队概率表（按概率降序）

列说明：`MC 基线` = 10 万次纯 Elo 模拟的晋级八强概率；`调整后` = 有界证据调整并重新归一化（合计 = 8）后的最终概率；`调整` = 相对调整幅度（“—” 表示未做证据调整，数值变化仅来自整体归一化）。

| # | 球队 | 组 | Elo（世界排名） | MC 基线 | 调整后 | 调整 | 一句话理由 |
| --- | --- | --- | --- | --- | --- | --- | --- |
''' + table_cn + '''

（48 项之和 = 8.000；精确数值见 `prediction.json`）

## ③ Bracket 相关性 caveat（重要）

本表给出的是**边际概率**：每队各自独立看“最终是否出现在八强里”的概率。它们**不是相互独立的事件**：

- 同一半区/同一路径的强队命运**负相关**——例如葡萄牙与哥伦比亚同处 K 组，两队的头名/次名身份互斥，而头名与次名进入完全不同的淘汰赛分支；一队走软路径，往往意味着另一队走硬路径。
- 因此**不能**把任意 8 支球队的概率相乘或相加来推断“恰好这 8 队成为八强”的概率——“上表前 8 名恰好就是最终八强”这一精确事件的概率远低于各队概率的直观乘积。
- 同理，某强队爆冷出局会系统性抬高其所在路径上所有球队的八强概率；本表无法表达这种条件结构，需要条件概率时应回到模拟器按情景重算。

## ④ 定义

「晋级八强」= 赢下 16 强淘汰赛（Round of 32 之后的 Round of 16），晋级 1/4 决赛，即成为最后 8 支球队之一。48 队概率之和 ≈ 8（八个名额）。

2026 世界杯赛制：48 队分 12 组，每组前 2 名 + 8 个成绩最好的第三名共 32 队进入淘汰赛（Round of 32），随后 16 强、8 强（1/4 决赛）逐轮淘汰。

## ⑤ 方法

1. **统计基线（100,000 次蒙特卡洛）**：纯 Elo 驱动的全赛程模拟（seed 20260611），无任何市场输入。Elo 取 eloratings.net 2026-06-11 快照。进球为独立泊松：lambda_A = 2.6 × e_A，其中 e_A 为 Elo 逻辑斯蒂期望（即把 2.6 球的单场基准按 Elo 期望切分）；东道主墨西哥/美国/加拿大仅小组赛 +100 Elo，淘汰赛因场地分散不加成（近似）。小组排名按 积分 → 净胜球 → 进球 → 同分球队间小积分榜 → 随机 处理；8 个最佳第三按 积分/净胜球/进球/随机 排序。淘汰赛对阵采用 FIFA 官方 2026 赛程树（第 73–104 场），第三名球队按 FIFA 允许组合表以确定性二分图匹配分配（近似，构造上排除同组重赛）；淘汰赛 90 分钟平局质量按 Elo 期望以伯努利方式拆分，作为加时+点球的替代。基线 48 队 p_qf 之和恰为 8。
2. **有界证据调整**（上限每队 ±20% 相对，本次实际最大 ±6%，须引用证据）：
   - 巴西 −6%：罗德里戈、米利唐、埃斯特旺伤缺，内马尔小腿伤、首战出战成疑（ESPN 伤情追踪 / Yahoo，2026-06）。
   - 加拿大 −6%：戴维斯腿筋伤疑、邦比托伤退、大卫整季低迷（Fox Sports，2026-05）。
   - 比利时 −5%：德布劳内（眼部）与卢卡库（髋部）在养伤状态下入选（beIN SPORTS，2026-05-15）。
   - 荷兰 −4%：廷贝尔腹股沟伤退出，海特勒伊达替补入队（ESPN / theScore，2026-06）。
   - 阿根廷 −2%：梅西腿筋伤愈、限制出场时间；C. 罗梅罗赶身体状态（CBC / Arizona Sports，2026-06）。
   - 法国 −2%：姆巴佩列入“赶身体状态”名单（Yahoo 实时汇总，2026-06）。
   - 克罗地亚 −2%：莫德里奇（40 岁）赶身体状态（Yahoo，2026-06）。
   - 西班牙 −1%：亚马尔/尼科·威廉斯/穆尼奥斯预计赶上 6/15 首战，仅保留比赛状态风险（ESPN / CBC，2026-06）。
   - 英格兰 +3%：5/22 公布名单后无重大伤病，豪强中最完整（Sky Sports，2026-05/06）。
   - 葡萄牙 +2%：阵容完整、无关键缺阵报道（Sky Sports / FIFA，2026-06）。
3. **归一化**：调整后将 48 队概率整体缩放回合计 = 8（缩放系数 1.0104）。所有调整后 p_qf 均不低于该队模拟基线的 p_sf（四强概率），保持 p_champion ≤ p_sf ≤ p_qf 单调性。
4. 本预测 **100% 独立于任何博彩/预测市场数据**，未参考任何赔率或市场价格。

## 来源

1. eloratings.net Elo 快照（2026-06-11）：https://www.eloratings.net/
2. ESPN：2026 世界杯伤情追踪（廷贝尔退出荷兰队等，访问于 2026-06-11）：https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info
3. CBC Sports：梅西、姆巴佩、亚马尔伤愈赶上世界杯（2026-06）：https://www.cbc.ca/sports/soccer/worldcup/injuries-2026-fifa-world-cup-messi-mbappe-yamal-davies-9.7221543
4. Yahoo Sports：西班牙/巴西/阿根廷/美国伤病可能影响世界杯（2026-06）：https://sports.yahoo.com/articles/spain-brazil-argentina-u-injuries-152522277.html
5. ESPN：梅西领衔阿根廷名单、第 6 次出战世界杯（2026-06）：https://www.espn.com/soccer/story/_/id/48904313/lionel-messi-argentina-2026-world-cup-squad
6. beIN SPORTS：德布劳内、卢卡库带伤入选比利时名单（2026-05-15）：https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/de-bruyne-and-lukaku-named-in-belgium-world-cup-squad-despite-injuries-2026-05-15
7. theScore：伤情追踪——廷贝尔等加入缺席名单（2026-06）：https://www.thescore.com/worldcup/news/3550982
8. Sky Sports：48 队名单汇总（英格兰 5/22 公布等，访问于 2026-06-11）：https://www.skysports.com/football/news/12098/13543070/world-cup-2026-squad-lists-england-scotland-brazil-usa-spain-france-germany-netherlands-argentina-portugal-and-more
9. Fox Sports：戴维斯带腿筋伤入选加拿大名单（2026-05）：https://www.foxsports.com/stories/soccer/alphonso-davies-named-to-canadas-world-cup-squad-despite-hamstring-injury

## 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
'''

EN = '''# 2026 World Cup — Reach Quarter-finals Pool Forecast (all 48 teams)

Generated: 2026-06-11T13:15:00Z | Model: pure-Elo Monte Carlo (100k sims) + bounded evidence adjustment | Chinese original: `report.md`

## 1. Most likely quarter-final eight

By adjusted probability, the eight teams most likely to reach the quarter-finals:

**Spain (73.2%), Argentina (70.2%), France (65.0%), England (55.8%), Portugal (43.6%), Brazil (41.1%), Colombia (40.4%), Netherlands (39.0%)**

These eight are exactly the Elo top eight, collectively claiming about 4.28 of the 8 slots.

**One-sentence view:** The most likely quarter-final eight are Spain, Argentina, France, England, Portugal, Brazil, Colombia and the Netherlands — yet no team clears 75%: the 48-team format spreads the eight slots thinner than ever, and even world-No.-1 Spain fall short of the quarter-finals roughly one time in four.

## 2. Full 48-team probability table (descending)

Columns: `MC baseline` = reach-QF probability from 100k pure-Elo sims; `Adjusted` = final probability after bounded evidence adjustment and renormalization (sums to 8); `Adj` = relative adjustment ("—" means no evidence adjustment; any change comes from renormalization only).

| # | Team | Grp | Elo (world rank) | MC baseline | Adjusted | Adj | One-line reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
''' + table_en + '''

(The 48 probabilities sum to 8.000; exact values in `prediction.json`.)

## 3. Bracket-correlation caveat (important)

These are **marginal probabilities** — each team's standalone chance of appearing among the final eight. They are **not independent events**:

- Strong teams on the same path are **negatively correlated** — e.g. Portugal and Colombia share Group K: winner and runner-up are mutually exclusive identities feeding entirely different knockout branches, so one taking the soft path usually pushes the other onto the hard one.
- You therefore **cannot** multiply or add any eight teams' probabilities to get the chance that "exactly these eight make it" — the probability of the top eight above being precisely the final eight is far below the naive product.
- Likewise, an early upset of one heavyweight systematically lifts the QF chances of every team on its path; this table cannot express that conditional structure. For scenario-conditional numbers, re-run the simulator under the scenario.

## 4. Definition

"Reach the quarter-finals" = win the Round-of-16 tie (after the Round of 32) and advance to the quarter-finals, i.e. be among the last 8 teams. The 48 probabilities sum to ~8 (eight slots).

2026 format: 48 teams in 12 groups; top two per group plus the 8 best third-placed teams (32 in all) enter the Round of 32, then Round of 16, then quarter-finals.

## 5. Method

1. **Statistical baseline (100,000 Monte Carlo sims)**: pure-Elo full-tournament simulation (seed 20260611), no market input of any kind. Elo from the eloratings.net snapshot of 2026-06-11. Goals are independent Poissons: lambda_A = 2.6 × e_A, where e_A is the Elo logistic expectancy (the 2.6-goal per-match baseline split by Elo expectancy). Hosts Mexico/USA/Canada get +100 Elo in group games only; no knockout host bonus since venues vary (approximation). Group ranking: points → goal difference → goals scored → head-to-head mini-table among tied teams → random draw; the 8 best third-placed teams ranked by points/GD/goals/random. Knockouts follow the official FIFA 2026 bracket (matches 73–104), with third-placed teams assigned by deterministic bipartite matching over FIFA's allowed-group sets (approximation; same-group R32 rematches impossible by construction). Knockout 90-minute draw mass is resolved by a Bernoulli draw proportional to Elo expectancy as a stand-in for extra time and penalties. Baseline p_qf sums to exactly 8.
2. **Bounded evidence adjustment** (cap ±20% relative per team; max actually used ±6%, each with cited evidence):
   - Brazil −6%: Rodrygo, Militão and Estêvão out injured; Neymar (calf) doubtful for the opener (ESPN injury tracker / Yahoo, June 2026).
   - Canada −6%: Davies (hamstring) doubtful, Bombito withdrawn, David out of form (Fox Sports, May 2026).
   - Belgium −5%: De Bruyne (eye) and Lukaku (hip) named while sidelined (beIN SPORTS, 2026-05-15).
   - Netherlands −4%: Timber withdrawn (groin), replaced by Geertruida (ESPN / theScore, June 2026).
   - Argentina −2%: Messi back from a hamstring issue on managed minutes; C. Romero in a fitness race (CBC / Arizona Sports, June 2026).
   - France −2%: Mbappé listed among fitness races (Yahoo live updates, June 2026).
   - Croatia −2%: Modrić (40) in a fitness race (Yahoo, June 2026).
   - Spain −1%: Yamal / Nico Williams / Muñoz expected fit for the June 15 opener; residual sharpness risk only (ESPN / CBC, June 2026).
   - England +3%: no major injuries after the May 22 squad announcement — the healthiest contender (Sky Sports, May–June 2026).
   - Portugal +2%: fully intact squad, no reported key absences (Sky Sports / FIFA, June 2026).
3. **Renormalization**: after adjustment, all 48 probabilities are rescaled to sum to 8 (factor 1.0104). Every adjusted p_qf remains at or above that team's simulated p_sf, preserving p_champion ≤ p_sf ≤ p_qf monotonicity.
4. This forecast is **100% independent of any betting or prediction-market data**; no odds or market prices were consulted.

## Sources

1. eloratings.net Elo snapshot (2026-06-11): https://www.eloratings.net/
2. ESPN: 2026 World Cup injuries tracker (Timber out for Netherlands, etc., accessed 2026-06-11): https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info
3. CBC Sports: Messi, Mbappé, Yamal all World Cup-bound after injury scares (June 2026): https://www.cbc.ca/sports/soccer/worldcup/injuries-2026-fifa-world-cup-messi-mbappe-yamal-davies-9.7221543
4. Yahoo Sports: Spain, Brazil, Argentina, U.S. injuries could factor into the World Cup (June 2026): https://sports.yahoo.com/articles/spain-brazil-argentina-u-injuries-152522277.html
5. ESPN: Messi to lead Argentina at a record 6th World Cup (June 2026): https://www.espn.com/soccer/story/_/id/48904313/lionel-messi-argentina-2026-world-cup-squad
6. beIN SPORTS: De Bruyne and Lukaku named in Belgium squad despite injuries (2026-05-15): https://www.beinsports.com/en-us/soccer/fifa-world-cup-2026/articles/de-bruyne-and-lukaku-named-in-belgium-world-cup-squad-despite-injuries-2026-05-15
7. theScore: World Cup injury tracker — Timber joins list of absentees (June 2026): https://www.thescore.com/worldcup/news/3550982
8. Sky Sports: World Cup 2026 squad lists, all 48 teams (England announced May 22; accessed 2026-06-11): https://www.skysports.com/football/news/12098/13543070/world-cup-2026-squad-lists-england-scotland-brazil-usa-spain-france-germany-netherlands-argentina-portugal-and-more
9. Fox Sports: Alphonso Davies named to Canada squad despite hamstring injury (May 2026): https://www.foxsports.com/stories/soccer/alphonso-davies-named-to-canadas-world-cup-squad-despite-hamstring-injury

## Disclaimer

This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers.
'''

with open(f'{OUT}/report.md', 'w') as f:
    f.write(CN)
with open(f'{OUT}/report.en.md', 'w') as f:
    f.write(EN)
print('wrote', f'{OUT}/report.md', 'and report.en.md')
