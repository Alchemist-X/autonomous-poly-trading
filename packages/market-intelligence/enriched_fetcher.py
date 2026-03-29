#!/usr/bin/env python3
"""
Enriched Market Fetcher — Drop-in replacement for fetch_markets.py
===================================================================

Outputs JSON that matches the RawPulseOutput interface expected by the
orchestrator's market-pulse.ts, PLUS additional intelligence fields:

  {
    "fetched_at": "...",
    "total_fetched": 5200,
    "total_filtered": 42,
    "min_liquidity": 5000,
    "fetch_config": { ... },
    "category_stats": { "fetched": [...], "filtered": [...] },
    "tag_stats":      { "fetched": [...], "filtered": [...] },
    "intelligence_context": {                    ← NEW
      "global_tension": "high",
      "sentiment": { "value": 34, "label": "Fear" },
      "trade_signals": [...],
      "convergence_alerts": [...],
      "high_risk_countries": [...]
    },
    "markets": [
      {
        "question": "...",
        "event_slug": "...",
        "slug": "...",
        "url": "...",
        "liquidity": 12345.0,
        "volume_24hr": 6789.0,
        "outcomes": ["Yes", "No"],
        "outcome_prices": [0.65, 0.35],
        "clob_token_ids": ["..."],
        "end_date": "2026-04-01T00:00:00Z",
        "best_bid": 0.64,
        "best_ask": 0.66,
        "spread": 0.02,
        "category_slug": "politics",             ← from tag_library
        "category_label": "Politics",
        "category_source": "market-intelligence",
        "tags": [
          {"slug": "us-elections", "label": "US Elections"}
        ],
        "pace": "strategic",                     ← NEW from pace_strategy
        "intelligence": {                        ← NEW from World Monitor
          "risk_level": "elevated",
          "related_countries": ["US"],
          "trade_signals": [...],
          "context_summary": "..."
        }
      },
      ...
    ]
  }

Usage (CLI — compatible with orchestrator spawn):
    python enriched_fetcher.py \\
        --pages 5 \\
        --events-per-page 50 \\
        --min-fetched-markets 5000 \\
        --min-liquidity 5000 \\
        --output /tmp/pulse.json

    python enriched_fetcher.py \\
        --pages 3 --min-liquidity 1000 \\
        --event-type Politics \\
        --output /tmp/politics.json
"""

from __future__ import annotations

import argparse
import datetime
import json
import sys
from collections import Counter
from typing import Any, Dict, List, Optional

from market_fetcher import MarketFetcher, EnrichedMarket
from tag_library import classify_market
from pace_strategy import assign_pace, get_profile
from worldmonitor_client import WorldMonitorClient
from intelligence_enricher import IntelligenceEnricher


# ─── Helpers ────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    return text.lower().replace(" & ", "-").replace(" ", "-")


def _build_category_stats(
    fetched_markets: List[EnrichedMarket],
    filtered_markets: List[EnrichedMarket],
) -> Dict:
    fetched_counts: Counter[str] = Counter()
    filtered_counts: Counter[str] = Counter()
    label_map: Dict[str, str] = {}

    for m in fetched_markets:
        t = m.primary_type
        fetched_counts[t] += 1
        label_map[t] = t

    for m in filtered_markets:
        t = m.primary_type
        filtered_counts[t] += 1
        label_map[t] = t

    return {
        "fetched": [
            {"slug": _slugify(k), "label": k, "count": v, "source": "market-intelligence"}
            for k, v in fetched_counts.most_common()
        ],
        "filtered": [
            {"slug": _slugify(k), "label": k, "count": v, "source": "market-intelligence"}
            for k, v in filtered_counts.most_common()
        ],
    }


def _build_tag_stats(
    fetched_markets: List[EnrichedMarket],
    filtered_markets: List[EnrichedMarket],
) -> Dict:
    fetched_counts: Counter[str] = Counter()
    filtered_counts: Counter[str] = Counter()

    for m in fetched_markets:
        for tag in m.tags:
            fetched_counts[tag] += 1
    for m in filtered_markets:
        for tag in m.tags:
            filtered_counts[tag] += 1

    return {
        "fetched": [
            {"slug": _slugify(k), "label": k, "count": v}
            for k, v in fetched_counts.most_common()
        ],
        "filtered": [
            {"slug": _slugify(k), "label": k, "count": v}
            for k, v in filtered_counts.most_common()
        ],
    }


