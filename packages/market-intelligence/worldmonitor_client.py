"""
World Monitor Client
====================

Programmatic access to World Monitor's 30+ intelligence microservices.
Provides geopolitical, financial, military, and conflict data to enrich
Polymarket trading decisions.

Key capabilities:
- Geopolitical risk scoring (Country Instability Index — 12 dimensions)
- AI-generated market implications (trade signals from world events)
- Cross-source signal convergence (multi-domain escalation detection)
- Conflict event tracking (ACLED / UCDP real-time data)
- Financial context (Fear & Greed, VIX, DXY, commodity quotes)
- Supply chain stress (shipping rates, chokepoints, sanctions)

Reference: https://github.com/koala73/worldmonitor

Usage:
    from worldmonitor_client import WorldMonitorClient

    wm = WorldMonitorClient()

    # Fast hydration — all data in one call
    snapshot = wm.bootstrap()

    # Targeted queries
    risks   = wm.get_risk_scores()
    signals = wm.get_cross_source_signals()
    trades  = wm.get_market_implications()
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import requests


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

WM_API_BASE = "https://worldmonitor.app/api"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Origin": "https://worldmonitor.app",
    "Referer": "https://worldmonitor.app/",
}

# Simple in-memory cache (shared with market_fetcher pattern)
_CACHE: Dict[str, tuple[float, Any]] = {}
_DEFAULT_TTL = 120  # seconds


def _cached_get(
    url: str,
    params: Optional[Dict] = None,
    headers: Optional[Dict] = None,
    ttl: int = _DEFAULT_TTL,
    timeout: int = 15,
) -> Optional[Dict]:
    """GET with simple TTL cache and graceful error handling."""
    cache_key = f"{url}|{params}"
    now = time.time()
    if cache_key in _CACHE:
        expires, data = _CACHE[cache_key]
        if now < expires:
            return data

    try:
        resp = requests.get(
            url,
            params=params or {},
            headers=headers or DEFAULT_HEADERS,
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        _CACHE[cache_key] = (now + ttl, data)
        return data
    except requests.RequestException as exc:
        print(f"[WorldMonitor] Request failed: {url} — {exc}")
        return None


# ---------------------------------------------------------------------------
# Data classes for structured results
# ---------------------------------------------------------------------------

# Country code → name mapping for common codes
_COUNTRY_NAMES: Dict[str, str] = {
    "US": "United States", "UA": "Ukraine", "RU": "Russia", "CN": "China",
    "TW": "Taiwan", "IR": "Iran", "IL": "Israel", "PS": "Palestine",
    "KP": "North Korea", "SA": "Saudi Arabia", "GB": "United Kingdom",
    "IN": "India", "BR": "Brazil", "KR": "South Korea", "JP": "Japan",
    "TR": "Turkey", "SY": "Syria", "YE": "Yemen", "IQ": "Iraq",
    "AF": "Afghanistan", "PK": "Pakistan", "MM": "Myanmar",
    "SD": "Sudan", "SO": "Somalia", "LY": "Libya", "ET": "Ethiopia",
    "CD": "DR Congo", "NG": "Nigeria", "MX": "Mexico", "CO": "Colombia",
    "VE": "Venezuela", "EG": "Egypt", "LB": "Lebanon", "DE": "Germany",
    "FR": "France", "PL": "Poland", "RO": "Romania",
}


@dataclass
class RiskScore:
    """Country-level instability score with dimensional breakdown."""
    country: str
    country_code: str = ""
    overall_score: float = 0.0   # 0-100
    level: str = "low"           # low / elevated / high / critical
    trend: str = "stable"
    dimensions: Dict[str, float] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: Dict) -> "RiskScore":
        # Handle World Monitor CII format: {region, combinedScore, components}
        code = d.get("region", d.get("countryCode", d.get("code", "")))
        country_name = d.get("country", d.get("name",
                             _COUNTRY_NAMES.get(code, code)))
        score = d.get("combinedScore", d.get("overall", d.get("score", 0)))
        if isinstance(score, str):
            try:
                score = float(score)
            except ValueError:
                score = 0

        level = "low"
        if score >= 80:
            level = "critical"
        elif score >= 50:
            level = "high"
        elif score >= 30:
            level = "elevated"

        # Parse trend
        trend_raw = d.get("trend", "stable")
        trend = "stable"
        if "rising" in str(trend_raw).lower() or "up" in str(trend_raw).lower():
            trend = "rising"
        elif "falling" in str(trend_raw).lower() or "down" in str(trend_raw).lower():
            trend = "falling"

        # Parse dimensional components
        components = d.get("components", {})
        dimensions = {}
        if components and isinstance(components, dict):
            dimensions = {k: v for k, v in components.items()
                          if isinstance(v, (int, float))}
        else:
            dimensions = {
                k: v for k, v in d.items()
                if k not in ("country", "name", "countryCode", "code",
                             "region", "combinedScore", "overall", "score",
                             "level", "trend", "components", "computedAt",
                             "staticBaseline", "dynamicScore")
                and isinstance(v, (int, float))
            }

        return cls(
            country=country_name,
            country_code=code,
            overall_score=score,
            level=level,
            trend=trend,
            dimensions=dimensions,
        )


@dataclass
class MarketImplication:
    """AI-generated trade signal derived from world events."""
    title: str = ""
    sector: str = ""
    direction: str = ""        # bullish / bearish / neutral
    confidence: float = 0.0    # 0-1
    justification: str = ""
    related_signals: List[str] = field(default_factory=list)
    timestamp: str = ""

    @classmethod
    def from_dict(cls, d: Dict) -> "MarketImplication":
        return cls(
            title=d.get("title", d.get("market", "")),
            sector=d.get("sector", d.get("category", "")),
            direction=d.get("direction", d.get("sentiment", "")),
            confidence=d.get("confidence", 0),
            justification=d.get("justification", d.get("reasoning", "")),
            related_signals=d.get("relatedSignals", d.get("signals", [])),
            timestamp=d.get("timestamp", d.get("updatedAt", "")),
        )


@dataclass
class CrossSourceSignal:
    """Multi-domain convergence signal indicating a high-impact event."""
    title: str = ""
    severity: str = ""         # low / medium / high / critical
    domains: List[str] = field(default_factory=list)
    description: str = ""
    score: float = 0.0
    sources_count: int = 0

    @classmethod
    def from_dict(cls, d: Dict) -> "CrossSourceSignal":
        return cls(
            title=d.get("title", d.get("summary", "")),
            severity=d.get("severity", d.get("level", "")),
            domains=d.get("domains", d.get("categories", [])),
            description=d.get("description", d.get("detail", "")),
            score=d.get("score", d.get("strength", 0)),
            sources_count=d.get("sourcesCount", d.get("sourceCount", 0)),
        )


@dataclass
class ConflictEvent:
    """An armed conflict or unrest event from ACLED/UCDP."""
    event_type: str = ""
    location: str = ""
    country: str = ""
    date: str = ""
    fatalities: int = 0
    description: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    source: str = ""

    @classmethod
    def from_dict(cls, d: Dict) -> "ConflictEvent":
        return cls(
            event_type=d.get("eventType", d.get("type", "")),
            location=d.get("location", d.get("admin1", "")),
            country=d.get("country", ""),
            date=d.get("date", d.get("eventDate", "")),
            fatalities=d.get("fatalities", 0),
            description=d.get("notes", d.get("description", "")),
            latitude=d.get("latitude", d.get("lat", 0)),
            longitude=d.get("longitude", d.get("lon", 0)),
            source=d.get("source", d.get("dataSource", "")),
        )


@dataclass
class FearGreedIndex:
    """Market sentiment indicator (0=Extreme Fear, 100=Extreme Greed)."""
    value: int = 50
    label: str = "Neutral"
    previous_value: int = 50
    previous_label: str = "Neutral"
    timestamp: str = ""

    @classmethod
    def from_dict(cls, d: Dict) -> "FearGreedIndex":
        # Handle WM format: {compositeScore, compositeLabel, ...}
        score = d.get("compositeScore",
                       d.get("value",
                             d.get("now", {}).get("value", 50)))
        label = d.get("compositeLabel",
                       d.get("label",
                             d.get("now", {}).get("label", "Neutral")))
        prev = d.get("previousScore",
                      d.get("previousValue",
                            d.get("yesterday", {}).get("value", 50)))
        return cls(
            value=int(score) if score else 50,
            label=str(label) if label else "Neutral",
            previous_value=int(prev) if prev else 50,
            previous_label="",
            timestamp=d.get("seededAt", d.get("timestamp",
                            d.get("updatedAt", ""))),
        )


# ---------------------------------------------------------------------------
# Main client
# ---------------------------------------------------------------------------

class WorldMonitorClient:
    """Client for World Monitor's intelligence APIs.

    Args:
        base_url:  API base (default: https://worldmonitor.app/api)
        api_key:   Optional API key for authenticated access.
        cache_ttl: Default cache TTL in seconds (default: 120).
    """

    def __init__(
        self,
        base_url: str = WM_API_BASE,
        api_key: Optional[str] = None,
        cache_ttl: int = _DEFAULT_TTL,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.cache_ttl = cache_ttl
        self.headers = dict(DEFAULT_HEADERS)
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"

    # -- Fast hydration -----------------------------------------------------

    def bootstrap(self) -> Optional[Dict]:
        """Single call returning ~80 pre-seeded data keys.
        Fastest way to hydrate all indicators at once.
        Returns the inner 'data' dict if present."""
        raw = _cached_get(
            f"{self.base_url}/bootstrap",
            headers=self.headers,
            ttl=60,
            timeout=20,
        )
        if raw and isinstance(raw, dict) and "data" in raw:
            return raw["data"]
        return raw

    # -- Intelligence -------------------------------------------------------

    def get_risk_scores(self) -> List[RiskScore]:
        """Country Instability Index — composite risk per country.
        Tries dedicated endpoint first, falls back to bootstrap data."""
        data = _cached_get(
            f"{self.base_url}/intelligence/v1/get-risk-scores",
            headers=self.headers,
            ttl=300,
        )
        if data:
            items = data if isinstance(data, list) else data.get(
                "ciiScores", data.get("scores", data.get("countries", [])))
            if items:
                return [RiskScore.from_dict(item) for item in items]

        # Fallback: bootstrap
        bs = self.bootstrap()
        if bs and "riskScores" in bs:
            rs_data = bs["riskScores"]
            items = rs_data.get("ciiScores", [])
            return [RiskScore.from_dict(item) for item in items]
        return []

    def get_market_implications(self, limit: int = 20) -> List[MarketImplication]:
        """AI-synthesized trade signals from live world state."""
        data = _cached_get(
            f"{self.base_url}/intelligence/v1/list-market-implications",
            params={"limit": limit},
            headers=self.headers,
            ttl=120,
        )
        if data:
            items = data if isinstance(data, list) else data.get(
                "cards", data.get("implications", data.get("items", [])))
            if items:
                return [MarketImplication.from_dict(item) for item in items[:limit]]

        # Fallback: bootstrap
        bs = self.bootstrap()
        if bs and "marketImplications" in bs:
            mi_data = bs["marketImplications"]
            items = mi_data.get("cards", [])
            return [MarketImplication.from_dict(item) for item in items[:limit]]
        return []

    def get_cross_source_signals(self, limit: int = 20) -> List[CrossSourceSignal]:
        """Multi-domain convergence signals (escalation detection)."""
        data = _cached_get(
            f"{self.base_url}/intelligence/v1/list-cross-source-signals",
            params={"limit": limit},
            headers=self.headers,
            ttl=120,
        )
        if data:
            items = data if isinstance(data, list) else data.get(
                "signals", data.get("items", []))
            if items:
                return [CrossSourceSignal.from_dict(item) for item in items[:limit]]

        # Fallback: bootstrap
        bs = self.bootstrap()
        if bs and "crossSourceSignals" in bs:
            sig_data = bs["crossSourceSignals"]
            items = sig_data.get("signals", sig_data.get("items", []))
            return [CrossSourceSignal.from_dict(item) for item in items[:limit]]
        return []

    def get_country_risk(self, country_code: str) -> Optional[RiskScore]:
        """Risk score for a specific country (ISO 3166-1 alpha-2)."""
        data = _cached_get(
            f"{self.base_url}/intelligence/v1/get-country-risk",
            params={"countryCode": country_code},
            headers=self.headers,
            ttl=300,
        )
        if not data:
            return None
        return RiskScore.from_dict(data)

    # -- Conflict -----------------------------------------------------------

    def get_conflict_events(
        self,
        limit: int = 50,
        country: Optional[str] = None,
    ) -> List[ConflictEvent]:
        """Armed conflict events from ACLED."""
        params: Dict[str, Any] = {"limit": limit}
        if country:
            params["country"] = country
        data = _cached_get(
            f"{self.base_url}/conflict/v1/list-acled-events",
            params=params,
            headers=self.headers,
            ttl=600,
        )
        if not data:
            return []
        items = data if isinstance(data, list) else data.get("events", data.get("items", []))
        return [ConflictEvent.from_dict(item) for item in items]

    def get_ucdp_events(self, limit: int = 50) -> List[ConflictEvent]:
        """Conflict events from Uppsala Conflict Data Program."""
        data = _cached_get(
            f"{self.base_url}/conflict/v1/list-ucdp-events",
            params={"limit": limit},
            headers=self.headers,
            ttl=600,
        )
        if not data:
            return []
        items = data if isinstance(data, list) else data.get("events", data.get("items", []))
        return [ConflictEvent.from_dict(item) for item in items]

    # -- Financial context --------------------------------------------------

    def get_fear_greed_index(self) -> Optional[FearGreedIndex]:
        """Current Fear & Greed Index for crypto/market sentiment."""
        data = _cached_get(
            f"{self.base_url}/market/v1/get-fear-greed-index",
            headers=self.headers,
            ttl=300,
        )
        if data:
            return FearGreedIndex.from_dict(data)

        # Fallback: bootstrap
        bs = self.bootstrap()
        if bs and "fearGreedIndex" in bs:
            fg = bs["fearGreedIndex"]
            composite = fg.get("composite", {})
            return FearGreedIndex(
                value=int(composite.get("score", 50)),
                label=composite.get("label", "Neutral"),
                previous_value=int(composite.get("previous", 50)),
                previous_label="",
                timestamp=fg.get("timestamp", ""),
            )
        return None

    def get_market_quotes(
        self,
        symbols: Optional[List[str]] = None,
    ) -> Optional[Dict]:
        """Stock / index quotes (VIX, DXY, SPY, etc.)."""
        params = {}
        if symbols:
            params["symbols"] = ",".join(symbols)
        return _cached_get(
            f"{self.base_url}/market/v1/list-market-quotes",
            params=params,
            headers=self.headers,
            ttl=60,
        )

    def get_commodity_quotes(
        self,
        symbols: Optional[List[str]] = None,
    ) -> Optional[Dict]:
        """Commodity quotes (CL=oil, GC=gold, NG=natgas, etc.)."""
        params = {}
        if symbols:
            params["symbols"] = ",".join(symbols)
        return _cached_get(
            f"{self.base_url}/market/v1/list-commodity-quotes",
            params=params,
            headers=self.headers,
            ttl=60,
        )

    def get_crypto_quotes(
        self,
        symbols: Optional[List[str]] = None,
    ) -> Optional[Dict]:
        """Crypto quotes from CoinGecko."""
        params = {}
        if symbols:
            params["symbols"] = ",".join(symbols)
        return _cached_get(
            f"{self.base_url}/market/v1/list-crypto-quotes",
            params=params,
            headers=self.headers,
            ttl=60,
        )

    # -- Predictions --------------------------------------------------------

    def get_prediction_markets(
        self,
        category: Optional[str] = None,
        page_size: int = 50,
    ) -> Optional[Dict]:
        """Polymarket + Kalshi prediction markets with odds & volume.

        Categories: geopolitical, tech, finance, economy.
        """
        params: Dict[str, Any] = {"pageSize": page_size}
        if category:
            params["category"] = category
        return _cached_get(
            f"{self.base_url}/prediction/v1/list-prediction-markets",
            params=params,
            headers=self.headers,
            ttl=120,
        )

    # -- Geopolitical context -----------------------------------------------

    def get_sanctions_pressure(self) -> Optional[Dict]:
        """Sanctions pressure scores by country/entity."""
        return _cached_get(
            f"{self.base_url}/sanctions/v1/get-pressure-score",
            headers=self.headers,
            ttl=1800,
        )

    def get_supply_chain_status(self) -> Optional[Dict]:
        """Supply chain stress: shipping rates, chokepoints."""
        return _cached_get(
            f"{self.base_url}/supply-chain/v1/get-chokepoints",
            headers=self.headers,
            ttl=600,
        )

    def get_economic_signals(self) -> Optional[Dict]:
        """Macro stress index, FRED indicators."""
        return _cached_get(
            f"{self.base_url}/economic/v1/get-macro-signals",
            headers=self.headers,
            ttl=300,
        )

    # -- Health & Climate ---------------------------------------------------

    def get_disease_outbreaks(self, limit: int = 20) -> Optional[Dict]:
        """Active disease outbreaks from CDC/ECDC/WHO."""
        return _cached_get(
            f"{self.base_url}/health/v1/list-disease-outbreaks",
            params={"limit": limit},
            headers=self.headers,
            ttl=1800,
        )

    def get_climate_anomalies(self) -> Optional[Dict]:
        """Temperature anomalies, extreme weather events."""
        return _cached_get(
            f"{self.base_url}/climate/v1/list-climate-anomalies",
            headers=self.headers,
            ttl=1800,
        )

    # -- News & OSINT -------------------------------------------------------

    def get_news_digest(self, category: Optional[str] = None) -> Optional[Dict]:
        """AI-summarized news from 435+ RSS feeds.

        Categories: politics, energy, tech, military, cyber, climate, etc.
        """
        params = {}
        if category:
            params["category"] = category
        return _cached_get(
            f"{self.base_url}/news/v1/list-feed-digest",
            params=params,
            headers=self.headers,
            ttl=300,
        )

    def get_forecasts(self, limit: int = 10) -> Optional[Dict]:
        """AI-generated geopolitical forecasts with confidence scores."""
        return _cached_get(
            f"{self.base_url}/forecast/v1/list-predictions",
            params={"limit": limit},
            headers=self.headers,
            ttl=600,
        )

    # -- Utility ------------------------------------------------------------

    def clear_cache(self) -> None:
        _CACHE.clear()

    def health_check(self) -> bool:
        """Check if the World Monitor API is reachable."""
        try:
            resp = requests.get(
                f"{self.base_url}/bootstrap",
                headers=self.headers,
                timeout=5,
            )
            return resp.status_code == 200
        except requests.RequestException:
            return False
