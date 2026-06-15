"""
Unified Polymarket Market Fetcher & Filter Module

Replaces the scattered market-fetching logic across the codebase with a single,
reusable interface that supports:

- Server-side filtering  (API query params sent to Gamma API)
- Client-side filtering  (event type, tags, volume, liquidity, price/odds range)
- Auto-classification    (via tag_library)
- Pagination             (cursor / offset based iteration)
- Order-book enrichment  (optional CLOB API integration)
- Caching                (simple TTL-based in-memory cache)

Usage examples:

    from market_fetcher import MarketFetcher

    mf = MarketFetcher()

    # Get all active sports markets
    markets = mf.fetch(event_type="Sports")

    # Get NBA markets with minimum volume
    markets = mf.fetch(tags=["NBA"], min_volume=10_000)

    # Search by keyword
    markets = mf.fetch(keyword="bitcoin", min_price=0.2, max_price=0.8)

    # Get markets ending in the next 24 hours
    markets = mf.fetch(end_date_before=datetime.now() + timedelta(hours=24))

    # Combine multiple filters
    markets = mf.fetch(
        event_type="Crypto",
        tags=["Bitcoin", "Ethereum"],
        min_volume=5000,
        sort_by="volume",
        limit=20,
    )
"""

from __future__ import annotations

import ast
import datetime
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import requests

from tag_library import classify_market, EVENT_TYPES


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GAMMA_API_BASE = "https://gamma-api.polymarket.com"
CLOB_API_BASE = "https://clob.polymarket.com"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/118.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

CACHE_TTL_SECONDS = 300  # 5 minutes


# ---------------------------------------------------------------------------
# Simple in-memory cache
# ---------------------------------------------------------------------------

@dataclass
class _CacheEntry:
    data: Any
    expires_at: float


class _Cache:
    def __init__(self) -> None:
        self._store: Dict[str, _CacheEntry] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None or time.time() > entry.expires_at:
            self._store.pop(key, None)
            return None
        return entry.data

    def set(self, key: str, data: Any, ttl: int = CACHE_TTL_SECONDS) -> None:
        self._store[key] = _CacheEntry(data=data, expires_at=time.time() + ttl)

    def clear(self) -> None:
        self._store.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_list_field(value: Any) -> list:
    """Safely parse a field that may be a JSON string or a real list."""
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = ast.literal_eval(value)
            if isinstance(parsed, list):
                return parsed
        except (ValueError, SyntaxError):
            pass
        # bracket-separated fallback
        if value.startswith("[") and value.endswith("]"):
            return [t.strip(' "\'') for t in value[1:-1].split(",") if t.strip()]
        return [value] if value else []
    return []


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_iso_date(date_str: str | None) -> datetime.datetime | None:
    if not date_str:
        return None
    try:
        return datetime.datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Enriched Market dataclass
# ---------------------------------------------------------------------------

