// Taker-fee model — mirror of services/orchestrator/src/lib/fees.ts (static
// path, calibrated 2026-03-30):
//   fee_usdc = shares * price * feeRate * (price * (1 - price))^exponent
// Category comes from Gamma metadata; neg-risk markets trade fee-free.
// Duplicated here (like the run-manager/repo mirrors) so the paper agent has
// zero workspace build dependencies.

export interface FeeParams {
  feeRate: number;
  exponent: number;
}

const CATEGORY_FEE_PARAMS: Readonly<Record<string, FeeParams>> = {
  other: { feeRate: 0.04, exponent: 1 },
  sports: { feeRate: 0.03, exponent: 1 },
  tech: { feeRate: 0.04, exponent: 1 },
  politics: { feeRate: 0.04, exponent: 1 },
  finance: { feeRate: 0.04, exponent: 1 },
  economics: { feeRate: 0.03, exponent: 0.5 },
  crypto: { feeRate: 0.072, exponent: 1 },
  culture: { feeRate: 0.05, exponent: 1 },
  weather: { feeRate: 0.025, exponent: 0.5 },
  mentions: { feeRate: 0.05, exponent: 1 },
  geopolitics: { feeRate: 0.04, exponent: 1 }
};

const ALIASES: ReadonlyArray<{ pattern: string; canonical: string }> = [
  { pattern: "politic", canonical: "politics" },
  { pattern: "trump", canonical: "politics" },
  { pattern: "election", canonical: "politics" },
  { pattern: "sport", canonical: "sports" },
  { pattern: "nba", canonical: "sports" },
  { pattern: "nfl", canonical: "sports" },
  { pattern: "soccer", canonical: "sports" },
  { pattern: "football", canonical: "sports" },
  { pattern: "crypto", canonical: "crypto" },
  { pattern: "bitcoin", canonical: "crypto" },
  { pattern: "ethereum", canonical: "crypto" },
  { pattern: "tech", canonical: "tech" },
  { pattern: "ai", canonical: "tech" },
  { pattern: "finance", canonical: "finance" },
  { pattern: "stock", canonical: "finance" },
  { pattern: "econ", canonical: "economics" },
  { pattern: "fed", canonical: "economics" },
  { pattern: "inflation", canonical: "economics" },
  { pattern: "weather", canonical: "weather" },
  { pattern: "climate", canonical: "weather" },
  { pattern: "culture", canonical: "culture" },
  { pattern: "entertain", canonical: "culture" },
  { pattern: "movie", canonical: "culture" },
  { pattern: "music", canonical: "culture" },
  { pattern: "mention", canonical: "mentions" },
  { pattern: "geopolitic", canonical: "geopolitics" },
  { pattern: "war", canonical: "geopolitics" }
];

export function feeParamsFor(category: string, negRisk: boolean): FeeParams {
  if (negRisk) return { feeRate: 0, exponent: 0 };
  const slug = category.trim().toLowerCase();
  if (slug && CATEGORY_FEE_PARAMS[slug]) return CATEGORY_FEE_PARAMS[slug];
  for (const alias of ALIASES) {
    if (slug.includes(alias.pattern)) return CATEGORY_FEE_PARAMS[alias.canonical] ?? CATEGORY_FEE_PARAMS.other!;
  }
  return CATEGORY_FEE_PARAMS.other!;
}

export function takerFeeUsd(shares: number, price: number, params: FeeParams): number {
  if (shares <= 0 || price <= 0 || price >= 1) return 0;
  const variance = price * (1 - price);
  return shares * price * params.feeRate * Math.pow(variance, params.exponent);
}
