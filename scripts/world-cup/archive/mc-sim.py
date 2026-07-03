#!/usr/bin/env python3
"""Pure-Elo Monte Carlo simulation of the 2026 FIFA World Cup (48 teams).

Market-blind statistical backbone: probabilities derive ONLY from the Elo
table (eloratings.net snapshot) + Poisson goal model. No market input.

Model summary (see METHOD string below for the archived description):
  - Group match goals: independent Poissons, lambda_A = 2.6 * eA where
    eA = pi_A / (pi_A + pi_B), pi_X = 10^(Elo_eff_X / 400).
  - Host bonus +100 Elo for Mexico / United States / Canada, group stage only.
  - Standings: points, GD, GF, head-to-head mini-table among fully tied
    teams, then random draw.
  - R32: official FIFA 2026 bracket (matches 73-88); 8 best thirds assigned
    to allowed slots via deterministic Kuhn bipartite matching.
  - Knockouts: 90-min Poisson (no host bonus); draws resolved Bernoulli with
    p = Elo expectancy (draw mass split proportionally to win expectancies).
  - 100,000 sims, seed 20260611.
"""

import bisect
import json
import math
import random
import sys
import time
from datetime import datetime, timezone

import os

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    "..", "..", "runtime-artifacts", "world-cup")
ELO_PATH = f"{BASE}/elo-table.json"
OUT_PATH = f"{BASE}/mc-results.json"

N_SIMS = 100_000
SEED = 20260611
TOTAL_GOALS = 2.6
HOST_BONUS = 100.0
HOSTS = {"Mexico", "United States", "Canada"}
MAX_GOALS = 15  # Poisson tail cutoff

# Groups recovered from event-list/questions.json (resolution metadata only).
GROUPS = {
    "A": ["Mexico", "Korea Republic", "Czechia", "South Africa"],
    "B": ["Canada", "Switzerland", "Bosnia-Herzegovina", "Qatar"],
    "C": ["Brazil", "Morocco", "Scotland", "Haiti"],
    "D": ["United States", "Türkiye", "Paraguay", "Australia"],
    "E": ["Germany", "Ecuador", "Côte d'Ivoire", "Curaçao"],
    "F": ["Netherlands", "Japan", "Sweden", "Tunisia"],
    "G": ["Belgium", "IR Iran", "Egypt", "New Zealand"],
    "H": ["Spain", "Uruguay", "Saudi Arabia", "Cabo Verde"],
    "I": ["France", "Norway", "Senegal", "Iraq"],
    "J": ["Argentina", "Austria", "Algeria", "Jordan"],
    "K": ["Portugal", "Colombia", "Uzbekistan", "DR Congo"],
    "L": ["England", "Croatia", "Panama", "Ghana"],
}

# Official FIFA 2026 R32 allocation (matches 73-88), per the published
# schedule (en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage,
# fetched 2026-06-11). ("W", g) = group winner, ("R", g) = runner-up,
# ("T", slot) = third-place slot with allowed source groups.
R32 = {
    73: (("R", "A"), ("R", "B")),
    74: (("W", "E"), ("T", "ABCDF")),
    75: (("W", "F"), ("R", "C")),
    76: (("W", "C"), ("R", "F")),
    77: (("W", "I"), ("T", "CDFGH")),
    78: (("R", "E"), ("R", "I")),
    79: (("W", "A"), ("T", "CEFHI")),
    80: (("W", "L"), ("T", "EHIJK")),
    81: (("W", "D"), ("T", "BEFIJ")),
    82: (("W", "G"), ("T", "AEHIJ")),
    83: (("R", "K"), ("R", "L")),
    84: (("W", "H"), ("R", "J")),
    85: (("W", "B"), ("T", "EFGIJ")),
    86: (("W", "J"), ("R", "H")),
    87: (("W", "K"), ("T", "DEIJL")),
    88: (("R", "D"), ("R", "G")),
}
THIRD_SLOTS = [m for m in sorted(R32) if R32[m][1][0] == "T"]
THIRD_ALLOWED = {m: set(R32[m][1][1]) for m in THIRD_SLOTS}

