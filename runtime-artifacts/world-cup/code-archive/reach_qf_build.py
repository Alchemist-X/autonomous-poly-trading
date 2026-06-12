#!/usr/bin/env python3
"""Build reach-qf forecast: MC baseline + bounded evidence adjustment, renormalize to 8."""
import json

BASE = '/Users/Aincrad/dev-proj/predict-raven/runtime-artifacts/world-cup'
mc = json.load(open(f'{BASE}/mc-results.json'))
teams = mc['teams']
groups = mc['groups']

group_of = {}
for g, members in groups.items():
    for t in members:
        group_of[t] = g

elo_raw = json.load(open(f'{BASE}/elo-table.json'))['teams']
elo_alias = {
    'Korea Republic': 'South Korea', 'United States': 'USA',
    'Côte d\'Ivoire': 'Ivory Coast', 'IR Iran': 'Iran',
    'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
    'Cabo Verde': 'Cape Verde', 'DR Congo': 'Congo DR',
}
def elo(t):
    k = elo_alias.get(t, t)
    return elo_raw[k]['elo'], elo_raw[k]['rank']

# Bounded relative adjustments (max +-20% relative), each with cited evidence in the report
adj = {
    'Brazil': -0.06,        # Rodrygo, Militao, Estevao out; Neymar calf doubt for opener
    'Netherlands': -0.04,   # Timber ruled out (groin), replaced by Geertruida
    'Belgium': -0.05,       # De Bruyne (eye) & Lukaku (hip) named despite being sidelined at Napoli
    'Argentina': -0.02,     # Messi hamstring, minutes restriction; Romero fitness race
    'France': -0.02,        # Mbappe in fitness race per trackers
    'Spain': -0.01,         # Yamal/N.Williams/Munoz returning from injury; expected fit for opener
    'England': 0.03,        # no major injury concerns, fully fit core
    'Portugal': 0.02,       # squad intact, no reported absences
    'Canada': -0.06,        # Davies hamstring doubt, Bombito removed, David poor form
    'Croatia': -0.02,       # Modric (40) in fitness race
}

rows = []
for t, v in teams.items():
    p0 = v['p_qf']
    p1 = p0 * (1 + adj.get(t, 0.0))
    rows.append({'team': t, 'p0': p0, 'p1': p1, 'p_sf': v['p_sf'], 'p_r32': v['p_r32']})

s = sum(r['p1'] for r in rows)
k = 8.0 / s
for r in rows:
    r['p'] = r['p1'] * k

# monotonicity check: adjusted p_qf >= baseline p_sf
viol = [r['team'] for r in rows if r['p'] < r['p_sf']]
assert not viol, f'monotonicity violated: {viol}'

rows.sort(key=lambda r: -r['p'])
print(f'pre-renorm sum: {s:.5f}  renorm factor: {k:.5f}  post sum: {sum(r["p"] for r in rows):.5f}')

cn = {
    'Spain': '西班牙', 'Argentina': '阿根廷', 'France': '法国', 'England': '英格兰',
    'Brazil': '巴西', 'Portugal': '葡萄牙', 'Netherlands': '荷兰', 'Colombia': '哥伦比亚',
    'Belgium': '比利时', 'Türkiye': '土耳其', 'Switzerland': '瑞士', 'Ecuador': '厄瓜多尔',
    'Japan': '日本', 'Germany': '德国', 'Norway': '挪威', 'Mexico': '墨西哥',
    'Croatia': '克罗地亚', 'Uruguay': '乌拉圭', 'Senegal': '塞内加尔', 'Canada': '加拿大',
    'Paraguay': '巴拉圭', 'Morocco': '摩洛哥', 'IR Iran': '伊朗', 'Korea Republic': '韩国',
    'Austria': '奥地利', 'Czechia': '捷克', 'Scotland': '苏格兰', 'United States': '美国',
    'Australia': '澳大利亚', 'Algeria': '阿尔及利亚', 'Panama': '巴拿马', 'Egypt': '埃及',
    "Côte d'Ivoire": '科特迪瓦', 'Sweden': '瑞典', 'Uzbekistan': '乌兹别克斯坦',
    'Bosnia-Herzegovina': '波黑', 'Jordan': '约旦', 'DR Congo': '刚果（金）',
    'Tunisia': '突尼斯', 'Cabo Verde': '佛得角', 'Saudi Arabia': '沙特阿拉伯',
    'New Zealand': '新西兰', 'Iraq': '伊拉克', 'South Africa': '南非', 'Haiti': '海地',
    'Qatar': '卡塔尔', 'Ghana': '加纳', 'Curaçao': '库拉索',
}
en = {
    'IR Iran': 'Iran', 'Korea Republic': 'South Korea', "Côte d'Ivoire": "Côte d'Ivoire",
    'Bosnia-Herzegovina': 'Bosnia and Herzegovina', 'Cabo Verde': 'Cape Verde',
}

