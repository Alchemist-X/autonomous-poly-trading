// Stock-universe access. The universe is an operator-maintained JSON file
// (config/stock-universe.json) so the list can be edited without a deploy of
// analyzer logic. Loaded once per process; immutable to callers.

import universeJson from "../../config/stock-universe.json";

export interface UniverseStock {
  ticker: string;
  company: string;
  companyZh?: string;
  sector: string;
  tags: readonly string[];
  aliases: readonly string[];
  beta: number;
}

export interface StockUniverse {
  version: string;
  stocks: readonly UniverseStock[];
}

const universe: StockUniverse = Object.freeze({
  version: universeJson.version,
  stocks: universeJson.stocks as readonly UniverseStock[]
});

export function getUniverse(): StockUniverse {
  return universe;
}

export function findStock(ticker: string): UniverseStock | null {
  const wanted = ticker.trim().toUpperCase();
  return universe.stocks.find((stock) => stock.ticker === wanted) ?? null;
}

// Compact, prompt-friendly table of the universe (one line per stock) so the
// model anchors its picks on maintained names instead of hallucinating tickers.
export function universePromptTable(): string {
  return universe.stocks
    .map(
      (stock) =>
        `${stock.ticker} — ${stock.company}${stock.companyZh ? ` (${stock.companyZh})` : ""} · ${stock.sector} · tags: ${stock.tags.join(",")}`
    )
    .join("\n");
}
