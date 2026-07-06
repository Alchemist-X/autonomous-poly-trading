// Market-blind mode (opt-in via FORECAST_MARKET_BLIND=1).
//
// The paper agent's whole edge computation assumes the engine's probability is
// INDEPENDENT of the market it will be compared against. Review 2026-07-06
// found the engine searching for the live Polymarket price of the very market
// it was forecasting and adopting it as the prior — making the "edge" partly
// circular. This module supplies:
//   - a prompt directive banning prediction-market prices as prior or evidence
//   - a domain blocklist applied at evidence intake (deterministic — no
//     keyword false-positives on legitimate financial questions)
//   - a soft keyword pattern that FLAGS (never rejects) market-price wording
//     in free text such as the framing prior rationale
// Same principle as the world-cup stripPrices rule: market pages may be used
// for event STRUCTURE and resolution rules, never for prices.
//
// Default OFF so the raven app / forecast API (where users may legitimately
// ask about market prices) are unaffected.

export function marketBlind(): boolean {
  return process.env.FORECAST_MARKET_BLIND === "1";
}

// Hostnames whose content IS market pricing. Suffix-matched against the
// canonical URL's host so subdomains are covered.
export const MARKET_DOMAIN_BLOCKLIST = [
  "polymarket.com",
  "kalshi.com",
  "manifold.markets",
  "metaculus.com",
  "predictit.org",
  "betfair.com",
  "smarkets.com",
  "oddschecker.com",
  "polymarketanalytics.com",
  "adjacentnews.com",
] as const;

export function isMarketPriceSource(url: string): boolean {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    const m = url.toLowerCase().match(/^(?:[a-z]+:\/\/)?([^/:?#]+)/);
    host = m?.[1] ?? "";
  }
  return MARKET_DOMAIN_BLOCKLIST.some((d) => host === d || host.endsWith(`.${d}`));
}

// Soft detector for market-price wording in free text (prior rationale,
// claims). Flag-only by design: "trading at" is legitimate in stock/financial
// questions, so a match must never reject an output on its own.
export const MARKET_PRICE_PATTERN =
  /\b(polymarket|kalshi|manifold|metaculus|predictit|betfair|smarkets|prediction[- ]market|betting odds|bookmaker|implied (?:probability|odds)|market (?:is |currently )?(?:pricing|trading|implies))\b/i;

export function mentionsMarketPricing(text: string): boolean {
  return MARKET_PRICE_PATTERN.test(text);
}

// Prompt directive injected into framing / audit / round prompts when the mode
// is on.
export function marketBlindDirective(): string {
  if (!marketBlind()) return "";
  return `
MARKET-BLIND RULE (hard constraint): Your estimate must be INDEPENDENT of prediction markets. Do NOT search for, cite, or use prediction-market prices, odds, or implied probabilities for this question or any equivalent/mirror question (Polymarket, Kalshi, Manifold, Metaculus, PredictIt, bookmakers, ...). News articles REPORTING such prices/odds/volumes are equally off-limits as evidence. You may consult a market page ONLY to pin down resolution rules or event structure — never the price. Base your prior on a reference class of comparable past events, and your updates on primary facts.
`;
}

// Machine-readable contamination record persisted on ForecastState.
export interface MarketBlindRecord {
  enabled: boolean;
  blockedCount: number; // evidence/reflection items zero-weighted by the domain blocklist
  priorSuspect: boolean; // prior rationale still matched market-price wording after re-audit
}