reasons_cn = {
    'Spain': 'Elo 世界第 1（2157），H 组仅乌拉圭一个真对手；亚马尔等伤员预计赶上首战，淘汰赛任何对位都占优。',
    'Argentina': 'Elo 第 2（2115），J 组（奥地利/阿尔及利亚/约旦）几乎无威胁；梅西伤愈复出但有出场时间管理，小幅下调。',
    'France': 'Elo 第 3（2063），I 组压制挪威/塞内加尔；姆巴佩在赶身体状态，但阵容深度足以兜底。',
    'England': 'Elo 第 4（2024），L 组只需越过克罗地亚；全队无重大伤病，是豪强中阵容最完整的一队，小幅上调。',
    'Portugal': 'Elo 第 6（1989），阵容完整无减员；与哥伦比亚的 K 组头名之争决定淘汰赛入口的软硬。',
    'Brazil': 'Elo 第 5（1991），C 组对手温和，但罗德里戈/米利唐/埃斯特旺缺席、内马尔小腿伤疑，多线减员下调。',
    'Colombia': 'Elo 第 7（1982），与葡萄牙几乎平起平坐；即便 K 组次名也有现实的八强路径。',
    'Netherlands': 'Elo 第 8（1948），F 组需压制日本；廷贝尔因腹股沟伤退出，后防深度受损，小幅下调。',
    'Belgium': 'Elo 第 15（1894），G 组（伊朗/埃及/新西兰）是 12 个组里最软之一、出线近乎保送；但德布劳内/卢卡库带伤进队，下调。',
    'Türkiye': 'Elo 第 13（1911），近两年上升势头明显；D 组头名概率近五成，赢下美国/巴拉圭即获相对友好的淘汰赛入口。',
    'Switzerland': 'Elo 第 17（1891），阵容完整，与加拿大争 B 组头名五五开；但 16 强对位偏硬，八强转化率被压低。',
    'Ecuador': 'Elo 第 9（1938），防守是南美顶级；与德国在 E 组缠斗，头名与否直接决定 16 强对手强度。',
    'Japan': 'Elo 第 14（1906），旅欧主力架构成熟，与荷兰争 F 组头名；次名路径明显偏硬。',
    'Germany': 'Elo 第 10（1932），纸面强但近两届大赛低迷已反映在 Elo 中；E 组与厄瓜多尔基本五五开。',
    'Norway': 'Elo 第 11（1914），哈兰德领衔的进攻火力极强；但 I 组大概率次名，淘汰赛路径不友好。',
    'Mexico': '东道主小组赛 +100 Elo 加成令 A 组头名概率近八成，但淘汰赛无加成，Elo 第 18 的真实实力使八强转化率仅约两成。',
    'Croatia': 'Elo 第 12（1912），L 组次名概率高；莫德里奇 40 岁仍在赶身体状态，黄金一代余晖面对强敌胜率有限。',
    'Uruguay': 'Elo 第 16（1892），H 组几乎注定次名；次名路径上的 16 强对手通常是另一组的头名级球队。',
    'Senegal': 'Elo 第 21（1860），非洲最强球队之一；但 I 组要先过挪威这关，且多以次名出线、对位偏硬。',
    'Canada': '东道主加成助攻出线，但戴维斯腿筋伤疑、邦比托伤退、大卫状态低迷，伤病扎堆下调。',
    'Paraguay': 'Elo 第 22（1834），防守扎实，与美国争 D 组次名；出线后大概率撞上欧洲强队。',
    'Morocco': 'Elo 第 24（1827），2022 四强班底仍在；但 C 组要过巴西这关，多以次名/第三出线、路径偏硬。',
    'IR Iran': 'Elo 第 29（1772），G 组次名概率不低；但 16 强几乎必撞强敌，八强转化率不足一成。',
    'Korea Republic': 'Elo 第 33（1758），A 组次名之争的主要对手是捷克；出线后基本对位强敌。',
    'Austria': 'Elo 第 23（1830），朗尼克体系成熟；但 J 组次名的淘汰赛入口不友好。',
    'Czechia': 'Elo 第 35（1740），与韩国争 A 组次名；整体实力平平，上限有限。',
    'Scotland': 'Elo 第 26（1782），作风硬朗，与摩洛哥争 C 组次名；淘汰赛竞争力有限。',
    'United States': '东道主加成下出线概率约 68%，但 Elo 仅第 39、近年状态下滑，D 组内被土耳其/巴拉圭压制。',
    'Australia': 'Elo 第 28（1777），D 组竞争激烈，常以小组第三身份险出线；出线后对位艰难。',
    'Algeria': 'Elo 第 29（1772），J 组阿根廷之外的次名竞争者；但出线后路径艰难。',
    'Panama': 'Elo 第 38（1730），L 组第三名的主要争夺者；中北美球队的上限有限。',
    'Egypt': 'Elo 第 48（1696），萨拉赫领衔但整体阵容单薄；G 组次名之争输面大。',
    "Côte d'Ivoire": 'Elo 第 49（1695），非洲杯冠军底子；但 E 组双强压顶，多以第三名出线。',
    'Sweden': 'Elo 第 43（1712），F 组前两名基本被荷兰/日本锁定；第三名出线后即遇强敌。',
    'Uzbekistan': 'Elo 第 42（1714），队史首次参赛；K 组双强压顶，出线已是超额。',
    'Bosnia-Herzegovina': 'Elo 第 65（1595），B 组第三；哲科时代之后阵容厚度不足。',
    'Jordan': 'Elo 第 52（1680），队史首次参赛；J 组能出线已属超额完成。',
    'DR Congo': 'Elo 第 55（1652），洲际附加赛突围的黑马；但 K 组双强压顶。',
    'Tunisia': 'Elo 第 58（1628），F 组想出线需先爆冷瑞典；八强基本只是数学可能。',
    'Cabo Verde': 'Elo 第 68（1578），队史首次参赛；H 组双强压顶，空间极小。',
    'Saudi Arabia': 'Elo 第 69（1576），连续三届参赛有大赛经验；但 H 组前两名几乎被锁定。',
    'New Zealand': 'Elo 第 72（1562），大洋洲直通名额；与 G 组前列的实力差距明显。',
    'Iraq': 'Elo 第 63（1607），附加赛晋级；I 组三强压顶，几乎没有出线空间。',
    'South Africa': 'Elo 第 80（1517），A 组面对东道主墨西哥与韩捷竞争，出线渺茫。',
    'Haiti': 'Elo 第 73（1548），时隔多年重返世界杯；C 组实力差距过大。',
    'Qatar': 'Elo 第 96（1421），48 队中 Elo 垫底；B 组出线概率极低。',
    'Ghana': 'Elo 第 81（1510），Elo 大幅下滑；L 组双强加巴拿马竞争下机会渺茫。',
    'Curaçao': 'Elo 第 91（1434），史上人口最少的参赛国；E 组双强压顶。',
}
reasons_en = {
    'Spain': 'Elo world No. 1 (2157); Uruguay is the only real obstacle in Group H, and Yamal & co. are expected fit for the opener — favourites in any knockout matchup.',
    'Argentina': 'Elo No. 2 (2115); Group J (Austria/Algeria/Jordan) poses little threat. Messi is back from a hamstring issue but on managed minutes — small markdown.',
    'France': 'Elo No. 3 (2063); should control Group I over Norway/Senegal. Mbappé is in a fitness race, but squad depth covers it.',
    'England': 'Elo No. 4 (2024); only Croatia stands between them and Group L top spot. No major injuries — the healthiest of the contenders, small markup.',
    'Portugal': 'Elo No. 6 (1989) with a fully intact squad; the Group K duel with Colombia decides how soft their knockout entry is.',
    'Brazil': 'Elo No. 5 (1991) and a gentle Group C, but Rodrygo/Militão/Estêvão are out and Neymar (calf) is a doubt — multi-position absences, marked down.',
    'Colombia': 'Elo No. 7 (1982), effectively level with Portugal; even as Group K runner-up they keep a realistic QF path.',
    'Netherlands': 'Elo No. 8 (1948); must hold off Japan in Group F. Timber ruled out (groin), thinning the back line — small markdown.',
    'Belgium': 'Elo No. 15 (1894); Group G (Iran/Egypt/New Zealand) is among the softest, but De Bruyne (eye) and Lukaku (hip) arrive off injuries — marked down.',
    'Türkiye': 'Elo No. 13 (1911), clearly trending up; near-50% to win Group D, which buys a relatively friendly knockout entry.',
    'Switzerland': 'Elo No. 17 (1891), fully intact squad in a coin-flip Group B with Canada; a hard R32 matchup suppresses the QF conversion.',
    'Ecuador': 'Elo No. 9 (1938) with an elite defensive record; locked in a Group E toss-up with Germany — top spot decides the R32 opponent.',
    'Japan': 'Elo No. 14 (1906), a mature Europe-based core contesting Group F with the Dutch; the runner-up path is clearly harder.',
    'Germany': 'Elo No. 10 (1932); strong on paper but two poor recent tournaments are baked into the rating — Group E vs Ecuador is a toss-up.',
    'Norway': 'Elo No. 11 (1914) with Haaland leading a fearsome attack; likely Group I runner-up, and that path is unfriendly.',
    'Mexico': 'The +100 host Elo bonus (group stage only) makes them ~79% Group A winners, but with no knockout bonus their true No. 18 strength converts to only ~22% QF.',
    'Croatia': 'Elo No. 12 (1912), likely Group L runner-up; Modrić at 40 is racing for fitness, and the ageing core wins few coin flips against elites.',
    'Uruguay': 'Elo No. 16 (1892), all but locked into second in Group H; the runner-up route usually means a group-winner-calibre R32 opponent.',
    'Senegal': "Elo No. 21 (1860), among Africa's strongest; but Norway blocks the path in Group I and a runner-up exit draws hard opponents.",
    'Canada': 'Host bonus helps them advance, but Davies (hamstring) is doubtful, Bombito is out and David is out of form — injury cluster, marked down.',
    'Paraguay': 'Elo No. 22 (1834), defensively solid, fighting the US for second in Group D; the reward is likely a European heavyweight.',
    'Morocco': 'Elo No. 24 (1827), the 2022 semi-final core remains; but Brazil sits atop Group C, so they usually advance second/third onto a hard path.',
    'IR Iran': 'Elo No. 29 (1772); decent odds of second in Group G, but the R32 almost guarantees an elite opponent — under 10% QF conversion.',
    'Korea Republic': 'Elo No. 33 (1758); the race for second in Group A is mainly with Czechia, and advancing means meeting a heavyweight.',
    'Austria': "Elo No. 23 (1830) with Rangnick's settled system; but the Group J runner-up's knockout entry is unfriendly.",
    'Czechia': 'Elo No. 35 (1740), contesting second in Group A with South Korea; modest overall level caps the ceiling.',
    'Scotland': 'Elo No. 26 (1782), well-organised, fighting Morocco for second in Group C; limited knockout upside.',
    'United States': 'Host bonus lifts them to ~68% to advance, but at Elo No. 39 and in declining form they are squeezed by Türkiye/Paraguay in Group D.',
    'Australia': 'Elo No. 28 (1777) in a congested Group D; often scrapes through third, after which the matchups get steep.',
    'Algeria': 'Elo No. 29 (1772), the main challenger for second behind Argentina in Group J; the path after that is hard.',
    'Panama': 'Elo No. 38 (1730), the main third-place contender in Group L; a limited Concacaf ceiling.',
    'Egypt': 'Elo No. 48 (1696); Salah headlines a thin squad, and they are second-favourites at best for the Group G runner-up spot.',
    "Côte d'Ivoire": 'Elo No. 49 (1695), African champions pedigree; but two giants sit atop Group E, so third place is the usual exit.',
    'Sweden': 'Elo No. 43 (1712); the Netherlands and Japan all but lock the top two in Group F, and a third-place exit meets an elite side at once.',
    'Uzbekistan': 'Elo No. 42 (1714), first-ever World Cup; two giants atop Group K make advancement itself the achievement.',
    'Bosnia-Herzegovina': 'Elo No. 65 (1595), third board in Group B; squad depth has thinned since the Džeko era.',
    'Jordan': 'Elo No. 52 (1680), debutants; getting out of Group J would already exceed expectations.',
    'DR Congo': 'Elo No. 55 (1652), the intercontinental-playoff dark horse; but two giants sit atop Group K.',
    'Tunisia': 'Elo No. 58 (1628); advancing from Group F requires upsetting Sweden first — QF is essentially a mathematical tail.',
    'Cabo Verde': 'Elo No. 68 (1578), historic debutants; two locked-in favourites above them in Group H leave minimal room.',
    'Saudi Arabia': 'Elo No. 69 (1576), third straight finals and tournament-hardened; but the top two in Group H are near-settled.',
    'New Zealand': 'Elo No. 72 (1562), the direct Oceania qualifier; a clear class gap to the top of Group G.',
    'Iraq': 'Elo No. 63 (1607), playoff qualifier; three stronger sides in Group I leave almost no route through.',
    'South Africa': 'Elo No. 80 (1517); facing host Mexico plus the Korea/Czechia race in Group A, advancement is remote.',
    'Haiti': 'Elo No. 73 (1548), back at the finals after decades; the class gap in Group C is too wide.',
    'Qatar': 'Elo No. 96 (1421), the lowest-rated of the 48; a Group B exit is very unlikely.',
    'Ghana': 'Elo No. 81 (1510) after a steep rating decline; two strong seeds plus Panama crowd them out of Group L.',
    'Curaçao': 'Elo No. 91 (1434), the smallest nation ever at a World Cup; two giants sit atop Group E.',
}