R16 = {89: (74, 77), 90: (73, 75), 91: (76, 78), 92: (79, 80),
       93: (83, 84), 94: (81, 82), 95: (86, 88), 96: (85, 87)}
QF = {97: (89, 90), 98: (93, 94), 99: (91, 92), 100: (95, 96)}
SF = {101: (97, 98), 102: (99, 100)}


def load_elo():
    with open(ELO_PATH) as fh:
        table = json.load(fh)["teams"]
    elo = {}
    for grp in GROUPS.values():
        for name in grp:
            if name not in table:
                raise KeyError(f"no Elo entry for {name!r}")
            elo[name] = float(table[name]["elo"])
    return elo


def poisson_cdf(lam):
    cdf, p, total = [], math.exp(-lam), 0.0
    for k in range(MAX_GOALS + 1):
        total += p
        cdf.append(min(total, 1.0))
        p *= lam / (k + 1)
    cdf[-1] = 1.0
    return cdf


def expectancy(elo_a, elo_b):
    pa = 10.0 ** (elo_a / 400.0)
    pb = 10.0 ** (elo_b / 400.0)
    return pa / (pa + pb)


def ko_win_prob(elo_a, elo_b):
    """P(team A advances): Poisson 90' + draw mass resolved with p = eA."""
    ea = expectancy(elo_a, elo_b)
    la, lb = TOTAL_GOALS * ea, TOTAL_GOALS * (1.0 - ea)
    pmf = lambda lam: [math.exp(-lam) * lam**k / math.factorial(k)
                       for k in range(MAX_GOALS + 1)]
    pa_, pb_ = pmf(la), pmf(lb)
    win = sum(pa_[i] * pb_[j] for i in range(MAX_GOALS + 1) for j in range(i))
    draw = sum(pa_[i] * pb_[i] for i in range(MAX_GOALS + 1))
    return win + ea * draw


def rank4(teams, stats, results, rng):
    """FIFA-style ranking: pts, GD, GF, head-to-head among tied, random."""
    order = sorted(teams, key=lambda t: (-stats[t][0], -stats[t][1],
                                         -stats[t][2]))
    ranked, i = [], 0
    while i < len(order):
        j = i
        ki = stats[order[i]]
        while j + 1 < len(order) and stats[order[j + 1]] == ki:
            j += 1
        cluster = order[i:j + 1]
        if len(cluster) > 1:
            tied = set(cluster)
            mini = {t: [0, 0, 0] for t in cluster}
            for (a, b), (ga, gb) in results.items():
                if a in tied and b in tied:
                    _accumulate(mini, a, b, ga, gb)
            cluster.sort(key=lambda t: (-mini[t][0], -mini[t][1],
                                        -mini[t][2], rng.random()))
        ranked.extend(cluster)
        i = j + 1
    return ranked


def _accumulate(stats, a, b, ga, gb):
    if ga > gb:
        stats[a][0] += 3
    elif gb > ga:
        stats[b][0] += 3
    else:
        stats[a][0] += 1
        stats[b][0] += 1
    stats[a][1] += ga - gb
    stats[b][1] += gb - ga
    stats[a][2] += ga
    stats[b][2] += gb


def kuhn_match(thirds, rng):
    """Assign 8 qualified third-place groups to allowed R32 slots."""
    order = sorted(thirds,
                   key=lambda g: sum(g in THIRD_ALLOWED[m] for m in THIRD_SLOTS))
    slot_of, group_of = {}, {}

    def try_assign(g, seen):
        for m in THIRD_SLOTS:
            if g in THIRD_ALLOWED[m] and m not in seen:
                seen.add(m)
                if m not in group_of or try_assign(group_of[m], seen):
                    group_of[m] = g
                    slot_of[g] = m
                    return True
        return False

    for g in order:
        try_assign(g, set())
    unmatched = [g for g in thirds if g not in slot_of]
    if unmatched:  # should never happen with FIFA's allowed sets
        free = [m for m in THIRD_SLOTS if m not in group_of]
        rng.shuffle(free)
        for g, m in zip(unmatched, free):
            group_of[m] = g
            slot_of[g] = m
        return slot_of, len(unmatched)
    return slot_of, 0


