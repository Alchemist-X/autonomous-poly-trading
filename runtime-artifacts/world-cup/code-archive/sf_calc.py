import json

d = json.load(open('/Users/Aincrad/dev-proj/predict-raven/runtime-artifacts/world-cup/mc-results.json'))
teams = d['teams']
items = {k: v for k, v in (teams.items() if isinstance(teams, dict) else [(t['team'], t) for t in teams])}

# Bounded evidence-based relative multipliers (all within +/-20% relative)
adj = {
    'Spain': 0.96,        # Yamal hamstring early group games; Fermin Lopez out (ESPN 2026-05-25)
    'England': 1.03,      # clean bill of health in Florida camp (Sky Sports / Sports Mole 2026-06)
    'Brazil': 0.90,       # Rodrygo ACL, Estevao out, Wesley out, Neymar calf doubt (ESPN tracker 2026-06-11)
    'Portugal': 0.92,     # Ronaldo back after ~3-month thigh injury, missed June friendlies; Dias/Leao/Semedo knocks
    'Colombia': 1.05,     # full-strength squad, James fit; chief group-K rival weakened (ESPN 2026-05-25)
    'Netherlands': 0.92,  # Simons & Schouten out, J. Timber withdrawn, GK Verbruggen doubt (FIFA 2026-06-11)
    'Germany': 0.95,      # Musiala sharpness after 196-day layoff; Neuer calf (Al Jazeera 2026-05-31)
    'Japan': 0.92,        # Mitoma and Minamino miss the tournament (Al Jazeera 2026-05-15)
    'Belgium': 0.92,      # Lukaku barely played this season, KDB eye injury, Courtois post-injury (FotMob 2026-05-15)
    'Norway': 0.95,       # Odegaard 5+ injury layoffs this season (Al Jazeera 2026-05-26)
    'Canada': 0.90,       # Davies hamstring, Bombito out, David poor form (Fox Sports 2026-06)
    'Morocco': 0.92,      # Aguerd and Ezzalzouli withdrawn injured (GhanaSoccernet 2026-06-11)
}

raw = {k: v['p_sf'] * adj.get(k, 1.0) for k, v in items.items()}
scale = 4.0 / sum(raw.values())
final = {k: p * scale for k, p in raw.items()}
print('renorm scale:', round(scale, 6))

# monotonicity check: p_champion <= adj p_sf <= baseline p_qf
for k, v in items.items():
    assert final[k] <= v['p_qf'] + 1e-9, (k, 'sf>qf')
    assert v['p_champion'] <= final[k] + 1e-9, (k, 'champ>sf')
print('monotonicity OK; sum =', round(sum(final.values()), 6))

rows = sorted(final.items(), key=lambda kv: -kv[1])
for name, p in rows:
    base = items[name]['p_sf']
    m = adj.get(name, 1.0)
    print(f"{name:25s} base={base*100:7.2f}%  mult={m:.2f}  final={p*100:7.2f}%  delta={ (p-base)*100:+6.2f}pp")

json.dump({k: round(v, 5) for k, v in final.items()}, open('/tmp/sf_final.json', 'w'))
