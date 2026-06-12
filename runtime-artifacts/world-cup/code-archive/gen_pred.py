import json

final = json.load(open('/tmp/sf_final.json'))

cn = {
 'Spain':'西班牙','Argentina':'阿根廷','France':'法国','England':'英格兰','Brazil':'巴西',
 'Colombia':'哥伦比亚','Portugal':'葡萄牙','Netherlands':'荷兰','Ecuador':'厄瓜多尔','Germany':'德国',
 'Norway':'挪威','Japan':'日本','Croatia':'克罗地亚','Switzerland':'瑞士','Türkiye':'土耳其',
 'Mexico':'墨西哥','Belgium':'比利时','Uruguay':'乌拉圭','Senegal':'塞内加尔','Morocco':'摩洛哥',
 'Paraguay':'巴拉圭','Canada':'加拿大','Austria':'奥地利','Scotland':'苏格兰','IR Iran':'伊朗',
 'Korea Republic':'韩国','Czechia':'捷克','Australia':'澳大利亚','Algeria':'阿尔及利亚',
 'United States':'美国','Panama':'巴拿马','Sweden':'瑞典','Egypt':'埃及',"Côte d'Ivoire":'科特迪瓦',
 'Uzbekistan':'乌兹别克斯坦','Jordan':'约旦','Bosnia-Herzegovina':'波黑','DR Congo':'刚果（金）',
 'Tunisia':'突尼斯','Cabo Verde':'佛得角','Saudi Arabia':'沙特阿拉伯','New Zealand':'新西兰',
 'Iraq':'伊拉克','South Africa':'南非','Haiti':'海地','Ghana':'加纳','Qatar':'卡塔尔','Curaçao':'库拉索',
}
en = {
 'IR Iran':'Iran','Korea Republic':'South Korea',"Côte d'Ivoire":'Ivory Coast','Cabo Verde':'Cape Verde',
}

rows = sorted(final.items(), key=lambda kv: -kv[1])
outcomes = [
    {'key': k, 'label_cn': cn[k], 'label_en': en.get(k, k), 'p': round(p, 5)}
    for k, p in rows
]
assert len(outcomes) == 48
assert abs(sum(o['p'] for o in outcomes) - 4.0) < 0.001

pred = {
 'id': 'reach-sf',
 'family': 'reach_semifinal',
 'event_slug': 'world-cup-nation-to-reach-semifinals',
 'question_cn': '哪些球队进入 2026 世界杯四强（赢下 1/4 决赛、晋级半决赛，最后 4 队）？',
 'question_en': 'Which teams reach the semifinals (win their quarterfinal, last 4) at the 2026 World Cup?',
 'kickoff_utc': None,
 'generated_at': '2026-06-11T13:15:00Z',
 'outcomes': outcomes,
 'one_liner_cn': '最可能的四强是西班牙、阿根廷、法国、英格兰——三支 Elo 2000+ 球队加上签位最顺的英格兰；巴西虽然 Elo 第 5，但伤病减员叠加与英格兰、墨西哥同处一个 1/4 区，四强概率被压到约 22%。',
 'one_liner_en': 'The most likely final four are Spain, Argentina, France and England — the three Elo 2000+ sides plus the team with the cleanest squad; Brazil, despite ranking 5th on Elo, are squeezed to about 22% by injuries and by sharing a quarter with England and Mexico.',
 'key_reasons': [
   {
     'cn': 'Elo 断层主导：西班牙（2157）、阿根廷（2115）、法国（2063）是仅有的三支 Elo 2000+ 球队，10 万次纯 Elo 蒙特卡洛模拟给出 66%/57%/50% 的四强基线，远超第 4 名英格兰（34%）之后的所有球队。',
     'en': 'The Elo gap dominates: Spain (2157), Argentina (2115) and France (2063) are the only Elo 2000+ sides, and the 100k-run pure-Elo Monte Carlo gives them 66%/57%/50% semifinal baselines, far ahead of everyone behind 4th-placed England (34%).',
     'source_url': 'https://www.eloratings.net/',
     'source_date': '2026-06-11'
   },
   {
     'cn': '签表结构决定中游命运：按官方淘汰赛对阵，英格兰、巴西、墨西哥的预计路径同处一个 1/4 区（最多一队进四强）；法国、荷兰与 E 组头名（德国/厄瓜多尔）同区；K 组出线者（葡萄牙/哥伦比亚）无论头名还是第二，1/4 决赛前后大概率撞上阿根廷或西班牙。',
     'en': 'Bracket structure decides the mid-tier: on the official knockout tree, England, Brazil and Mexico project into the same quarter (at most one can reach the last 4); France, the Netherlands and the Group E winner (Germany/Ecuador) share another; and whoever emerges from Group K (Portugal/Colombia) is likely to run into Argentina or Spain around the quarterfinal.',
     'source_url': 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage',
     'source_date': '2026-06-11'
   },
   {
     'cn': '伤病不对称是主要调整项：巴西（罗德里戈 ACL、内马尔小腿伤疑）、葡萄牙（C 罗 3 个月大腿伤刚复出）、荷兰、日本、比利时等带伤减员被下调（最大 −10% 相对）；英格兰训练营全员健康、哥伦比亚满编且主要对手带伤，获小幅上调。',
     'en': 'Injury asymmetry drives the adjustments: Brazil (Rodrygo ACL, Neymar calf doubt), Portugal (Ronaldo just back from a three-month thigh injury), the Netherlands, Japan and Belgium were marked down (max -10% relative), while England, with a clean bill of health in camp, and a fully fit Colombia were nudged up.',
     'source_url': 'https://www.espn.com/soccer/story/_/id/48572979/2026-fifa-world-cup-injuries-tracker-which-stars-miss-latest-info',
     'source_date': '2026-06-11'
   }
 ],
 'confidence_tier': '中',
 'n_sources': 18,
 'method_note': '100,000-run pure-Elo Poisson Monte Carlo over the full official 2026 bracket (seed 20260611, eloratings.net snapshot 2026-06-11, no market input) + bounded evidence-based adjustments (largest used ±10% relative, cap ±20%), renormalized so the 48 probabilities sum to 4. Market-blind by policy.',
 'report': 'report.md'
}

out = '/Users/Aincrad/dev-proj/predict-raven/runtime-artifacts/world-cup/reports/reach-sf/prediction.json'
with open(out, 'w') as fh:
    json.dump(pred, fh, ensure_ascii=False, indent=2)
print('wrote', out)
print('sum p =', sum(o['p'] for o in outcomes))

# also dump a markdown table fragment for the report
def pct(p):
    return f'{p*100:.1f}%' if p >= 0.0005 else '<0.1%'
mc = json.load(open('/Users/Aincrad/dev-proj/predict-raven/runtime-artifacts/world-cup/mc-results.json'))['teams']
for i, (k, p) in enumerate(rows, 1):
    print(f'| {i} | {cn[k]} {en.get(k,k)} | {pct(mc[k]["p_sf"])} | **{pct(p)}** |')
