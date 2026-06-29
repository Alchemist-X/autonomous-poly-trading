#!/usr/bin/env python3
"""FIFA Post Match Summary Report (PMSR) PDF extractor.

The ONLY Python in @autopoly/fifa-models. Downloads the per-match PMSR PDFs for
a tournament and parses the reliably-extractable stat layers into TeamMatchStats
JSON (camelCase keys matching src/types.ts). Graphical layers (passing networks,
off-ball movement, ball-recovery time, offer-conversion) are NOT machine
extractable and are emitted as null with a single WARN.

Market-blind: only on-pitch FIFA stats are read; no betting/market data.

How the real 2026 PDFs are laid out (verified on PMSR-M01/M19/M22):
  - These reports render their stat tables as POSITIONED TEXT, not as PDF
    tables. pdfplumber.extract_tables() returns nothing, so we use
    extract_text() and parse each stat LINE with regex instead.
  - Page 1 carries the score + team names + date, e.g.
        "Mexico 2 - 0 South Africa"
        "Group A - Match 1"
        "11 June 2026"
  - Page 3 "Key Statistics" is almost everything, one stat per line as
        "<homeValue> <Label> <awayValue>", e.g.
        "Total 57.1% 6.8% 36.1% Total"   (possession: home 57.1, away 36.1)
        "1.78 xG (Expected Goals) 0.1"   (REAL FIFA xG)
        "16 (4) Attempts at Goal (On Target) 3 (2)"
        "547 (495) Total Passes (Complete) 351 (290)"
        "105 Completed Line Breaks 57"
        "13 Crosses 8"
        "23 Ball Progressions 8"
        "31 Forced Turnovers 32"
        "107.3 km Total Distance Covered 97.1 km"
        "5.3 km Zone 4 - Low Speed Sprinting: 20-25 km/h 5.1 km"
  - Page 4 "Phases of Play" is "<home%> <Label> <away%>", e.g.
        "9% High Press 6%", "1% Counter Attack 2%", "11% Low Block 14%".
  - Per-player physical tables (pages ~50-51) render their numeric columns
    GRAPHICALLY: the text layer has only player names, no values. So team
    sprints / high-speed-runs / top-speed / minutes are NOT extractable and are
    left at 0 (a one-time WARN is emitted). Total distance and Zone 4 distance,
    however, ARE on page 3 and are used.

What is parsed (reliable):
  - Key Statistics:  possession, REAL xG, attempts (total/on/off target),
                     passes (total/completed), pass completion, completed line
                     breaks, crosses, ball progressions, forced turnovers,
                     total distance (km), Zone 4 distance (km).
  - Phases of Play:  high-press / counter-attack / low-block %.

Derived approximation (fallback only): when a PDF lacks a real xG line we fall
back to the documented "Model 2" formula
  xgApprox = 0.10 * attemptsOnTarget
           + 0.03 * attemptsOffTarget
           + 0.05 * lineBreaksCompleted
The REAL FIFA xG is preferred whenever present.

Usage:
  python3 fifa_extract.py --selftest
  python3 fifa_extract.py --tournament 2026 --manifest manifest.json [--out DIR]
                          [--limit N] [--dry-run]

The --selftest path runs offline against an embedded fake stats dict and
validates row-assembly + real-xG passthrough + score parsing + JSON shape. It is
the test.
"""

import argparse
import json
import logging as _logging
import os
import re
import sys
import time
import traceback
import warnings as _warnings
from datetime import datetime, timezone

# pdfplumber/pdfminer emit noisy "Could not get FontBBox ..." messages on these
# reports; they are harmless. The text ones come through pdfminer's `logging`
# (not Python `warnings`), so we mute both channels to keep the terminal clean.
_warnings.filterwarnings("ignore")
_logging.getLogger("pdfminer").setLevel(_logging.ERROR)

# --- terminal visibility: colourised, levelled logging -----------------------

_COLOR = sys.stderr.isatty() and os.environ.get("NO_COLOR") is None
_CODES = {"INFO": "36", "WARN": "33", "ERR": "31", "OK": "32"}


def _log(level, msg):
    """Emit a levelled log line to stderr (INFO/WARN/ERR/OK)."""
    tag = f"[{level}]"
    if _COLOR:
        tag = f"\033[{_CODES.get(level, '0')}m{tag}\033[0m"
    print(f"{tag} {msg}", file=sys.stderr, flush=True)


# Emit the "graphical fields require OCR/manual annotation" warning only once.
_GRAPHICAL_WARNED = {"done": False}

# Fields that live in the GRAPHICAL layers of the PDF and cannot be parsed here.
GRAPHICAL_NULL_FIELDS = (
    "offerConversionPct",
    "movementInBehind",
    "ballRecoveryTimeSec",
    "passNetwork",
)


def _warn_graphical_once():
    if not _GRAPHICAL_WARNED["done"]:
        _GRAPHICAL_WARNED["done"] = True
        _log(
            "WARN",
            "Graphical fields left null (need OCR/manual annotation): "
            + ", ".join(GRAPHICAL_NULL_FIELDS),
        )