@dataclass
class EnrichedMarket:
    """A market enriched with classification data and normalised fields."""
    raw: Dict[str, Any]

    # Core fields (normalised from raw)
    question: str = ""
    description: str = ""
    market_id: str = ""
    end_date: Optional[datetime.datetime] = None
    volume: float = 0.0
    liquidity: float = 0.0
    outcomes: List[str] = field(default_factory=list)
    outcome_prices: List[float] = field(default_factory=list)
    clob_token_ids: List[str] = field(default_factory=list)
    active: bool = True

    # Classification
    event_types: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    primary_type: str = "Uncategorized"
    primary_tag: Optional[str] = None

    # Computed
    spread: Optional[float] = None  # best_ask - best_bid
    best_bid: Optional[float] = None
    best_ask: Optional[float] = None

    @classmethod
    def from_raw(cls, raw: Dict[str, Any]) -> "EnrichedMarket":
        question = raw.get("question", "")
        description = raw.get("description", "")
        category_hint = raw.get("category", "")

        classification = classify_market(question, description, category_hint)

        outcome_prices_raw = _parse_list_field(raw.get("outcomePrices", []))
        outcome_prices = [_safe_float(p) for p in outcome_prices_raw]

        return cls(
            raw=raw,
            question=question,
            description=description,
            market_id=raw.get("id", ""),
            end_date=_parse_iso_date(raw.get("endDate")),
            volume=_safe_float(raw.get("volume")),
            liquidity=_safe_float(raw.get("liquidity")),
            outcomes=_parse_list_field(raw.get("outcomes", [])),
            outcome_prices=outcome_prices,
            clob_token_ids=_parse_list_field(raw.get("clobTokenIds", [])),
            active=raw.get("active", True),
            event_types=classification["event_types"],
            tags=classification["tags"],
            primary_type=classification["primary_type"],
            primary_tag=classification["primary_tag"],
        )

    @property
    def is_tradable(self) -> bool:
        return len(self.clob_token_ids) > 0

    @property
    def end_date_str(self) -> str:
        if self.end_date:
            return self.end_date.strftime("%Y-%m-%d %H:%M")
        return "Unknown"

    @property
    def volume_str(self) -> str:
        return f"${self.volume:,.2f}"

    def to_dict(self) -> Dict[str, Any]:
        """Serialise to a plain dict (e.g. for JSON responses)."""
        return {
            "question": self.question,
            "market_id": self.market_id,
            "end_date": self.end_date_str,
            "volume": self.volume,
            "liquidity": self.liquidity,
            "outcomes": self.outcomes,
            "outcome_prices": self.outcome_prices,
            "event_types": self.event_types,
            "tags": self.tags,
            "primary_type": self.primary_type,
            "primary_tag": self.primary_tag,
            "is_tradable": self.is_tradable,
            "spread": self.spread,
            "best_bid": self.best_bid,
            "best_ask": self.best_ask,
        }


# ---------------------------------------------------------------------------
# MarketFetcher
# ---------------------------------------------------------------------------

