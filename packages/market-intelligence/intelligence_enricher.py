"""
Intelligence Enricher
=====================

Bridges World Monitor intelligence with Polymarket market analysis.
Augments each market with geopolitical context, risk signals, and
AI-generated trade implications to improve prediction quality.

Architecture:
    Polymarket Markets (market_fetcher)
            +
    World Monitor Intelligence (worldmonitor_client)
            ↓
    IntelligenceEnricher
            ↓
    Enriched markets with reasoning context

Usage:
    from intelligence_enricher import IntelligenceEnricher

    enricher = IntelligenceEnricher()
    report = enricher.build_context_report()
    enriched = enricher.enrich_markets(markets)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from market_fetcher import EnrichedMarket, MarketFetcher
from worldmonitor_client import (
    WorldMonitorClient,
    CrossSourceSignal,
    FearGreedIndex,
    MarketImplication,
    RiskScore,
)


# ---------------------------------------------------------------------------
# Keyword → country / region mapping for geopolitical markets
# ---------------------------------------------------------------------------

GEOPOLITICAL_KEYWORDS: Dict[str, List[str]] = {
    "US": ["united states", "america", "biden", "trump", "harris",
           "congress", "senate", "white house", "fed ", "federal reserve",
           "us election", "us policy"],
    "UA": ["ukraine", "kyiv", "zelensky", "crimea", "donbas", "donetsk"],
    "RU": ["russia", "moscow", "putin", "kremlin"],
    "CN": ["china", "beijing", "xi jinping", "taiwan", "prc"],
    "TW": ["taiwan", "taipei"],
    "IR": ["iran", "tehran", "khamenei", "irgc", "hormuz"],
    "IL": ["israel", "tel aviv", "netanyahu", "idf", "gaza"],
    "PS": ["palestine", "gaza", "hamas", "west bank"],
    "KP": ["north korea", "pyongyang", "kim jong"],
    "SA": ["saudi arabia", "riyadh", "opec"],
    "EU": ["europe", "european union", "brussels", "ecb"],
    "GB": ["united kingdom", "uk ", "london", "starmer", "sunak"],
    "IN": ["india", "modi", "new delhi"],
    "BR": ["brazil", "lula", "brasilia"],
    "KR": ["south korea", "seoul"],
    "JP": ["japan", "tokyo", "yen"],
    "TR": ["turkey", "erdogan", "ankara"],
    "SY": ["syria", "damascus", "aleppo"],
    "YE": ["yemen", "houthi", "sanaa"],
}

# Market topic → relevant financial indicators
TOPIC_INDICATORS: Dict[str, List[str]] = {
    "oil": ["CL", "BZ", "NG"],         # crude, brent, nat gas
    "energy": ["CL", "BZ", "NG"],
    "gold": ["GC", "SI"],               # gold, silver
    "crypto": ["BTC", "ETH"],
    "bitcoin": ["BTC"],
    "ethereum": ["ETH"],
    "inflation": ["DXY", "TNX", "GC"],  # dollar, 10y yield, gold
    "interest rate": ["TNX", "DXY"],
    "fed": ["TNX", "DXY", "SPY"],
    "recession": ["VIX", "SPY", "TNX"],
    "stock": ["SPY", "QQQ", "VIX"],
    "tech": ["QQQ", "AAPL", "NVDA"],
    "war": ["GC", "CL", "VIX"],
    "conflict": ["GC", "CL", "VIX"],
    "sanctions": ["CL", "GC", "DXY"],
    "trade war": ["DXY", "SPY", "CL"],
    "tariff": ["DXY", "SPY"],
    "election": ["VIX", "SPY", "DXY"],
}


# ---------------------------------------------------------------------------
# Enrichment result
# ---------------------------------------------------------------------------

@dataclass
class MarketIntelligence:
    """Intelligence context attached to a specific market."""
    market: EnrichedMarket

    # Matched geopolitical context
    related_countries: List[str] = field(default_factory=list)
    country_risks: List[RiskScore] = field(default_factory=list)
    risk_level: str = "unknown"  # aggregated: low/elevated/high/critical

    # Matched signals
    relevant_implications: List[MarketImplication] = field(default_factory=list)
    relevant_signals: List[CrossSourceSignal] = field(default_factory=list)

    # Financial context
    sentiment: Optional[FearGreedIndex] = None
    relevant_quotes: Dict[str, Any] = field(default_factory=dict)

    # Reasoning summary
    context_summary: str = ""

    def to_dict(self) -> Dict[str, Any]:
        base = self.market.to_dict()
        base.update({
            "intelligence": {
                "related_countries": self.related_countries,
                "risk_level": self.risk_level,
                "country_risks": [
                    {"country": r.country, "score": r.overall_score,
                     "level": r.level}
                    for r in self.country_risks
                ],
                "trade_signals": [
                    {"title": imp.title, "direction": imp.direction,
                     "confidence": imp.confidence,
                     "justification": imp.justification}
                    for imp in self.relevant_implications
                ],
                "convergence_signals": [
                    {"title": s.title, "severity": s.severity,
                     "domains": s.domains, "score": s.score}
                    for s in self.relevant_signals
                ],
                "sentiment": {
                    "value": self.sentiment.value,
                    "label": self.sentiment.label,
                } if self.sentiment else None,
                "financial_context": self.relevant_quotes,
                "context_summary": self.context_summary,
            }
        })
        return base


# ---------------------------------------------------------------------------
# Context report (snapshot of the world state)
# ---------------------------------------------------------------------------

@dataclass
class ContextReport:
    """A point-in-time snapshot of world state for trading decisions."""
    risk_scores: List[RiskScore] = field(default_factory=list)
    implications: List[MarketImplication] = field(default_factory=list)
    signals: List[CrossSourceSignal] = field(default_factory=list)
    sentiment: Optional[FearGreedIndex] = None
    economic_data: Optional[Dict] = None
    conflict_count: int = 0
    critical_countries: List[str] = field(default_factory=list)
    high_risk_countries: List[str] = field(default_factory=list)

    @property
    def global_tension_level(self) -> str:
        if len(self.critical_countries) >= 3:
            return "critical"
        if self.critical_countries or len(self.high_risk_countries) >= 5:
            return "high"
        if len(self.high_risk_countries) >= 2:
            return "elevated"
        return "baseline"

    def summary(self) -> str:
        lines = [
            f"Global Tension: {self.global_tension_level.upper()}",
            f"Critical countries: {', '.join(self.critical_countries) or 'none'}",
            f"High-risk countries: {', '.join(self.high_risk_countries) or 'none'}",
        ]
        if self.sentiment:
            lines.append(
                f"Market Sentiment: {self.sentiment.label} ({self.sentiment.value})")
        lines.append(f"Active trade signals: {len(self.implications)}")
        lines.append(f"Convergence alerts: {len(self.signals)}")
        lines.append(f"Active conflict events: {self.conflict_count}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# IntelligenceEnricher
# ---------------------------------------------------------------------------

class IntelligenceEnricher:
    """Enriches Polymarket markets with World Monitor intelligence."""

    def __init__(
        self,
        wm_client: Optional[WorldMonitorClient] = None,
        market_fetcher: Optional[MarketFetcher] = None,
    ) -> None:
        self.wm = wm_client or WorldMonitorClient()
        self.mf = market_fetcher or MarketFetcher()
        self._context: Optional[ContextReport] = None

    # -- Context building ---------------------------------------------------

    def build_context_report(self, force_refresh: bool = False) -> ContextReport:
        """Build a world-state context report from World Monitor data.

        Cached internally; call with force_refresh=True to update.
        """
        if self._context and not force_refresh:
            return self._context

        report = ContextReport()

        # 1) Risk scores
        report.risk_scores = self.wm.get_risk_scores()
        for rs in report.risk_scores:
            if rs.level == "critical":
                report.critical_countries.append(rs.country)
            elif rs.level == "high":
                report.high_risk_countries.append(rs.country)

        # 2) Market implications
        report.implications = self.wm.get_market_implications(limit=30)

        # 3) Cross-source convergence
        report.signals = self.wm.get_cross_source_signals(limit=30)

        # 4) Sentiment
        report.sentiment = self.wm.get_fear_greed_index()

        # 5) Economic signals
        report.economic_data = self.wm.get_economic_signals()

        # 6) Conflict count
        events = self.wm.get_conflict_events(limit=100)
        report.conflict_count = len(events)

        self._context = report
        return report

    # -- Market enrichment --------------------------------------------------

    def enrich_markets(
        self,
        markets: List[EnrichedMarket],
        include_quotes: bool = False,
    ) -> List[MarketIntelligence]:
        """Attach intelligence context to a list of markets.

        Args:
            markets:        List of EnrichedMarket from MarketFetcher.
            include_quotes: Also fetch relevant financial quotes per market.
        """
        ctx = self.build_context_report()
        results = []

        # Build a risk-score lookup by country code
        risk_lookup: Dict[str, RiskScore] = {
            rs.country_code: rs for rs in ctx.risk_scores if rs.country_code
        }

        for market in markets:
            mi = MarketIntelligence(market=market, sentiment=ctx.sentiment)

            market_text = f"{market.question} {market.description}".lower()

            # 1) Match countries
            for code, keywords in GEOPOLITICAL_KEYWORDS.items():
                if any(kw in market_text for kw in keywords):
                    mi.related_countries.append(code)
                    if code in risk_lookup:
                        mi.country_risks.append(risk_lookup[code])

            # Aggregate risk level
            if mi.country_risks:
                max_score = max(r.overall_score for r in mi.country_risks)
                if max_score >= 80:
                    mi.risk_level = "critical"
                elif max_score >= 50:
                    mi.risk_level = "high"
                elif max_score >= 30:
                    mi.risk_level = "elevated"
                else:
                    mi.risk_level = "low"

            # 2) Match trade implications by keyword overlap
            for imp in ctx.implications:
                imp_text = f"{imp.title} {imp.sector} {imp.justification}".lower()
                # Check if the implication relates to this market
                overlap = _text_overlap(market_text, imp_text)
                if overlap >= 2:
                    mi.relevant_implications.append(imp)

            # 3) Match cross-source signals
            for sig in ctx.signals:
                sig_text = f"{sig.title} {sig.description}".lower()
                if _text_overlap(market_text, sig_text) >= 2:
                    mi.relevant_signals.append(sig)

            # 4) Relevant financial quotes
            if include_quotes:
                symbols = set()
                for topic, syms in TOPIC_INDICATORS.items():
                    if topic in market_text:
                        symbols.update(syms)
                if symbols:
                    quotes = self.wm.get_market_quotes(list(symbols))
                    if quotes:
                        mi.relevant_quotes = quotes

            # 5) Build context summary
            mi.context_summary = self._build_summary(mi, ctx)

            results.append(mi)

        return results

    def enrich_and_fetch(
        self,
        event_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        keyword: Optional[str] = None,
        min_volume: float = 0,
        limit: int = 50,
        include_quotes: bool = False,
        **kwargs,
    ) -> List[MarketIntelligence]:
        """Convenience: fetch markets then enrich with intelligence."""
        markets = self.mf.fetch(
            event_type=event_type,
            tags=tags,
            keyword=keyword,
            min_volume=min_volume,
            limit=limit,
            pages=2,
            **kwargs,
        )
        return self.enrich_markets(markets, include_quotes=include_quotes)

    # -- Private helpers ----------------------------------------------------

    @staticmethod
    def _build_summary(mi: MarketIntelligence, ctx: ContextReport) -> str:
        """Generate a concise reasoning context string."""
        parts = []

        # Risk
        if mi.country_risks:
            risk_str = ", ".join(
                f"{r.country} ({r.level}, {r.overall_score:.0f})"
                for r in mi.country_risks
            )
            parts.append(f"Geopolitical risk: {risk_str}")

        # Trade signals
        if mi.relevant_implications:
            for imp in mi.relevant_implications[:3]:
                parts.append(
                    f"Signal: {imp.title} → {imp.direction} "
                    f"(confidence {imp.confidence})"
                )

        # Convergence
        if mi.relevant_signals:
            for sig in mi.relevant_signals[:2]:
                parts.append(
                    f"Convergence [{sig.severity}]: {sig.title} "
                    f"(score {sig.score:.1f}, {sig.sources_count} sources)"
                )

        # Sentiment
        if mi.sentiment:
            parts.append(
                f"Market sentiment: {mi.sentiment.label} "
                f"({mi.sentiment.value}/100)"
            )

        # Global context
        parts.append(f"Global tension: {ctx.global_tension_level}")

        return " | ".join(parts) if parts else "No specific intelligence context."


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _text_overlap(text_a: str, text_b: str) -> int:
    """Count significant word overlaps between two texts."""
    stop_words = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been",
        "will", "would", "could", "should", "can", "may", "might",
        "do", "does", "did", "has", "have", "had", "this", "that",
        "it", "its", "in", "on", "at", "to", "for", "of", "with",
        "and", "or", "but", "not", "no", "by", "from", "as", "if",
        "than", "then", "so", "up", "out", "about", "into", "over",
        "after", "before", "between", "under", "more", "most",
        "other", "some", "such", "only", "also", "very", "just",
        "what", "which", "who", "when", "where", "how", "all",
        "each", "every", "both", "few", "many", "much", "own",
    }
    words_a = set(re.findall(r'[a-z]{3,}', text_a)) - stop_words
    words_b = set(re.findall(r'[a-z]{3,}', text_b)) - stop_words
    return len(words_a & words_b)


# ---------------------------------------------------------------------------
# Pretty printing
# ---------------------------------------------------------------------------

def print_context_report(report: ContextReport) -> None:
    """Print a formatted context report."""
    print("\n" + "=" * 70)
    print("  WORLD STATE CONTEXT REPORT")
    print("=" * 70)
    print(f"\n{report.summary()}")

    if report.implications:
        print(f"\n  Top Trade Signals ({len(report.implications)}):")
        for imp in report.implications[:5]:
            arrow = {"bullish": "+", "bearish": "-"}.get(
                imp.direction.lower() if imp.direction else "", "~")
            conf_str = (f"{imp.confidence}" if isinstance(imp.confidence, float)
                        else str(imp.confidence))
            print(f"    [{arrow}] {imp.title} "
                  f"({imp.direction}, {conf_str})")

    if report.signals:
        print(f"\n  Convergence Alerts ({len(report.signals)}):")
        for sig in report.signals[:5]:
            print(f"    [{sig.severity.upper()}] {sig.title} "
                  f"(score {sig.score:.1f})")

    print("=" * 70 + "\n")


def print_enriched_markets(markets: List[MarketIntelligence]) -> None:
    """Print enriched markets with intelligence context."""
    print(f"\n{'=' * 80}")
    print(f"  INTELLIGENCE-ENRICHED MARKETS  ({len(markets)} results)")
    print(f"{'=' * 80}")

    for i, mi in enumerate(markets, 1):
        m = mi.market
        print(f"\n{i:>3}. {m.question}")
        print(f"     End: {m.end_date_str}  |  Vol: {m.volume_str}")
        print(f"     Type: {m.primary_type}  |  Tags: "
              f"{'#' + ', #'.join(m.tags) if m.tags else 'none'}")

        if mi.related_countries:
            print(f"     Countries: {', '.join(mi.related_countries)}  "
                  f"|  Risk: {mi.risk_level.upper()}")

        if mi.country_risks:
            for r in mi.country_risks:
                top_dims = sorted(r.dimensions.items(),
                                  key=lambda x: -x[1])[:3]
                dims_str = ", ".join(f"{k}={v:.0f}" for k, v in top_dims)
                print(f"       {r.country}: {r.overall_score:.0f}/100 "
                      f"({r.level}) [{dims_str}]")

        if mi.relevant_implications:
            print(f"     Trade signals ({len(mi.relevant_implications)}):")
            for imp in mi.relevant_implications[:2]:
                print(f"       → {imp.direction.upper()}: {imp.title} "
                      f"({imp.confidence})")

        if mi.relevant_signals:
            print(f"     Convergence ({len(mi.relevant_signals)}):")
            for sig in mi.relevant_signals[:2]:
                print(f"       ! [{sig.severity}] {sig.title}")

        if mi.context_summary:
            # Truncate long summaries for display
            summary = mi.context_summary
            if len(summary) > 200:
                summary = summary[:197] + "..."
            print(f"     Context: {summary}")

        print(f"     {'─' * 60}")

    print(f"\n{'=' * 80}\n")
