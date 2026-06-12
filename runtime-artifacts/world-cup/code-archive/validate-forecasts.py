import json, os, re, sys

ROOT = 'runtime-artifacts/world-cup/reports'
EXPECT_SUM = {'group_match':1, 'group_winner':1, 'champion':1, 'reach_quarterfinal':8, 'reach_semifinal':4}
BANNED = ['稳赚','必中','包赢','锁单','荐单','跟单','下注','押注']
BANNED_EN = [r'\bguaranteed\b', r'\bpicks\b', r'\btips\b', r'\block\b(?! ?screen)']
MARKET = ['FanDuel','DraftKings','Kalshi','Pinnacle','盘口','隐含概率','市场价','博彩公司','oddsportal','oddschecker','bookmaker','betting odds','p_mkt','偏差信号']
issues = {}
pools = {}

def add(d, sev, msg):
    issues.setdefault(d, []).append((sev, msg))

dirs = sorted(d for d in os.listdir(ROOT) if os.path.isdir(f'{ROOT}/{d}'))
for d in dirs:
    base = f'{ROOT}/{d}'
    try:
        p = json.load(open(f'{base}/prediction.json'))
    except Exception as e:
        add(d, 'HIGH', f'prediction.json unreadable: {e}'); continue
    fam = p.get('family')
    for field in ['id','family','event_slug','question_cn','question_en','outcomes','one_liner_cn','one_liner_en','key_reasons','confidence_tier','n_sources','method_note']:
        if field not in p: add(d, 'HIGH', f'missing field {field}')
    outs = p.get('outcomes', [])
    if fam in EXPECT_SUM and outs:
        s = sum(o.get('p', 0) for o in outs)
        if abs(s - EXPECT_SUM[fam]) > (0.05 if fam.startswith('reach') else 0.011):
            add(d, 'HIGH', f'outcome sum {s:.4f} != {EXPECT_SUM[fam]}')
    for o in outs:
        if any(k for k in o if 'market' in k.lower() or k == 'p_mkt'): add(d, 'HIGH', f'market field in outcome {o.get("key")}')
        if not (0 <= o.get('p', -1) <= 1): add(d, 'HIGH', f'p out of range: {o}')
    kr = p.get('key_reasons', [])
    if not (2 <= len(kr) <= 3): add(d, 'MED', f'key_reasons count {len(kr)}')
    for r in kr:
        if not str(r.get('source_url','')).startswith('http'): add(d, 'MED', f'reason without source_url')
    if fam in ('reach_quarterfinal','reach_semifinal','champion'):
        pools[fam] = {o['key']: o['p'] for o in outs}
    for fname, dis in [('report.md','本报告提供基于公开数据'), ('report.en.md','This report provides probability estimates')]:
        path = f'{base}/{fname}'
        if not os.path.exists(path): add(d, 'HIGH', f'{fname} missing'); continue
        txt = open(path).read()
        if dis not in txt: add(d, 'HIGH', f'{fname}: disclaimer missing')
        for w in BANNED:
            if w in txt: add(d, 'HIGH', f'{fname}: banned word {w}')
        for pat in BANNED_EN:
            if re.search(pat, txt, re.I): add(d, 'MED', f'{fname}: banned EN pattern {pat}')
        for w in MARKET:
            if w.lower() in txt.lower(): add(d, 'HIGH', f'{fname}: market reference "{w}"')
        if re.search(r'\bodds\b', txt, re.I): add(d, 'MED', f'{fname}: word "odds" present (check context)')
        nm = txt.lower().count('polymarket')
        if nm > 3: add(d, 'MED', f'{fname}: polymarket mentioned {nm}x (expect <=3 metadata mentions)')

if len(pools) == 3:
    bad = [t for t in pools['champion'] if not (pools['champion'][t] <= pools['reach_semifinal'].get(t,1)+1e-6 <= pools['reach_quarterfinal'].get(t,1)+1e-6)]
    if bad: issues.setdefault('POOLS', []).append(('HIGH', f'monotonicity violated: {bad[:5]}'))

n_high = sum(1 for v in issues.values() for s,_ in v if s=='HIGH')
n_med = sum(1 for v in issues.values() for s,_ in v if s=='MED')
print(f'checked {len(dirs)} dirs: {n_high} HIGH / {n_med} MED issues in {len(issues)} dirs')
for d, v in sorted(issues.items()):
    for s, m in v: print(f'  [{s}] {d}: {m}')
sys.exit(1 if n_high else 0)
