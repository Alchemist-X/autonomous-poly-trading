# 2026 世界杯 I 组头名预测（France / Norway / Senegal / Iraq）

生成时间：2026-06-11T13:15:00Z ｜ 方法：纯 Elo 蒙特卡洛 + 有界证据调整 ｜ 不含任何市场数据

## ① 结论

| 球队 | 统计基线 | 调整后概率 |
| --- | --- | --- |
| 法国 France | 70.4% | **72.2%** |
| 挪威 Norway | 19.2% | **17.2%** |
| 塞内加尔 Senegal | 10.1% | **10.4%** |
| 伊拉克 Iraq | 0.3% | **0.3%** |

**一句话观点：** 法国阵容齐整（姆巴佩伤愈出任队长、萨利巴解除伤情疑虑），Elo 高出挪威约 150 分，约 72% 概率拿下 I 组头名；挪威有状态火热的哈兰德，但厄德高整季伤病缠身是减分项。

## ② 定义

「I 组头名」= FIFA 2026 世界杯小组赛结束后 I 组最终积分榜第 1 名。排名规则依次为：**积分 → 净胜球 → 进球数 → 相关球队间对赛成绩 → 公平竞赛积分 → 抽签**。

## ③ 各队简评（Elo / 状态 / 赛程角度）

- **法国（Elo 2063，世界第 3）**：组内 Elo 断层领先（高出挪威 149 分、塞内加尔 203 分）。最终名单满员——姆巴佩伤愈获任队长，萨利巴体能疑虑被德尚明确排除；卡马文加、科洛·穆阿尼落选更多反映阵容深度而非危机。末轮（6-26）对挪威前若先取塞内加尔、伊拉克，很可能提前锁定头名走势。
- **挪威（Elo 1914，世界第 11）**：时隔 28 年重返世界杯，哈兰德以 55 个国家队进球（含预选赛 16 球）领衔且确认出战；但核心组织者厄德高本季至少 5 次伤停、曾缺席 3 月友谊赛，创造力高度依赖其健康状况——这是对基线的主要下修依据（−2pp）。
- **塞内加尔（Elo 1860，世界第 21）**：非洲区一线强队，整体硬度足够；要争头名大概率需要在首轮（6-16）对法国拿分，否则只能寄望次轮（6-22）直接击败挪威后比拼净胜球。
- **伊拉克（Elo 1607，世界第 63）**：与前三队 Elo 差距 250+ 分，三轮全部面对强敌，争头名概率接近于零（0.3%）。

## ④ 方法

1. **统计基线**：100,000 次全赛程蒙特卡洛模拟（seed 20260611），基于 eloratings.net 2026-06-11 快照的纯 Elo 泊松进球模型——双方进球为独立泊松分布，λ 由 Elo 胜率期望按 2.6 球基准切分；小组排名按 积分→净胜球→进球→并列队间对赛→随机 处理；不含任何市场输入。东道主 Elo 加成仅适用于主办国所在组的小组赛，不影响本组。
2. **有界调整（每队 ≤ ±4pp）**：唯一证据驱动调整为挪威 −2pp（厄德高伤情不确定性，见来源 6）；其余三队按基线比例承接释放的概率并重新归一（法国 +1.7pp、塞内加尔 +0.3pp、伊拉克 +0.0pp），合计为 1。
3. **不确定性**：置信档「中」——方向明确（法国显著领先），幅度受末轮法挪直接对话的单场方差影响。

## 来源

1. Elo 评分快照：https://www.eloratings.net/World.tsv （抓取于 2026-06-11，本仓库 `elo-table.json`）
2. 模拟产物：`runtime-artifacts/world-cup/mc-results.json`（2026-06-11，100k sims）；赛程见 `runtime-artifacts/world-cup/event-list/questions.json`
3. ESPN：法国最终名单，姆巴佩入选并任队长，卡马文加/科洛·穆阿尼落选（2026-05-14 公布，访问于 2026-06-11）https://www.espn.com/soccer/story/_/id/48771039/france-2026-world-cup-squad-mbappe-camavinga-kolo-muani-dembele
4. FOX Sports：德尚排除萨利巴伤情疑虑（访问于 2026-06-11）https://www.foxsports.com/stories/soccer/william-saliba-hands-france-massive-injury-lift-as-didier-deschamps-issues-blunt-selection-warning-over-ousmane-dembele
5. CBC：姆巴佩伤情虚惊后确认出战世界杯（访问于 2026-06-11）https://www.cbc.ca/sports/soccer/worldcup/injuries-2026-fifa-world-cup-messi-mbappe-yamal-davies-9.7221543
6. Al Jazeera：挪威前瞻——厄德高本季至少 5 次伤停、缺席 3 月友谊赛（2026-05-26）https://www.aljazeera.com/sports/2026/5/26/norway-world-cup-2026-preview-players-to-watch-group-matches-squad-list
7. FIFA.com：挪威 26 人名单，哈兰德、厄德高领衔（访问于 2026-06-11）https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/norway-squad-announcement-stale-solbakken
8. Olympics.com：哈兰德 55 个国家队进球、预选赛 16 球；挪威时隔 28 年重返决赛圈（访问于 2026-06-11）https://www.olympics.com/en/news/fifa-world-cup-2026-norway-all-players-full-squad-list-key-stats-and-schedule

## 免责声明

本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。
