# 2026 世界杯 A 组头名预测报告

- **预测问题**：A 组最终积分榜第 1 名是哪支球队？（墨西哥 / 韩国 / 捷克 / 南非）
- **结算事件 slug（仅作结算元数据）**：`world-cup-group-a-winner`
- **报告生成时间**：2026-06-11T13:15:00Z（A 组首战开球前）
- **市场盲声明**：本预测完全独立于任何博彩赔率与预测市场——制作过程中未获取、未参考任何盘口数据；概率仅来自 Elo/蒙特卡洛统计模型加有上限的证据化调整。
- 英文版：[`report.en.md`](report.en.md)；机器可读结果：[`prediction.json`](prediction.json)

## ① 预测结论

| 球队 | 统计基线 | 有界调整 | **最终概率** |
| --- | --- | --- | --- |
| **墨西哥 Mexico** | 78.9% | −2.0pp | **76.9%** |
| **韩国 South Korea** | 11.5% | +1.0pp | **12.5%** |
| **捷克 Czechia** | 9.3% | +1.0pp | **10.3%** |
| **南非 South Africa** | 0.3% | 0 | **0.3%** |

**一句话观点**：墨西哥坐拥三场本土高原比赛、Elo 与近期状态全面领先，约 77% 概率拿下 A 组头名；韩国（约 12.5%）与捷克（约 10.3%）之间的差距小于一场比赛的偶然性，南非仅剩数学可能。

置信档：**中**——方向上信心高（各路证据都指向墨西哥大幅领先），幅度上中等（小组头名取决于三场比赛的联合结果，单场爆冷或平局连锁即可大幅改变格局）。

## ② 问题定义与结算标准

- **预测什么**：A 组四队打完 3 轮小组赛后，FIFA 官方最终积分榜的第 1 名。
- **排名规则**（依次比较）：积分 → 净胜球 → 进球数 → 相互对赛成绩 → 公平竞赛积分 → 抽签。
- 四个选项互斥且穷尽，概率之和为 1。A 组末轮预计 2026-06-24/25 进行，全部完赛后即可结算。

## ③ 各队简评（Elo / 状态 / 赛程视角）

- **墨西哥**（Elo 1875，世界第 18）：2026 年 8 场热身不败、仅丢 2 球，末战 5-1 大胜塞尔维亚（Sports Mole，2026-06-10）；三场小组赛全部在本国进行（墨西哥城阿兹特克 ×2、瓜达拉哈拉 ×1），且均为海拔 1,500–2,240 米的高原主场。保留意见：2025 年底曾 6 场不胜，且东道主大赛开局历来偏保守。
- **韩国**（Elo 1758，世界第 33）：5 月 16 日公布的 26 人名单中，孙兴慜以队长身份第四次出战世界杯，金玟哉、李刚仁悉数入选（ESPN / FIFA，2026-05-16）；主力中场黄仁范带踝伤备战是主要隐患。三场比赛全部在墨西哥境内（瓜达拉哈拉 ×2、蒙特雷），首战捷克实为"准中立场"对决（Olympics.com，2026-06-11 查阅）。
- **捷克**（Elo 1740，世界第 35）：经 3 月欧洲区附加赛晋级（UEFA.com，2026-06-11 查阅）；2025 年 12 月 Koubek 接替 Hašek 执教（FourFourTwo，2026-06-11 查阅）；Schick 伤愈可打中锋、Hložek 长伤归队（FIFA，2026-05），阵容齐整度好于 Elo 已吸收的 2025 低谷。赛程是四队中最难一档：末轮需赴阿兹特克客战墨西哥（Squawka，2026-06-11 查阅）。
- **南非**（Elo 1517，世界第 80）：2026 年至今不胜（0 胜 3 平 2 负、仅进 3 球，afrik-foot，2026-06-07），与组内三队的 Elo 差都在 220 分以上；拿头名需要多重冷门叠加，模型仅给 0.3%。

## ④ 方法

