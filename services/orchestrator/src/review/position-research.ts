import type { PublicPosition } from "@autopoly/contracts";
import type { PlanningOrderBookSnapshot } from "../lib/execution-planning.js";
import type { PositionResearchSnapshot } from "../runtime/decision-metadata.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function readString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readBoolean(record: JsonRecord | null, keys: string[]): boolean | null {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return null;
}

function truncateText(value: string | null, maxChars: number): string | null {
  if (!value) {
    return null;
  }
  return value.length <= maxChars ? value : `${value.slice(0, maxChars - 3)}...`;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  const trimmed = value.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return normalizeStringArray(parsed);
  } catch {
    return trimmed
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
}

function normalizeNumberArray(value: unknown): number[] {
  return normalizeStringArray(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function findMatchingMarketRecord(
  position: PublicPosition,
  eventRecord: JsonRecord | null,
  marketRecords: JsonRecord[]
): JsonRecord | null {
  const eventMarkets = Array.isArray(eventRecord?.markets)
    ? eventRecord.markets
        .map((item) => asRecord(item))
        .filter((item): item is JsonRecord => item != null)
    : [];
  const candidates = [...marketRecords, ...eventMarkets];
  const matching = candidates.find((record) =>
    readString(record, ["slug", "market_slug", "marketSlug"]) === position.market_slug
  );
  if (matching) {
    return matching;
  }
  if (candidates.length === 1) {
    return candidates[0]!;
  }
  return candidates.find((record) => !readString(record, ["slug", "market_slug", "marketSlug"])) ?? null;
}

function resolveRulesDescription(eventRecord: JsonRecord | null, marketRecord: JsonRecord | null): string | null {
  const direct = readString(marketRecord, ["description", "rules", "resolutionRules", "resolution_rules"])
    ?? readString(eventRecord, ["description", "rules", "resolutionRules", "resolution_rules"]);
  const nestedMarket = asRecord(marketRecord?.rules);
  const nestedEvent = asRecord(eventRecord?.rules);
  return direct
    ?? readString(nestedMarket, ["description", "text"])
    ?? readString(nestedEvent, ["description", "text"]);
}

function resolveResolutionSource(eventRecord: JsonRecord | null, marketRecord: JsonRecord | null): string | null {
  const nestedMarket = asRecord(marketRecord?.rules);
  const nestedEvent = asRecord(eventRecord?.rules);
  return readString(marketRecord, ["resolutionSource", "resolution_source"])
    ?? readString(eventRecord, ["resolutionSource", "resolution_source"])
    ?? readString(nestedMarket, ["resolutionSource", "resolution_source"])
    ?? readString(nestedEvent, ["resolutionSource", "resolution_source"]);
}

function resolveEndDate(eventRecord: JsonRecord | null, marketRecord: JsonRecord | null): string | null {
  return readString(marketRecord, ["endDate", "end_date", "endDateIso"])
    ?? readString(eventRecord, ["endDate", "end_date", "endDateIso"]);
}

function resolveMatchedOutcomePrice(position: PublicPosition, marketRecord: JsonRecord | null): number | null {
  const outcomes = normalizeStringArray(marketRecord?.outcomes);
  const prices = normalizeNumberArray(marketRecord?.outcomePrices ?? marketRecord?.outcome_prices);
  const index = outcomes.findIndex((outcome) => outcome.toLowerCase() === position.outcome_label.toLowerCase());
  const price = index >= 0 ? prices[index] : null;
  return price != null && Number.isFinite(price) ? price : null;
}

function describeStatus(status: PositionResearchSnapshot["marketStatus"]): string | null {
  if (!status || (status.active == null && status.closed == null && status.archived == null)) {
    return null;
  }
  return [
    `active=${status.active == null ? "-" : String(status.active)}`,
    `closed=${status.closed == null ? "-" : String(status.closed)}`,
    `archived=${status.archived == null ? "-" : String(status.archived)}`
  ].join(" ");
}

export function buildPositionResearchSnapshot(input: {
  position: PublicPosition;
  book: PlanningOrderBookSnapshot | null;
  eventRecord?: Record<string, unknown> | null;
  marketRecords?: Array<Record<string, unknown>>;
  fetchedAtUtc?: string;
}): PositionResearchSnapshot {
  const fetchedAtUtc = input.fetchedAtUtc ?? new Date().toISOString();
  const eventRecord = asRecord(input.eventRecord);
  const marketRecords = (input.marketRecords ?? [])
    .map((record) => asRecord(record))
    .filter((record): record is JsonRecord => record != null);
  const marketRecord = findMatchingMarketRecord(input.position, eventRecord, marketRecords);
  const rulesDescription = truncateText(resolveRulesDescription(eventRecord, marketRecord), 700);
  const resolutionSource = resolveResolutionSource(eventRecord, marketRecord);
  const endDate = resolveEndDate(eventRecord, marketRecord);
  const matchedOutcomePrice = resolveMatchedOutcomePrice(input.position, marketRecord);
  const marketStatus = {
    active: readBoolean(marketRecord, ["active"]) ?? readBoolean(eventRecord, ["active"]),
    closed: readBoolean(marketRecord, ["closed"]) ?? readBoolean(eventRecord, ["closed"]),
    archived: readBoolean(marketRecord, ["archived"]) ?? readBoolean(eventRecord, ["archived"])
  };
  const statusLine = describeStatus(marketStatus);
  const orderbook = input.book
    ? {
        bestBid: input.book.bestBid ?? null,
        bestAsk: input.book.bestAsk ?? null,
        minOrderSize: input.book.minOrderSize ?? null
      }
    : null;
  const marketProb = orderbook?.bestBid ?? matchedOutcomePrice ?? input.position.current_price;
  const freshEvidence = [
    `Dedicated position research refreshed ${input.position.market_slug} / ${input.position.outcome_label}.`,
    statusLine ? `Gamma status: ${statusLine}.` : null,
    rulesDescription ? `Resolution rule snapshot: ${rulesDescription}` : null,
    resolutionSource ? `Resolution source: ${resolutionSource}.` : null,
    endDate ? `Market end date: ${endDate}.` : null,
    orderbook
      ? `Orderbook snapshot for held token: best bid ${orderbook.bestBid ?? "-"}, best ask ${orderbook.bestAsk ?? "-"}, min size ${orderbook.minOrderSize ?? "-"}.`
      : null,
    matchedOutcomePrice != null ? `Gamma outcome price for held side: ${matchedOutcomePrice.toFixed(4)}.` : null
  ].filter((line): line is string => Boolean(line));
  const unresolvedData = [
    eventRecord ? null : "Gamma event payload unavailable",
    marketRecord ? null : "Gamma market payload unavailable",
    rulesDescription ? null : "Resolution rule text unavailable",
    orderbook ? null : "Held-token orderbook unavailable"
  ].filter((line): line is string => Boolean(line));
  const adverseSignals = [
    marketStatus.closed === true ? "Gamma marks this market as closed." : null,
    marketStatus.archived === true ? "Gamma marks this market as archived." : null,
    marketStatus.active === false && marketStatus.closed !== true ? "Gamma marks this market as inactive." : null
  ].filter((line): line is string => Boolean(line));

  return {
    positionId: input.position.id,
    eventSlug: input.position.event_slug,
    marketSlug: input.position.market_slug,
    tokenId: input.position.token_id,
    outcomeLabel: input.position.outcome_label,
    fetchedAtUtc,
    marketProb,
    orderbook,
    rules: {
      description: rulesDescription,
      resolutionSource,
      endDate
    },
    marketStatus,
    freshEvidence,
    adverseSignals,
    unresolvedData,
    sources: [
      {
        title: "Polymarket event",
        url: `https://polymarket.com/event/${input.position.event_slug}`,
        retrieved_at_utc: fetchedAtUtc
      }
    ]
  };
}