# --- low-level number helpers ------------------------------------------------
#
# Stat lines mix label text with numbers (and a label may even contain digits,
# e.g. "20-25 km/h"), so we never blindly grab "all numbers". Each extractor
# targets the positional shape of one line type (first/last %, first/last km,
# leading/trailing count, paren pairs) and returns the (home, away) it wants.


def _pct_pair(line):
    """First and last percentage in a line -> (home, away). None if <2. Pure.

    Possession line is "Total 57.1% 6.8% 36.1% Total"; home is the first %, away
    the last %. Phase lines are "<home%> <Label> <away%>". Same rule serves both.
    """
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*%", str(line or ""))
    if len(nums) < 2:
        return None
    return float(nums[0]), float(nums[-1])


def _possession_pair(line):
    """Possession data line -> (home%, away%). None if shape doesn't match. Pure.

    The possession value sits on its own line "Total 57.1% 6.8% 36.1% Total"
    (the word "Possession" is a separate, value-less header above it). We match
    by shape: a line bracketed by "Total" with exactly three percentages, where
    the first is the home share and the last (before the trailing "Total") is the
    away share; the middle % is the contested possession and is ignored.
    """
    stripped = str(line or "").strip()
    if not (stripped.lower().startswith("total")
            and stripped.lower().endswith("total")):
        return None
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*%", stripped)
    if len(nums) < 2:
        return None
    return float(nums[0]), float(nums[-1])


def _km_pair(line):
    """First and last "<num> km" in a line -> (home, away). None if <2. Pure.

    Used for "107.3 km Total Distance Covered 97.1 km" and the Zone 4 line. The
    "km/h" inside the Zone 4 label is also matched by `\\s*km`, but it sits
    between the two real values, so first/last still pick the right ones.
    """
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*km", str(line or ""))
    if len(nums) < 2:
        return None
    return float(nums[0]), float(nums[-1])


def _lead_trail_int(line):
    """Leading number and trailing number of a line -> (home, away). Pure.

    For simple count lines like "105 Completed Line Breaks 57" or
    "23 Ball Progressions 8". Returns None if either end lacks a number.
    """
    lead = re.match(r"^\s*(\d+(?:\.\d+)?)", str(line or ""))
    trail = re.search(r"(\d+(?:\.\d+)?)\s*$", str(line or ""))
    if not lead or not trail:
        return None
    return float(lead.group(1)), float(trail.group(1))


def _paren_pairs(line):
    """All "<n> (<m>)" numeric pairs in a line, in order. Pure.

    "16 (4) Attempts at Goal (On Target) 3 (2)" -> [(16,4),(3,2)]; the label
    "(On Target)" has no leading number so it is not matched. First pair is the
    home (total, sub); last pair is the away (total, sub).
    """
    return [(int(a), int(b))
            for a, b in re.findall(r"(\d+)\s*\((\d+)\)", str(line or ""))]


def _round(value, ndigits):
    """Round, preserving None. Pure."""
    return None if value is None else round(value, ndigits)


def _utc_stamp():
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


# --- page-1 score / team parsing ---------------------------------------------


def parse_score_teams(page1_text):
    """Parse "<home> <g> - <g> <away>" from page-1 text. Pure.

    Returns {"home","away","goalsHome","goalsAway"} or None if not found. The
    first matching line wins (the score banner is the document's first line).
    """
    for raw in (page1_text or "").splitlines():
        line = raw.strip()
        m = re.match(r"^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+?)\s*$", line)
        if m:
            return {
                "home": m.group(1).strip(),
                "goalsHome": int(m.group(2)),
                "goalsAway": int(m.group(3)),
                "away": m.group(4).strip(),
            }
    return None


# --- PDF parsing -------------------------------------------------------------
#
# A "raw stats dict" is the intermediate structure produced by reading the
# Key-Statistics / Phases-of-Play stat lines (home value | label | away value)
# plus physical totals and the page-1 score/teams. assemble_perspective() turns
# it into the two TeamMatchStats perspectives. Keeping parsing and assembly
# separate is what lets --selftest validate the math with no PDF.

# Each entry is (label-substring matched case-insensitively in a stat line,
# raw-dict key, extractor). The extractor returns (homeValue, awayValue) or
# None. Order matters: more specific labels must precede their substrings (so
# "Counter Attack" is tried before any "counter" catch-all would be).
PAGE3_LINE_RULES = (
    # possession data line is "Total <home%> <contested%> <away%> Total" (the
    # word "Possession" is a value-less header above it). Match by "total"; the
    # shape-checking extractor skips the other "Total ..." lines (passes/dist).
    ("total", "possessionPct", _possession_pair),
    # real FIFA xG: "1.78 xG (Expected Goals) 0.1"
    ("xg (expected goals)", "xgReal", _lead_trail_int),
    # "16 (4) Attempts at Goal (On Target) 3 (2)" -> total + on-target per side.
    ("attempts at goal", "attemptsPair", _paren_pairs),
    # "547 (495) Total Passes (Complete) 351 (290)" -> total + complete.
    ("total passes", "passesPair", _paren_pairs),
    ("completed line breaks", "lineBreaksCompleted", _lead_trail_int),
    ("crosses", "crosses", _lead_trail_int),
    ("ball progressions", "ballProgressions", _lead_trail_int),
    ("forced turnovers", "forcedTurnovers", _lead_trail_int),
    ("total distance covered", "totalDistanceKm", _km_pair),
    ("zone 4", "zone4Km", _km_pair),
)

