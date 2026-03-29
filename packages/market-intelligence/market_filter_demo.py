#!/usr/bin/env python3
"""
Market Filter Demo
==================

Interactive demonstration of the unified MarketFetcher and TagLibrary system.
Run this script to see various filtering capabilities in action.

Usage:
    python market_filter_demo.py                  # Run all demos
    python market_filter_demo.py --type Sports     # Filter by event type
    python market_filter_demo.py --tag NBA         # Filter by tag
    python market_filter_demo.py --keyword bitcoin # Free-text search
    python market_filter_demo.py --ending-soon 48  # Ending within N hours
    python market_filter_demo.py --min-volume 5000 # Minimum volume
    python market_filter_demo.py --browse-tags     # Browse tag library
    python market_filter_demo.py --search-tag nba  # Search tags
    python market_filter_demo.py --interactive     # Interactive mode
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone

from market_fetcher import MarketFetcher, print_market_table
from tag_library import (
    EVENT_TYPES,
    list_all_tags,
    list_event_types,
    search_tags,
)


def demo_browse_tags() -> None:
    """Show the full tag library."""
    print("\n" + "=" * 70)
    print("  TAG LIBRARY  -  All Event Types & Tags")
    print("=" * 70)
    for et_info in list_event_types():
        print(f"\n  [{et_info['name']}] {et_info['description']}")
        print(f"  Tags ({et_info['tag_count']}):")
        for tag_name in et_info["tags"]:
            print(f"    - {tag_name}")
    print()


def demo_search_tags(query: str) -> None:
    """Search the tag library."""
    results = search_tags(query)
    print(f"\nTag search for '{query}': {len(results)} result(s)")
    for r in results:
        print(f"  [{r['event_type']}] {r['tag']}: {r['description']}")
    print()


def demo_by_event_type(mf: MarketFetcher, event_type: str) -> None:
    """Fetch and display markets for a given event type."""
    markets = mf.fetch_by_event_type(event_type, pages=2)
    print_market_table(markets, title=f"{event_type} Markets")


def demo_by_tags(mf: MarketFetcher, tags: list[str]) -> None:
    """Fetch and display markets matching specific tags."""
    markets = mf.fetch_by_tags(tags, pages=2)
    print_market_table(markets, title=f"Markets tagged: {', '.join(tags)}")


def demo_by_keyword(mf: MarketFetcher, keyword: str) -> None:
    """Free-text keyword search."""
    markets = mf.fetch(keyword=keyword, pages=2)
    print_market_table(markets, title=f"Keyword search: '{keyword}'")


def demo_ending_soon(mf: MarketFetcher, hours: int = 48) -> None:
    """Markets ending within N hours."""
    markets = mf.fetch_ending_soon(hours=hours, pages=2)
    print_market_table(
        markets,
        title=f"Markets ending within {hours} hours",
    )


def demo_high_volume(mf: MarketFetcher, min_vol: float = 5000) -> None:
    """High-volume markets."""
    markets = mf.fetch_high_volume(min_volume=min_vol, pages=2)
    print_market_table(markets, title=f"High volume (>= ${min_vol:,.0f})")


def demo_mispriced(mf: MarketFetcher) -> None:
    """Potentially mispriced markets (outcome odds 30-70%)."""
    markets = mf.fetch_mispriced(low=0.3, high=0.7, pages=2)
    print_market_table(markets, title="Potentially mispriced (30%-70%)")


def demo_combined(mf: MarketFetcher) -> None:
    """Show combined filtering: Sports + high volume + tradable."""
    markets = mf.fetch(
        event_type="Sports",
        min_volume=1000,
        tradable_only=True,
        pages=2,
    )
    print_market_table(
        markets,
        title="Sports | Volume >= $1,000 | Tradable only",
    )


def demo_type_summary(mf: MarketFetcher) -> None:
    """Show a summary of how many markets exist per event type."""
    all_markets = mf.fetch(pages=3)
    type_counts: dict[str, int] = {}
    tag_counts: dict[str, int] = {}

    for m in all_markets:
        for et in m.event_types:
            type_counts[et] = type_counts.get(et, 0) + 1
        for tag in m.tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
        if not m.event_types:
            type_counts["Uncategorized"] = type_counts.get("Uncategorized", 0) + 1

    print(f"\n{'=' * 60}")
    print(f"  MARKET DISTRIBUTION  ({len(all_markets)} total markets)")
    print(f"{'=' * 60}")

    print("\n  By Event Type:")
    for et, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        bar = "#" * min(count, 40)
        print(f"    {et:<20s} {count:>4d}  {bar}")

    print("\n  Top Tags:")
    for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1])[:20]:
        bar = "#" * min(count, 40)
        print(f"    {tag:<20s} {count:>4d}  {bar}")

    print()


def interactive_mode(mf: MarketFetcher) -> None:
    """Simple interactive REPL for exploring markets."""
    print("\n" + "=" * 60)
    print("  INTERACTIVE MARKET EXPLORER")
    print("=" * 60)
    print("\nCommands:")
    print("  type <name>         - Filter by event type (e.g. type Sports)")
    print("  tag <name>          - Filter by tag (e.g. tag NBA)")
    print("  search <keyword>    - Keyword search")
    print("  ending <hours>      - Markets ending in N hours")
    print("  volume <min>        - Minimum volume filter")
    print("  tags                - Browse all tags")
    print("  find-tag <query>    - Search tag library")
    print("  summary             - Market distribution summary")
    print("  quit                - Exit")
    print()

    while True:
        try:
            cmd = input("market> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not cmd:
            continue

        parts = cmd.split(maxsplit=1)
        action = parts[0].lower()
        arg = parts[1].strip() if len(parts) > 1 else ""

        if action in ("quit", "exit", "q"):
            print("Goodbye!")
            break
        elif action == "type" and arg:
            demo_by_event_type(mf, arg)
        elif action == "tag" and arg:
            demo_by_tags(mf, [arg])
        elif action == "search" and arg:
            demo_by_keyword(mf, arg)
        elif action == "ending":
            hours = int(arg) if arg.isdigit() else 24
            demo_ending_soon(mf, hours)
        elif action == "volume":
            try:
                min_v = float(arg)
            except ValueError:
                min_v = 5000
            demo_high_volume(mf, min_v)
        elif action == "tags":
            demo_browse_tags()
        elif action in ("find-tag", "findtag", "search-tag") and arg:
            demo_search_tags(arg)
        elif action == "summary":
            demo_type_summary(mf)
        else:
            print(f"Unknown command: {cmd}")
            print("Type 'quit' to exit or try 'tags' to browse the tag library.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Polymarket Market Filter Demo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--type", dest="event_type",
                        help="Filter by event type (e.g. Sports, Politics, Crypto)")
    parser.add_argument("--tag",
                        help="Filter by tag (e.g. NBA, Bitcoin, US Elections)")
    parser.add_argument("--keyword",
                        help="Free-text keyword search")
    parser.add_argument("--ending-soon", type=int, metavar="HOURS",
                        help="Markets ending within N hours")
    parser.add_argument("--min-volume", type=float, metavar="AMOUNT",
                        help="Minimum trading volume")
    parser.add_argument("--browse-tags", action="store_true",
                        help="Browse the full tag library")
    parser.add_argument("--search-tag",
                        help="Search the tag library")
    parser.add_argument("--interactive", action="store_true",
                        help="Interactive exploration mode")
    parser.add_argument("--summary", action="store_true",
                        help="Show market distribution summary")
    parser.add_argument("--all-demos", action="store_true",
                        help="Run all demo scenarios")

    args = parser.parse_args()

    # If no flags at all, show help and run --all-demos
    has_any_flag = any([
        args.event_type, args.tag, args.keyword, args.ending_soon,
        args.min_volume, args.browse_tags, args.search_tag,
        args.interactive, args.summary, args.all_demos,
    ])

    if args.browse_tags:
        demo_browse_tags()
        if not has_any_flag:
            return

    if args.search_tag:
        demo_search_tags(args.search_tag)
        if not has_any_flag:
            return

    mf = MarketFetcher()

    if args.interactive:
        interactive_mode(mf)
        return

    if args.event_type:
        demo_by_event_type(mf, args.event_type)

    if args.tag:
        demo_by_tags(mf, [args.tag])

    if args.keyword:
        demo_by_keyword(mf, args.keyword)

    if args.ending_soon:
        demo_ending_soon(mf, args.ending_soon)

    if args.min_volume:
        demo_high_volume(mf, args.min_volume)

    if args.summary:
        demo_type_summary(mf)

    if args.all_demos or not has_any_flag:
        print("\n" + "#" * 70)
        print("#  POLYMARKET MARKET FILTER - FULL DEMO")
        print("#" * 70)

        # 1) Tag library overview
        demo_browse_tags()

        # 2) Market distribution
        demo_type_summary(mf)

        # 3) Sports markets
        demo_by_event_type(mf, "Sports")

        # 4) Crypto markets
        demo_by_event_type(mf, "Crypto")

        # 5) Politics markets
        demo_by_event_type(mf, "Politics")

        # 6) High volume
        demo_high_volume(mf, 5000)

        # 7) Combined filter
        demo_combined(mf)

        print("\nDemo complete! Use --interactive for hands-on exploration.")
        print("Use --help to see all available flags.")


if __name__ == "__main__":
    main()
