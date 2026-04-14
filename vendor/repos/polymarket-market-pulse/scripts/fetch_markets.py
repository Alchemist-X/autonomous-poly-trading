#!/usr/bin/env python3
"""
Fetch active Polymarket markets via the Gamma /events endpoint.

Retrieves events sorted by multiple dimensions (volume, liquidity, recency, competitive),
expands nested markets, filters junk, and outputs structured JSON for analysis.

Usage:
    python fetch_markets.py [--pages N] [--events-per-page N] [--min-fetched-markets N] [--min-liquidity N] [--output FILE]
"""

import argparse
import http.client
import json
import math
import re
import sys
import time
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta

GAMMA_API = "https://gamma-api.polymarket.com"

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "polymarket-market-pulse/2.0",
}

# ---------------------------------------------------------------------------
# Junk market filtering
# ---------------------------------------------------------------------------

JUNK_TITLE_PATTERNS = [
    re.compile(r"Up or Down", re.IGNORECASE),
    re.compile(r"\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)", re.IGNORECASE),
    re.compile(r"\d{1,2}:\d{2}\s*(AM|PM)\s*ET", re.IGNORECASE),
]

MIN_HOURS_TO_EXPIRY = 24
SORT_CONFIGS = [
    {"order": "volume24hr", "ascending": "false"},
    {"order": "liquidity", "ascending": "false"},
    {"order": "startDate", "ascending": "false"},
    {"order": "competitive", "ascending": "false"},
]


def is_junk_market(question: str, end_date: str) -> bool:
    """Return True if the market matches junk title patterns or expires within 24h."""
    for pat in JUNK_TITLE_PATTERNS:
        if pat.search(question):
            return True
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            if end_dt - datetime.now(timezone.utc) < timedelta(hours=MIN_HOURS_TO_EXPIRY):
                return True
        except (ValueError, TypeError):
            pass
    return False


def is_coin_flip(outcome_prices: list) -> bool:
    """Return True if all outcome prices are in the 0.48-0.52 range (coin flip)."""
    if not outcome_prices:
        return False
    return all(0.48 <= p <= 0.52 for p in outcome_prices)


# ---------------------------------------------------------------------------
# Resilient HTTP fetching with retry
# ---------------------------------------------------------------------------

def fetch_with_retry(url: str, headers: dict, max_retries: int = 3, backoff: float = 1.0):
    """Fetch a URL with exponential-backoff retry on transient errors."""
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except (urllib.error.URLError,
                http.client.IncompleteRead,
                http.client.RemoteDisconnected,
                TimeoutError,
                ConnectionResetError) as e:
            if attempt < max_retries - 1:
                wait = backoff * (2 ** attempt)
                print(f"[WARN] Retry {attempt + 1}/{max_retries} for {url[:80]}... ({e})", file=sys.stderr)
                time.sleep(wait)
            else:
                raise


# ---------------------------------------------------------------------------
# API fetching — /events endpoint with pagination
# ---------------------------------------------------------------------------

def fetch_events_page(params: dict) -> list:
    """Fetch a single page of events from the Gamma /events endpoint."""
    qs = urllib.parse.urlencode(params)
    url = f"{GAMMA_API}/events?{qs}"
    return fetch_with_retry(url, HEADERS)


def extract_markets_from_events(events: list) -> list:
    """Expand events into individual markets, injecting _event_slug and _event_title."""
    markets = []
    for event in events:
        event_slug = event.get("slug", "")
        event_title = event.get("title", "")
        event_tags = event.get("tags", [])
        event_category = event.get("category")
        event_neg_risk = event.get("negRisk", False)
        nested_markets = event.get("markets", [])
        if not nested_markets:
            continue
        for m in nested_markets:
            m["_event_slug"] = event_slug
            m["_event_title"] = event_title
            m["_event_tags"] = event_tags
            m["_event_category"] = event_category
            # Propagate event-level negRisk if market doesn't have it
            if "negRisk" not in m or m["negRisk"] is None:
                m["negRisk"] = event_neg_risk
            markets.append(m)
    return markets


