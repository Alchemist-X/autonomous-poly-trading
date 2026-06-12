# -*- coding: utf-8 -*-
import json, os

BASE = '/Users/Aincrad/dev-proj/predict-raven/runtime-artifacts/world-cup'
OUT = os.path.join(BASE, 'reports', 'champion')

with open(os.path.join(BASE, 'mc-results.json')) as f:
    mc = json.load(f)
teams = mc['teams']

ADJ = {
    'Spain': 0.96, 'Argentina': 0.98, 'France': 1.05, 'England': 1.05,
    'Brazil': 0.85, 'Colombia': 1.05, 'Netherlands': 0.85, 'Germany': 0.90,
}
raw = {k: v['p_champion'] * ADJ.get(k, 1.0) for k, v in teams.items()}
s = sum(raw.values())
final = {k: v / s for k, v in raw.items()}

# mc-name -> (polymarket leg label, CN name, group, elo, world rank)
META = {
 'Spain': ('Spain','西班牙','H',2157,1), 'Argentina': ('Argentina','阿根廷','J',2115,2),
 'France': ('France','法国','I',2063,3), 'England': ('England','英格兰','L',2024,4),
 'Brazil': ('Brazil','巴西','C',1991,5), 'Portugal': ('Portugal','葡萄牙','K',1989,6),
 'Colombia': ('Colombia','哥伦比亚','K',1982,7), 'Netherlands': ('Netherlands','荷兰','F',1948,8),
 'Ecuador': ('Ecuador','厄瓜多尔','E',1938,9), 'Germany': ('Germany','德国','E',1932,10),
 'Norway': ('Norway','挪威','I',1914,11), 'Croatia': ('Croatia','克罗地亚','L',1912,12),
 'Türkiye': ('Turkiye','土耳其','D',1911,13), 'Japan': ('Japan','日本','F',1906,14),
 'Belgium': ('Belgium','比利时','G',1894,15), 'Uruguay': ('Uruguay','乌拉圭','H',1892,16),
 'Switzerland': ('Switzerland','瑞士','B',1891,17), 'Mexico': ('Mexico','墨西哥','A',1875,18),
 'Senegal': ('Senegal','塞内加尔','I',1860,21), 'Paraguay': ('Paraguay','巴拉圭','D',1834,22),
 'Austria': ('Austria','奥地利','J',1830,23), 'Morocco': ('Morocco','摩洛哥','C',1827,24),
 'Canada': ('Canada','加拿大','B',1788,25), 'Scotland': ('Scotland','苏格兰','C',1782,26),
 'Australia': ('Australia','澳大利亚','D',1777,28), 'IR Iran': ('Iran','伊朗','G',1772,29),
 'Algeria': ('Algeria','阿尔及利亚','J',1772,29), 'Korea Republic': ('South Korea','韩国','A',1758,33),
 'Czechia': ('Czechia','捷克','A',1740,35), 'Panama': ('Panama','巴拿马','L',1730,38),
 'United States': ('USA','美国','D',1726,39), 'Uzbekistan': ('Uzbekistan','乌兹别克斯坦','K',1714,42),
 'Sweden': ('Sweden','瑞典','F',1712,43), 'Egypt': ('Egypt','埃及','G',1696,48),
 "Côte d'Ivoire": ('Ivory Coast','科特迪瓦','E',1695,49), 'Jordan': ('Jordan','约旦','J',1680,52),
 'DR Congo': ('Congo DR','刚果（金）','K',1652,55), 'Tunisia': ('Tunisia','突尼斯','F',1628,58),
 'Iraq': ('Iraq','伊拉克','I',1607,63), 'Bosnia-Herzegovina': ('Bosnia-Herzegovina','波黑','B',1595,65),
 'Cabo Verde': ('Cape Verde','佛得角','H',1578,68), 'Saudi Arabia': ('Saudi Arabia','沙特阿拉伯','H',1576,69),
 'New Zealand': ('New Zealand','新西兰','G',1562,72), 'Haiti': ('Haiti','海地','C',1548,73),
 'South Africa': ('South Africa','南非','A',1517,80), 'Ghana': ('Ghana','加纳','L',1510,81),
 'Curaçao': ('Curaçao','库拉索','E',1434,91), 'Qatar': ('Qatar','卡塔尔','B',1421,96),
}