# Phases-of-Play lines (page 4): "<home%> <Label> <away%>".
PAGE4_LINE_RULES = (
    ("high press", "phaseHighPressPct", _pct_pair),
    ("counter attack", "phaseCounterAttackPct", _pct_pair),
    ("low block", "phaseLowBlockPct", _pct_pair),
)


def _apply_rules(lines, rules, side_a, side_b, parse_warnings):
    """Match each rule against the first line whose VALUES it can extract.

    `side_a`/`side_b` are the home/away raw-stat dicts (mutated). Tuple-valued
    extractors (attempts/passes parens) store the raw pair under the rule key;
    scalar extractors store homeValue in side_a and awayValue in side_b.

    A label can appear on more than one line (e.g. "Possession" is both a bare
    header and the data line "Total 57.1% ... Total"); we scan all label-bearing
    lines and take the first that actually yields values, so the value-less
    header line is skipped. A label whose lines all yield nothing is recorded in
    `parse_warnings`. One unparseable line must never abort: each extraction is
    wrapped in try/except.
    """
    for needle, key, extractor in rules:
        candidates = [ln for ln in lines if needle in ln.lower()]
        if not candidates:
            parse_warnings.append(f"label not found: {needle}")
            continue

        stored = False
        for line in candidates:
            try:
                result = extractor(line)
            except Exception as err:  # noqa: BLE001 - one bad line must not abort
                parse_warnings.append(f"failed to parse '{needle}': {err}")
                continue
            if not result:
                continue

            if extractor is _paren_pairs:
                # Paren pairs: first pair is home (total, sub), last is away.
                if len(result) < 2:
                    continue
                side_a[key] = result[0]
                side_b[key] = result[-1]
            else:
                home, away = result
                side_a[key] = home
                side_b[key] = away
            stored = True
            break

        if not stored:
            parse_warnings.append(f"no values on any line for '{needle}'")


def parse_pdf(pdf_path):
    """Read a PMSR PDF into a raw stats dict via extract_text() line parsing.

    Returns ({"A": {...}, "B": {...}, "physA": {...}, "physB": {...},
              "meta": {...}, "parseWarnings": [...]}, warnings).
    Each side dict holds the home/away stat values; `physA`/`physB` hold the
    physical totals; `meta` holds the page-1 score + team names. pdfplumber is
    imported here so --selftest never requires it.
    """
    import pdfplumber  # local import: only needed on the download path

    warnings = []
    parse_warnings = []
    side_a, side_b = {}, {}

    with pdfplumber.open(pdf_path) as pdf:
        pages = [p.extract_text() or "" for p in pdf.pages]

    page1 = pages[0] if len(pages) > 0 else ""
    page3 = pages[2] if len(pages) > 2 else ""
    page4 = pages[3] if len(pages) > 3 else ""

    meta = parse_score_teams(page1) or {}
    if not meta:
        parse_warnings.append("could not parse score/teams from page 1")

    p3_lines = [ln.strip() for ln in page3.splitlines() if ln.strip()]
    p4_lines = [ln.strip() for ln in page4.splitlines() if ln.strip()]

    _apply_rules(p3_lines, PAGE3_LINE_RULES, side_a, side_b, parse_warnings)
    _apply_rules(p4_lines, PAGE4_LINE_RULES, side_a, side_b, parse_warnings)

    # The per-player physical tables render their numeric columns graphically,
    # so sprints / HSR / top-speed / minutes are not in the text layer. Total
    # distance + Zone 4 (from page 3) are the only physical numbers available;
    # Zone 5 has no page-3 line, so high-intensity distance is Zone-4-only here.
    phys_a = _phys_from_side(side_a, parse_warnings, "home")
    phys_b = _phys_from_side(side_b, parse_warnings, "away")

    if not side_a and not side_b:
        warnings.append("no recognised stat lines found")

    return (
        {
            "A": side_a,
            "B": side_b,
            "physA": phys_a,
            "physB": phys_b,
            "meta": meta,
            "parseWarnings": parse_warnings,
        },
        warnings,
    )


def _empty_phys():
    return {"distM": 0.0, "hiDistM": 0.0, "sprints": 0.0, "hsr": 0.0,
            "topSpeed": 0.0, "minutes": 0.0, "rows": 0}


