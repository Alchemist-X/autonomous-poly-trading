"""
Polymarket Tag Library & Event Type Classification System

Provides:
- EVENT_TYPES: Top-level event categories (Sports, Politics, Crypto, etc.)
- TAG_LIBRARY: Hierarchical tag definitions with keywords for auto-matching
- classify_market(): Auto-classify a market by scanning its text fields
- search_tags(): Find tags matching a query string
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

# Minimum keyword length for simple substring matching.
# Shorter keywords use word-boundary regex to avoid false positives
# (e.g. "sol" matching "resolution", "eth" matching "whether").
_WORD_BOUNDARY_THRESHOLD = 5


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Tag:
    """A single tag with keywords used for automatic market matching."""
    name: str
    keywords: List[str]
    description: str = ""

    def matches(self, text: str) -> bool:
        text_lower = text.lower()
        for kw in self.keywords:
            if len(kw) < _WORD_BOUNDARY_THRESHOLD:
                # Short keyword → require word boundaries
                if re.search(r'\b' + re.escape(kw) + r'\b', text_lower):
                    return True
            else:
                if kw in text_lower:
                    return True
        return False


@dataclass
class EventType:
    """A top-level event category containing multiple tags."""
    name: str
    description: str
    tags: List[Tag] = field(default_factory=list)
    # Extra broad keywords that belong to the category itself
    keywords: List[str] = field(default_factory=list)

    def matches(self, text: str) -> bool:
        text_lower = text.lower()
        for kw in self.keywords:
            if len(kw) < _WORD_BOUNDARY_THRESHOLD:
                if re.search(r'\b' + re.escape(kw) + r'\b', text_lower):
                    return True
            else:
                if kw in text_lower:
                    return True
        return any(tag.matches(text) for tag in self.tags)

    def matched_tags(self, text: str) -> List[str]:
        return [tag.name for tag in self.tags if tag.matches(text)]


# ---------------------------------------------------------------------------
# Event type & tag definitions
# ---------------------------------------------------------------------------

EVENT_TYPES: Dict[str, EventType] = {}


def _register(event_type: EventType) -> None:
    EVENT_TYPES[event_type.name] = event_type


# ---- Sports ---------------------------------------------------------------
_register(EventType(
    name="Sports",
    description="Sports events including leagues, tournaments, and matches",
    keywords=["sports", "playoff", "playoffs", "finals",
              "tournament", "championship", "mvp", "standings"],
    tags=[
        Tag("NBA", ["nba", "basketball",
                     "lakers", "celtics", "warriors", "knicks",
                     "76ers", "nuggets", "clippers", "mavericks",
                     "grizzlies", "timberwolves", "cavaliers", "pacers",
                     "blazers", "pelicans"],
            "National Basketball Association"),
        Tag("NFL", ["nfl", "super bowl",
                    "chiefs", "49ers", "cowboys", "packers",
                    "bengals", "dolphins", "patriots", "steelers",
                    "broncos", "chargers", "seahawks",
                    "buccaneers", "commanders"],
            "National Football League"),
        Tag("MLB", ["mlb", "baseball", "world series",
                    "yankees", "dodgers", "red sox", "astros", "braves",
                    "cubs", "cardinals", "mets", "phillies", "padres",
                    "guardians", "rangers", "orioles", "rays", "blue jays",
                    "twins", "white sox", "mariners", "angels", "athletics",
                    "royals", "tigers", "brewers", "reds", "pirates",
                    "rockies", "diamondbacks", "nationals", "marlins"],
            "Major League Baseball"),
        Tag("Soccer", ["soccer", "premier league", "uefa", "champions league",
                       "fifa", "world cup", "la liga", "serie a", "bundesliga",
                       "ligue 1", "mls", "manchester united", "manchester city",
                       "liverpool", "chelsea", "arsenal", "tottenham",
                       "barcelona", "real madrid", "bayern munich",
                       "psg", "juventus", "inter milan", "ac milan",
                       "borussia dortmund"],
            "Football / Soccer worldwide"),
        Tag("NHL", ["nhl", "hockey", "stanley cup",
                    "bruins", "rangers", "maple leafs", "canadiens",
                    "blackhawks", "penguins", "capitals", "flyers",
                    "red wings", "oilers", "avalanche", "lightning"],
            "National Hockey League"),
        Tag("Tennis", ["tennis", "atp", "wta", "grand slam",
                       "wimbledon", "us open tennis", "australian open",
                       "french open", "roland garros", "djokovic", "nadal",
                       "federer", "alcaraz", "sinner", "swiatek"],
            "Professional tennis"),
        Tag("Golf", ["golf", "pga", "masters", "the open",
                     "ryder cup", "lpga"],
            "Professional golf"),
        Tag("Combat Sports", ["ufc", "mma", "boxing", "fight night",
                              "bellator", "heavyweight", "lightweight",
                              "middleweight", "welterweight", "featherweight"],
            "UFC / MMA / Boxing"),
        Tag("Olympics", ["olympics", "olympic games", "ioc",
                         "summer olympics", "winter olympics",
                         "paralympics", "medal count"],
            "Olympic Games"),
        Tag("Motorsport", ["formula 1", "f1", "nascar", "motogp",
                           "indycar", "le mans", "grand prix"],
            "Motor racing"),
        Tag("Esports", ["esports", "league of legends", "dota 2",
                        "counter-strike", "valorant", "overwatch"],
            "Competitive gaming"),
    ],
))

# ---- Politics --------------------------------------------------------------
_register(EventType(
    name="Politics",
    description="Elections, legislation, government policy, and geopolitics",
    keywords=["election", "vote", "ballot", "legislation", "bill",
              "congress", "senate", "parliament", "governor", "mayor",
              "political", "geopolitics", "diplomat"],
    tags=[
        Tag("US Elections", ["presidential election", "us election",
                             "midterm", "primary", "electoral college",
                             "democrat", "republican", "gop", "dnc", "rnc",
                             "biden", "trump", "harris", "desantis",
                             "congress election", "senate race"],
            "US federal and state elections"),
        Tag("US Policy", ["executive order", "supreme court", "scotus",
                          "federal reserve", "fed rate", "interest rate",
                          "government shutdown", "debt ceiling",
                          "impeachment", "filibuster", "white house"],
            "US domestic policy and governance"),
        Tag("International Politics", ["nato", "united nations",
                                       "european union", "g7 summit", "g20 summit",
                                       "sanctions", "trade war", "tariff",
                                       "ceasefire", "peace deal",
                                       "invasion", "conflict",
                                       "brexit", "referendum"],
            "International relations and geopolitics"),
        Tag("Regulation", ["regulation", "cftc", "legalize",
                           "antitrust", "compliance", "enforcement"],
            "Government regulation and enforcement"),
    ],
))

# ---- Crypto & Web3 ---------------------------------------------------------
_register(EventType(
    name="Crypto",
    description="Cryptocurrency prices, DeFi, blockchain events",
    keywords=["crypto", "blockchain", "defi", "web3", "token",
              "mining", "halving", "staking", "dao"],
    tags=[
        Tag("Bitcoin", ["bitcoin", "btc", "btcusdt", "satoshi",
                        "bitcoin etf", "btc price"],
            "Bitcoin price and ecosystem"),
        Tag("Ethereum", ["ethereum", "ethusdt",
                         "eth price", "ethereum etf"],
            "Ethereum price and ecosystem"),
        Tag("Altcoins", ["solana", "cardano", "polkadot",
                         "avalanche", "avax", "chainlink",
                         "polygon", "matic", "ripple", "xrp",
                         "dogecoin", "doge", "shiba", "memecoin",
                         "meme coin", "litecoin", "altcoin"],
            "Alternative cryptocurrencies"),
        Tag("DeFi", ["defi", "liquidity pool",
                     "uniswap", "aave", "compound finance",
                     "lending protocol", "borrowing protocol"],
            "Decentralised finance protocols"),
        Tag("NFT", ["nft", "non-fungible", "opensea", "bored ape",
                    "cryptopunks", "digital art", "metaverse"],
            "Non-fungible tokens and digital collectibles"),
        Tag("Stablecoins", ["stablecoin", "usdt", "usdc",
                            "tether", "depeg"],
            "Stablecoins and pegging events"),
    ],
))

# ---- Economy & Finance -----------------------------------------------------
_register(EventType(
    name="Economy",
    description="Macroeconomics, markets, commodities, and corporate events",
    keywords=["economy", "economic", "gdp", "inflation", "recession",
              "unemployment", "jobs report", "cpi", "ppi", "fomc"],
    tags=[
        Tag("Stock Market", ["s&p 500", "sp500", "nasdaq", "dow jones",
                             "stock market", "market cap", "stock price",
                             "nyse", "bull market", "bear market"],
            "Stock indices and equities"),
        Tag("Companies", ["microsoft", "nvidia", "tesla", "openai",
                          "largest company", "market capitalization"],
            "Public companies and corporate events"),
        Tag("Commodities", ["crude oil", "natural gas",
                            "commodity", "opec", "brent crude"],
            "Commodities and raw materials"),
        Tag("Interest Rates", ["interest rate", "fed rate", "rate cut",
                               "rate hike", "fomc", "central bank",
                               "ecb", "boj", "bank of england"],
            "Monetary policy and interest rates"),
    ],
))

# ---- Science & Technology --------------------------------------------------
_register(EventType(
    name="Science & Tech",
    description="Scientific discoveries, space, AI, and technology milestones",
    keywords=["science", "technology", "research", "discovery",
              "breakthrough", "innovation"],
    tags=[
        Tag("AI", ["artificial intelligence", "ai model", "chatgpt",
                   "gpt-5", "gpt5", "llm", "machine learning",
                   "deepmind", "anthropic", "openai", "agi",
                   "ai regulation", "ai safety"],
            "Artificial intelligence milestones"),
        Tag("Space", ["spacex", "nasa", "rocket launch",
                      "starship", "satellite", "asteroid", "orbit",
                      "space station", "space exploration"],
            "Space exploration and launches"),
        Tag("Climate", ["climate", "hottest on record",
                        "global warming", "carbon emission",
                        "hurricane", "wildfire", "drought",
                        "el nino", "la nina"],
            "Climate and weather events"),
        Tag("Health", ["vaccine", "pandemic", "fda approval",
                       "clinical trial", "virus outbreak", "outbreak",
                       "disease", "covid", "bird flu", "mpox"],
            "Public health and medical breakthroughs"),
    ],
))

# ---- Entertainment & Culture -----------------------------------------------
_register(EventType(
    name="Entertainment",
    description="Movies, music, TV, awards, and pop culture",
    keywords=["entertainment", "celebrity", "pop culture"],
    tags=[
        Tag("Awards", ["oscar", "grammy", "emmy", "golden globe",
                       "academy award", "tony award", "bafta",
                       "best picture", "best actor"],
            "Entertainment award shows"),
        Tag("Movies & TV", ["box office", "movie", "film",
                            "streaming", "netflix", "disney+",
                            "hbo", "tv show", "series finale"],
            "Film and television"),
        Tag("Music", ["album", "billboard", "concert", "tour",
                      "spotify", "grammy", "single", "number one"],
            "Music industry"),
        Tag("Social Media", ["twitter", "tiktok", "instagram",
                             "followers", "influencer", "youtube"],
            "Social media events and milestones"),
    ],
))

# ---- Miscellaneous ---------------------------------------------------------
_register(EventType(
    name="Miscellaneous",
    description="Events that do not fit neatly into other categories",
    keywords=[],
    tags=[
        Tag("Weather", ["weather", "storm", "tornado", "earthquake",
                        "tsunami", "snow", "blizzard", "heat wave"],
            "Weather events (non-climate policy)"),
        Tag("Legal", ["lawsuit", "trial", "verdict", "indictment",
                      "conviction", "settlement", "court ruling"],
            "Legal proceedings and court cases"),
        Tag("Demographics", ["population", "census", "birth rate",
                             "immigration", "migration"],
            "Population and demographic milestones"),
    ],
))


# ---------------------------------------------------------------------------
# Classification helpers
# ---------------------------------------------------------------------------

def classify_market(question: str,
                    description: str = "",
                    category_hint: str = "") -> Dict:
    """
    Auto-classify a market into event types and tags.

    Returns:
        {
            "event_types": ["Sports", ...],
            "tags": ["NBA", "Tennis", ...],
            "primary_type": "Sports",       # best single match
            "primary_tag": "NBA",            # best single tag
        }
    """
    combined = f"{question} {description} {category_hint}"

    matched_types: List[str] = []
    matched_tags: List[str] = []

    for et in EVENT_TYPES.values():
        tags_hit = et.matched_tags(combined)
        if tags_hit or et.matches(combined):
            matched_types.append(et.name)
            matched_tags.extend(tags_hit)

    # Deduplicate while preserving order
    seen_types: Set[str] = set()
    unique_types = []
    for t in matched_types:
        if t not in seen_types:
            unique_types.append(t)
            seen_types.add(t)

    seen_tags: Set[str] = set()
    unique_tags = []
    for t in matched_tags:
        if t not in seen_tags:
            unique_tags.append(t)
            seen_tags.add(t)

    return {
        "event_types": unique_types,
        "tags": unique_tags,
        "primary_type": unique_types[0] if unique_types else "Uncategorized",
        "primary_tag": unique_tags[0] if unique_tags else None,
    }


def search_tags(query: str) -> List[Dict]:
    """
    Search the tag library for tags matching a query string.

    Returns a list of dicts:
        [{"event_type": "Sports", "tag": "NBA", "description": "..."}]
    """
    query_lower = query.lower()
    results = []
    for et in EVENT_TYPES.values():
        for tag in et.tags:
            if (query_lower in tag.name.lower()
                    or query_lower in tag.description.lower()
                    or any(query_lower in kw for kw in tag.keywords)):
                results.append({
                    "event_type": et.name,
                    "tag": tag.name,
                    "description": tag.description,
                })
    return results


def list_all_tags() -> List[Dict]:
    """Return every tag in the library grouped by event type."""
    result = []
    for et in EVENT_TYPES.values():
        for tag in et.tags:
            result.append({
                "event_type": et.name,
                "tag": tag.name,
                "description": tag.description,
                "keywords_count": len(tag.keywords),
            })
    return result


def list_event_types() -> List[Dict]:
    """Return summary of all event types."""
    return [
        {
            "name": et.name,
            "description": et.description,
            "tag_count": len(et.tags),
            "tags": [t.name for t in et.tags],
        }
        for et in EVENT_TYPES.values()
    ]