def _fetch_dimension(sort_cfg: dict, base_params: dict, pages: int, events_per_page: int) -> list:
    """Fetch all pages for a single sort dimension. Runs in its own thread."""
    dimension_label = sort_cfg["order"]
    markets = []
    for page in range(pages):
        params = {
            **base_params,
            **sort_cfg,
            "offset": str(page * events_per_page),
        }
        try:
            events = fetch_events_page(params)
        except Exception as e:
            print(f"[WARN] {dimension_label} page {page}: {e}", file=sys.stderr)
            continue

        if not events:
            break

        page_markets = extract_markets_from_events(events)
        markets.extend(page_markets)

        print(f"[INFO] {dimension_label} page {page}: {len(events)} events, {len(page_markets)} markets", file=sys.stderr)

        if len(events) < events_per_page:
            break  # last page

        time.sleep(0.3)  # rate limit courtesy per dimension

    return markets


def fetch_all_candidates(pages_per_dimension: int, events_per_page: int = 50) -> list:
    """Fetch events across 4 sort dimensions concurrently, expand to markets, deduplicate."""
    base_params = {
        "active": "true",
        "closed": "false",
        "limit": str(min(events_per_page, 50)),  # /events max is 50
    }

    seen_ids = set()
    all_markets = []

    with ThreadPoolExecutor(max_workers=len(SORT_CONFIGS)) as pool:
        futures = {
            pool.submit(_fetch_dimension, cfg, base_params, pages_per_dimension, events_per_page): cfg
            for cfg in SORT_CONFIGS
        }
        for future in as_completed(futures):
            cfg = futures[future]
            try:
                markets = future.result()
            except Exception as e:
                print(f"[WARN] {cfg['order']} dimension failed: {e}", file=sys.stderr)
                continue
            new_count = 0
            for m in markets:
                mid = m.get("id")
                if mid and mid not in seen_ids:
                    seen_ids.add(mid)
                    all_markets.append(m)
                    new_count += 1
            print(f"[INFO] {cfg['order']}: {len(markets)} total, {new_count} new (after dedup)", file=sys.stderr)

    return all_markets


# ---------------------------------------------------------------------------
# Data extraction & filtering
# ---------------------------------------------------------------------------

def parse_float(val, default=0.0):
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def slugify_label(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower())
    return slug.strip("-")


def normalize_event_tags(tags: list) -> list:
    normalized = []
    seen = set()
    if not isinstance(tags, list):
        return normalized
    for tag in tags:
        if isinstance(tag, dict):
            raw_slug = str(tag.get("slug") or "").strip()
            raw_label = str(tag.get("label") or tag.get("name") or raw_slug or "").strip()
        else:
            raw_slug = ""
            raw_label = str(tag).strip()
        label = raw_label or raw_slug
        slug = raw_slug or slugify_label(label)
        if not slug:
            continue
        if slug in seen:
            continue
        seen.add(slug)
        normalized.append({
            "slug": slug,
            "label": label or slug,
        })
    return normalized


def derive_primary_category(tags: list, raw_category=None) -> dict:
    if isinstance(raw_category, dict):
        slug = str(raw_category.get("slug") or "").strip()
        label = str(raw_category.get("label") or raw_category.get("name") or "").strip()
        if slug or label:
            return {
                "slug": slug or slugify_label(label),
                "label": label or slug,
                "source": "event-category",
            }
    if isinstance(raw_category, str) and raw_category.strip():
        label = raw_category.strip()
        return {
            "slug": slugify_label(label),
            "label": label,
            "source": "event-category",
        }
    if tags:
        return {
            **tags[0],
            "source": "first-tag",
        }
    return {
        "slug": "uncategorized",
        "label": "Uncategorized",
        "source": "fallback",
    }


def build_taxonomy_stats(markets: list) -> dict:
    total_markets = len(markets)
    category_counts = {}
    tag_counts = {}

    for market in markets:
        category = market.get("primary_category") or {}
        category_slug = category.get("slug") or "uncategorized"
        category_label = category.get("label") or "Uncategorized"
        category_source = category.get("source") or "unknown"
        bucket = category_counts.setdefault(category_slug, {"slug": category_slug, "label": category_label, "source": category_source, "count": 0})
        bucket["count"] += 1

        for tag in market.get("tags", []):
            tag_slug = tag.get("slug")
            tag_label = tag.get("label") or tag_slug
            if not tag_slug:
                continue
            bucket = tag_counts.setdefault(tag_slug, {"slug": tag_slug, "label": tag_label, "count": 0})
            bucket["count"] += 1

    def finalize(counter: dict) -> list:
        rows = sorted(counter.values(), key=lambda item: (-item["count"], item["label"]))
        return [
            {
                **row,
                "share": round((row["count"] / total_markets), 6) if total_markets > 0 else 0.0,
            }
            for row in rows
        ]

    return {
        "market_count": total_markets,
        "unique_categories": len(category_counts),
        "unique_tags": len(tag_counts),
        "category_counts": finalize(category_counts),
        "tag_counts": finalize(tag_counts),
    }


