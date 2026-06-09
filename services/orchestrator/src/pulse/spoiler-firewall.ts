// Independent-forecasting firewall ("no spoilers").
//
// The whole premise of the pipeline is to form a probability estimate that is INDEPENDENT of the
// market it is trying to beat, then compare to the market price only at stage 7 to find edge.
// If stages 1-6 ever see the market/odds price, the reasoning anchors to it and the independent
// signal is gone ("spoiled").
//
// Therefore prediction markets, sportsbooks, and odds aggregators are blocked from query-plan
// generation (stage 2) and evidence collection (stage 3). The market price is fetched separately
// into a quarantined field and consumed ONLY at stage 7 (conclusion + edge) — it is never placed
// in any stage 1-6 LLM prompt. Polymarket resolution RULES (factual, not pricing) remain allowed
// for stage 1; the order book / current price never enters the reasoning evidence.

export const SPOILER_HOST_BLOCKLIST: readonly string[] = [
  // prediction markets / forecasting aggregators
  "polymarket.com", "kalshi.com", "predictit.org", "manifold.markets", "metaculus.com",
  "insightprediction.com", "futuur.com", "zeitgeist.pm", "augur.net", "gnosis.io",
  // sportsbooks / bookmakers
  "bet365.com", "williamhill.com", "draftkings.com", "fanduel.com", "betfair.com",
  "pinnacle.com", "bovada.lv", "betmgm.com", "caesars.com", "unibet.com", "888sport.com",
  "ladbrokes.com", "paddypower.com", "bwin.com", "betway.com", "smarkets.com",
  // odds aggregators / tipsters
  "oddschecker.com", "oddsportal.com", "vegasinsider.com", "actionnetwork.com",
  "covers.com", "sportsbookreview.com", "oddsshark.com", "the-odds-api.com"
];

const BLOCKED_SET = new Set(SPOILER_HOST_BLOCKLIST);

const SPOILER_QUERY_TERMS: readonly string[] = [
  "polymarket", "kalshi", "predictit", "manifold markets", "metaculus",
  "betting odds", "sportsbook", "bookmaker", "vegas odds", "betting line", "implied odds"
];

/** Normalize a host or URL to a bare lowercase hostname (strips scheme, path, leading www.). */
export function normalizeHost(hostOrUrl: string): string {
  let host = hostOrUrl.trim().toLowerCase();
  if (!host) return "";
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname.toLowerCase();
    } catch {
      // best-effort: fall through with the raw string
    }
  } else if (host.includes("/")) {
    host = host.split("/")[0] ?? host;
  }
  return host.replace(/^www\./, "");
}

/** True for prediction-market / odds / sportsbook hosts that would spoil independent reasoning. */
export function isSpoilerSource(hostOrUrl: string): boolean {
  const host = normalizeHost(hostOrUrl);
  if (!host) return false;
  if (BLOCKED_SET.has(host)) return true;
  return SPOILER_HOST_BLOCKLIST.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

/** Drop spoiler sources from a collection keyed by sourceUrl/sourceHost (stage 3 guard). */
export function filterSpoilerSources<T extends { sourceUrl?: string; sourceHost?: string }>(records: readonly T[]): T[] {
  return records.filter((record) => !isSpoilerSource(record.sourceUrl ?? record.sourceHost ?? ""));
}

/** True if a search query explicitly names a market / odds source (stage 2 guard). */
export function queryMentionsSpoiler(query: string): boolean {
  const normalized = query.toLowerCase();
  return SPOILER_QUERY_TERMS.some((term) => normalized.includes(term));
}

/** Remove queries that would surface market / odds pricing; returns the cleaned list. */
export function stripSpoilerQueries(queries: readonly string[]): string[] {
  return queries.filter((query) => !queryMentionsSpoiler(query));
}
