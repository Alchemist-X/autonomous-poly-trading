// Market Impact Engine — data model for the demo console.
//
// A To-C forecasting surface (sibling to the /research "Forecasting Engine"):
// given a catalyst event, it forecasts the impact on each tracked US-listed
// stock across three horizons — short (today), mid (~3 months), long (1+ year) —
// each as a decision-first call (direction + confidence + magnitude + thesis),
// backed by a shared, weighted evidence pool. Illustrative, not financial advice.
//
// Localized fields are kept as flat `_en` / `_zh` pairs to mirror the generated
// JSON exactly (no transform step); use `pick(locale, en, zh)` to read them.

export type Locale = "en" | "zh";
export type Direction = "up" | "down" | "neutral";
export type HorizonId = "short" | "mid" | "long";
export type Stance = "support" | "oppose" | "mixed";

export interface EvidenceCard {
  readonly id: string;
  readonly sourceType: string; // news | analyst | filing | market-data | fundamental | precedent
  readonly title_en: string;
  readonly title_zh: string;
  readonly date: string;
  readonly stance: Stance; // support = bullish for the ticker, oppose = bearish, mixed
  readonly weightPct: number;
  readonly reliability: number; // 0-1
  readonly excerpt_en: string;
  readonly excerpt_zh: string;
  readonly url?: string;
}

export interface Driver {
  readonly en: string;
  readonly zh: string;
}

export interface HorizonForecast {
  readonly horizon: HorizonId;
  readonly direction: Direction;
  readonly confidence: number; // 0-1: probability the move is in `direction`
  readonly magnitude_en: string;
  readonly magnitude_zh: string;
  readonly thesis_en: string;
  readonly thesis_zh: string;
  readonly drivers: readonly Driver[];
  readonly evidenceIds: readonly string[];
}

export interface TickerForecast {
  readonly ticker: string;
  readonly name_en: string;
  readonly name_zh: string;
  readonly verdict_en: string;
  readonly verdict_zh: string;
  readonly horizons: readonly HorizonForecast[];
}

export interface Stage {
  readonly id: string;
  readonly title_en: string;
  readonly title_zh: string;
  readonly summary_en: string;
  readonly summary_zh: string;
}

export interface MarketImpactRun {
  readonly id: string;
  readonly eventDate: string;
  readonly event_en: string;
  readonly event_zh: string;
  readonly summary_en: string;
  readonly summary_zh: string;
  readonly disclaimer_en: string;
  readonly disclaimer_zh: string;
  readonly stages: readonly Stage[];
  readonly evidence: readonly EvidenceCard[];
  readonly tickers: readonly TickerForecast[];
}

export function pick(locale: Locale, en: string, zh: string): string {
  return locale === "zh" ? zh : en;
}
