# 2026 世界杯公开预测 — 事件清单与结算定义

> 生成时间：2026-06-11T12:29:01.335Z · 数据源：Polymarket Gamma 缓存快照（仅事件结构与结算映射；本管线为盲测——分析全程不读取任何市场价格）

**范围：** 72 场小组赛 + 12 个小组头名 + 八强名单 + 四强名单 + 冠军，共 87 个问题、408 条市场腿。

## 结算定义（全部问题统一标准）

| 家族 | 定义 |
|---|---|
| 小组赛单场 (72) | 90 分钟（含补时）赛果，三个互斥结果：A 胜 / 平 / B 胜。小组赛无加时与点球。按 FIFA 官方赛果结算，对应 Polymarket 同一 negRisk 事件下的 3 个二元市场。 |
| 小组头名 (12) | FIFA 官方最终小组积分榜第 1 名（排名规则：积分 → 净胜球 → 进球数 → 对赛成绩 → 公平竞赛分 → 抽签）。每组 4 队互斥，概率之和 ≈ 1。 |
| 八强名单 (1 题 × 48 队) | 2026 年 48 队赛制：12 个小组前两名 + 8 个最佳第三共 32 队进入淘汰赛。「进入八强」= 赢下 16 强淘汰赛、获得 1/4 决赛参赛资格（最后 8 队）。每队一个二元概率，恰好 8 队实现，48 队概率之和 ≈ 8。 |
| 四强名单 (1 题 × 48 队) | 「进入四强」= 赢下 1/4 决赛、获得半决赛参赛资格（最后 4 队）。每队一个二元概率，概率之和 ≈ 4。 |
| 冠军 (1 题 × 48 队) | 赢得 2026-07-19 决赛（含加时与点球）。48 队互斥，概率之和 ≈ 1。 |

> 注：单场问题中「A 队」按 Polymarket 赛程列序的第一队，仅作标识，不代表真实主客场。

## 1. 小组赛 72 场

