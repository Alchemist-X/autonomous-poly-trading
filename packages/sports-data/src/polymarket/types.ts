// Normalized Polymarket World Cup market model + cache/snapshot/index types.
// Gamma returns clobTokenIds / outcomes / outcomePrices as JSON-encoded STRINGS;
// the normaliser parses them into real arrays. clobTokenIds are the asset_ids
// the CLOB WebSocket subscribes on.

export type WcCategory = "match" | "group_ko" | "champion" | "award" | "player" | "special";

export interface WcMarket {
  readonly id: string; // Gamma market id
  readonly conditionId: string; // on-chain CTF condition id
  readonly questionId: string; // CTF question id (questionID)
  readonly question: string;
  readonly marketSlug: string;
  readonly eventSlug: string;
  readonly eventTitle: string;
  readonly category: WcCategory;
  readonly subtype: string; // e.g. moneyline_1x2, total_goals, tournament_winner, golden_boot
  readonly groupItem: string | null; // groupItemTitle (team/player this leg refers to)
  readonly outcomes: readonly string[];
  readonly outcomePrices: readonly number[];
  readonly clobTokenIds: readonly string[]; // asset_ids for WS subscription
  readonly negRisk: boolean;
  readonly negRiskMarketId: string | null;
  readonly enableOrderBook: boolean;
  readonly acceptingOrders: boolean;
  readonly active: boolean;
  readonly closed: boolean;
  readonly archived: boolean;
  readonly bestBid: number | null;
  readonly bestAsk: number | null;
  readonly lastTradePrice: number | null;
  readonly spread: number | null;
  readonly oneDayPriceChange: number | null;
  readonly liquidity: number;
  readonly volume: number;
  readonly volume24hr: number;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly url: string;
  readonly tagIds: readonly number[];
  readonly updatedAt: string | null;
}

export interface MarketSnapshot {
  readonly generatedAt: string;
  readonly source: { readonly gammaTagIds: readonly number[]; readonly endpoint: string };
  readonly counts: {
    readonly total: number;
    readonly active: number;
    readonly closed: number;
    readonly byCategory: Record<string, number>;
    readonly bySubtype: Record<string, number>;
  };
  readonly markets: readonly WcMarket[];
}

export interface TokenRef {
  readonly marketId: string;
  readonly conditionId: string;
  readonly marketSlug: string;
  readonly outcome: string;
  readonly outcomeIndex: number;
}

export interface MarketIndex {
  readonly generatedAt: string;
  readonly byEventSlug: Record<string, string[]>; // event_slug -> market ids
  readonly byConditionId: Record<string, string>; // conditionId -> market id
  readonly byMarketSlug: Record<string, string>; // market slug -> market id
  readonly byTokenId: Record<string, TokenRef>; // clob asset_id -> token ref
}

export interface SnapshotDiff {
  readonly added: readonly WcMarket[];
  readonly removed: readonly { id: string; question: string }[];
  readonly statusChanged: readonly { id: string; question: string; from: string; to: string }[];
  readonly priceChanged: readonly {
    id: string;
    question: string;
    oldPrices: readonly number[];
    newPrices: readonly number[];
    maxDelta: number;
  }[];
  readonly summary: {
    addedCount: number;
    removedCount: number;
    statusChangedCount: number;
    priceChangedCount: number;
    unchanged: number;
  };
}
