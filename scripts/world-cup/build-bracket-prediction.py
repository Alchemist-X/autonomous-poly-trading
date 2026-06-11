import json

ELO = json.load(open('runtime-artifacts/world-cup/elo-table.json'))['teams']
MC_RAW = json.load(open('runtime-artifacts/world-cup/mc-results.json'))['teams']
# MC uses FIFA fixture names; bracket groups use common names.
MC_ALIAS = {"South Korea": "Korea Republic", "Ivory Coast": "Côte d'Ivoire", "USA": "United States",
            "Cape Verde": "Cabo Verde", "Congo DR": "DR Congo",
            "Bosnia and Herzegovina": "Bosnia-Herzegovina", "Iran": "IR Iran"}
MC = {**MC_RAW, **{k: MC_RAW[v] for k, v in MC_ALIAS.items() if v in MC_RAW}}
GROUPS = {"A": ["Mexico","South Korea","Czechia","South Africa"],"B": ["Switzerland","Canada","Bosnia and Herzegovina","Qatar"],"C": ["Brazil","Morocco","Scotland","Haiti"],"D": ["USA","Türkiye","Paraguay","Australia"],"E": ["Germany","Ecuador","Ivory Coast","Curaçao"],"F": ["Netherlands","Japan","Sweden","Tunisia"],"G": ["Belgium","Egypt","Iran","New Zealand"],"H": ["Spain","Uruguay","Saudi Arabia","Cape Verde"],"I": ["France","Norway","Senegal","Iraq"],"J": ["Argentina","Austria","Algeria","Jordan"],"K": ["Portugal","Colombia","Congo DR","Uzbekistan"],"L": ["England","Croatia","Ghana","Panama"]}
HOSTS = {"Mexico","USA","Canada"}
R32 = {73:(("R","A"),("R","B")),74:(("W","E"),("T","ABCDF")),75:(("W","F"),("R","C")),76:(("W","C"),("R","F")),77:(("W","I"),("T","CDFGH")),78:(("R","E"),("R","I")),79:(("W","A"),("T","CEFHI")),80:(("W","L"),("T","EHIJK")),81:(("W","D"),("T","BEFIJ")),82:(("W","G"),("T","AEHIJ")),83:(("R","K"),("R","L")),84:(("W","H"),("R","J")),85:(("W","B"),("T","EFGIJ")),86:(("W","J"),("R","H")),87:(("W","K"),("T","DEIJL")),88:(("R","D"),("R","G"))}
R16 = {89:(74,77),90:(73,75),91:(76,78),92:(79,80),93:(83,84),94:(81,82),95:(86,88),96:(85,87)}
QF  = {97:(89,90),98:(93,94),99:(91,92),100:(95,96)}
SF  = {101:(97,98),102:(99,100)}

def elo(t): return float(ELO[t]['elo'])
def eff(t, group_stage): return elo(t) + (100 if group_stage and t in HOSTS else 0)
def exp_win(a, b):  # knockout: neutral, Elo expectancy
    pa = 10**(elo(a)/400); pb = 10**(elo(b)/400)
    return pa/(pa+pb)

# 1) modal group standings by effective Elo (host bonus applies in groups)
standings = {g: sorted(ts, key=lambda t: -eff(t, True)) for g, ts in GROUPS.items()}
firsts  = {g: s[0] for g, s in standings.items()}
seconds = {g: s[1] for g, s in standings.items()}
thirds  = {g: s[2] for g, s in standings.items()}

# 2) best 8 thirds by raw Elo (modal proxy for points/GD)
third_rank = sorted(GROUPS, key=lambda g: -elo(thirds[g]))
qualified = sorted(third_rank[:8])

# 3) deterministic backtracking: assign qualified third groups to allowed slots
slots = [m for m in sorted(R32) if R32[m][1][0] == "T"]
allowed = {m: set(R32[m][1][1]) for m in slots}
def assign(i, used, acc):
    if i == len(qualified): return acc
    g = qualified[i]
    for m in slots:
        if m not in used and g in allowed[m]:
            r = assign(i+1, used | {m}, {**acc, m: g})
            if r: return r
    return None
slot_third = assign(0, set(), {})
assert slot_third, "third matching failed"

def src_team(s, m):
    kind = s[0]
    return firsts[s[1]] if kind=="W" else seconds[s[1]] if kind=="R" else thirds[slot_third[m]]

bracket = {"meta": {"basis": "modal path: groups ranked by effective Elo (host +100 in groups); knockout winner = higher Elo; per-tie p = Elo expectancy", "elo_snapshot": "2026-06-11", "mc": "marginals from 100k-sim mc-results.json"}}
result = {}
def play(m, a, b):
    p = exp_win(a, b)
    w = a if p >= 0.5 else b
    result[m] = w
    return {"match": m, "a": a, "b": b, "winner": w, "p_winner": round(max(p, 1-p), 3)}

bracket["R32"] = [play(m, src_team(R32[m][0], m), src_team(R32[m][1], m)) for m in sorted(R32)]
bracket["R16"] = [play(m, result[a], result[b]) for m, (a,b) in sorted(R16.items())]
bracket["QF"]  = [play(m, result[a], result[b]) for m, (a,b) in sorted(QF.items())]
bracket["SF"]  = [play(m, result[a], result[b]) for m, (a,b) in sorted(SF.items())]
f = play(104, result[101], result[102]); bracket["F"] = [f]
bracket["champion"] = f["winner"]
bracket["standings"] = {
    g: [
        {"team": t, "pos": i + 1, "p_r32": round(MC[t]["p_r32"], 4),
         "status": "晋级" if (i < 2 or (i == 2 and g in qualified)) else "出局"}
        for i, t in enumerate(standings[g])
    ]
    for g in sorted(GROUPS)
}
bracket["mc_marginals_top8"] = sorted(((t, round(d["p_qf"],3), round(d["p_sf"],3), round(d["p_champion"],3)) for t,d in MC.items()), key=lambda x:-x[1])[:12]

json.dump(bracket, open('runtime-artifacts/world-cup/bracket-prediction.json','w'), ensure_ascii=False, indent=1)
for stage in ["R32","R16","QF","SF","F"]:
    print(f"--- {stage} ---")
    for t in bracket[stage]:
        print(f"  M{t['match']}: {t['a']} vs {t['b']}  -> {t['winner']} ({t['p_winner']:.0%})")
print("CHAMPION:", bracket["champion"])
print("qualified thirds:", {g: thirds[g] for g in qualified})