**第一步：统计基线（蒙特卡洛）**。100,000 次全赛事纯 Elo 泊松蒙特卡洛模拟（seed 20260611），Elo 取 eloratings.net 2026-06-11 快照，完全不含任何市场输入。单场进球为独立泊松：λ = 2.6 × Elo 逻辑期望（即按 10^(Elo/400) 胜率期望切分 2.6 球基线）；东道主墨西哥小组赛享 +100 Elo 主场修正（淘汰赛不加）。小组排名按 积分 → 净胜球 → 进球 → 全并列队间小循环 → 随机 处理。A 组基线：墨西哥 78.9% / 韩国 11.5% / 捷克 9.3% / 南非 0.3%。

**第二步：有界证据调整（每队 ≤ ±4pp，须引用证据）**：

| 球队 | 调整 | 理由 |
| --- | --- | --- |
| 墨西哥 | −2.0pp | 纯 Elo 泊松结构性低估平局：东道主揭幕战历史平局基率约 26%（Sofascore，2026-06-11），而本仓库 Elo 模型对昨日揭幕战平局仅给约 15%（见 `../fifwc-mex-rsa-2026-06-11/report.md`）；平局增多会不成比例地侵蚀头名概率。叠加 2025 年底 6 场不胜的反向状态证据（Sports Mole，2026-06-10）。 |
| 韩国 | +1.0pp | 进攻轴心齐整：孙兴慜伤愈领衔、金玟哉/李刚仁在列（ESPN/FIFA，2026-05-16）；对捷克的关键直接对话在准中立场进行。黄仁范踝伤限制了更大的上调。 |
| 捷克 | +1.0pp | Schick 伤愈、Hložek 回归，满编阵容强于 Elo 1740 所反映的 2025 低谷（FIFA，2026-05）；但末轮客战阿兹特克的赛程压制了上调空间。 |
| 南非 | 0 | 2026 全年不胜、进攻乏力（afrik-foot，2026-06-07），无任何正面证据支持上调；0.3% 基线维持。 |

调整净和为零，最终概率自然归一：**墨西哥 76.9% / 韩国 12.5% / 捷克 10.3% / 南非 0.3%**。最大单项调整 2pp，远未触及 ±4pp 上限。

**局限**：Elo 不含阵容与战术细节；主场修正为统一 +100，未区分各场馆海拔差异；模拟中的随机并列处理是对 FIFA 完整规则（含公平竞赛分）的近似。

## 来源

1. eloratings.net World Football Elo（2026-06-11 快照，`../../elo-table.json`）：墨西哥 1875 / 韩国 1758 / 捷克 1740 / 南非 1517
2. https://www.espn.com/soccer/story/_/id/48788433/son-heung-min-south-korea-world-cup-squad-lee-kang-kim-min-jae （2026-05-16）
3. https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/korea-republic-world-cup-squad-hong-myungbo （2026-05-16）
4. https://www.olympics.com/en/news/fifa-world-cup-2026-republic-of-korea-all-players-full-squad-list-key-stats-schedule （2026-06-11 查阅）
5. https://www.fifa.com/en/articles/czechia-world-cup-squad-announced （2026-05）
6. https://www.fourfourtwo.com/team/czech-republic-world-cup-2026-squad （2026-06-11 查阅）
7. https://www.uefa.com/european-qualifiers/news/02a6-20d15945d06d-c1587a40d2a4-1000--czechia-at-the-world-cup-2026-squad-fixtures-group-and-hi/ （2026-06-11 查阅）
8. https://www.squawka.com/en/news/world-cup/czech-republic-world-cup-2026-fixtures-squad-analysis/ （2026-06-11 查阅）
9. https://www.sportsmole.co.uk/football/mexico/world-cup-2026/preview/mexico-vs-south-africa-prediction-team-news-lineups_598869.html （2026-06-10）
10. https://www.afrik-foot.com/en-za/bafanas-winless-run-continues （2026-06-07）
11. https://www.sofascore.com/news/every-world-cup-hosts-opening-match-what-history-says （2026-06-11）

## 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
