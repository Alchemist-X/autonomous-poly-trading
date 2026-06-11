# 2026 世界杯 D 组头名预测（USA · Türkiye · Paraguay · Australia）

生成时间：2026-06-11T13:15:00Z ｜ 预测 ID：`group-winner:d` ｜ 本报告 100% 独立于任何博彩/预测市场数据

## ① 结论

| 球队 | 模型基线 | 调整后概率 |
|---|---|---|
| 土耳其 Türkiye | 49.2% | **50.4%** |
| 巴拉圭 Paraguay | 21.4% | **21.9%** |
| 美国 USA | 19.5% | **17.5%** |
| 澳大利亚 Australia | 9.9% | **10.2%** |

**一句话观点：** Elo 全组最高的土耳其约五成概率拿下 D 组头名；东道主美国虽有主场加成，但 Cardoso、Agyemang 伤缺令其与巴拉圭的第二名之争更胶着。

## ② 定义

「D 组头名」= FIFA 小组赛最终积分榜第 1 名。官方排名规则依次为：积分 → 净胜球 → 进球数 → 相关队间对赛成绩 → 公平竞赛积分（红黄牌）→ 抽签。

## ③ 各队简评（仅基于 Elo、状态与赛程，不含任何市场信息）

- **土耳其（Elo 1911，世界第 13）**：全组 Elo 最高，比第二高的巴拉圭高 77 分；Güler、Yıldız 领衔的 26 人名单 6 月 2 日公布，无重大伤病消息。末轮 6 月 25 日在 SoFi 客场对美国是头名之争最大变数。
- **巴拉圭（Elo 1834，世界第 22）**：纸面第二强，防守稳健型球队；6 月 12 日首战美国（SoFi）若拿分，头名概率将显著上修。
- **美国（Elo 1726，世界第 39）**：三场小组赛全部在本土（洛杉矶×2、西雅图×1），模型已按小组赛 +100 Elo 主场加成计算（等效 1826）；但主力后腰 Johnny Cardoso 与前锋 Patrick Agyemang 因伤无缘世界杯，Richards 亦有脚伤隐忧，故在基线上下调 2 个百分点。
- **澳大利亚（Elo 1777，世界第 28）**：原始 Elo 反而高于美国，作风硬朗但攻坚能力有限；夺头名需在与土耳其、美国的直接对话中至少抢 4 分，概率最低但并非可忽略。

## ④ 方法

1. **统计基线**：纯 Elo 泊松蒙特卡洛，100,000 次全赛程模拟（seed 20260611），Elo 取自 eloratings.net 2026-06-11 快照，完全不含市场输入。两队进球为独立泊松分布，λ 由 Elo 胜率期望按 2.6 球基准拆分；东道主墨西哥、美国、加拿大仅在小组赛 +100 Elo。小组排名按 积分→净胜球→进球→同分队间对赛→随机 处理（公平竞赛分以随机近似）。
2. **有界调整**：仅允许每队 ±4pp 且必须有引用证据。本次仅一项：美国因 Cardoso、Agyemang 确认伤缺 −2pp（来源 2），其余三队按基线占比重新归一，总和为 1。土耳其、巴拉圭、澳大利亚无足以触发调整的伤停证据，维持基线。
3. **置信级别**：中。小组头名取决于三轮比赛与净胜球细节，模型对单场波动敏感。

## 来源

1. eloratings.net World Football Elo Ratings（快照 2026-06-11）— https://www.eloratings.net/
2. ESPN：USMNT 公布 2026 世界杯 26 人名单，Cardoso、Agyemang 伤缺；D 组赛程（6/12 vs 巴拉圭·SoFi，6/19 vs 澳大利亚·西雅图，6/25 vs 土耳其·SoFi）（2026-06-09）— https://www.espn.com/soccer/story/_/id/48882389/usa-2026-world-cup-roster-christian-pulisic-squad-mckennie-adams
3. CBS Sports：Pochettino 名单揭晓，Reyna 入选、Luna 落选（2026-06-09）— https://www.cbssports.com/soccer/news/usmnt-world-cup-roster-2026-live-updates-squad-announcement/live/
4. FIFA.com：Güler 与 Yıldız 领衔土耳其大名单（2026-05-18）— https://www.fifa.com/en/articles/turkiye-preliminary-world-cup-squad-announced
5. Daily Sabah：土耳其公布 26 人最终名单（2026-06-02）— https://www.dailysabah.com/sports/football/turkiye-unveil-26-player-squad-for-historic-2026-world-cup-return

## 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