def _phys_from_side(side, parse_warnings, which):
    """Build a physical accumulator for one side from page-3 distance numbers.

    Total-distance and Zone-4 distance arrive in KM on page 3; we convert to
    metres so assemble_perspective() (which divides by 1000) keeps working.
    Zone 5 has no page-3 line, so hiDistM is Zone-4-only; we note that once.
    sprints / hsr / topSpeed / minutes are not in the text layer -> left 0.
    """
    phys = _empty_phys()
    dist_km = side.get("totalDistanceKm")
    zone4_km = side.get("zone4Km")
    if dist_km is not None:
        phys["distM"] = float(dist_km) * 1000.0
    if zone4_km is not None:
        # High-intensity = Zone 4 (+ Zone 5, but Zone 5 is absent from page 3).
        phys["hiDistM"] = float(zone4_km) * 1000.0
        if which == "home" and "zone5 distance absent (page-3 has only zone 4)" \
                not in parse_warnings:
            parse_warnings.append(
                "zone5 distance absent (page-3 has only zone 4)")
    return phys


# --- row assembly (the part --selftest exercises) ----------------------------


def assemble_perspective(meta, side, phys):
    """Build one TeamMatchStats dict (camelCase) from a parsed side.

    `meta` carries matchId/date/neutral/team/opponent/goalsFor/goalsAgainst.
    `side` is the stat dict for this team; `phys` its physical accumulator.
    Distances arrive in metres and are converted to km. Numeric fields default
    to 0; graphical fields are null.

    xgApprox: the REAL FIFA xG (side["xgReal"]) is used when present; otherwise
    we fall back to the documented approximation
        0.10*onTarget + 0.03*offTarget + 0.05*lineBreaksCompleted.
    Pure.
    """
    # Attempts: side["attemptsPair"] is (total, onTarget); off = total - on.
    attempts_pair = side.get("attemptsPair")
    if attempts_pair:
        attempts_total, on_target = attempts_pair
    else:
        attempts_total, on_target = 0, 0
    off_target = max(attempts_total - on_target, 0)

    # Passes: side["passesPair"] is (total, completed).
    passes_pair = side.get("passesPair")
    if passes_pair:
        total_passes, passes_completed = passes_pair
    else:
        total_passes, passes_completed = 0, 0

    lb_completed = side.get("lineBreaksCompleted", 0.0) or 0.0
    # No separate "attempted" line in these reports -> attempted = completed.
    lb_attempted = side.get("lineBreaksAttempted", lb_completed) or lb_completed

    xg_real = side.get("xgReal")
    if xg_real is not None:
        xg_approx = float(xg_real)
    else:
        xg_approx = 0.10 * on_target + 0.03 * off_target + 0.05 * lb_completed

    dist_km = (phys.get("distM", 0.0) or 0.0) / 1000.0
    hi_km = (phys.get("hiDistM", 0.0) or 0.0) / 1000.0

    return {
        "team": meta["team"],
        "opponent": meta["opponent"],
        "matchId": meta["matchId"],
        "date": meta["date"],
        "neutral": bool(meta["neutral"]),
        "goalsFor": int(meta["goalsFor"]),
        "goalsAgainst": int(meta["goalsAgainst"]),

        "possessionPct": _round(side.get("possessionPct", 0.0) or 0.0, 1),
        "attemptsAtGoal": int(attempts_total),
        "attemptsOnTarget": int(on_target),
        "attemptsOffTarget": int(off_target),
        "totalPasses": int(total_passes),
        "passesCompleted": int(passes_completed),
        "crosses": int(side.get("crosses", 0.0) or 0.0),
        "ballProgressions": int(side.get("ballProgressions", 0.0) or 0.0),

        "phaseHighPressPct": _round(side.get("phaseHighPressPct", 0.0) or 0.0, 1),
        "phaseCounterAttackPct":
            _round(side.get("phaseCounterAttackPct", 0.0) or 0.0, 1),
        "phaseLowBlockPct": _round(side.get("phaseLowBlockPct", 0.0) or 0.0, 1),

        "lineBreaksAttempted": int(lb_attempted),
        "lineBreaksCompleted": int(lb_completed),
        # 4-units line breaks are not exposed in these reports -> 0.
        "lb4UnitsCompleted": int(side.get("lb4UnitsCompleted", 0.0) or 0.0),

        # Graphical layers — not machine extractable here.
        "offerConversionPct": None,
        "movementInBehind": None,
        "forcedTurnovers": int(side.get("forcedTurnovers", 0.0) or 0.0),
        "ballRecoveryTimeSec": None,

        "teamTotalDistanceKm": _round(dist_km, 2),
        "highIntensityDistanceKm": _round(hi_km, 2),
        "sprints": int(phys.get("sprints", 0.0) or 0.0),
        "highSpeedRuns": int(phys.get("hsr", 0.0) or 0.0),
        "topSpeedMax": _round(phys.get("topSpeed", 0.0) or 0.0, 1),
        "minutesPlayed": int(phys.get("minutes", 0.0) or 0.0),

        "passNetwork": None,
        "xgApprox": round(xg_approx, 3),
    }