R = {  # mc-name -> (reason_cn, reason_en)
 'Spain': ('Elo 2157 世界第 1、与第 2 名差 42 分；H 组（乌拉圭/沙特/佛得角）出线无虞；唯一隐忧是亚马尔腹股沟伤势的负荷管理与费尔明伤缺，故小幅下调。',
           'Elo 2157, world No. 1 by 42 points; Group H (Uruguay/Saudi Arabia/Cape Verde) poses little exit risk; only concerns are managing Lamine Yamal\'s groin issue and Fermin Lopez\'s absence, hence a small trim.'),
 'Argentina': ('卫冕冠军，Elo 2115 世界第 2；J 组（奥地利/阿尔及利亚/约旦）偏软；梅西腿筋伤愈复出即对冰岛进球，但罗梅罗（膝）、莫利纳（大腿）带伤，微幅下调。',
           'Defending champions, Elo 2115 world No. 2; soft Group J (Austria/Algeria/Jordan); Messi returned from his hamstring issue and scored vs Iceland, but Romero (knee) and Molina (thigh) carry knocks — tiny trim.'),
 'France': ('Elo 2063 世界第 3；I 组有挪威/塞内加尔但头名概率 70%；主力框架无重大伤病（仅埃基蒂克缺席），相对伤病潮中的对手获小幅上调。',
           'Elo 2063, world No. 3; Group I contains Norway/Senegal yet France win it 70% of the time; core squad healthy (only Ekitike missing) — small upgrade relative to injury-hit rivals.'),
 'England': ('Elo 2024 世界第 4；L 组除克罗地亚外无强敌；阵容齐整（仅本·怀特因膝伤缺席），小幅上调。',
           'Elo 2024, world No. 4; Group L has no heavyweight beyond Croatia; squad essentially intact (only Ben White out with a knee injury) — small upgrade.'),
 'Portugal': ('Elo 1989 世界第 6；K 组与哥伦比亚的头名之争（50% vs 47%）决定淘汰赛签位；未检索到重大伤病消息，维持基线。',
           'Elo 1989, world No. 6; the Group K top-spot duel with Colombia (50% vs 47%) decides their bracket path; no material injury news found — baseline kept.'),
 'Brazil': ('Elo 1991 世界第 5，但内马尔小腿伤出战首战存疑，罗德里戈（十字韧带）、米利唐（手术）、埃斯特旺（腿筋）均无缘，攻防两端减员严重，下调 15%。',
           'Elo 1991, world No. 5, but Neymar\'s calf makes the opener doubtful while Rodrygo (ACL), Militao (surgery) and Estevao (hamstring) are all out — heavy attrition at both ends, downgraded 15%.'),
 'Colombia': ('Elo 1982 世界第 7；迪亚斯、J 罗领衔的主力班底满编出战；K 组对葡萄牙的头名之争胜负五五开，小幅上调。',
           'Elo 1982, world No. 7; full-strength core led by Luis Diaz and James Rodriguez; the Group K race with Portugal is a coin flip — small upgrade.'),
 'Netherlands': ('Elo 1948 世界第 8，但廷贝尔（腹股沟）、西蒙斯（膝）、斯豪滕（膝）、德利赫特（背）集体伤缺，防线与中场中轴受损，下调 15%。',
           'Elo 1948, world No. 8, but Timber (groin), Xavi Simons (knee), Schouten (knee) and De Ligt (back) are all out — the defensive and midfield spine is gutted, downgraded 15%.'),
 'Ecuador': ('Elo 1938 世界第 9，南美区预选赛防守冠绝；E 组与德国争头名几乎五五开（50% vs 47%）；无负面消息，维持基线。',
           'Elo 1938, world No. 9 with an elite defensive record; the Group E top-spot race with Germany is nearly even (50% vs 47%); no negative news — baseline kept.'),
 'Germany': ('Elo 1932 世界第 10；特尔施特根、格纳布里、卡尔均伤缺（维尔茨在列）；E 组对厄瓜多尔不占优，下调 10%。',
           'Elo 1932, world No. 10; Ter Stegen, Gnabry and Karl all out injured (Wirtz is in); no edge over Ecuador in Group E — downgraded 10%.'),
 'Türkiye': ('Elo 1911 世界第 13；D 组头名最大热门（49%），新黄金一代成色十足，但淘汰赛深处对位顶级强队时硬实力差距显现。',
           'Elo 1911, world No. 13; favourite to win Group D (49%) with a genuine golden generation, but the rating gap shows once they meet elite sides deep in the bracket.'),
 'Norway': ('Elo 1914 世界第 11；哈兰德领衔的进攻火力强，但 I 组头名难越法国（19% vs 70%），多数路径从次席走更硬的半区。',
           'Elo 1914, world No. 11; Haaland-led attack is real, but topping Group I past France is hard (19% vs 70%), so most paths run through the tougher side as runners-up.'),
 'Croatia': ('Elo 1912 世界第 12；L 组次席最可能（28% 头名），淘汰赛经验丰富但阵容老化，R32 起即可能撞强敌。',
           'Elo 1912, world No. 12; most likely Group L runner-up (28% to win it); deep tournament pedigree but an ageing core, and strong opponents can appear from the R32 onward.'),
 'Belgium': ('Elo 1894 世界第 15；G 组头名大热（68%），前两轮赛程友好，但八强往上对位 Elo 2000+ 球队时胜率快速衰减。',
           'Elo 1894, world No. 15; strong favourite for Group G (68%) with a friendly early schedule, but win rates fall fast once 2000+ Elo sides appear from the QF up.'),
 'Japan': ('Elo 1906 世界第 14；F 组与荷兰争头名（39% vs 56%），荷兰的伤病潮间接改善其小组走位与淘汰赛签位。',
           'Elo 1906, world No. 14; chasing the Netherlands for Group F (39% vs 56%) — the Dutch injury wave indirectly improves Japan\'s group and bracket position.'),
 'Switzerland': ('Elo 1891 世界第 17；B 组与加拿大头名之争五五开（50% vs 48%）；一贯稳健，但缺乏冠军级的进攻上限。',
           'Elo 1891, world No. 17; the Group B race with Canada is even (50% vs 48%); reliably solid, but lacks a title-level attacking ceiling.'),
 'Uruguay': ('Elo 1892 世界第 16；H 组撞上西班牙，基本锁定从次席进入更硬的淘汰赛路径，冠军概率被签位压制。',
           'Elo 1892, world No. 16; drawn with Spain in Group H, so effectively locked into the harder knockout path as runners-up — title odds suppressed by the draw.'),
 'Mexico': ('东道主，小组赛全部在本土高原主场（头名概率 79%），但 Elo 1875（第 18）的硬实力使晋级概率在淘汰赛逐轮快速衰减。',
           'Host nation with all group games at home altitude venues (79% to win Group A), but at Elo 1875 (No. 18) survival odds decay quickly each knockout round.'),
 'Senegal': ('Elo 1860 世界第 21，非洲区 Elo 最高；I 组第三热门，需先在挪威/法国的夹缝中突围。',
           'Elo 1860, world No. 21 and Africa\'s top-rated side; third favourite in Group I, needing to squeeze past Norway and France first.'),
 'Paraguay': ('Elo 1834 世界第 22；D 组出线概率可观（次席争夺主力），但淘汰赛硬实力天花板有限。',
           'Elo 1834, world No. 22; decent odds to advance from Group D as a runner-up contender, but a limited ceiling once the knockouts begin.'),
 'Morocco': ('Elo 1827 世界第 24；2022 四强班底犹在，C 组次席热门（17% 头名），但巴西挡在头名路上。',
           'Elo 1827, world No. 24; the 2022 semi-final core remains and they are Group C runner-up favourites (17% to win it), with Brazil blocking top spot.'),
 'Austria': ('Elo 1830 世界第 23；J 组次席最可能，阿根廷头名几无悬念，出线后上限受签位限制。',
           'Elo 1830, world No. 23; likeliest Group J runner-up with Argentina near-certain to top it — bracket position caps the upside.'),
 'Canada': ('东道主、小组赛主场加成（B 组头名 48%），但 Elo 1788（第 25）意味着淘汰赛中前段即遇强敌。',
           'Co-host with home group games (48% to win Group B), but Elo 1788 (No. 25) means elite opposition arrives early in the knockouts.'),
 'Scotland': ('Elo 1782 世界第 26；C 组与摩洛哥争次席，冠军概率仅剩统计尾部。',
           'Elo 1782, world No. 26; fighting Morocco for second in Group C — title probability is statistical tail only.'),
 'IR Iran': ('Elo 1772 世界第 29；G 组次席有力争夺者（22% 头名），但淘汰赛对位欧美强队的胜率低。',
           'Elo 1772, world No. 29; a real Group G runner-up contender (22% to win it), but win rates vs top European/South American sides are low.'),
 'Korea Republic': ('Elo 1758 世界第 33；孙兴慜第四次出战世界杯领衔，A 组次席有戏，深度晋级需连续爆冷。',
           'Elo 1758, world No. 33; Son Heung-min leads his fourth World Cup and second place in Group A is live, but a deep run needs repeated upsets.'),
 'Czechia': ('Elo 1740 世界第 35；A 组与韩国争次席，末轮客战阿兹特克，冠军概率属尾部。',
           'Elo 1740, world No. 35; battling South Korea for second in Group A with a final-round trip to the Azteca — tail probability.'),
 'Australia': ('Elo 1777 世界第 28；D 组第三热门，即便出线，淘汰赛上限有限。',
           'Elo 1777, world No. 28; third pick in Group D, and even if they advance the knockout ceiling is modest.'),
 'Algeria': ('Elo 1772 世界第 29；J 组次席争夺者之一，且身处阿根廷的半区路径。',
           'Elo 1772, world No. 29; one of the Group J runner-up contenders, sitting on Argentina\'s side of the path.'),
 'Panama': ('Elo 1730 世界第 38；L 组面对英格兰/克罗地亚出线已属冷门，尾部概率。',
           'Elo 1730, world No. 38; merely advancing past England/Croatia in Group L would be an upset — tail probability.'),
 'United States': ('东道主、小组赛主场加成，但 Elo 1726 仅列第 39，D 组头名概率不足 20%，模型冠军概率接近于零。',
           'Co-host with home group games, but at Elo 1726 (No. 39) they win Group D under 20% of the time and the model title probability is near zero.'),
 'Sweden': ('Elo 1712 世界第 43；F 组第三，出线本身已是冷门。', 'Elo 1712, world No. 43; third wheel in Group F — advancing would itself be a surprise.'),
 'Egypt': ('Elo 1696 世界第 48；萨拉赫领衔，但 G 组次席之争落后于伊朗。', 'Elo 1696, world No. 48; Salah leads, but they trail Iran in the Group G runner-up race.'),
 'Jordan': ('Elo 1680 世界第 52；J 组陪跑，数学尾部。', 'Elo 1680, world No. 52; making up the numbers in Group J — mathematical tail.'),
 'South Africa': ('Elo 1517 世界第 80；A 组最弱且 2026 年至今不胜，模拟中从未夺冠。', 'Elo 1517, world No. 80; weakest in Group A and winless in 2026 — never won in simulation.'),
 'Bosnia-Herzegovina': ('Elo 1595 世界第 65；B 组出线概率约 2%，冠军概率四舍五入为 0。', 'Elo 1595, world No. 65; about 2% to even win Group B — title probability rounds to zero.'),
 'Qatar': ('Elo 1421，全部 48 队中最低之一；B 组陪跑。', 'Elo 1421, among the lowest of all 48 teams; also-ran in Group B.'),
 'Haiti': ('Elo 1548 世界第 73；C 组尾部。', 'Elo 1548, world No. 73; Group C tail.'),
 "Côte d'Ivoire": ('Elo 1695 世界第 49；E 组第三，偶有爆冷潜力但冠军概率≈0。', 'Elo 1695, world No. 49; Group E third pick with upset potential, but title probability is ~0.'),
 'Curaçao': ('Elo 1434 世界第 91；史上最小参赛国之一，E 组尾部。', 'Elo 1434, world No. 91; one of the smallest nations ever at a World Cup — Group E tail.'),
 'Tunisia': ('Elo 1628 世界第 58；F 组尾部。', 'Elo 1628, world No. 58; Group F tail.'),
 'New Zealand': ('Elo 1562 世界第 72；G 组尾部。', 'Elo 1562, world No. 72; Group G tail.'),
 'Saudi Arabia': ('Elo 1576 世界第 69；与西班牙同组，尾部。', 'Elo 1576, world No. 69; sharing a group with Spain — tail.'),
 'Cabo Verde': ('Elo 1578 世界第 68；历史性首次参赛，H 组尾部。', 'Elo 1578, world No. 68; historic debutants, Group H tail.'),
 'Iraq': ('Elo 1607 世界第 63；I 组尾部。', 'Elo 1607, world No. 63; Group I tail.'),
 'Uzbekistan': ('Elo 1714 世界第 42；首次参赛，K 组面对葡萄牙/哥伦比亚出线已难。', 'Elo 1714, world No. 42; debutants who already face long odds of escaping Portugal and Colombia in Group K.'),
 'DR Congo': ('Elo 1652 世界第 55；附加赛奇迹晋级，K 组尾部。', 'Elo 1652, world No. 55; miracle playoff qualifiers — Group K tail.'),
 'Ghana': ('Elo 1510 世界第 81，48 队中 Elo 最低档；L 组尾部。', 'Elo 1510, world No. 81, in the lowest Elo band of all 48; Group L tail.'),
}