| # | 日期 | 组 | 对阵 | 开球 (UTC) | event_slug |
|---|---|---|---|---|---|
| 1 | 2026-06-11 | A | Mexico vs South Africa | 19:00 | `fifwc-mex-rsa-2026-06-11` |
| 2 | 2026-06-11 | A | Korea Republic vs Czechia | 02:00 | `fifwc-kr-cze-2026-06-11` |
| 3 | 2026-06-12 | B | Canada vs Bosnia-Herzegovina | 19:00 | `fifwc-can-bih-2026-06-12` |
| 4 | 2026-06-12 | D | United States vs Paraguay | 01:00 | `fifwc-usa-par-2026-06-12` |
| 5 | 2026-06-13 | B | Qatar vs Switzerland | 19:00 | `fifwc-qat-che-2026-06-13` |
| 6 | 2026-06-13 | C | Brazil vs Morocco | 22:00 | `fifwc-bra-mar-2026-06-13` |
| 7 | 2026-06-13 | C | Haiti vs Scotland | 01:00 | `fifwc-hai-sco-2026-06-13` |
| 8 | 2026-06-14 | D | Australia vs Türkiye | 04:00 | `fifwc-aus-tur-2026-06-14` |
| 9 | 2026-06-14 | E | Germany vs Curaçao | 17:00 | `fifwc-ger-kor-2026-06-14` |
| 10 | 2026-06-14 | F | Netherlands vs Japan | 20:00 | `fifwc-nld-jpn-2026-06-14` |
| 11 | 2026-06-14 | E | Côte d'Ivoire vs Ecuador | 23:00 | `fifwc-civ-ecu-2026-06-14` |
| 12 | 2026-06-14 | F | Sweden vs Tunisia | 02:00 | `fifwc-swe-tun-2026-06-14` |
| 13 | 2026-06-15 | H | Spain vs Cabo Verde | 16:00 | `fifwc-esp-cvi-2026-06-15` |
| 14 | 2026-06-15 | G | Belgium vs Egypt | 19:00 | `fifwc-bel-egy-2026-06-15` |
| 15 | 2026-06-15 | H | Saudi Arabia vs Uruguay | 22:00 | `fifwc-ksa-ury-2026-06-15` |
| 16 | 2026-06-15 | G | IR Iran vs New Zealand | 01:00 | `fifwc-irn-nzl-2026-06-15` |
| 17 | 2026-06-16 | I | France vs Senegal | 19:00 | `fifwc-fra-sen-2026-06-16` |
| 18 | 2026-06-16 | I | Iraq vs Norway | 22:00 | `fifwc-irq-nor-2026-06-16` |
| 19 | 2026-06-16 | J | Argentina vs Algeria | 01:00 | `fifwc-arg-alg-2026-06-16` |
| 20 | 2026-06-17 | J | Austria vs Jordan | 04:00 | `fifwc-aut-jor-2026-06-17` |
| 21 | 2026-06-17 | K | Portugal vs DR Congo | 17:00 | `fifwc-prt-cdr-2026-06-17` |
| 22 | 2026-06-17 | L | England vs Croatia | 20:00 | `fifwc-eng-hrv-2026-06-17` |
| 23 | 2026-06-17 | L | Ghana vs Panama | 23:00 | `fifwc-gha-pan-2026-06-17` |
| 24 | 2026-06-17 | K | Uzbekistan vs Colombia | 02:00 | `fifwc-uzb-col-2026-06-17` |
| 25 | 2026-06-18 | A | Czechia vs South Africa | 16:00 | `fifwc-cze-rsa-2026-06-18` |
| 26 | 2026-06-18 | B | Switzerland vs Bosnia-Herzegovina | 19:00 | `fifwc-che-bih-2026-06-18` |
| 27 | 2026-06-18 | B | Canada vs Qatar | 22:00 | `fifwc-can-qat-2026-06-18` |
| 28 | 2026-06-18 | A | Mexico vs Korea Republic | 01:00 | `fifwc-mex-kr-2026-06-18` |
| 29 | 2026-06-19 | D | United States vs Australia | 19:00 | `fifwc-usa-aus-2026-06-19` |
| 30 | 2026-06-19 | C | Scotland vs Morocco | 22:00 | `fifwc-sco-mar-2026-06-19` |
| 31 | 2026-06-19 | C | Brazil vs Haiti | 00:30 | `fifwc-bra-hai-2026-06-19` |
| 32 | 2026-06-19 | D | Türkiye vs Paraguay | 03:00 | `fifwc-tur-par-2026-06-19` |
| 33 | 2026-06-20 | F | Netherlands vs Sweden | 17:00 | `fifwc-nld-swe-2026-06-20` |
| 34 | 2026-06-20 | E | Germany vs Côte d'Ivoire | 20:00 | `fifwc-ger-civ-2026-06-20` |
| 35 | 2026-06-20 | E | Ecuador vs Curaçao | 00:00 | `fifwc-ecu-kor-2026-06-20` |
| 36 | 2026-06-21 | F | Tunisia vs Japan | 04:00 | `fifwc-tun-jpn-2026-06-21` |
| 37 | 2026-06-21 | H | Spain vs Saudi Arabia | 16:00 | `fifwc-esp-ksa-2026-06-21` |
| 38 | 2026-06-21 | G | Belgium vs IR Iran | 19:00 | `fifwc-bel-irn-2026-06-21` |
| 39 | 2026-06-21 | H | Uruguay vs Cabo Verde | 22:00 | `fifwc-ury-cvi-2026-06-21` |
| 40 | 2026-06-21 | G | New Zealand vs Egypt | 01:00 | `fifwc-nzl-egy-2026-06-21` |
| 41 | 2026-06-22 | J | Argentina vs Austria | 17:00 | `fifwc-arg-aut-2026-06-22` |
| 42 | 2026-06-22 | I | France vs Iraq | 21:00 | `fifwc-fra-irq-2026-06-22` |
| 43 | 2026-06-22 | I | Norway vs Senegal | 00:00 | `fifwc-nor-sen-2026-06-22` |
| 44 | 2026-06-22 | J | Jordan vs Algeria | 03:00 | `fifwc-jor-alg-2026-06-22` |
| 45 | 2026-06-23 | K | Portugal vs Uzbekistan | 17:00 | `fifwc-prt-uzb-2026-06-23` |
| 46 | 2026-06-23 | L | England vs Ghana | 20:00 | `fifwc-eng-gha-2026-06-23` |
| 47 | 2026-06-23 | L | Panama vs Croatia | 23:00 | `fifwc-pan-hrv-2026-06-23` |
| 48 | 2026-06-23 | K | Colombia vs DR Congo | 02:00 | `fifwc-col-cdr-2026-06-23` |
| 49 | 2026-06-24 | B | Bosnia-Herzegovina vs Qatar | 19:00 | `fifwc-bih-qat-2026-06-24` |
| 50 | 2026-06-24 | B | Switzerland vs Canada | 19:00 | `fifwc-che-can-2026-06-24` |
| 51 | 2026-06-24 | C | Morocco vs Haiti | 22:00 | `fifwc-mar-hai-2026-06-24` |
| 52 | 2026-06-24 | C | Scotland vs Brazil | 22:00 | `fifwc-sco-bra-2026-06-24` |
| 53 | 2026-06-24 | A | Czechia vs Mexico | 01:00 | `fifwc-cze-mex-2026-06-24` |
| 54 | 2026-06-24 | A | South Africa vs Korea Republic | 01:00 | `fifwc-rsa-kr-2026-06-24` |
| 55 | 2026-06-25 | E | Ecuador vs Germany | 20:00 | `fifwc-ecu-ger-2026-06-25` |
| 56 | 2026-06-25 | E | Curaçao vs Côte d'Ivoire | 20:00 | `fifwc-kor-civ-2026-06-25` |
| 57 | 2026-06-25 | F | Japan vs Sweden | 23:00 | `fifwc-jpn-swe-2026-06-25` |
| 58 | 2026-06-25 | F | Tunisia vs Netherlands | 23:00 | `fifwc-tun-nld-2026-06-25` |
| 59 | 2026-06-25 | D | Paraguay vs Australia | 02:00 | `fifwc-par-aus-2026-06-25` |
| 60 | 2026-06-25 | D | Türkiye vs United States | 02:00 | `fifwc-tur-usa-2026-06-25` |
| 61 | 2026-06-26 | I | Norway vs France | 19:00 | `fifwc-nor-fra-2026-06-26` |
| 62 | 2026-06-26 | I | Senegal vs Iraq | 19:00 | `fifwc-sen-irq-2026-06-26` |
| 63 | 2026-06-26 | H | Cabo Verde vs Saudi Arabia | 00:00 | `fifwc-cvi-ksa-2026-06-26` |
| 64 | 2026-06-26 | H | Uruguay vs Spain | 00:00 | `fifwc-ury-esp-2026-06-26` |
| 65 | 2026-06-26 | G | Egypt vs IR Iran | 03:00 | `fifwc-egy-irn-2026-06-26` |
| 66 | 2026-06-26 | G | New Zealand vs Belgium | 03:00 | `fifwc-nzl-bel-2026-06-26` |
| 67 | 2026-06-27 | L | Croatia vs Ghana | 21:00 | `fifwc-hrv-gha-2026-06-27` |
| 68 | 2026-06-27 | L | Panama vs England | 21:00 | `fifwc-pan-eng-2026-06-27` |
| 69 | 2026-06-27 | K | DR Congo vs Uzbekistan | 23:30 | `fifwc-cdr-uzb-2026-06-27` |
| 70 | 2026-06-27 | K | Colombia vs Portugal | 23:30 | `fifwc-col-prt-2026-06-27` |
| 71 | 2026-06-27 | J | Algeria vs Austria | 02:00 | `fifwc-alg-aut-2026-06-27` |
| 72 | 2026-06-27 | J | Jordan vs Argentina | 02:00 | `fifwc-jor-arg-2026-06-27` |