# Numeric fields whose presence we report on per match (parsed vs null/zero).
TABULAR_FIELDS = (
    "possessionPct", "attemptsAtGoal", "attemptsOnTarget", "attemptsOffTarget",
    "totalPasses", "passesCompleted", "crosses", "ballProgressions",
    "phaseHighPressPct", "phaseCounterAttackPct", "phaseLowBlockPct",
    "lineBreaksAttempted", "lineBreaksCompleted", "lb4UnitsCompleted",
    "forcedTurnovers", "teamTotalDistanceKm", "highIntensityDistanceKm",
    "sprints", "highSpeedRuns", "topSpeedMax", "minutesPlayed",
)


def _resolve_teams_goals(entry, meta, parse_warnings):
    """Reconcile manifest teams/goals with the PDF's own page-1 banner.

    Canonical team names come from the manifest (they must match elo-table.json),
    but we VALIDATE them against page 1 and WARN on mismatch. Goals come from the
    PDF when the manifest omits them (manifest may carry only id/url/teams/date);
    PDF score is preferred over a manifest score when both exist and differ.
    Returns (goalsA, goalsB). Mutates `parse_warnings`. Pure-ish.
    """
    # Validate team names against the PDF banner (informational warning only).
    pdf_home = (meta or {}).get("home")
    pdf_away = (meta or {}).get("away")
    if pdf_home and pdf_away:
        man_home = str(entry.get("teamA", "")).lower()
        man_away = str(entry.get("teamB", "")).lower()
        if man_home and man_home not in pdf_home.lower() \
                and pdf_home.lower() not in man_home:
            parse_warnings.append(
                f"teamA '{entry.get('teamA')}' != page-1 home '{pdf_home}'")
        if man_away and man_away not in pdf_away.lower() \
                and pdf_away.lower() not in man_away:
            parse_warnings.append(
                f"teamB '{entry.get('teamB')}' != page-1 away '{pdf_away}'")

    # Goals: prefer the PDF score; fall back to the manifest.
    pdf_ga = (meta or {}).get("goalsHome")
    pdf_gb = (meta or {}).get("goalsAway")
    man_ga = entry.get("goalsA")
    man_gb = entry.get("goalsB")

    if pdf_ga is not None and pdf_gb is not None:
        if man_ga is not None and man_gb is not None \
                and (int(man_ga) != pdf_ga or int(man_gb) != pdf_gb):
            parse_warnings.append(
                f"manifest score {man_ga}-{man_gb} != page-1 "
                f"{pdf_ga}-{pdf_gb}; using page-1")
        return pdf_ga, pdf_gb

    return int(man_ga or 0), int(man_gb or 0)


def build_match_perspectives(entry, raw):
    """Produce both TeamMatchStats perspectives + a per-match report row.

    `entry` is one manifest row (matchId, teamA, teamB, date, optional neutral
    and goalsA/goalsB). `raw` is parse_pdf output (or a selftest fake). Pure
    given inputs.
    """
    parse_warnings = list(raw.get("parseWarnings", []))
    meta = raw.get("meta", {})
    ga, gb = _resolve_teams_goals(entry, meta, parse_warnings)

    meta_a = {"team": entry["teamA"], "opponent": entry["teamB"],
              "matchId": entry["matchId"], "date": entry["date"],
              "neutral": entry.get("neutral", True),
              "goalsFor": ga, "goalsAgainst": gb}
    meta_b = {"team": entry["teamB"], "opponent": entry["teamA"],
              "matchId": entry["matchId"], "date": entry["date"],
              "neutral": entry.get("neutral", True),
              "goalsFor": gb, "goalsAgainst": ga}

    a = assemble_perspective(meta_a, raw["A"], raw["physA"])
    b = assemble_perspective(meta_b, raw["B"], raw["physB"])

    # A field counts as "present" if either perspective parsed a non-zero value
    # for it (zero is indistinguishable from "missing" here).
    present = sorted(f for f in TABULAR_FIELDS if a.get(f) or b.get(f))
    report = {
        "matchId": entry["matchId"],
        "teamA": entry["teamA"],
        "teamB": entry["teamB"],
        "tabularFieldsPresent": present,
        "nullFields": list(GRAPHICAL_NULL_FIELDS),
        "parseWarnings": parse_warnings,
        "xgReal": {"A": raw["A"].get("xgReal"), "B": raw["B"].get("xgReal")},
    }
    return [a, b], report


# --- download with cache + retry/backoff -------------------------------------

_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def download_pdf(url, cache_path, retries=3):
    """Download `url` to `cache_path` unless cached. Returns the path.

    Realistic UA + exponential backoff. Raises on final failure so the caller
    can archive context. requests is imported lazily.
    """
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 1024:
        _log("INFO", f"cache hit: {os.path.basename(cache_path)}")
        return cache_path

    import requests  # local import: only needed on the download path

    last_err = None
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers={"User-Agent": _UA},
                                timeout=60, stream=True)
            resp.raise_for_status()
            tmp = f"{cache_path}.part"
            with open(tmp, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=65536):
                    if chunk:
                        fh.write(chunk)
            os.replace(tmp, cache_path)
            return cache_path
        except Exception as err:  # noqa: BLE001 — surfaced after retries
            last_err = err
            backoff = 2 ** attempt
            _log("WARN", f"download attempt {attempt}/{retries} failed "
                         f"({err}); retrying in {backoff}s")
            time.sleep(backoff)
    raise RuntimeError(f"download failed after {retries} attempts: {last_err}")


