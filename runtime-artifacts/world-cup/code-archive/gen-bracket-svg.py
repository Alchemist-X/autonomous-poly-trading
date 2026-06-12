import json

B = json.load(open('runtime-artifacts/world-cup/bracket-prediction.json'))
CN = {"Mexico":"墨西哥","South Korea":"韩国","Czechia":"捷克","South Africa":"南非","Switzerland":"瑞士","Canada":"加拿大","Bosnia and Herzegovina":"波黑","Qatar":"卡塔尔","Brazil":"巴西","Morocco":"摩洛哥","Scotland":"苏格兰","Haiti":"海地","USA":"美国","Türkiye":"土耳其","Paraguay":"巴拉圭","Australia":"澳大利亚","Germany":"德国","Ecuador":"厄瓜多尔","Ivory Coast":"科特迪瓦","Curaçao":"库拉索","Netherlands":"荷兰","Japan":"日本","Sweden":"瑞典","Tunisia":"突尼斯","Belgium":"比利时","Egypt":"埃及","Iran":"伊朗","New Zealand":"新西兰","Spain":"西班牙","Uruguay":"乌拉圭","Saudi Arabia":"沙特","Cape Verde":"佛得角","France":"法国","Norway":"挪威","Senegal":"塞内加尔","Iraq":"伊拉克","Argentina":"阿根廷","Austria":"奥地利","Algeria":"阿尔及利亚","Jordan":"约旦","Portugal":"葡萄牙","Colombia":"哥伦比亚","Congo DR":"刚果民主","Uzbekistan":"乌兹别克","England":"英格兰","Croatia":"克罗地亚","Ghana":"加纳","Panama":"巴拿马"}

ties = {t['match']: t for stage in ["R32","R16","QF","SF","F"] for t in B[stage]}
# seed labels for R32 entrants
R32_SRC = {73:("A2","B2"),74:("E1","T3"),75:("F1","C2"),76:("C1","F2"),77:("I1","T3"),78:("E2","I2"),79:("A1","T3"),80:("L1","T3"),81:("D1","T3"),82:("G1","T3"),83:("K2","L2"),84:("H1","J2"),85:("B1","T3"),86:("J1","H2"),87:("K1","T3"),88:("D2","G2")}
champ_path = set()
champ = B['champion']
for stage in ["R32","R16","QF","SF","F"]:
    for t in B[stage]:
        if champ in (t['a'], t['b']):
            champ_path.add((stage, t['match']))

LEFT  = {"r32o":[74,77,73,75,83,84,81,82], "r16":[89,90,93,94], "qf":[97,98], "sf":101}
RIGHT = {"r32o":[76,78,79,80,86,88,85,87], "r16":[91,92,95,96], "qf":[99,100], "sf":102}
W,H,P = 124,22,29
COLS = [8,142,276,410,544]
out = []
def box(x,y,team,note,hl):
    cls = "c-teal" if hl else "c-gray"
    out.append(f'<g class="{cls}"><rect x="{x}" y="{y}" width="{W}" height="{H}" rx="5"/>'
               f'<text class="ts" x="{x+7}" y="{y+15}">{CN[team]} {note}</text></g>')
def elbow(x1,y1,x2,y2):
    xm = x1 + 5
    out.append(f'<path d="M{x1} {y1} H{xm} V{y2} H{x2}" fill="none" stroke="var(--color-border-primary)" stroke-width="1"/>')

def half(spec, y0, title):
    out.append(f'<text class="th" x="8" y="{y0-26}">{title}</text>')
    for i,lbl in enumerate(["32强","16强","八强","四强","决赛名额"]):
        out.append(f'<text class="ts" x="{COLS[i]+7}" y="{y0-8}" opacity="0.7">{lbl}</text>')
    pos = {}  # (col, slot) -> center y
    # col 0: R32 entrants
    for j,m in enumerate(spec["r32o"]):
        t = ties[m]
        for k,(team,seed) in enumerate(zip((t['a'],t['b']), R32_SRC[m])):
            r = 2*j+k
            y = y0 + r*P
            hl = team == champ and ("R32",m) in champ_path
            box(COLS[0], y, team, seed, hl)
            pos[(0,r)] = y + H/2
    # advancing columns
    col_ties = [ [ties[m] for m in spec["r32o"]], [ties[m] for m in spec["r16"]], [ties[m] for m in spec["qf"]], [ties[spec["sf"]]] ]
    for c in range(1,5):
        prev = col_ties[c-1]
        for s,t in enumerate(prev):
            team = t['winner']; pct = f"{t['p_winner']:.0%}"
            cy = (pos[(c-1,2*s)] + pos[(c-1,2*s+1)])/2
            y = cy - H/2
            stage_here = ["R32","R16","QF","SF"][c-1]
            hl = team == champ
            box(COLS[c], y, team, pct, hl)
            pos[(c,s)] = cy
            elbow(COLS[c-1]+W, pos[(c-1,2*s)], COLS[c], cy)
            elbow(COLS[c-1]+W, pos[(c-1,2*s+1)], COLS[c], cy)
    return pos[(4,0)]

y_l = half(LEFT, 78, "上半区 → 半决赛 1")
y_r = half(RIGHT, 78+16*P+74, "下半区 → 半决赛 2")
# final strip
fy = 78+32*P+118
f = ties[104]
out.append(f'<text class="th" x="8" y="{fy-10}">决赛（纽约/新泽西 · 2026-07-19）</text>')
for k,team in enumerate((f['a'],f['b'])):
    box(180+k*190, fy, team, "", team==champ)
out.append(f'<text class="ts" x="332" y="{fy+15}">vs</text>')
out.append(f'<g class="c-teal"><rect x="180" y="{fy+34}" width="314" height="26" rx="6"/>'
           f'<text class="t" x="{180+18}" y="{fy+51}">预测冠军：{CN[champ]}（决赛胜率 {f["p_winner"]:.0%}，MC 夺冠 37.8%）</text></g>')
out.append(f'<text class="ts" x="8" y="{fy+82}" opacity="0.6">绿色 = 预测夺冠路径 · 每格百分比 = 该队赢下上一轮对位的模型概率（纯 Elo，市场盲测）· 32强格标注 = 小组名次/最佳第三</text>')
Hh = fy + 100
svg = (f'<svg width="100%" viewBox="0 0 680 {Hh}" role="img" xmlns="http://www.w3.org/2000/svg">'
       f'<title>2026 世界杯盲测对阵预测</title><desc>基于纯 Elo 模态路径的 32 强至决赛对阵预测，西班牙为预测冠军</desc>'
       + "".join(out) + '</svg>')
open('/tmp/bracket.svg','w').write(svg)
print(len(svg), "bytes")