# prediction.json
outcomes = [
    {'key': r['team'], 'label_cn': cn[r['team']], 'label_en': en.get(r['team'], r['team']),
     'p': round(r['p'], 5)}
    for r in rows
]
pred = {
    'id': 'reach-qf',
    'family': 'reach_quarterfinal',
    'event_slug': 'world-cup-nation-to-reach-quarterfinals',
    'question_cn': '哪些球队能晋级 2026 世界杯八强（赢下 16 强淘汰赛、进入 1/4 决赛）？48 队各自的晋级概率（合计约 8）。',
    'question_en': 'Which teams reach the 2026 World Cup quarter-finals (win their Round-of-16 tie)? Per-team probabilities for all 48 teams (summing to ~8).',
    'kickoff_utc': None,
    'generated_at': '2026-06-11T13:15:00Z',
    'outcomes': outcomes,
    'one_liner_cn': '最可能的八强是西班牙、阿根廷、法国、英格兰、葡萄牙、巴西、哥伦比亚、荷兰——但没有任何球队超过 75%，48 队扩军让八强名额比以往任何一届都更分散。',
    'one_liner_en': 'The most likely quarter-final eight are Spain, Argentina, France, England, Portugal, Brazil, Colombia and the Netherlands — yet no team clears 75%, as the 48-team format spreads the eight slots thinner than ever.',
    'key_reasons': [
        {
            'cn': 'Elo 前八（西班牙 2157 至荷兰 1948）恰好是模型给出的八强前八候选，合计拿走 8 个名额中的约 4.3 个；扩军后强队小组更软、16 强多对阵小组第三，头部转化率被进一步抬高。',
            'en': 'The Elo top eight (Spain 2157 down to Netherlands 1948) are exactly the model’s top eight QF candidates, collectively claiming ~4.3 of the 8 slots; the expanded format gives top seeds softer groups and R32 ties often against third-placed sides.',
            'source_url': 'https://www.eloratings.net/',
            'source_date': '2026-06-11',
        },
        {
            'cn': '豪强之间的伤病不对称是主要调整项：巴西（罗德里戈/米利唐/埃斯特旺缺席、内马尔伤疑）、荷兰（廷贝尔退出）、比利时（德布劳内/卢卡库带伤）下调，全员健康的英格兰上调。',
            'en': 'Injury asymmetry among contenders drives the adjustments: Brazil (Rodrygo/Militão/Estêvão out, Neymar doubtful), Netherlands (Timber withdrawn) and Belgium (De Bruyne/Lukaku arriving injured) are marked down; a fully fit England is marked up.',
            'source_url': 'https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info',
            'source_date': '2026-06-11',
        },
        {
            'cn': '第 9 至 17 位（比利时到克罗地亚）全部挤在 20%–35% 区间：对这批球队而言，小组头名与否（决定 16 强对手档次）比自身实力差异更能左右八强命运。',
            'en': 'Places 9–17 (Belgium through Croatia) are all packed into the 20%–35% band: for this tier, winning the group (and thus the calibre of the R32 opponent) moves their QF fate more than raw strength differences do.',
            'source_url': 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026',
            'source_date': '2026-06-11',
        },
    ],
    'confidence_tier': '中',
    'n_sources': 9,
    'method_note': 'Pure-Elo Poisson Monte Carlo (100,000 full-tournament sims, seed 20260611, eloratings.net snapshot 2026-06-11, +100 Elo host bonus in group games only, official 2026 bracket with third-place allocation; no market input of any kind), then bounded evidence-based adjustments of at most ±6% relative per team (cap ±20%) for cited injury/fitness news on top-tier squads, renormalized so the 48 probabilities sum to 8.',
    'report': 'report.md',
}