# --- error archiving ---------------------------------------------------------


def archive_error(out_dir, reason, context):
    """Write failure context to run-error/<ts>-<reason>/ and return the dir."""
    safe = re.sub(r"[^a-z0-9]+", "-", reason.lower()).strip("-")[:40] or "error"
    err_dir = os.path.join(out_dir, "run-error", f"{_utc_stamp()}-{safe}")
    os.makedirs(err_dir, exist_ok=True)
    with open(os.path.join(err_dir, "context.json"), "w") as fh:
        json.dump(context, fh, indent=2, ensure_ascii=False)
    _log("ERR", f"archived failure context -> {err_dir}")
    return err_dir


# --- manifest + run ----------------------------------------------------------


def load_manifest(path):
    """Read + minimally validate the manifest JSON array."""
    with open(path) as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("manifest must be a JSON array of match entries")
    # goalsA/goalsB are now optional: the PDF's own page-1 score is used when
    # the manifest omits them.
    required = ("matchId", "url", "teamA", "teamB", "date")
    for i, entry in enumerate(data):
        missing = [k for k in required if k not in entry]
        if missing:
            raise ValueError(f"manifest entry {i} missing keys: {missing}")
    return data


def default_out_dir(tournament):
    base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, "..", "..", "..", "runtime-artifacts",
                        "world-cup", "fifa", str(tournament))


def run(args):
    """Main pipeline: download -> parse -> assemble -> write JSON + report."""
    out_dir = args.out or default_out_dir(args.tournament)
    cache_dir = os.path.join(out_dir, "pdf-cache")
    os.makedirs(cache_dir, exist_ok=True)

    manifest = load_manifest(args.manifest)
    if args.limit:
        manifest = manifest[: args.limit]
    total = len(manifest)
    _log("INFO", f"tournament={args.tournament} mode="
                 f"{'dry-run' if args.dry_run else 'live'} matches={total} "
                 f"out={out_dir}")

    all_stats, reports = [], []
    null_field_total = 0
    parsed_ok = 0
    freed_bytes = 0
    started = time.time()

    for idx, entry in enumerate(manifest, start=1):
        elapsed = time.time() - started
        _log("INFO", f"[{idx}/{total}] {entry['teamA']} v {entry['teamB']} "
                     f"({entry['matchId']}) elapsed={elapsed:.1f}s")
        if args.dry_run:
            _log("INFO", f"  dry-run: would download {entry['url']}")
            continue
        try:
            cache_path = os.path.join(cache_dir, f"{entry['matchId']}.pdf")
            download_pdf(entry["url"], cache_path)
            raw, warnings = parse_pdf(cache_path)
            for w in warnings:
                _log("WARN", f"  {entry['matchId']}: {w}")
            _warn_graphical_once()
            perspectives, report = build_match_perspectives(entry, raw)
            for w in report.get("parseWarnings", []):
                _log("WARN", f"  {entry['matchId']}: {w}")
            all_stats.extend(perspectives)
            reports.append(report)
            null_field_total += len(report["nullFields"]) * 2
            parsed_ok += 1
            _log("OK", f"  parsed {entry['matchId']} "
                       f"(fields present: {len(report['tabularFieldsPresent'])})")
            # Delete the raw PDF once its data is extracted (user rule): keep only
            # the <10MB structured data, not the ~5MB-each source PDFs.
            if not args.keep_pdfs:
                try:
                    freed = os.path.getsize(cache_path)
                    os.remove(cache_path)
                    freed_bytes += freed
                    _log("INFO", f"  deleted {entry['matchId']}.pdf "
                                 f"(freed {freed / 1e6:.1f} MB)")
                except OSError:
                    pass
        except Exception as err:  # noqa: BLE001 — one bad PDF must not abort
            _log("ERR", f"  {entry['matchId']} failed: {err}")
            archive_error(out_dir, f"{entry['matchId']}-parse", {
                "matchId": entry["matchId"], "url": entry.get("url"),
                "error": str(err), "traceback": traceback.format_exc(),
            })
            reports.append({"matchId": entry["matchId"], "error": str(err)})

    if not args.dry_run:
        _write_outputs(out_dir, all_stats, reports)

    if not args.dry_run and not args.keep_pdfs:
        _log("OK", f"freed {freed_bytes / 1e6:.1f} MB of PDFs "
                   f"(kept only structured data)")
        try:
            if os.path.isdir(cache_dir) and not os.listdir(cache_dir):
                os.rmdir(cache_dir)
        except OSError:
            pass

    _log("OK", f"done: {parsed_ok}/{total} parsed, "
               f"{null_field_total} null graphical fields total")
    _log("INFO", f"output dir: {out_dir}")
    return 0


