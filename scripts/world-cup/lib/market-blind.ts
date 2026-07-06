// Market-blind policy (2026-06-11, user decision): cached snapshots must never
// store market prices — the prediction pipeline reads this cache and must stay
// unspoiled. Structure/slugs/conditionIds are kept; price fields are nulled.
//
// SINGLE enforcement point. cache-markets.ts and check-updates.ts had verbatim
// copies of this (Stage 2 dedup, 2026-07-03); the blind-test red line must not
// have two copies that can drift apart.
export function stripPrices<T extends { markets: readonly unknown[] }>(snapshot: T): T {
  const PRICE_FIELDS = ["outcomePrices", "bestBid", "bestAsk", "lastTradePrice", "spread", "oneDayPriceChange"];
  const markets = (snapshot.markets as Record<string, unknown>[]).map((m) => ({
    ...m,
    ...Object.fromEntries(PRICE_FIELDS.map((f) => [f, null]))
  }));
  return { ...snapshot, markets, priceFieldsStripped: { fields: PRICE_FIELDS, reason: "market-blind forecasting" } } as unknown as T;
}