ADJ_NOTE_CN = {
 'Spain': '−4%', 'Argentina': '−2%', 'France': '+5%', 'England': '+5%',
 'Brazil': '−15%', 'Colombia': '+5%', 'Netherlands': '−15%', 'Germany': '−10%',
}

rows = sorted(final.items(), key=lambda kv: -kv[1])

def pct(p):
    if p >= 0.01: return f"{p*100:.1f}%"
    if p >= 0.0001: return f"{p*100:.3f}%"
    if p > 0: return f"{p*100:.4f}%"
    return "≈0%"

# ---------- prediction.json ----------
outcomes = []
for k, p in rows:
    label, cn, grp, elo, rank = META[k]
    outcomes.append({"key": label, "label_cn": cn, "label_en": label, "p": round(p, 6)})

one_cn = "西班牙以约37%居首，阿根廷约24%、法国约14%紧随——Elo前四档断层使西阿法英四队合计约82%；巴西、荷兰因多名主力伤缺被有界下调。"
one_en = "Spain leads at ~37% with Argentina ~24% and France ~14% — the top-four Elo tier (Spain/Argentina/France/England) combines for ~82%, while Brazil and the Netherlands take bounded downgrades for multiple key injuries."

pred = {
 "id": "champion", "family": "champion", "event_slug": "world-cup-winner",
 "question_cn": "哪支球队赢得 2026 世界杯冠军？（以 2026-07-19 决赛结果为准，含加时与点球）",
 "question_en": "Which team wins the 2026 FIFA World Cup? (Decided by the 2026-07-19 final, including extra time and penalties)",
 "kickoff_utc": None, "generated_at": "2026-06-11T13:15:00Z",
 "outcomes": outcomes,
 "one_liner_cn": one_cn, "one_liner_en": one_en,
 "key_reasons": [
   {"cn": "Elo 断层：西班牙 2157、阿根廷 2115、法国 2063、英格兰 2024 与第五名拉开 30+ 分差距，10 万次蒙特卡洛中四队合计夺冠概率约 82%。",
    "en": "Elo stratification: Spain 2157, Argentina 2115, France 2063 and England 2024 sit 30+ points clear of fifth place; the four combine for ~82% of titles across 100k Monte Carlo runs.",
    "source_url": "https://www.eloratings.net/", "source_date": "2026-06-11"},
   {"cn": "伤病不对称：巴西（内马尔存疑，罗德里戈/米利唐/埃斯特旺缺席）、荷兰（廷贝尔/西蒙斯/德利赫特/斯豪滕缺席）、德国（特尔施特根/格纳布里缺席）遭遇减员潮，而法国、英格兰、哥伦比亚主力齐整——据此做有界上下调。",
    "en": "Injury asymmetry: Brazil (Neymar doubtful; Rodrygo/Militao/Estevao out), the Netherlands (Timber/Simons/De Ligt/Schouten out) and Germany (Ter Stegen/Gnabry out) are depleted while France, England and Colombia are near full strength — driving the bounded adjustments.",
    "source_url": "https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info", "source_date": "2026-06-11"},
   {"cn": "新赛制放大强弱差：48 队 104 场、新增 32 强轮，夺冠需连赢 5 轮淘汰赛，Elo 优势逐轮复利，头部球队的边际概率被进一步推高。",
    "en": "The new format amplifies strength gaps: with 48 teams, 104 matches and an added round of 32, the champion must win five straight knockout rounds, compounding the Elo edge of the top tier.",
    "source_url": "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026", "source_date": "2026-06-11"},
 ],
 "confidence_tier": "中",
 "n_sources": 10,
 "method_note": "100k-sim pure-Elo Poisson Monte Carlo (eloratings.net snapshot 2026-06-11, official FIFA 2026 bracket, hosts +100 Elo in group stage only; seed 20260611) + evidence-bounded per-team adjustment (max ±20% relative, max applied ±15%), renormalized to sum 1. Market-blind: no betting or prediction-market inputs of any kind.",
 "report": "report.md",
}
with open(os.path.join(OUT, 'prediction.json'), 'w') as f:
    json.dump(pred, f, ensure_ascii=False, indent=2)