## 2. 小组头名（12 组）

- **A 组**: Czechia · Mexico · South Africa · South Korea
- **B 组**: Bosnia and Herzegovina · Canada · Qatar · Switzerland
- **C 组**: Brazil · Haiti · Morocco · Scotland
- **D 组**: Australia · Paraguay · Türkiye · USA
- **E 组**: Curaçao · Ecuador · Germany · Ivory Coast
- **F 组**: Japan · Netherlands · Sweden · Tunisia
- **G 组**: Belgium · Egypt · Iran · New Zealand
- **H 组**: Cape Verde · Saudi Arabia · Spain · Uruguay
- **I 组**: France · Iraq · Norway · Senegal
- **J 组**: Algeria · Argentina · Austria · Jordan
- **K 组**: Colombia · Congo DR · Portugal · Uzbekistan
- **L 组**: Croatia · England · Ghana · Panama

## 3. 八强名单（48 队，按字母排序）

| # | 球队 | market_slug |
|---|---|---|
| 1 | Algeria | `will-algeria-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134505` |
| 2 | Argentina | `will-argentina-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134503` |
| 3 | Australia | `will-australia-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134480` |
| 4 | Austria | `will-austria-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134504` |
| 5 | Belgium | `will-belgium-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134491` |
| 6 | Bosnia and Herzegovina | `will-bosnia-and-herzegovina-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134474` |
| 7 | Brazil | `will-brazil-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134475` |
| 8 | Canada | `will-canada-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134471` |
| 9 | Cape Verde | `will-cape-verde-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134498` |
| 10 | Colombia | `will-colombia-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134508` |
| 11 | Croatia | `will-croatia-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134512` |
| 12 | Curacao | `will-curacao-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134486` |
| 13 | Czechia | `will-czechia-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134470` |
| 14 | DR Congo | `will-dr-congo-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134510` |
| 15 | Ecuador | `will-ecuador-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134484` |
| 16 | Egypt | `will-egypt-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134493` |
| 17 | England | `will-england-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134511` |
| 18 | France | `will-france-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134499` |
| 19 | Germany | `will-germany-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134483` |
| 20 | Ghana | `will-ghana-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134514` |
| 21 | Haiti | `will-haiti-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134478` |
| 22 | Iran | `will-iran-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134492` |
| 23 | Iraq | `will-iraq-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134502` |
| 24 | Ivory Coast | `will-ivory-coast-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134485` |
| 25 | Japan | `will-japan-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134488` |
| 26 | Jordan | `will-jordan-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134506` |
| 27 | Mexico | `will-mexico-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134467` |
| 28 | Morocco | `will-morocco-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134476` |
| 29 | Netherlands | `will-netherlands-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134487` |
| 30 | New Zealand | `will-new-zealand-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134494` |
| 31 | Norway | `will-norway-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134501` |
| 32 | Panama | `will-panama-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134513` |
| 33 | Paraguay | `will-paraguay-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134481` |
| 34 | Portugal | `will-portugal-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134507` |
| 35 | Qatar | `will-qatar-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134473` |
| 36 | Saudi Arabia | `will-saudi-arabia-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134497` |
| 37 | Scotland | `will-scotland-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134477` |
| 38 | Senegal | `will-senegal-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134500` |
| 39 | South Africa | `will-south-africa-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134469` |
| 40 | South Korea | `will-south-korea-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134468` |
| 41 | Spain | `will-spain-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134495` |
| 42 | Sweden | `will-sweden-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134490` |
| 43 | Switzerland | `will-switzerland-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134472` |
| 44 | Tunisia | `will-tunisia-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134489` |
| 45 | Turkiye | `will-turkiye-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134482` |
| 46 | Uruguay | `will-uruguay-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134496` |
| 47 | USA | `will-usa-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134479` |
| 48 | Uzbekistan | `will-uzbekistan-reach-the-quarterfinals-at-the-2026-fifa-world-cup-20260602145134509` |

