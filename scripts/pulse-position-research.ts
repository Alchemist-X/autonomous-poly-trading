import type { PublicPosition } from "@autopoly/contracts";
import type { loadConfig as loadExecutorConfig } from "../services/executor/src/config.ts";
import {
  fetchEventBySlug,
  fetchMarketBySlug,
  type BookSnapshot
} from "../services/executor/src/lib/polymarket.ts";
import { buildPositionResearchSnapshot } from "../services/orchestrator/src/review/position-research.ts";
import type { PositionResearchSnapshot } from "../services/orchestrator/src/runtime/decision-metadata.ts";

type ExecutorConfig = ReturnType<typeof loadExecutorConfig>;

function toPlanningBook(book: BookSnapshot | null) {
  if (!book) {
    return null;
  }
  return {
    bestBid: book.bestBid ?? null,
    bestAsk: book.bestAsk ?? null,
    minOrderSize: book.minOrderSize ?? null,
    asks: book.asks,
    bids: book.bids
  };
}

export async function buildPulsePositionResearchSnapshots(input: {
  executorConfig: ExecutorConfig;
  positions: PublicPosition[];
  readBook: (tokenId: string) => Promise<BookSnapshot | null>;
}): Promise<PositionResearchSnapshot[]> {
  const fetchedAtUtc = new Date().toISOString();
  return await Promise.all(input.positions.map(async (position) => {
    const [book, eventRecord, marketRecords] = await Promise.all([
      input.readBook(position.token_id).catch(() => null),
      fetchEventBySlug(input.executorConfig, position.event_slug).catch(() => null),
      fetchMarketBySlug(input.executorConfig, position.market_slug).catch(() => [])
    ]);

    return buildPositionResearchSnapshot({
      position,
      book: toPlanningBook(book),
      eventRecord,
      marketRecords,
      fetchedAtUtc
    });
  }));
}