def extract_market_info(m: dict) -> dict:
    """Extract and normalize fields from a raw market dict."""
    outcomes = m.get("outcomes", "")
    if isinstance(outcomes, str):
        try:
            outcomes = json.loads(outcomes)
        except (json.JSONDecodeError, TypeError):
            outcomes = []

    outcome_prices = m.get("outcomePrices", "")
    if isinstance(outcome_prices, str):
        try:
            outcome_prices = json.loads(outcome_prices)
        except (json.JSONDecodeError, TypeError):
            outcome_prices = []

    clob_token_ids = m.get("clobTokenIds", "")
    if isinstance(clob_token_ids, str):
        try:
            clob_token_ids = json.loads(clob_token_ids)
        except (json.JSONDecodeError, TypeError):
            clob_token_ids = []

    prices = [parse_float(p) for p in outcome_prices] if outcome_prices else []
    event_tags = normalize_event_tags(m.get("_event_tags", []))
    primary_category = derive_primary_category(event_tags, m.get("_event_category"))

    # URL: prefer event slug, fall back to market slug
    event_slug = m.get("_event_slug", "")
    market_slug = m.get("slug", "")
    slug_for_url = event_slug or market_slug
    market_url = f"https://polymarket.com/event/{slug_for_url}" if slug_for_url else ""

    return {
        "id": m.get("id"),
        "condition_id": m.get("conditionId", ""),
        "slug": market_slug,
        "event_slug": event_slug,
        "event_title": m.get("_event_title", ""),
        "tags": event_tags,
        "primary_category": primary_category,
        "category_slug": primary_category.get("slug"),
        "category_label": primary_category.get("label"),
        "category_source": primary_category.get("source"),
        "url": market_url,
        "question": m.get("question", ""),
        "description": (m.get("description") or "")[:500],
        "outcomes": outcomes,
        "outcome_prices": prices,
        "clob_token_ids": clob_token_ids,
        "liquidity": parse_float(m.get("liquidityNum", m.get("liquidity"))),
        "volume_24hr": parse_float(m.get("volume24hr")),
        "volume_total": parse_float(m.get("volumeNum", m.get("volume"))),
        "best_bid": parse_float(m.get("bestBid")),
        "best_ask": parse_float(m.get("bestAsk")),
        "spread": parse_float(m.get("spread")),
        "last_trade_price": parse_float(m.get("lastTradePrice")),
        "one_day_price_change": parse_float(m.get("oneDayPriceChange")),
        "one_week_price_change": parse_float(m.get("oneWeekPriceChange")),
        "end_date": m.get("endDate", ""),
        "enable_order_book": m.get("enableOrderBook", False),
        "neg_risk": bool(m.get("negRisk", False)),
        "fees_enabled": m.get("feesEnabled"),
        "fee_schedule": m.get("feeSchedule"),
        "created_at": m.get("createdAt", ""),
    }


def filter_markets(markets: list, min_liquidity: float) -> list:
    """Filter markets by order book, liquidity, price range, junk patterns, and coin flips."""
    filtered = []
    for m in markets:
        if not m["enable_order_book"]:
            continue
        if m["liquidity"] < min_liquidity:
            continue
        prices = m["outcome_prices"]
        if not prices:
            continue
        max_price = max(prices)
        min_price = min(prices)
        if max_price > 0.95 or min_price < 0.05:
            continue
        # Junk market filtering
        if is_junk_market(m["question"], m["end_date"]):
            continue
        if is_coin_flip(prices):
            continue
        filtered.append(m)
    return filtered


# ---------------------------------------------------------------------------
# Composite scoring
# ---------------------------------------------------------------------------