## 4. 四强名单（48 队）

| # | 球队 | market_slug |
|---|---|---|
| 1 | Algeria | `will-algeria-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149747` |
| 2 | Argentina | `will-argentina-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149745` |
| 3 | Australia | `will-australia-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149722` |
| 4 | Austria | `will-austria-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149746` |
| 5 | Belgium | `will-belgium-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149733` |
| 6 | Bosnia and Herzegovina | `will-bosnia-and-herzegovina-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149716` |
| 7 | Brazil | `will-brazil-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149717` |
| 8 | Canada | `will-canada-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149713` |
| 9 | Cape Verde | `will-cape-verde-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149740` |
| 10 | Colombia | `will-colombia-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149750` |
| 11 | Croatia | `will-croatia-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149754` |
| 12 | Curacao | `will-curacao-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149728` |
| 13 | Czechia | `will-czechia-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149712` |
| 14 | DR Congo | `will-dr-congo-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149752` |
| 15 | Ecuador | `will-ecuador-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149726` |
| 16 | Egypt | `will-egypt-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149735` |
| 17 | England | `will-england-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149753` |
| 18 | France | `will-france-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149741` |
| 19 | Germany | `will-germany-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149725` |
| 20 | Ghana | `will-ghana-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149756` |
| 21 | Haiti | `will-haiti-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149720` |
| 22 | Iran | `will-iran-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149734` |
| 23 | Iraq | `will-iraq-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149744` |
| 24 | Ivory Coast | `will-ivory-coast-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149727` |
| 25 | Japan | `will-japan-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149730` |
| 26 | Jordan | `will-jordan-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149748` |
| 27 | Mexico | `will-mexico-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149709` |
| 28 | Morocco | `will-morocco-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149718` |
| 29 | Netherlands | `will-netherlands-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149729` |
| 30 | New Zealand | `will-new-zealand-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149736` |
| 31 | Norway | `will-norway-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149743` |
| 32 | Panama | `will-panama-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149755` |
| 33 | Paraguay | `will-paraguay-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149723` |
| 34 | Portugal | `will-portugal-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149749` |
| 35 | Qatar | `will-qatar-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149715` |
| 36 | Saudi Arabia | `will-saudi-arabia-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149739` |
| 37 | Scotland | `will-scotland-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149719` |
| 38 | Senegal | `will-senegal-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149742` |
| 39 | South Africa | `will-south-africa-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149711` |
| 40 | South Korea | `will-south-korea-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149710` |
| 41 | Spain | `will-spain-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149737` |
| 42 | Sweden | `will-sweden-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149732` |
| 43 | Switzerland | `will-switzerland-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149714` |
| 44 | Tunisia | `will-tunisia-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149731` |
| 45 | Turkiye | `will-turkiye-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149724` |
| 46 | Uruguay | `will-uruguay-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149738` |
| 47 | USA | `will-usa-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149721` |
| 48 | Uzbekistan | `will-uzbekistan-reach-the-semifinals-at-the-2026-fifa-world-cup-20260602145149751` |