def main():
    t0 = time.time()
    elo = load_elo()
    rng = random.Random(SEED)
    teams = [t for grp in GROUPS.values() for t in grp]
    idx = {t: i for i, t in enumerate(teams)}

    # Precompute group fixtures with host bonus + Poisson CDFs.
    fixtures = {}  # group -> list of (a, b, cdf_a, cdf_b)
    for g, members in GROUPS.items():
        fx = []
        for i in range(4):
            for j in range(i + 1, 4):
                a, b = members[i], members[j]
                ea_, eb_ = elo[a], elo[b]
                if a in HOSTS:
                    ea_ += HOST_BONUS
                if b in HOSTS:
                    eb_ += HOST_BONUS
                ea = expectancy(ea_, eb_)
                fx.append((a, b, poisson_cdf(TOTAL_GOALS * ea),
                           poisson_cdf(TOTAL_GOALS * (1.0 - ea))))
        fixtures[g] = fx

    ko_cache = {}

    def ko_winner(a, b):
        key = (a, b)
        p = ko_cache.get(key)
        if p is None:
            p = ko_win_prob(elo[a], elo[b])
            ko_cache[key] = p
        return a if rng.random() < p else b

    n = len(teams)
    c_gw = [0] * n
    c_r32 = [0] * n
    c_qf = [0] * n
    c_sf = [0] * n
    c_fin = [0] * n
    c_ch = [0] * n
    fallback_total = 0

    for sim in range(N_SIMS):
        firsts, seconds, thirds = {}, {}, {}
        for g, members in GROUPS.items():
            stats = {t: [0, 0, 0] for t in members}  # pts, gd, gf
            results = {}
            for a, b, cdf_a, cdf_b in fixtures[g]:
                ga = bisect.bisect_right(cdf_a, rng.random())
                gb = bisect.bisect_right(cdf_b, rng.random())
                results[(a, b)] = (ga, gb)
                _accumulate(stats, a, b, ga, gb)
            ranked = rank4(members, stats, results, rng)
            firsts[g], seconds[g] = ranked[0], ranked[1]
            third = ranked[2]
            s = stats[third]
            thirds[g] = (third, s[0], s[1], s[2])
            c_gw[idx[ranked[0]]] += 1

        third_rank = sorted(GROUPS, key=lambda g: (-thirds[g][1],
                                                   -thirds[g][2],
                                                   -thirds[g][3],
                                                   rng.random()))
        qualified = third_rank[:8]
        slot_of, fb = kuhn_match(qualified, rng)
        fallback_total += fb
        third_team = {slot_of[g]: thirds[g][0] for g in qualified}

        winners = {}
        for m, (sa, sb) in R32.items():
            a = (firsts[sa[1]] if sa[0] == "W"
                 else seconds[sa[1]] if sa[0] == "R" else third_team[m])
            b = (firsts[sb[1]] if sb[0] == "W"
                 else seconds[sb[1]] if sb[0] == "R" else third_team[m])
            c_r32[idx[a]] += 1
            c_r32[idx[b]] += 1
            winners[m] = ko_winner(a, b)
        for m, (ma, mb) in R16.items():
            winners[m] = ko_winner(winners[ma], winners[mb])
        for m, (ma, mb) in QF.items():
            a, b = winners[ma], winners[mb]
            c_qf[idx[a]] += 1
            c_qf[idx[b]] += 1
            winners[m] = ko_winner(a, b)
        for m, (ma, mb) in SF.items():
            a, b = winners[ma], winners[mb]
            c_sf[idx[a]] += 1
            c_sf[idx[b]] += 1
            winners[m] = ko_winner(a, b)
        fa, fb_ = winners[101], winners[102]
        c_fin[idx[fa]] += 1
        c_fin[idx[fb_]] += 1
        c_ch[idx[ko_winner(fa, fb_)]] += 1

        if (sim + 1) % 20_000 == 0:
            el = time.time() - t0
            eta = el / (sim + 1) * (N_SIMS - sim - 1)
            print(f"INFO  sims {sim + 1:>7}/{N_SIMS}  elapsed {el:6.1f}s  "
                  f"eta {eta:5.1f}s", flush=True)

    method = (
        "Pure-Elo Poisson Monte Carlo: 100,000 full-tournament simulations, "
        "seed 20260611, ratings from the eloratings.net snapshot of "
        "2026-06-11 (elo-table.json); no market input of any kind. "
        "Match goals are independent Poissons with lambdaA = 2.6 * eA, "
        "eA = 10^(EloA/400) / (10^(EloA/400) + 10^(EloB/400)), i.e. the Elo "
        "logistic expectancy splits a 2.6-goal baseline; hosts Mexico, "
        "United States and Canada receive +100 Elo in group matches only, "
        "and no host bonus is applied in knockouts because venues vary "
        "(approximation). Group ranking uses points, goal difference, goals "
        "scored, head-to-head mini-table among fully tied teams, then a "
        "random draw; the 8 best third-placed teams are ranked by points / "
        "GD / goals scored / random. The knockout tree is the official FIFA "
        "2026 bracket (matches 73-104 per the published schedule); "
        "third-placed teams are assigned to the 8 allowed winner slots by "
        "deterministic Kuhn bipartite matching over FIFA's allowed-group "
        "sets (approximation of FIFA's official combination table; same- "
        "group R32 rematches impossible by construction). Knockout matches "
        "are 90-minute Poisson simulations whose draw mass is resolved by a "
        "Bernoulli draw with probability equal to the Elo expectancy, i.e. "
        "draw mass split proportionally to win expectancies as a stand-in "
        "for extra time and penalties."
    )

    out_teams = {}
    for t in teams:
        i = idx[t]
        out_teams[t] = {
            "p_group_winner": round(c_gw[i] / N_SIMS, 5),
            "p_r32": round(c_r32[i] / N_SIMS, 5),
            "p_qf": round(c_qf[i] / N_SIMS, 5),
            "p_sf": round(c_sf[i] / N_SIMS, 5),
            "p_final": round(c_fin[i] / N_SIMS, 5),
            "p_champion": round(c_ch[i] / N_SIMS, 5),
        }
    out_groups = {g: {t: out_teams[t]["p_group_winner"] for t in members}
                  for g, members in GROUPS.items()}

    # Sanity assertions.
    for g, members in GROUPS.items():
        s = sum(out_teams[t]["p_group_winner"] for t in members)
        assert abs(s - 1.0) <= 0.005, f"group {g} winner sum {s}"
    sums = {k: sum(v[k] for v in out_teams.values())
            for k in ("p_qf", "p_sf", "p_final", "p_champion")}
    assert abs(sums["p_qf"] - 8) <= 0.05, sums
    assert abs(sums["p_sf"] - 4) <= 0.05, sums
    assert abs(sums["p_champion"] - 1) <= 0.05, sums
    for t, v in out_teams.items():
        assert (v["p_champion"] <= v["p_final"] <= v["p_sf"]
                <= v["p_qf"] <= v["p_r32"]), (t, v)
    assert fallback_total == 0, f"third-place matching fallbacks: {fallback_total}"

    result = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "n_sims": N_SIMS,
        "seed": SEED,
        "method": method,
        "teams": out_teams,
        "groups": out_groups,
    }
    with open(OUT_PATH, "w") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)

    print(f"OK    sanity checks passed (qf sum {sums['p_qf']:.3f}, "
          f"sf sum {sums['p_sf']:.3f}, champion sum {sums['p_champion']:.3f}, "
          f"third-slot fallbacks {fallback_total})")
    print(f"OK    wrote {OUT_PATH}  ({time.time() - t0:.1f}s)")
    print("\nTop 10 champion probabilities:")
    top = sorted(out_teams.items(), key=lambda kv: -kv[1]["p_champion"])[:10]
    for rank, (t, v) in enumerate(top, 1):
        print(f"  {rank:>2}. {t:<15} champion {v['p_champion']:.4f}  "
              f"final {v['p_final']:.4f}  sf {v['p_sf']:.4f}  "
              f"qf {v['p_qf']:.4f}  group-win {v['p_group_winner']:.4f}")


if __name__ == "__main__":
    sys.setrecursionlimit(10_000)
    main()