class MarketFetcher:
    """Central interface for fetching and filtering Polymarket markets."""

    def __init__(self, cache_ttl: int = CACHE_TTL_SECONDS) -> None:
        self._cache = _Cache()
        self._cache_ttl = cache_ttl

    # -- Public API ---------------------------------------------------------

    def fetch(
        self,
        *,
        # Server-side (Gamma API) params
        limit: int = 100,
        active: bool = True,
        start_date_min: Optional[str] = None,
        # Client-side filters
        event_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        keyword: Optional[str] = None,
        min_volume: float = 0,
        max_volume: Optional[float] = None,
        min_liquidity: float = 0,
        min_price: float = 0.0,
        max_price: float = 1.0,
        end_date_before: Optional[datetime.datetime] = None,
        end_date_after: Optional[datetime.datetime] = None,
        tradable_only: bool = False,
        # Ordering
        sort_by: str = "volume",   # volume | liquidity | end_date | relevance
        sort_desc: bool = True,
        # Enrichment options
        enrich_orderbook: bool = False,
        # Pagination helpers
        offset: int = 0,
        pages: int = 1,
    ) -> List[EnrichedMarket]:
        """
        Fetch markets from Gamma API, classify, filter, and return enriched
        results.

        Args:
            limit:            Max markets per API page (max 100).
            active:           Only fetch active markets.
            start_date_min:   ISO date – earliest start date (server-side).
            event_type:       Filter by event type name (e.g. "Sports").
            tags:             Filter by tag names (e.g. ["NBA", "NFL"]).
            keyword:          Free-text keyword search in question/description.
            min_volume:       Minimum trading volume.
            max_volume:       Maximum trading volume (None = no limit).
            min_liquidity:    Minimum liquidity.
            min_price:        Min outcome price (0-1) for at least one outcome.
            max_price:        Max outcome price (0-1) for at least one outcome.
            end_date_before:  Markets ending before this datetime.
            end_date_after:   Markets ending after this datetime.
            tradable_only:    Only include markets with CLOB token IDs.
            sort_by:          Sort field.
            sort_desc:        Descending sort.
            enrich_orderbook: Fetch order-book data for each market (slower).
            offset:           Skip first N results (client-side).
            pages:            How many API pages to fetch (each = ``limit``).

        Returns:
            List of EnrichedMarket objects.
        """
        raw_markets = self._fetch_raw(
            limit=limit,
            active=active,
            start_date_min=start_date_min,
            pages=pages,
        )

        # Enrich
        enriched = [EnrichedMarket.from_raw(m) for m in raw_markets]

        # ---- Client-side filters ------------------------------------------
        filtered = enriched

        if event_type:
            et_lower = event_type.lower()
            filtered = [
                m for m in filtered
                if any(et.lower() == et_lower for et in m.event_types)
            ]

        if tags:
            tags_lower = {t.lower() for t in tags}
            filtered = [
                m for m in filtered
                if tags_lower & {t.lower() for t in m.tags}
            ]

        if keyword:
            kw_lower = keyword.lower()
            filtered = [
                m for m in filtered
                if kw_lower in m.question.lower()
                or kw_lower in m.description.lower()
            ]

        if min_volume > 0:
            filtered = [m for m in filtered if m.volume >= min_volume]

        if max_volume is not None:
            filtered = [m for m in filtered if m.volume <= max_volume]

        if min_liquidity > 0:
            filtered = [m for m in filtered if m.liquidity >= min_liquidity]

        if tradable_only:
            filtered = [m for m in filtered if m.is_tradable]

        # Price / odds range filter: keep markets where at least one outcome
        # price falls within [min_price, max_price]
        if min_price > 0.0 or max_price < 1.0:
            def _price_in_range(m: EnrichedMarket) -> bool:
                if not m.outcome_prices:
                    return True  # no price data → don't exclude
                return any(min_price <= p <= max_price for p in m.outcome_prices)
            filtered = [m for m in filtered if _price_in_range(m)]

        # Date range
        if end_date_after:
            end_date_after_aware = _ensure_aware(end_date_after)
            filtered = [
                m for m in filtered
                if m.end_date and m.end_date >= end_date_after_aware
            ]

        if end_date_before:
            end_date_before_aware = _ensure_aware(end_date_before)
            filtered = [
                m for m in filtered
                if m.end_date and m.end_date <= end_date_before_aware
            ]

        # ---- Sort ---------------------------------------------------------
        sort_key = self._sort_key(sort_by)
        filtered.sort(key=sort_key, reverse=sort_desc)

        # ---- Offset / slice -----------------------------------------------
        if offset > 0:
            filtered = filtered[offset:]

        # ---- Optional order-book enrichment --------------------------------
        if enrich_orderbook:
            for m in filtered:
                self._enrich_orderbook(m)

        return filtered

    def fetch_by_event_type(self, event_type: str, **kwargs) -> List[EnrichedMarket]:
        """Shortcut: fetch markets for a specific event type."""
        return self.fetch(event_type=event_type, **kwargs)

    def fetch_by_tags(self, tags: List[str], **kwargs) -> List[EnrichedMarket]:
        """Shortcut: fetch markets matching any of the given tags."""
        return self.fetch(tags=tags, **kwargs)

    def fetch_ending_soon(
        self,
        hours: int = 24,
        **kwargs,
    ) -> List[EnrichedMarket]:
        """Shortcut: markets ending within the next N hours."""
        now = datetime.datetime.now(tz=datetime.timezone.utc)
        return self.fetch(
            end_date_after=now,
            end_date_before=now + datetime.timedelta(hours=hours),
            sort_by="end_date",
            sort_desc=False,
            **kwargs,
        )

    def fetch_high_volume(
        self,
        min_volume: float = 10_000,
        **kwargs,
    ) -> List[EnrichedMarket]:
        """Shortcut: markets with at least min_volume in trading volume."""
        return self.fetch(min_volume=min_volume, sort_by="volume", **kwargs)

    def fetch_mispriced(
        self,
        low: float = 0.3,
        high: float = 0.7,
        **kwargs,
    ) -> List[EnrichedMarket]:
        """Shortcut: markets where at least one outcome is in [low, high]
        range – potentially mispriced / low conviction."""
        return self.fetch(min_price=low, max_price=high, **kwargs)

    def clear_cache(self) -> None:
        self._cache.clear()

    # -- Private helpers ----------------------------------------------------

    def _fetch_raw(
        self,
        limit: int,
        active: bool,
        start_date_min: Optional[str],
        pages: int,
    ) -> List[Dict[str, Any]]:
        """Fetch raw market JSON dicts from Gamma API, with caching."""
        all_markets: List[Dict[str, Any]] = []

        for page in range(pages):
            cache_key = f"gamma:{limit}:{active}:{start_date_min}:{page}"
            cached = self._cache.get(cache_key)
            if cached is not None:
                all_markets.extend(cached)
                continue

            params: Dict[str, Any] = {
                "limit": limit,
                "active": active,
                "t": int(time.time() * 1000),  # cache-bust
            }
            if start_date_min:
                params["start_date_min"] = start_date_min
            if page > 0:
                params["offset"] = page * limit

            try:
                resp = requests.get(
                    f"{GAMMA_API_BASE}/markets",
                    params=params,
                    headers=DEFAULT_HEADERS,
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, list):
                    self._cache.set(cache_key, data, self._cache_ttl)
                    all_markets.extend(data)
                else:
                    break  # unexpected format
            except requests.RequestException as exc:
                print(f"[MarketFetcher] API error (page {page}): {exc}")
                break

        return all_markets

    def _enrich_orderbook(self, market: EnrichedMarket) -> None:
        """Attach order-book spread / bid / ask to an EnrichedMarket."""
        if not market.clob_token_ids:
            return
        token_id = market.clob_token_ids[0]
        cache_key = f"book:{token_id}"
        book = self._cache.get(cache_key)
        if book is None:
            try:
                resp = requests.get(
                    f"{CLOB_API_BASE}/book",
                    params={"token_id": token_id},
                    headers=DEFAULT_HEADERS,
                    timeout=10,
                )
                if resp.status_code == 200:
                    book = resp.json()
                    self._cache.set(cache_key, book, self._cache_ttl)
            except requests.RequestException:
                return
        if not book:
            return
        bids = book.get("bids", [])
        asks = book.get("asks", [])
        if bids:
            market.best_bid = _safe_float(bids[0].get("price"))
        if asks:
            market.best_ask = _safe_float(asks[0].get("price"))
        if market.best_bid is not None and market.best_ask is not None:
            market.spread = round(market.best_ask - market.best_bid, 4)

    @staticmethod
    def _sort_key(sort_by: str):
        if sort_by == "volume":
            return lambda m: m.volume
        if sort_by == "liquidity":
            return lambda m: m.liquidity
        if sort_by == "end_date":
            return lambda m: m.end_date or datetime.datetime.min.replace(
                tzinfo=datetime.timezone.utc
            )
        # default: volume
        return lambda m: m.volume


