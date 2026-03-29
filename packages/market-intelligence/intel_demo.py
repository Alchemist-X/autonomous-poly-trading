#!/usr/bin/env python3
"""
Intelligence-Enhanced Market Analysis Demo
===========================================

Demonstrates the full pipeline:
    World Monitor Intelligence  +  Polymarket Data  →  Enriched Trading Context

Usage:
    python intel_demo.py                         # Full demo
    python intel_demo.py --context               # World state report only
    python intel_demo.py --type Politics          # Politics markets + intel
    python intel_demo.py --tag Bitcoin            # Bitcoin markets + intel
    python intel_demo.py --keyword ukraine        # Ukraine-related + intel
    python intel_demo.py --high-risk              # Focus on high-risk markets
"""

from __future__ import annotations

import argparse

from market_fetcher import MarketFetcher, print_market_table
from worldmonitor_client import WorldMonitorClient
from intelligence_enricher import (
    IntelligenceEnricher,
    print_context_report,
    print_enriched_markets,
)


def demo_world_context(enricher: IntelligenceEnricher) -> None:
    """Show the current world state context report."""
    print("\nBuilding world state context...")
    report = enricher.build_context_report(force_refresh=True)
    print_context_report(report)


def demo_enriched_by_type(
    enricher: IntelligenceEnricher,
    event_type: str,
) -> None:
    """Show markets for an event type enriched with intelligence."""
    print(f"\nFetching {event_type} markets with intelligence enrichment...")
    results = enricher.enrich_and_fetch(event_type=event_type)
    print_enriched_markets(results)


def demo_enriched_by_tag(
    enricher: IntelligenceEnricher,
    tag: str,
) -> None:
    """Show markets for a tag enriched with intelligence."""
    print(f"\nFetching #{tag} markets with intelligence enrichment...")
    results = enricher.enrich_and_fetch(tags=[tag])
    print_enriched_markets(results)


def demo_enriched_by_keyword(
    enricher: IntelligenceEnricher,
    keyword: str,
) -> None:
    """Keyword search with intelligence enrichment."""
    print(f"\nSearching '{keyword}' markets with intelligence enrichment...")
    results = enricher.enrich_and_fetch(keyword=keyword)
    print_enriched_markets(results)


def demo_high_risk_markets(enricher: IntelligenceEnricher) -> None:
    """Find markets related to high-risk countries and show full context."""
    print("\nIdentifying markets related to geopolitical hotspots...")
    report = enricher.build_context_report()

    # Get all critical + high-risk countries
    hotspot_countries = report.critical_countries + report.high_risk_countries
    if not hotspot_countries:
        print("No critical/high-risk countries detected right now.")
        print("Showing geopolitics-related markets instead...")
        results = enricher.enrich_and_fetch(event_type="Politics")
    else:
        print(f"Hotspots: {', '.join(hotspot_countries)}")
        # Fetch all markets and filter for related ones
        all_markets = enricher.enrich_and_fetch(limit=100)
        results = [
            m for m in all_markets
            if m.risk_level in ("high", "critical") and m.related_countries
        ]
        if not results:
            # Fallback: show politics markets
            results = enricher.enrich_and_fetch(event_type="Politics")

    print_enriched_markets(results)


def demo_full(enricher: IntelligenceEnricher) -> None:
    """Run the full demo pipeline."""
    print("#" * 70)
    print("#  INTELLIGENCE-ENHANCED POLYMARKET ANALYSIS")
    print("#  Powered by: World Monitor + Poly-Trader")
    print("#" * 70)

    # 1) World state snapshot
    print("\n\n[1/4] Building world state context...")
    report = enricher.build_context_report(force_refresh=True)
    print_context_report(report)

    # 2) Politics markets with geopolitical risk context
    print("\n[2/4] Politics markets with geopolitical intelligence...")
    politics = enricher.enrich_and_fetch(event_type="Politics", limit=10)
    print_enriched_markets(politics)

    # 3) Crypto markets with financial sentiment
    print("\n[3/4] Crypto markets with financial sentiment...")
    crypto = enricher.enrich_and_fetch(event_type="Crypto", limit=10)
    print_enriched_markets(crypto)

    # 4) High-risk geopolitical markets
    print("\n[4/4] Markets in geopolitical hotspots...")
    demo_high_risk_markets(enricher)

    print("\nDemo complete!")
    print("The intelligence enricher adds geopolitical context,")
    print("risk scores, trade signals, and convergence alerts")
    print("to every Polymarket market for better prediction.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Intelligence-Enhanced Market Analysis",
    )
    parser.add_argument("--context", action="store_true",
                        help="Show world state context report only")
    parser.add_argument("--type", dest="event_type",
                        help="Enrich markets by event type")
    parser.add_argument("--tag",
                        help="Enrich markets by tag")
    parser.add_argument("--keyword",
                        help="Enrich markets by keyword search")
    parser.add_argument("--high-risk", action="store_true",
                        help="Focus on high-risk geopolitical markets")
    parser.add_argument("--api-key",
                        help="World Monitor API key (if required)")
    parser.add_argument("--wm-url", default="https://worldmonitor.app/api",
                        help="World Monitor API base URL")

    args = parser.parse_args()

    wm = WorldMonitorClient(base_url=args.wm_url, api_key=args.api_key)
    enricher = IntelligenceEnricher(wm_client=wm)

    has_flag = any([args.context, args.event_type, args.tag,
                    args.keyword, args.high_risk])

    if args.context:
        demo_world_context(enricher)
    if args.event_type:
        demo_enriched_by_type(enricher, args.event_type)
    if args.tag:
        demo_enriched_by_tag(enricher, args.tag)
    if args.keyword:
        demo_enriched_by_keyword(enricher, args.keyword)
    if args.high_risk:
        demo_high_risk_markets(enricher)

    if not has_flag:
        demo_full(enricher)


if __name__ == "__main__":
    main()