# ---------- report.md (CN) ----------
def table_cn():
    lines = ["| # | 球队 | 组 | Elo（世界排名） | 统计基线 | 调整 | **最终概率** | 一句话理由 |",
             "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for i, (k, p) in enumerate(rows, 1):
        label, cn, grp, elo, rank = META[k]
        base = teams[k]['p_champion']
        adjn = ADJ_NOTE_CN.get(k, '—')
        lines.append(f"| {i} | **{cn} {label}** | {grp} | {elo}（#{rank}） | {pct(base)} | {adjn} | **{pct(p)}** | {R[k][0]} |")
    return "\n".join(lines)

def table_en():
    lines = ["| # | Team | Grp | Elo (world rank) | Statistical baseline | Adj. | **Final p** | One-line rationale |",
             "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for i, (k, p) in enumerate(rows, 1):
        label, cn, grp, elo, rank = META[k]
        base = teams[k]['p_champion']
        adjn = ADJ_NOTE_CN.get(k, '—')
        lines.append(f"| {i} | **{label}** | {grp} | {elo} (#{rank}) | {pct(base)} | {adjn} | **{pct(p)}** | {R[k][1]} |")
    return "\n".join(lines)

top5 = ", ".join(f"{META[k][1]} {pct(p)}" for k, p in rows[:5])

DISCLAIMER_CN = "本报告提供基于公开数据的概率估计与研究分析，不构成任何金融、投资或投注建议。所有预测均为概率而非确定性结果；过往表现不代表未来。预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。我们不接受、不撮合任何投注，也不提供任何博彩平台资金通道。"
DISCLAIMER_EN = "This report provides probability estimates and research analysis based on public data. It is not financial, investment, or betting advice. All forecasts are probabilities, not certainties; past performance does not guarantee future results. Prediction markets and sports betting are restricted or illegal in many jurisdictions; check your local laws. 18+. We do not accept or facilitate any wagers."

SOURCES = """1. eloratings.net World Football Elo（2026-06-11 快照，本仓库 `../../elo-table.json`）— https://www.eloratings.net/
2. ESPN 2026 World Cup injuries tracker（廷贝尔/西蒙斯/德利赫特/斯豪滕、内马尔、特尔施特根/格纳布里等伤情）— https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info （2026-06-11 查阅）
3. UPI：Spain, Brazil, Argentina, U.S. injuries could factor into World Cup（亚马尔/梅西/罗梅罗/莫利纳伤情）— https://www.upi.com/Sports_News/Soccer/2026/06/10/World-Cup-injuries-Spain-Argentina-Iceland/4671780927848/ （2026-06-10）
4. Yahoo Sports：Spain, Brazil, Argentina, U.S. injuries could factor into World Cup — https://sports.yahoo.com/articles/spain-brazil-argentina-u-injuries-152522277.html （2026-06-10）
5. Sports Mole：World Cup 2026 injury list and return dates（Ekitike/Rodrygo/Xavi Simons 等）— https://www.sportsmole.co.uk/football/england/world-cup/feature/world-cup-injury-list-absent-players-and-doubts_597036.html （2026-06-11 查阅）
6. Goal.com：Cole Palmer, Rodrygo and the biggest stars who are missing from the 2026 World Cup（埃斯特旺/罗德里戈/米利唐等）— https://www.goal.com/en/lists/biggest-stars-miss-2026-world-cup-injury-suspension-selection/bltd6ff2d56ebf99a62 （2026-06-11 查阅）
7. Flashscore：Which star players are ruled out of the 2026 World Cup through injury? — https://www.flashscore.com/news/soccer-world-championship-the-major-names-who-will-miss-the-2026-world-cup-through-injury/MejPJJqJ/ （2026-06-11 查阅）
8. karlobag.eu：Injuries before the 2026 World Cup: Timber, Karl and Wesley ruled out（2026-06-08 廷贝尔退出）— https://karlobag.eu/en/sports/injuries-before-the-2026-world-cup-timber-karl-and-wesley-ruled-out-of-major-squ-cxafy/ （2026-06-11 查阅）
9. FIFA：Diaz and James headline Colombia squad（哥伦比亚满编名单）— https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/colombia-squad-announced （2026-06-02）
10. ESPN：2026 World Cup: Squad lists for all 48 teams（6 月 2 日 26 人名单截止）— https://www.espn.com/soccer/story/_/id/48757621/2026-world-cup-squad-lists-players-announced-all-48-teams （2026-06-11 查阅）"""

report_cn = f"""# 2026 世界杯冠军预测报告（48 队全员概率）

- **预测问题**：哪支球队赢得 2026 世界杯冠军？（以 2026-07-19 决赛结果为准，含加时与点球）
- **结算事件 slug（仅作结算元数据）**：`world-cup-winner`
- **报告生成时间**：2026-06-11T13:15:00Z（揭幕战次日、绝大多数球队首战之前）
- **市场盲声明**：本预测完全独立于任何博彩赔率与预测市场——制作过程中未获取、未参考任何盘口数据；概率仅来自 Elo/蒙特卡洛统计模型加有上限的证据化调整。
- 英文版：[`report.en.md`](report.en.md)；机器可读结果：[`prediction.json`](prediction.json)

## ① 最可能冠军名单

**前五名：{top5}。**

**一句话观点**：{one_cn}

置信档：**中**——方向上信心较高（Elo 前四档断层 + 伤病证据一致指向头部集中），幅度上保留意见：纯 Elo 模型给头号种子的概率（西班牙 ~37%）高于历届"赛前最大热门"的历史夺冠基率（约 20–25%），单一评分体系可能低估七场制长赛程中的伤病、红牌与点球随机性。

## ② 完整 48 队概率表（按最终概率降序）

{table_cn()}

> 表内"调整"为相对调整（上限 ±20%），调整后全表重新归一化（归一化因子 ≈ +1.75%，未调整球队的最终值因此略高于基线）。"≈0%"表示 10 万次模拟中夺冠次数为 0（< 0.001%）。

## ③ Bracket 相关性 caveat（重要）

本表给出的是**边际概率**：每队单独看的夺冠概率。但 48 队的命运不是独立的——淘汰赛对阵树（官方第 73–104 场赛程）使**同半区强队高度负相关**：

- 同半区的两支强队最多只有一队能进决赛；若西班牙提前出局，受益最大的是与其同半区的球队，而不是均匀分摊到所有队。
- 小组头名 vs 次席直接决定走哪半边签表（例如葡萄牙/哥伦比亚的 K 组头名之争、德国/厄瓜多尔的 E 组之争），这些组内结果与后续淘汰赛概率强相关。
- 因此**不能**把本表概率当作独立事件做联合运算（如"A 与 B 同时进四强"的概率不等于两者边际概率相乘）；任何联合事件请回到逐场模拟层面计算。

## ④ 问题定义与结算标准

- **预测什么**：哪支球队赢得 2026-07-19（美东）在新泽西 MetLife 体育场举行的决赛，**含加时与点球**——即最终捧杯者。
- 48 个选项互斥且穷尽，概率之和 = 1。
- 决赛结束（含可能的加时/点球）后即可结算。

## ⑤ 方法

**第一步：统计基线（蒙特卡洛）**。100,000 次全赛事纯 Elo 泊松蒙特卡洛模拟（seed 20260611），Elo 取 eloratings.net 2026-06-11 快照，完全不含任何市场输入。单场进球为独立泊松：λ = 2.6 × Elo 逻辑期望（按 10^(Elo/400) 期望切分 2.6 球基线）；东道主墨西哥/美国/加拿大仅在小组赛享 +100 Elo 主场修正（淘汰赛场馆分散，不加）。小组排名按 积分 → 净胜球 → 进球 → 全并列队间小循环 → 随机；8 个成绩最好的小组第三按 积分/净胜球/进球/随机 排序。淘汰赛树采用官方 FIFA 2026 对阵（第 73–104 场），小组第三的落位用确定性二分图匹配近似 FIFA 官方组合表（构造上排除同组 32 强重赛）；淘汰赛 90 分钟泊松出平局时，按双方 Elo 期望比例的伯努利抽样定胜负（近似加时与点球）。

**第二步：有界证据调整（每队相对幅度 ≤ ±20%，须引用证据，调整后重新归一化）**：

| 球队 | 相对调整 | 理由（来源见下） |
| --- | --- | --- |
| 巴西 | −15% | 内马尔小腿伤出战首战存疑（队医 5/28 评估休 3 周）；罗德里戈（ACL）、米利唐（腿筋肌腱手术）、埃斯特旺（腿筋）均无缘本届（ESPN/Goal/Flashscore） |
| 荷兰 | −15% | 廷贝尔（腹股沟，6/8 退队）、西蒙斯（膝）、斯豪滕（膝）、德利赫特（背）集体缺席，防线中轴受损（ESPN/karlobag） |
| 德国 | −10% | 特尔施特根（大腿）、格纳布里（大腿）、卡尔（大腿）伤缺；维尔茨在列（ESPN/karlobag） |
| 西班牙 | −4% | 亚马尔腹股沟/腿筋伤势仍在负荷管理（赶首战 6/15 在时间表内）；费尔明·洛佩斯跖骨骨折缺席（UPI/Yahoo） |
| 阿根廷 | −2% | 梅西腿筋伤愈复出即对冰岛进球，但罗梅罗（膝）、莫利纳（大腿）带伤备战（UPI/Yahoo） |
| 法国 | +5% | 主力框架无重大伤病（仅埃基蒂克缺席），相对头部竞争对手的伤病潮获益（Sports Mole） |
| 英格兰 | +5% | 阵容齐整，仅本·怀特（膝）缺席（Sports Mole/搜索结果） |
| 哥伦比亚 | +5% | 迪亚斯、J 罗领衔满编出战，6/2 名单无主力缺席（FIFA） |
| 其余 40 队 | 0 | 未检索到改变冠军概率的重大消息（本次仅核查头部球队，见局限） |

最大单项调整 ±15%，未触及 ±20% 上限；调整净和为 −1.7pp，重新归一化后所有概率之和 = 1，且逐队满足 p_champion ≤ p_sf ≤ p_qf 的单调性。

**局限**：① 纯 Elo 不含阵容深度、战术与教练因素，伤病只能事后以有界方式打补丁；② 单一评分体系可能高估头号种子（西班牙 37% 高于历史热门基率）；③ 仅对前 10 名球队做了新闻核查（4 次检索预算），长尾球队的伤停未逐一确认——但其冠军概率本身处于尾部，影响极小；④ 小组第三落位与加时/点球处理均为近似。

## 来源

{SOURCES}

## 免责声明

{DISCLAIMER_CN}
"""

report_en = f"""# 2026 FIFA World Cup Champion Forecast (all 48 teams)

- **Question**: Which team wins the 2026 FIFA World Cup? (Decided by the 2026-07-19 final, including extra time and penalties)
- **Settlement event slug (resolution metadata only)**: `world-cup-winner`
- **Generated**: 2026-06-11T13:15:00Z (the day after the opener, before most teams' first matches)
- **Market-blind statement**: This forecast is fully independent of any betting odds or prediction markets — no market data of any kind was fetched or referenced; probabilities come solely from an Elo/Monte-Carlo statistical model plus a bounded, evidence-based adjustment.
- Chinese original: [`report.md`](report.md); machine-readable output: [`prediction.json`](prediction.json)

## 1. Most likely champions

**Top five: {", ".join(f"{META[k][0]} {pct(p)}" for k, p in rows[:5])}.**

**One-sentence view**: {one_en}

Confidence tier: **Medium** — high directional confidence (the top-four Elo tier and the injury evidence both point to concentration at the top), with a caveat on magnitude: a pure-Elo model gives the top seed (Spain ~37%) more than the historical base rate for pre-tournament favourites (~20–25%), and a single rating system may understate injury, red-card and penalty randomness across a seven-match run.

## 2. Full 48-team probability table (descending)

{table_en()}

> "Adj." is a relative adjustment (capped at ±20%); the table is renormalized afterwards (factor ≈ +1.75%, so untouched teams end slightly above baseline). "≈0%" means zero titles in 100,000 simulations (< 0.001%).

## 3. Bracket-correlation caveat (important)

These are **marginal probabilities** — each team viewed in isolation. The 48 teams' fates are not independent: the knockout tree (official matches 73–104) makes **strong teams in the same half of the bracket heavily negatively correlated**:

- At most one of two giants in the same half can reach the final; if Spain exits early, the windfall accrues mainly to teams in Spain's half, not evenly to everyone.
- Winning a group vs finishing second routes a team to a different half (e.g. the Portugal/Colombia race in Group K, Germany/Ecuador in Group E), so group outcomes correlate strongly with downstream knockout odds.
- Do **not** multiply these marginals for joint events (e.g. "A and B both reach the semis"); joint probabilities must come from the match-level simulation itself.

## 4. Definition and settlement

- **What is forecast**: the team that wins the final on 2026-07-19 (US East) at MetLife Stadium, New Jersey, **including extra time and penalties** — i.e. lifts the trophy.
- The 48 outcomes are mutually exclusive and exhaustive; probabilities sum to 1.
- Settles when the final concludes (after any extra time/shootout).

## 5. Method

**Step 1 — statistical baseline (Monte Carlo)**. 100,000 full-tournament pure-Elo Poisson simulations (seed 20260611), ratings from the eloratings.net snapshot of 2026-06-11, with no market input of any kind. Match goals are independent Poissons: λ = 2.6 × the Elo logistic expectancy (the 10^(Elo/400) win expectancy splits a 2.6-goal baseline). Hosts Mexico, the United States and Canada get +100 Elo in group matches only (knockout venues vary). Group ranking: points → goal difference → goals scored → head-to-head mini-table among fully tied teams → random draw; the 8 best third-placed teams rank by points/GD/goals/random. The knockout tree is the official FIFA 2026 bracket (matches 73–104); third-place slotting approximates FIFA's combination table via deterministic bipartite matching (same-group R32 rematches impossible by construction). Drawn knockout matches after 90 Poisson minutes are resolved by a Bernoulli draw proportional to Elo expectancy (a stand-in for extra time and penalties).

**Step 2 — bounded evidence adjustment (≤ ±20% relative per team, cited, then renormalized)**:

| Team | Rel. adj. | Rationale (sources below) |
| --- | --- | --- |
| Brazil | −15% | Neymar's calf makes the opener doubtful (team doctor, May 28: up to 3 weeks out); Rodrygo (ACL), Militao (hamstring-tendon surgery) and Estevao (hamstring) all miss the tournament (ESPN/Goal/Flashscore) |
| Netherlands | −15% | Timber (groin, withdrew June 8), Xavi Simons (knee), Schouten (knee) and De Ligt (back) all out — the defensive spine is gutted (ESPN/karlobag) |
| Germany | −10% | Ter Stegen (thigh), Gnabry (thigh) and Karl (thigh) out; Wirtz is in (ESPN/karlobag) |
| Spain | −4% | Lamine Yamal's groin/hamstring still under load management (on schedule for the June 15 opener); Fermin Lopez out with a metatarsal fracture (UPI/Yahoo) |
| Argentina | −2% | Messi returned from his hamstring issue and scored vs Iceland, but Romero (knee) and Molina (thigh) carry knocks (UPI/Yahoo) |
| France | +5% | Core squad free of major injuries (only Ekitike missing) — relative gain vs injury-hit rivals (Sports Mole) |
| England | +5% | Squad essentially intact; only Ben White (knee) is out (Sports Mole/search results) |
| Colombia | +5% | Full-strength squad led by Luis Diaz and James Rodriguez per the June 2 list (FIFA) |
| Other 40 teams | 0 | No champion-probability-moving news found (only the top teams were checked — see limitations) |

The largest single adjustment is ±15%, inside the ±20% cap; the net is −1.7pp before renormalization, after which probabilities sum to 1 and per-team monotonicity p_champion ≤ p_sf ≤ p_qf holds.

**Limitations**: (i) pure Elo carries no squad-depth, tactical or managerial information — injuries are patched ex post within bounds; (ii) a single rating system may overrate the top seed (Spain's 37% exceeds historical favourite base rates); (iii) news checks covered only the top ~10 teams (4-search budget) — long-tail teams' absences were not individually verified, but their title probabilities are tail-level anyway; (iv) third-place slotting and extra-time/penalty handling are approximations.

## Sources

{SOURCES}

## Disclaimer

{DISCLAIMER_EN}
"""

with open(os.path.join(OUT, 'report.md'), 'w') as f:
    f.write(report_cn)
with open(os.path.join(OUT, 'report.en.md'), 'w') as f:
    f.write(report_en)

# final validation
with open(os.path.join(OUT, 'prediction.json')) as f:
    p = json.load(f)
assert len(p['outcomes']) == 48
tot = sum(o['p'] for o in p['outcomes'])
ps = [o['p'] for o in p['outcomes']]
assert ps == sorted(ps, reverse=True)
assert len(p['key_reasons']) == 3
req = ["id","family","event_slug","question_cn","question_en","kickoff_utc","generated_at","outcomes","one_liner_cn","one_liner_en","key_reasons","confidence_tier","n_sources","method_note","report"]
assert all(k in p for k in req), [k for k in req if k not in p]
print("OK  sum(p) =", tot, " outcomes =", len(p['outcomes']))
print("files:", sorted(os.listdir(OUT)))
