"""Offline smoke tests for the market-intelligence module.

No network and no credentials: tag classification, pace assignment, and the
RawPulseMarket JSON-shape compatibility are all exercised against a bundled
fixture. Run with: pytest packages/market-intelligence/
"""

from __future__ import annotations

import json
import types
from pathlib import Path

import enriched_fetcher as EF
import pace_strategy as PS
import tag_library as TL

FIXTURE = Path(__file__).parent / "fixtures" / "sample_market.json"

# Fields the orchestrator's market-pulse.ts ingestion expects on each market.
REQUIRED_RAW_PULSE_FIELDS = [
    "question",
    "event_slug",
    "slug",
    "url",
    "liquidity",
    "volume_24hr",
    "outcomes",
    "outcome_prices",
    "clob_token_ids",
    "end_date",
    "best_bid",
    "best_ask",
    "spread",
]


def test_tag_classification_is_deterministic_and_correct():
    btc = TL.classify_market("Will Bitcoin close above $100k by Dec 31, 2026?")
    assert btc["primary_type"] == "Crypto"
    assert "Bitcoin" in btc["tags"]

    nba = TL.classify_market("Will the Lakers win the 2026 NBA championship?")
    assert nba["primary_type"] == "Sports"
    assert "NBA" in nba["tags"]

    # Unmatched text falls back to Uncategorized with no tags.
    blank = TL.classify_market("zzz nonsense qqq")
    assert blank["primary_type"] == "Uncategorized"
    assert blank["tags"] == []

    # Deterministic: same input -> identical classification.
    assert TL.classify_market("Will Bitcoin close above $100k by Dec 31, 2026?") == btc


def test_pace_assignment_rules():
    # Tag-level override (NBA -> fast) and short window (end_hours <= 24 -> fast).
    assert PS.assign_pace("Sports", ["NBA"], end_hours=6) == "fast"
    # Tag-level strategic override.
    assert PS.assign_pace("Politics", ["International Politics"]) == "strategic"
    # High geopolitical risk forces strategic, regardless of type.
    assert PS.assign_pace("Economy", None, geopolitical_risk=70) == "strategic"
    # Short time-to-resolution forces fast.
    assert PS.assign_pace("Science & Tech", None, end_hours=10) == "fast"
    # Type-level default.
    assert PS.assign_pace("Science & Tech", None) == "slow"
    # Unknown type falls back to medium.
    assert PS.assign_pace("Nonexistent", None) == "medium"


def test_raw_pulse_json_shape_offline():
    market = types.SimpleNamespace(**json.loads(FIXTURE.read_text()))
    out = EF._market_to_raw_pulse(market, pace="strategic", intel_ctx=None)

    # Output keys must be a superset of what market-pulse.ts ingests.
    missing = [k for k in REQUIRED_RAW_PULSE_FIELDS if k not in out]
    assert missing == [], f"missing RawPulseMarket fields: {missing}"

    # Classification + pace are surfaced for downstream targeting.
    assert out["category_label"] == "Politics"
    assert out["category_source"] == "market-intelligence"
    assert out["pace"] == "strategic"
    assert out["tags"] == [{"slug": "international-politics", "label": "International Politics"}]
    # null end_date maps to an empty string, not a crash.
    assert out["end_date"] == ""
    # JSON-serialisable (the fetcher dumps this to stdout / file).
    json.dumps(out)


if __name__ == "__main__":
    # Runnable without pytest: `python3 test_market_intelligence.py`.
    test_tag_classification_is_deterministic_and_correct()
    test_pace_assignment_rules()
    test_raw_pulse_json_shape_offline()
    print("OK: market-intelligence offline smoke passed (3 checks)")