def _market_to_raw_pulse(
    market: EnrichedMarket,
    pace: str,
    intel_ctx: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Convert EnrichedMarket to RawPulseMarket-compatible dict."""
    # Build Polymarket URL from slug (best-effort)
    slug = market.raw.get("slug", "")
    event_slug = market.raw.get("groupItemTitle", slug) or slug
    url = market.raw.get("url", f"https://polymarket.com/event/{slug}")

    return {
        "question": market.question,
        "event_slug": event_slug,
        "slug": slug,
        "url": url,
        "liquidity": market.liquidity,
        "volume_24hr": market.raw.get("volume24hr", market.volume),
        "outcomes": market.outcomes,
        "outcome_prices": market.outcome_prices,
        "clob_token_ids": market.clob_token_ids,
        "end_date": market.end_date.isoformat() if market.end_date else "",
        "best_bid": market.best_bid or 0,
        "best_ask": market.best_ask or 0,
        "spread": market.spread or 0,
        # Classification (consumed by market-pulse.ts)
        "category_slug": _slugify(market.primary_type),
        "category_label": market.primary_type,
        "category_source": "market-intelligence",
        "tags": [
            {"slug": _slugify(tag), "label": tag}
            for tag in market.tags
        ],
        # Extended fields (new)
        "pace": pace,
        "intelligence": intel_ctx,
    }


def _build_intelligence_context(enricher: IntelligenceEnricher) -> Dict:
    """Build global intelligence context snapshot."""
    report = enricher.build_context_report()
    return {
        "global_tension": report.global_tension_level,
        "sentiment": {
            "value": report.sentiment.value,
            "label": report.sentiment.label,
        } if report.sentiment else None,
        "trade_signals": [
            {
                "title": imp.title,
                "direction": imp.direction,
                "confidence": imp.confidence,
                "sector": imp.sector,
            }
            for imp in report.implications[:10]
        ],
        "convergence_alerts": [
            {
                "title": sig.title,
                "severity": sig.severity,
                "domains": sig.domains,
            }
            for sig in report.signals[:10]
        ],
        "critical_countries": report.critical_countries,
        "high_risk_countries": report.high_risk_countries,
        "conflict_count": report.conflict_count,
    }


# ─── Main pipeline ─────────────────────────────────────────────────────

def run_enriched_fetch(
    pages: int = 5,
    events_per_page: int = 50,
    min_fetched_markets: int = 5000,
    min_liquidity: float = 5000.0,
    event_type: Optional[str] = None,
    tags_filter: Optional[List[str]] = None,
    enable_intelligence: bool = True,
    output_path: Optional[str] = None,
) -> Dict:
    """Run the full enriched fetch pipeline and return RawPulseOutput."""

    mf = MarketFetcher()
    wm = WorldMonitorClient()
    enricher = IntelligenceEnricher(wm_client=wm, market_fetcher=mf)

    # ── Step 1: Fetch all markets ────────────────────────────────────
    num_pages = max(pages, 1)
    all_markets = mf.fetch(
        limit=min(events_per_page, 100),
        pages=num_pages,
        active=True,
    )
    total_fetched = len(all_markets)

    # ── Step 2: Apply filters ────────────────────────────────────────
    filtered = all_markets

    if min_liquidity > 0:
        filtered = [m for m in filtered if m.liquidity >= min_liquidity]

    if event_type:
        et_lower = event_type.lower()
        filtered = [
            m for m in filtered
            if any(et.lower() == et_lower for et in m.event_types)
        ]

    if tags_filter:
        tags_lower = {t.lower() for t in tags_filter}
        filtered = [
            m for m in filtered
            if tags_lower & {t.lower() for t in m.tags}
        ]

    # Only keep tradable markets
    filtered = [m for m in filtered if m.is_tradable]

    # Sort by volume descending
    filtered.sort(key=lambda m: m.volume, reverse=True)

    total_filtered = len(filtered)

    # ── Step 3: Intelligence enrichment ──────────────────────────────
    intel_context = None
    market_intels: Dict[str, Dict] = {}

    if enable_intelligence:
        try:
            intel_context = _build_intelligence_context(enricher)
            enriched_intels = enricher.enrich_markets(filtered)
            for mi in enriched_intels:
                key = mi.market.question
                market_intels[key] = {
                    "risk_level": mi.risk_level,
                    "related_countries": mi.related_countries,
                    "trade_signals": [
                        {"title": imp.title, "direction": imp.direction,
                         "confidence": imp.confidence}
                        for imp in mi.relevant_implications[:3]
                    ],
                    "convergence_alerts": [
                        {"title": s.title, "severity": s.severity}
                        for s in mi.relevant_signals[:3]
                    ],
                    "context_summary": mi.context_summary,
                }
        except Exception as exc:
            print(f"[enriched_fetcher] Intelligence enrichment failed: {exc}",
                  file=sys.stderr)

    # ── Step 4: Assign pace + build output ───────────────────────────
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    output_markets = []

    for m in filtered:
        # Calculate hours to end
        end_hours = None
        if m.end_date:
            delta = m.end_date - now
            end_hours = max(delta.total_seconds() / 3600, 0)

        # Get geopolitical risk for pace calculation
        geo_risk = None
        mi_ctx = market_intels.get(m.question)
        if mi_ctx and mi_ctx.get("related_countries"):
            # Use country risk scores from the enricher context
            geo_risk = {"low": 10, "elevated": 35, "high": 60,
                        "critical": 85}.get(mi_ctx.get("risk_level", ""), None)

        pace = assign_pace(
            primary_type=m.primary_type,
            tags=m.tags,
            end_hours=end_hours,
            geopolitical_risk=geo_risk,
        )

        output_markets.append(
            _market_to_raw_pulse(m, pace=pace, intel_ctx=mi_ctx)
        )

    # ── Step 5: Build stats ──────────────────────────────────────────
    category_stats = _build_category_stats(all_markets, filtered)
    tag_stats = _build_tag_stats(all_markets, filtered)

    # ── Step 6: Assemble RawPulseOutput ──────────────────────────────
    result = {
        "fetched_at": now.isoformat(),
        "total_fetched": total_fetched,
        "total_filtered": total_filtered,
        "min_liquidity": min_liquidity,
        "fetch_config": {
            "pages_per_dimension": pages,
            "events_per_page": events_per_page,
            "min_fetched_markets": min_fetched_markets,
            "dimensions": ["volume24hr", "liquidity", "startDate", "competitive"],
        },
        "category_stats": category_stats,
        "tag_stats": tag_stats,
        "intelligence_context": intel_context,
        "markets": output_markets,
    }

    # ── Step 7: Write output ─────────────────────────────────────────
    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2, default=str)
        print(f"[enriched_fetcher] Wrote {len(output_markets)} markets to {output_path}",
              file=sys.stderr)
    else:
        json.dump(result, sys.stdout, ensure_ascii=False, indent=2, default=str)

    return result


# ─── CLI ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Enriched Polymarket fetcher (drop-in for fetch_markets.py)",
    )
    # Standard args (compatible with orchestrator spawn)
    parser.add_argument("--pages", type=int, default=5)
    parser.add_argument("--events-per-page", type=int, default=50)
    parser.add_argument("--min-fetched-markets", type=int, default=5000)
    parser.add_argument("--min-liquidity", type=float, default=5000)
    parser.add_argument("--output", type=str, default=None)
    # Extended args
    parser.add_argument("--event-type", type=str, default=None,
                        help="Filter by event type (Sports, Politics, Crypto, etc.)")
    parser.add_argument("--tags", type=str, default=None,
                        help="Comma-separated tags to filter (NBA, Bitcoin, etc.)")
    parser.add_argument("--no-intelligence", action="store_true",
                        help="Disable World Monitor intelligence enrichment")

    args = parser.parse_args()

    tags = [t.strip() for t in args.tags.split(",")] if args.tags else None

    run_enriched_fetch(
        pages=args.pages,
        events_per_page=args.events_per_page,
        min_fetched_markets=args.min_fetched_markets,
        min_liquidity=args.min_liquidity,
        event_type=args.event_type,
        tags_filter=tags,
        enable_intelligence=not args.no_intelligence,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