def _write_outputs(out_dir, all_stats, reports):
    stats_path = os.path.join(out_dir, "team-match-stats.json")
    report_path = os.path.join(out_dir, "extraction-report.json")
    with open(stats_path, "w") as fh:
        json.dump(all_stats, fh, indent=2, ensure_ascii=False)
    with open(report_path, "w") as fh:
        json.dump({"generatedAt": _utc_stamp(), "matches": reports},
                  fh, indent=2, ensure_ascii=False)
    _log("OK", f"wrote {stats_path}")
    _log("OK", f"wrote {report_path}")


# --- selftest (the test) -----------------------------------------------------


def _fake_raw():
    """A tiny embedded fake parse_pdf output for offline validation.

    Mirrors the NEW raw structure: paired attempts/passes, real xG, page-1 meta,
    and distances in metres in the phys accumulators.
    """
    return {
        "A": {"possessionPct": 57.1,
              "attemptsPair": (16, 4),   # total 16, on-target 4 -> off 12
              "passesPair": (547, 495),  # total 547, complete 495
              "xgReal": 1.78,
              "crosses": 13.0, "ballProgressions": 23.0,
              "phaseHighPressPct": 9.0, "phaseCounterAttackPct": 1.0,
              "phaseLowBlockPct": 11.0, "lineBreaksCompleted": 105.0,
              "forcedTurnovers": 31.0,
              "totalDistanceKm": 107.3, "zone4Km": 5.3},
        "B": {"possessionPct": 36.1,
              "attemptsPair": (3, 2),    # total 3, on-target 2 -> off 1
              "passesPair": (351, 290),
              "xgReal": 0.1,
              "crosses": 8.0, "ballProgressions": 8.0,
              "phaseHighPressPct": 6.0, "phaseCounterAttackPct": 2.0,
              "phaseLowBlockPct": 14.0, "lineBreaksCompleted": 57.0,
              "forcedTurnovers": 32.0,
              "totalDistanceKm": 97.1, "zone4Km": 5.1},
        "physA": {"distM": 107300.0, "hiDistM": 5300.0, "sprints": 0.0,
                  "hsr": 0.0, "topSpeed": 0.0, "minutes": 0.0, "rows": 0},
        "physB": {"distM": 97100.0, "hiDistM": 5100.0, "sprints": 0.0,
                  "hsr": 0.0, "topSpeed": 0.0, "minutes": 0.0, "rows": 0},
        "meta": {"home": "Mexico", "away": "South Africa",
                 "goalsHome": 2, "goalsAway": 0},
        "parseWarnings": [],
    }


# Keys every emitted TeamMatchStats must carry (mirrors src/types.ts exactly).
_EXPECTED_KEYS = {
    "team", "opponent", "matchId", "date", "neutral", "goalsFor",
    "goalsAgainst", "possessionPct", "attemptsAtGoal", "attemptsOnTarget",
    "attemptsOffTarget", "totalPasses", "passesCompleted", "crosses",
    "ballProgressions", "phaseHighPressPct", "phaseCounterAttackPct",
    "phaseLowBlockPct", "lineBreaksAttempted", "lineBreaksCompleted",
    "lb4UnitsCompleted", "offerConversionPct", "movementInBehind",
    "forcedTurnovers", "ballRecoveryTimeSec", "teamTotalDistanceKm",
    "highIntensityDistanceKm", "sprints", "highSpeedRuns", "topSpeedMax",
    "minutesPlayed", "passNetwork", "xgApprox",
}


