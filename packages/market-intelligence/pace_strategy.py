"""
Pace Strategy — Market-Type-Aware Analysis Cadence
===================================================

Different market categories demand different analysis rhythms:

  "fast"       Sports, real-time events       → re-scan every 1-2 hours
  "medium"     Elections, earnings, crypto     → re-scan every 4-8 hours
  "slow"       Long-term policy, climate      → re-scan every 12-24 hours
  "strategic"  Geopolitical, conflict-driven  → continuous monitoring

Pace influences:
  1. How often the orchestrator should re-fetch & re-evaluate
  2. Confidence adjustment (fast markets penalised, strategic boosted)
  3. Position sizing multiplier
  4. Stop-loss tightness

Usage:
    from pace_strategy import assign_pace, PACE_PROFILES

    pace = assign_pace(primary_type="Sports", tags=["NBA"], end_hours=6)
    # → "fast"

    profile = PACE_PROFILES[pace]
    # → { refresh_hours: 1, confidence_mult: 0.85, sizing_mult: 0.7, ... }
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class PaceProfile:
    """Operational parameters for a given pace tier."""
    name: str
    refresh_hours: float        # Recommended re-scan interval
    confidence_multiplier: float  # Applied to raw confidence
    sizing_multiplier: float    # Applied to Kelly sizing
    stop_loss_tighter: bool     # Tighten stop-loss for volatile paces
    description: str


PACE_PROFILES: Dict[str, PaceProfile] = {
    "fast": PaceProfile(
        name="fast",
        refresh_hours=1,
        confidence_multiplier=0.85,
        sizing_multiplier=0.7,
        stop_loss_tighter=True,
        description="Real-time events (sports, breaking news). "
                    "High volatility, short resolution window.",
    ),
    "medium": PaceProfile(
        name="medium",
        refresh_hours=6,
        confidence_multiplier=1.0,
        sizing_multiplier=1.0,
        stop_loss_tighter=False,
        description="Standard cadence (elections, earnings, crypto). "
                    "Moderate volatility, days-to-weeks resolution.",
    ),
    "slow": PaceProfile(
        name="slow",
        refresh_hours=24,
        confidence_multiplier=1.05,
        sizing_multiplier=1.1,
        stop_loss_tighter=False,
        description="Long-horizon events (climate, regulation, demographics). "
                    "Low volatility, weeks-to-months resolution.",
    ),
    "strategic": PaceProfile(
        name="strategic",
        refresh_hours=4,
        confidence_multiplier=1.1,
        sizing_multiplier=0.9,
        stop_loss_tighter=True,
        description="Geopolitical & conflict-driven markets. "
                    "High-impact but requires continuous intelligence feed.",
    ),
}


# ── Type → Pace mapping ─────────────────────────────────────────────────

_TYPE_PACE: Dict[str, str] = {
    "Sports":         "fast",
    "Entertainment":  "medium",
    "Crypto":         "medium",
    "Economy":        "medium",
    "Politics":       "medium",
    "Science & Tech": "slow",
    "Miscellaneous":  "slow",
}

# Tags that override the type-level pace
_TAG_PACE_OVERRIDE: Dict[str, str] = {
    # Fast — live events
    "NBA":            "fast",
    "NFL":            "fast",
    "MLB":            "fast",
    "Soccer":         "fast",
    "NHL":            "fast",
    "Combat Sports":  "fast",
    "Motorsport":     "fast",
    "Esports":        "fast",
    # Strategic — geopolitical
    "International Politics": "strategic",
    "US Elections":   "strategic",
    "US Policy":      "strategic",
    "Regulation":     "strategic",
    # Slow — long-horizon
    "Climate":        "slow",
    "Demographics":   "slow",
    "Olympics":       "slow",
}


def assign_pace(
    primary_type: str,
    tags: Optional[List[str]] = None,
    end_hours: Optional[float] = None,
    geopolitical_risk: Optional[float] = None,
) -> str:
    """Determine the analysis pace for a market.

    Priority:
      1. If geopolitical_risk >= 50 → "strategic"
      2. If end_hours <= 24 → "fast"
      3. Tag-level override (most specific tag wins)
      4. Type-level default
      5. Fallback: "medium"
    """
    # Rule 1: High geopolitical risk forces strategic pace
    if geopolitical_risk is not None and geopolitical_risk >= 50:
        return "strategic"

    # Rule 2: Very short time-to-resolution forces fast pace
    if end_hours is not None and end_hours <= 24:
        return "fast"

    # Rule 3: Tag-level override (first match wins)
    if tags:
        for tag in tags:
            if tag in _TAG_PACE_OVERRIDE:
                return _TAG_PACE_OVERRIDE[tag]

    # Rule 4: Type-level default
    if primary_type in _TYPE_PACE:
        return _TYPE_PACE[primary_type]

    # Rule 5: Fallback
    return "medium"


def get_profile(pace: str) -> PaceProfile:
    """Get the PaceProfile for a given pace string."""
    return PACE_PROFILES.get(pace, PACE_PROFILES["medium"])