def compute_composite_score(markets: list) -> list:
    """Pre-compute liquidity_score = log10(liquidity + 1) for composite ranking.

    Final composite score used in the AI analysis step:
        composite = |edge| * log10(liquidity + 1)
    This ensures edge dominates but extremely illiquid markets are penalized.
    """
    for m in markets:
        liq = m["liquidity"]
        m["liquidity_score"] = math.log10(max(liq, 1) + 1)
    return markets


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Fetch Polymarket active markets via /events endpoint")
    parser.add_argument("--pages", type=int, default=5,
                        help="Pages per sort dimension (default: 5, ~1000 events; use 20 for deep scan)")
    parser.add_argument("--events-per-page", type=int, default=50,
                        help="Events per API page (default: 50, /events max)")
    parser.add_argument("--min-fetched-markets", type=int, default=5000,
                        help="Minimum unique raw markets to fetch before stopping (default: 5000)")
    parser.add_argument("--min-liquidity", type=float, default=5000,
                        help="Min liquidity filter in USD (default: 5000)")
    parser.add_argument("--output", type=str, default=None,
                        help="Output file path (default: stdout)")
    parser.add_argument("--raw", action="store_true",
                        help="Skip filtering, output all fetched markets")
    # Backward compatibility: --limit is accepted but remapped to --pages
    parser.add_argument("--limit", type=int, default=None,
                        help="(Deprecated) Alias: sets --pages to ceil(limit/50)")
    args = parser.parse_args()

    if args.limit is not None:
        args.pages = max(1, math.ceil(args.limit / args.events_per_page))
        print(f"[INFO] --limit is deprecated; mapped to --pages {args.pages}", file=sys.stderr)

    current_pages = args.pages
    raw_markets = []
    for _ in range(3):
        print(f"[INFO] Fetching events from Polymarket Gamma API "
              f"({current_pages} pages x {len(SORT_CONFIGS)} dimensions)...", file=sys.stderr)
        raw_markets = fetch_all_candidates(current_pages, args.events_per_page)
        print(f"[INFO] Fetched {len(raw_markets)} unique markets from events", file=sys.stderr)
        if len(raw_markets) >= args.min_fetched_markets or len(raw_markets) == 0:
            break
        next_pages = max(current_pages + 1, math.ceil(current_pages * (args.min_fetched_markets / max(len(raw_markets), 1))))
        if next_pages == current_pages:
            next_pages += 1
        print(f"[WARN] Unique market count {len(raw_markets)} is below target {args.min_fetched_markets}; "
              f"expanding pages per dimension to {next_pages} and retrying", file=sys.stderr)
        current_pages = next_pages

    extracted = [extract_market_info(m) for m in raw_markets]

    if args.raw:
        results = extracted
    else:
        results = filter_markets(extracted, args.min_liquidity)
        print(f"[INFO] {len(results)} markets after filtering "
              f"(min_liquidity=${args.min_liquidity}, junk removed)", file=sys.stderr)

    results = compute_composite_score(results)
    results.sort(key=lambda x: x["volume_24hr"], reverse=True)
    fetched_taxonomy = build_taxonomy_stats(extracted)
    filtered_taxonomy = build_taxonomy_stats(results)

    output = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "total_fetched": len(raw_markets),
        "total_filtered": len(results),
        "min_liquidity": args.min_liquidity,
        "fetch_config": {
            "pages_per_dimension": current_pages,
            "events_per_page": args.events_per_page,
            "min_fetched_markets": args.min_fetched_markets,
            "dimensions": [cfg["order"] for cfg in SORT_CONFIGS],
        },
        "category_stats": {
            "fetched": [
                {
                    "slug": row["slug"],
                    "label": row["label"],
                    "count": row["count"],
                    "source": row.get("source"),
                }
                for row in fetched_taxonomy["category_counts"]
            ],
            "filtered": [
                {
                    "slug": row["slug"],
                    "label": row["label"],
                    "count": row["count"],
                    "source": row.get("source"),
                }
                for row in filtered_taxonomy["category_counts"]
            ],
        },
        "tag_stats": {
            "fetched": [
                {
                    "slug": row["slug"],
                    "label": row["label"],
                    "count": row["count"],
                }
                for row in fetched_taxonomy["tag_counts"]
            ],
            "filtered": [
                {
                    "slug": row["slug"],
                    "label": row["label"],
                    "count": row["count"],
                }
                for row in filtered_taxonomy["tag_counts"]
            ],
        },
        "taxonomy": {
            "category_source": "primary_category prefers event.category, then falls back to the first event tag returned by Gamma /events",
            "fetched": fetched_taxonomy,
            "filtered": filtered_taxonomy,
        },
        "markets": results,
    }

    json_str = json.dumps(output, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, "w") as f:
            f.write(json_str)
        print(f"[INFO] Output written to {args.output}", file=sys.stderr)
    else:
        print(json_str)


if __name__ == "__main__":
    main()