def selftest():
    """Validate row assembly, real-xG passthrough, score parsing, JSON shape."""
    _log("INFO", "selftest: assembling perspectives from embedded fake stats")

    # --- score / team parsing from a page-1 banner --------------------------
    parsed = parse_score_teams(
        "Mexico 2 - 0 South Africa\nGroup A - Match 1\n11 June 2026")
    assert parsed == {"home": "Mexico", "away": "South Africa",
                      "goalsHome": 2, "goalsAway": 0}, f"score parse: {parsed}"

    # --- line extractors ----------------------------------------------------
    assert _pct_pair("9% High Press 6%") == (9.0, 6.0)
    # possession line: home first %, away last %; non-possession "Total ..."
    # lines must NOT match (shape guard returns None).
    assert _possession_pair("Total 57.1% 6.8% 36.1% Total") == (57.1, 36.1)
    assert _possession_pair("547 (495) Total Passes (Complete) 351 (290)") is None
    assert _km_pair("107.3 km Total Distance Covered 97.1 km") == (107.3, 97.1)
    assert _km_pair("5.3 km Zone 4 - 20-25 km/h 5.1 km") == (5.3, 5.1)
    assert _paren_pairs("16 (4) Attempts at Goal (On Target) 3 (2)") == \
        [(16, 4), (3, 2)]
    assert _lead_trail_int("105 Completed Line Breaks 57") == (105.0, 57.0)

    # --- manifest WITHOUT goals: PDF page-1 score must be used --------------
    entry = {"matchId": "PMSR-M01", "teamA": "MEX", "teamB": "RSA",
             "date": "2026-06-11", "neutral": False}
    perspectives, report = build_match_perspectives(entry, _fake_raw())
    a, b = perspectives

    # Shape: exactly the TeamMatchStats keys, no more, no less.
    assert set(a.keys()) == _EXPECTED_KEYS, \
        f"key mismatch: {set(a.keys()) ^ _EXPECTED_KEYS}"
    assert set(b.keys()) == _EXPECTED_KEYS

    # Perspective wiring + goals sourced from the PDF (2-0).
    assert a["team"] == "MEX" and a["opponent"] == "RSA"
    assert a["goalsFor"] == 2 and a["goalsAgainst"] == 0
    assert b["goalsFor"] == 0 and b["goalsAgainst"] == 2

    # Attempts: total/on-target parsed; off-target = total - on-target.
    assert a["attemptsAtGoal"] == 16 and a["attemptsOnTarget"] == 4
    assert a["attemptsOffTarget"] == 12
    assert a["totalPasses"] == 547 and a["passesCompleted"] == 495

    # REAL xG passthrough: xgApprox equals the FIFA xG, not the formula.
    assert a["xgApprox"] == 1.78, f"real xG A: {a['xgApprox']}"
    assert b["xgApprox"] == 0.1, f"real xG B: {b['xgApprox']}"

    # Fallback xG formula when no real xG present.
    fb = _fake_raw()
    del fb["A"]["xgReal"]
    (a2, _b2), _ = build_match_perspectives(entry, fb)
    expected_fb = round(0.10 * 4 + 0.03 * 12 + 0.05 * 105, 3)  # 0.4+0.36+5.25
    assert a2["xgApprox"] == expected_fb, \
        f"fallback xG {a2['xgApprox']} != {expected_fb}"

    # Physical: metres -> km; Zone 4 only for high-intensity; rest 0.
    assert a["teamTotalDistanceKm"] == 107.3
    assert a["highIntensityDistanceKm"] == 5.3
    assert a["sprints"] == 0 and a["minutesPlayed"] == 0

    # Line breaks: attempted defaults to completed when no attempted line.
    assert a["lineBreaksCompleted"] == 105 and a["lineBreaksAttempted"] == 105

    # Graphical fields must be null.
    for f in GRAPHICAL_NULL_FIELDS:
        assert a[f] is None and b[f] is None, f"{f} should be null"

    # JSON round-trips cleanly.
    json.loads(json.dumps(perspectives))
    assert report["matchId"] == "PMSR-M01"
    assert report["nullFields"] == list(GRAPHICAL_NULL_FIELDS)
    assert report["xgReal"] == {"A": 1.78, "B": 0.1}

    # --- manifest WITH a conflicting score: PDF wins + warns ----------------
    entry2 = dict(entry, goalsA=9, goalsB=9)
    _persp, report2 = build_match_perspectives(entry2, _fake_raw())
    assert any("using page-1" in w for w in report2["parseWarnings"]), \
        "expected a score-mismatch warning"

    _log("OK", "selftest passed: assembly + real-xG + score parse + shape valid")
    return 0


# --- CLI ---------------------------------------------------------------------


def _check_pdfplumber():
    """Fail fast with an actionable message if pdfplumber is missing."""
    try:
        import pdfplumber  # noqa: F401
        import requests  # noqa: F401
    except ImportError:
        _log("INFO", "pdfplumber/requests not installed. Install with: "
                     "pip install pdfplumber requests")
        return False
    return True


def build_parser():
    p = argparse.ArgumentParser(
        description="Extract FIFA Post Match Summary PDFs to TeamMatchStats JSON.")
    p.add_argument("--tournament", choices=["2022", "2026"], default="2026")
    p.add_argument("--manifest", help="JSON array of match entries to extract")
    p.add_argument("--out", help="output directory (default per tournament)")
    p.add_argument("--limit", type=int, help="only process the first N matches")
    p.add_argument("--dry-run", action="store_true",
                   help="list what would be downloaded; no network/IO")
    p.add_argument("--keep-pdfs", action="store_true",
                   help="keep downloaded PDFs (default: delete each after "
                        "extraction; structured data is <10MB, PDFs are ~5MB each)")
    p.add_argument("--selftest", action="store_true",
                   help="run offline self-test of assembly + math + shape")
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    if args.selftest:
        return selftest()
    if not args.manifest:
        _log("ERR", "--manifest is required unless running --selftest")
        return 2
    if not args.dry_run and not _check_pdfplumber():
        return 3
    try:
        return run(args)
    except Exception as err:  # noqa: BLE001 — top-level guard
        out_dir = args.out or default_out_dir(args.tournament)
        try:
            archive_error(out_dir, "run-fatal", {
                "error": str(err), "traceback": traceback.format_exc()})
        except Exception:  # noqa: BLE001 — never mask the original error
            pass
        _log("ERR", f"fatal: {err}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