def _ensure_aware(dt: datetime.datetime) -> datetime.datetime:
    """Make a naive datetime UTC-aware."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt


# ---------------------------------------------------------------------------
# Convenience: print a summary table of markets
# ---------------------------------------------------------------------------

def print_market_table(
    markets: List[EnrichedMarket],
    title: str = "Markets",
    show_tags: bool = True,
) -> None:
    """Pretty-print a list of enriched markets."""
    print(f"\n{'=' * 80}")
    print(f"  {title}  ({len(markets)} results)")
    print(f"{'=' * 80}")

    for i, m in enumerate(markets, 1):
        tag_str = ""
        if show_tags:
            tag_str = f"  [{m.primary_type}]"
            if m.tags:
                tag_str += f" #{', #'.join(m.tags)}"

        print(f"\n{i:>3}. {m.question}")
        print(f"     End: {m.end_date_str}  |  Vol: {m.volume_str}"
              f"  |  Tradable: {'Yes' if m.is_tradable else 'No'}")
        if tag_str:
            print(f"    {tag_str}")
        if m.outcome_prices:
            pairs = list(zip(m.outcomes, m.outcome_prices))
            odds_str = "  |  ".join(
                f"{o}: {p * 100:.1f}%" for o, p in pairs
            )
            print(f"     Odds: {odds_str}")
        if m.spread is not None:
            print(f"     Spread: {m.spread:.4f}  "
                  f"(Bid: {m.best_bid:.3f}  Ask: {m.best_ask:.3f})")

    print(f"\n{'=' * 80}\n")
