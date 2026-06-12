import json, os, re, csv
from datetime import datetime

BASE = '/Users/Aincrad/.claude/projects/-Users-Aincrad-dev-proj-predict-raven/6367ed0b-6379-410a-8033-1b4657fe0a95/subagents/workflows'
RUNS = {
    'wf_dfde9c3e-2a0': 'sample-v1(market-era,superseded)',
    'wf_d6b74666-a79': 'v1(killed; elo-table reused)',
    'wf_58799d69-b6b': 'v2(killed; MC reused)',
    'wf_8db95ecb-dc7': 'v3a(killed by interrupt)',
    'wf_b40cd715-3d6': 'v3b(production)',
}
OUT = 'runtime-artifacts/world-cup/run-ledger'
os.makedirs(OUT, exist_ok=True)

def label_from_prompt(t):
    pats = [
        (r'Event slug \(resolution metadata only\): (fifwc-[a-z0-9-]+)', lambda m: f'predict:{m.group(1)}'),
        (r'Verify and fix in place the forecast for .*?reports/(fifwc-[a-z0-9-]+)/', lambda m: f'verify:{m.group(1)}'),
        (r'GROUP ([A-L]) WINNER', lambda m: f'group:{m.group(1)}'),
        (r'Verify and fix in place ALL 12 group-winner', lambda m: 'verify:groups'),
        (r'Verify and fix in place the 3 pool', lambda m: 'verify:pools'),
        (r'(八强|reach-qf) pool', lambda m: 'pool:reach-qf'),
        (r'(四强|reach-sf) pool', lambda m: 'pool:reach-sf'),
        (r'(冠军|champion) pool', lambda m: 'pool:champion'),
        (r'Monte Carlo simulation of the ENTIRE', lambda m: 'mc:tournament'),
        (r'Retrofit the already-published opener', lambda m: 'sample:retrofit'),
        (r'Elo lookup table', lambda m: 'elo:table'),
        (r'MEXICO national team', lambda m: 'sample:evidence-mex'),
        (r'SOUTH AFRICA \(Bafana', lambda m: 'sample:evidence-rsa'),
        (r'MATCH-CONTEXT evidence', lambda m: 'sample:evidence-context'),
        (r'STATISTICAL baseline probability', lambda m: 'sample:model'),
        (r'CURRENT market prices', lambda m: 'sample:market(v1)'),
        (r'SYNTHESIS stage', lambda m: 'sample:synthesis'),
        (r'LENS: FACT-CHECK', lambda m: 'sample:verify-facts'),
        (r'LENS: NUMBERS', lambda m: 'sample:verify-numbers'),
        (r'LENS: COMPLIANCE', lambda m: 'sample:verify-compliance'),
        (r'revision stage', lambda m: 'sample:finalize'),
        (r'Predict group-stage match', lambda m: 'predict(v1):' + (re.search(r'Polymarket event: (fifwc-[a-z0-9-]+)', t).group(1) if re.search(r'Polymarket event: (fifwc-[a-z0-9-]+)', t) else '?')),
    ]
    for pat, fn in pats:
        m = re.search(pat, t)
        if m: return fn(m)
    return 'unknown'

rows = []
for run, runlabel in RUNS.items():
    d = f'{BASE}/{run}'
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        if not (f.startswith('agent-') and f.endswith('.jsonl')): continue
        path = f'{d}/{f}'
        first_ts = last_ts = None; model = ''; calls = 0
        inp = cr = cc = out = 0; prompt = ''; killed = False
        for line in open(path):
            try: e = json.loads(line)
            except: continue
            ts = e.get('timestamp')
            if ts:
                if not first_ts: first_ts = ts
                last_ts = ts
            if e.get('type') == 'user' and not prompt:
                c = e.get('message', {}).get('content')
                if isinstance(c, str): prompt = c
                elif isinstance(c, list):
                    prompt = ' '.join(x.get('text','') for x in c if isinstance(x, dict))
            if e.get('type') == 'user' and '[Request interrupted by user]' in str(e.get('message',{}).get('content','')): killed = True
            if e.get('type') == 'assistant':
                msg = e.get('message', {})
                u = msg.get('usage') or {}
                if u: calls += 1
                model = msg.get('model', model)
                inp += u.get('input_tokens', 0); cr += u.get('cache_read_input_tokens', 0)
                cc += u.get('cache_creation_input_tokens', 0); out += u.get('output_tokens', 0)
        dur = ''
        if first_ts and last_ts:
            t0 = datetime.fromisoformat(first_ts.replace('Z','+00:00')); t1 = datetime.fromisoformat(last_ts.replace('Z','+00:00'))
            dur = round((t1-t0).total_seconds())
        rows.append({'run': runlabel, 'label': label_from_prompt(prompt), 'model': model, 'duration_s': dur,
                     'api_calls': calls, 'input_fresh': inp, 'cache_creation': cc, 'cache_read': cr,
                     'output': out, 'total_new_tokens': inp+cc+out, 'killed': killed})

with open(f'{OUT}/ledger.csv', 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

prod = [r for r in rows if r['run'].startswith('v3b') or r['label'] in ('mc:tournament','elo:table')]
def sm(rs, k): return sum(r[k] for r in rs)
print(f"agents total: {len(rows)} | production-relevant: {len(prod)}")
print(f"PRODUCTION totals: out={sm(prod,'output'):,} fresh_in={sm(prod,'input_fresh'):,} cache_create={sm(prod,'cache_creation'):,} cache_read={sm(prod,'cache_read'):,}")
allr = rows
print(f"ALL (incl killed/superseded): out={sm(allr,'output'):,} fresh_in={sm(allr,'input_fresh'):,} cache_create={sm(allr,'cache_creation'):,} cache_read={sm(allr,'cache_read'):,}")
models = sorted(set(r['model'] for r in rows if r['model']))
print('models used:', models)
durs = sorted(r['duration_s'] for r in prod if isinstance(r['duration_s'], int) and r['label'].startswith('predict:'))
if durs: print(f"per-match predict duration: median {durs[len(durs)//2]}s, min {durs[0]}s, max {durs[-1]}s, n={len(durs)}")
po = sorted((r['output'] for r in prod if r['label'].startswith('predict:')))
if po: print(f"per-match predict output tokens: median {po[len(po)//2]:,}, max {po[-1]:,}")