## 5. 冠军（48 队）

| # | 球队 | market_slug |
|---|---|---|
| 1 | Algeria | `will-algeria-win-the-2026-fifa-world-cup` |
| 2 | Argentina | `will-argentina-win-the-2026-fifa-world-cup-245` |
| 3 | Australia | `will-australia-win-the-2026-fifa-world-cup-816` |
| 4 | Austria | `will-austria-win-the-2026-fifa-world-cup` |
| 5 | Belgium | `will-belgium-win-the-2026-fifa-world-cup-358` |
| 6 | Bosnia-Herzegovina | `will-bosnia-herzegovina-win-the-2026-fifa-world-cup` |
| 7 | Brazil | `will-brazil-win-the-2026-fifa-world-cup-183` |
| 8 | Canada | `will-canada-win-the-2026-fifa-world-cup-755` |
| 9 | Cape Verde | `will-cape-verde-win-the-2026-fifa-world-cup` |
| 10 | Colombia | `will-colombia-win-the-2026-fifa-world-cup-734` |
| 11 | Congo DR | `will-congo-dr-win-the-2026-fifa-world-cup` |
| 12 | Croatia | `will-croatia-win-the-2026-fifa-world-cup` |
| 13 | Curaçao | `will-curaao-win-the-2026-fifa-world-cup` |
| 14 | Czechia | `will-czechia-win-the-2026-fifa-world-cup` |
| 15 | Ecuador | `will-ecuador-win-the-2026-fifa-world-cup-986` |
| 16 | Egypt | `will-egypt-win-the-2026-fifa-world-cup` |
| 17 | England | `will-england-win-the-2026-fifa-world-cup-937` |
| 18 | France | `will-france-win-the-2026-fifa-world-cup-924` |
| 19 | Germany | `will-germany-win-the-2026-fifa-world-cup-467` |
| 20 | Ghana | `will-ghana-win-the-2026-fifa-world-cup` |
| 21 | Haiti | `will-haiti-win-the-2026-fifa-world-cup` |
| 22 | Iran | `will-iran-win-the-2026-fifa-world-cup-788` |
| 23 | Iraq | `will-iraq-win-the-2026-fifa-world-cup` |
| 24 | Ivory Coast | `will-ivory-coast-win-the-2026-fifa-world-cup` |
| 25 | Japan | `will-japan-win-the-2026-fifa-world-cup-112` |
| 26 | Jordan | `will-jordan-win-the-2026-fifa-world-cup-233` |
| 27 | Mexico | `will-mexico-win-the-2026-fifa-world-cup-529` |
| 28 | Morocco | `will-morocco-win-the-2026-fifa-world-cup-464` |
| 29 | Netherlands | `will-netherlands-win-the-2026-fifa-world-cup-739` |
| 30 | New Zealand | `will-new-zealand-win-the-2026-fifa-world-cup-635` |
| 31 | Norway | `will-norway-win-the-2026-fifa-world-cup-893` |
| 32 | Panama | `will-team-z-win-the-2026-fifa-world-cup-316` |
| 33 | Paraguay | `will-paraguay-win-the-2026-fifa-world-cup-967` |
| 34 | Portugal | `will-portugal-win-the-2026-fifa-world-cup-912` |
| 35 | Qatar | `will-qatar-win-the-2026-fifa-world-cup` |
| 36 | Saudi Arabia | `will-saudi-arabia-win-the-2026-fifa-world-cup` |
| 37 | Scotland | `will-scotland-win-the-2026-fifa-world-cup` |
| 38 | Senegal | `will-senegal-win-the-2026-fifa-world-cup` |
| 39 | South Africa | `will-south-africa-win-the-2026-fifa-world-cup` |
| 40 | South Korea | `will-south-korea-win-the-2026-fifa-world-cup-485` |
| 41 | Spain | `will-spain-win-the-2026-fifa-world-cup-963` |
| 42 | Sweden | `will-sweden-win-the-2026-fifa-world-cup` |
| 43 | Switzerland | `will-switzerland-win-the-2026-fifa-world-cup` |
| 44 | Tunisia | `will-tunisia-win-the-2026-fifa-world-cup-165` |
| 45 | Turkiye | `will-turkiye-win-the-2026-fifa-world-cup` |
| 46 | Uruguay | `will-uruguay-win-the-2026-fifa-world-cup-932` |
| 47 | USA | `will-usa-win-the-2026-fifa-world-cup-467` |
| 48 | Uzbekistan | `will-uzbekistan-win-the-2026-fifa-world-cup-773` |

---

本清单提供基于公开数据的概率研究范围定义，不构成任何金融、投资或投注建议。