outdir = f'{BASE}/reports/reach-qf'
import os
os.makedirs(outdir, exist_ok=True)
with open(f'{outdir}/prediction.json', 'w') as f:
    json.dump(pred, f, ensure_ascii=False, indent=2)
    f.write('\n')

# table rows for the two reports
def fmt(p):
    return f'{100*p:.1f}%'

lines_cn, lines_en = [], []
for i, r in enumerate(rows, 1):
    t = r['team']
    g = group_of[t]
    e, rk = elo(t)
    d = adj.get(t, 0.0)
    dtxt = f'{"+" if d>0 else ""}{int(d*100)}%' if d else '—'
    lines_cn.append(f"| {i} | {cn[t]} {t} | {g} | {e}（第{rk}） | {fmt(r['p0'])} | **{fmt(r['p'])}** | {dtxt} | {reasons_cn[t]} |")
    lines_en.append(f"| {i} | {en.get(t, t)} | {g} | {e} (No. {rk}) | {fmt(r['p0'])} | **{fmt(r['p'])}** | {dtxt} | {reasons_en[t]} |")

with open('/tmp/qf_table_cn.md', 'w') as f:
    f.write('\n'.join(lines_cn))
with open('/tmp/qf_table_en.md', 'w') as f:
    f.write('\n'.join(lines_en))

top8 = [r['team'] for r in rows[:8]]
print('top8:', ', '.join(top8))
print('top8 mass:', sum(r['p'] for r in rows[:8]))
print('elo-top8 mass check (baseline):', sum(teams[t]['p_qf'] for t in ['Spain','Argentina','France','England','Brazil','Portugal','Colombia','Netherlands']))
for r in rows[:18]:
    print(f"{r['team']:20s} base={fmt(r['p0']):>6s} adj={fmt(r['p']):>6s}")
print('files written:', outdir)
