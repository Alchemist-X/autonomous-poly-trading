import { loadConfig } from "../config.js";
import { executeMarketOrder, getClobClient, readBook, type BookSnapshot } from "../lib/polymarket.js";

interface CandidateMarket {
  eventSlug: string;
  eventTitle: string;
  marketSlug: string;
  question: string;
  tokenYes: string;
  tokenNo: string;
  priceYes: number;
  priceNo: number;
  liquidity: number;
  bestBid?: number;
  bestAsk?: number;
  restricted?: boolean;
}

interface CandidatePick {
  label: "YES" | "NO";
  tokenId: string;
  price: number;
  book: BookSnapshot;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const has = (flag: string) => args.includes(flag);
  const get = (flag: string, fallback: string): string => {
    const index = args.indexOf(flag);
    const value = index >= 0 ? args[index + 1] : undefined;
    return value ? value : fallback;
  };

  return {
    shouldTrade: has("--trade"),
    maxUsd: Math.min(1, Number(get("--max-usd", "1"))),
    direction: get("--direction", "auto").toLowerCase() as "auto" | "yes" | "no",
    slug: get("--slug", "")
  };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseNumberArray(value: unknown): number[] {
  return parseStringArray(value).map((entry) => Number(entry));
}

function parseNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isReasonableBook(book: BookSnapshot | null, referencePrice: number): book is BookSnapshot {
  if (!book) {
    return false;
  }
  const spread = book.bestAsk - book.bestBid;
  const midpoint = (book.bestAsk + book.bestBid) / 2;
  return (
    book.bestBid > 0.03 &&
    book.bestAsk < 0.97 &&
    spread > 0 &&
    spread <= 0.2 &&
    Math.abs(midpoint - referencePrice) <= 0.25
  );
}

async function chooseTradeablePick(
  config: ReturnType<typeof loadConfig>,
  candidate: CandidateMarket,
  direction: "auto" | "yes" | "no"
): Promise<CandidatePick | null> {
  const yesBook = await readBook(config, candidate.tokenYes);
  const noBook = await readBook(config, candidate.tokenNo);

  const yesOption = isReasonableBook(yesBook, candidate.priceYes)
    ? { label: "YES" as const, tokenId: candidate.tokenYes, price: candidate.priceYes, book: yesBook }
    : null;
  const noOption = isReasonableBook(noBook, candidate.priceNo)
    ? { label: "NO" as const, tokenId: candidate.tokenNo, price: candidate.priceNo, book: noBook }
    : null;

  if (direction === "yes") {
    return yesOption;
  }
  if (direction === "no") {
    return noOption;
  }

  if (yesOption && noOption) {
    return yesOption.book.bestAsk - yesOption.book.bestBid <= noOption.book.bestAsk - noOption.book.bestBid
      ? yesOption
      : noOption;
  }

  return yesOption ?? noOption;
}

async function resolveEventSlug(slug: string): Promise<CandidateMarket | null> {
  const response = await fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`);
  if (!response.ok) {
    throw new Error(`Failed to resolve event slug "${slug}": ${response.status}`);
  }
  const event = await response.json() as Record<string, unknown>;
  const markets = Array.isArray(event.markets) ? event.markets as Array<Record<string, unknown>> : [];

  for (const market of markets) {
    const tokenIds = parseStringArray(market.clobTokenIds);
    const prices = parseNumberArray(market.outcomePrices);
    if (
      market.active === true &&
      market.closed === false &&
      tokenIds.length >= 2 &&
      prices.length >= 2 &&
      prices[0]! > 0.03 &&
      prices[0]! < 0.97 &&
      prices[1]! > 0.03 &&
      prices[1]! < 0.97
    ) {
      return {
        eventSlug: String(event.slug ?? slug),
        eventTitle: String(event.title ?? slug),
        marketSlug: String(market.slug ?? slug),
        question: String(market.question ?? slug),
        tokenYes: tokenIds[0]!,
        tokenNo: tokenIds[1]!,
        priceYes: prices[0]!,
        priceNo: prices[1]!,
        liquidity: Number(market.liquidity ?? event.liquidity ?? 0),
        bestBid: parseNumber(market.bestBid),
        bestAsk: parseNumber(market.bestAsk),
        restricted: market.restricted === true
      };
    }
  }

  return null;
}

async function resolveMarketSlug(slug: string): Promise<CandidateMarket | null> {
  const response = await fetch(`https://gamma-api.polymarket.com/markets?slug=${slug}`);
  if (!response.ok) {
    throw new Error(`Failed to resolve market slug "${slug}": ${response.status}`);
  }
  const markets = await response.json() as Array<Record<string, unknown>>;
  const market = markets[0];
  if (!market) {
    return null;
  }
  const tokenIds = parseStringArray(market.clobTokenIds);
  const prices = parseNumberArray(market.outcomePrices);
  const events = Array.isArray(market.events) ? market.events as Array<Record<string, unknown>> : [];
  const event = events[0] ?? {};
  if (
    market.active !== true ||
    market.closed === true ||
    tokenIds.length < 2 ||
    prices.length < 2
  ) {
    return null;
  }
  return {
    eventSlug: String(event.slug ?? slug),
    eventTitle: String(event.title ?? market.question ?? slug),
    marketSlug: String(market.slug ?? slug),
    question: String(market.question ?? slug),
    tokenYes: tokenIds[0]!,
    tokenNo: tokenIds[1]!,
    priceYes: prices[0]!,
    priceNo: prices[1]!,
    liquidity: parseNumber(market.liquidity),
    bestBid: parseNumber(market.bestBid),
    bestAsk: parseNumber(market.bestAsk),
    restricted: market.restricted === true
  };
}

async function fetchTopCandidate(config: ReturnType<typeof loadConfig>, direction: "auto" | "yes" | "no"): Promise<{
  candidate: CandidateMarket;
  pick: CandidatePick;
}> {
  const response = await fetch("https://gamma-api.polymarket.com/markets?limit=100&active=true&closed=false&order=liquidity&ascending=false");
  if (!response.ok) {
    throw new Error(`Gamma API failed: ${response.status}`);
  }
  const markets = await response.json() as Array<Record<string, unknown>>;

  for (const market of markets) {
    const marketSlug = String(market.slug ?? "");
    const tokenIds = parseStringArray(market.clobTokenIds);
    const prices = parseNumberArray(market.outcomePrices);
    const bestBid = parseNumber(market.bestBid);
    const bestAsk = parseNumber(market.bestAsk);
    const spread = parseNumber(market.spread, bestAsk - bestBid);
    if (
      !marketSlug ||
      market.active !== true ||
      market.closed === true ||
      tokenIds.length < 2 ||
      prices.length < 2 ||
      bestBid < 0.05 ||
      bestAsk > 0.95 ||
      spread <= 0 ||
      spread > 0.08
    ) {
      continue;
    }
    const events = Array.isArray(market.events) ? market.events as Array<Record<string, unknown>> : [];
    const event = events[0] ?? {};
    const candidate: CandidateMarket = {
      eventSlug: String(event.slug ?? marketSlug),
      eventTitle: String(event.title ?? market.question ?? marketSlug),
      marketSlug,
      question: String(market.question ?? marketSlug),
      tokenYes: tokenIds[0]!,
      tokenNo: tokenIds[1]!,
      priceYes: prices[0]!,
      priceNo: prices[1]!,
      liquidity: parseNumber(market.liquidity),
      bestBid,
      bestAsk,
      restricted: market.restricted === true
    };
    const pick = await chooseTradeablePick(config, candidate, direction);
    if (pick) {
      return { candidate, pick };
    }
  }

  throw new Error("No liquid binary market candidate found.");
}

async function main() {
  const args = parseArgs();
  const config = loadConfig();
  const client = await getClobClient(config);

  if (!client) {
    throw new Error("No live Polymarket client available. Check env file discovery.");
  }

  const balance = await (client as any).getBalanceAllowance({ asset_type: "COLLATERAL" });
  const usdcBalance = Number((balance as any)?.balance ?? 0) / 1e6;
  const resolved = args.slug
    ? await (async () => {
        const candidate = await resolveMarketSlug(args.slug) ?? await resolveEventSlug(args.slug);
        if (!candidate) {
          return null;
        }
        const pick = await chooseTradeablePick(config, candidate, args.direction);
        return pick ? { candidate, pick } : null;
      })()
    : await fetchTopCandidate(config, args.direction);

  if (!resolved) {
    throw new Error("Candidate market not found or order book is not tradeable.");
  }

  const { candidate, pick } = resolved;

  console.log(JSON.stringify({
    envFilePath: config.envFilePath,
    funderAddressPreview: `${config.funderAddress.slice(0, 6)}***${config.funderAddress.slice(-4)}`,
    usdcBalance,
    candidate: {
      eventSlug: candidate.eventSlug,
      eventTitle: candidate.eventTitle,
      marketSlug: candidate.marketSlug,
      question: candidate.question,
      liquidity: candidate.liquidity,
      priceYes: candidate.priceYes,
      priceNo: candidate.priceNo,
      bestBid: candidate.bestBid,
      bestAsk: candidate.bestAsk,
      restricted: candidate.restricted
    },
    chosenDirection: pick.label,
    tokenIdPreview: `${pick.tokenId.slice(0, 10)}...`,
    orderBook: pick.book
  }, null, 2));

  if (!args.shouldTrade) {
    return;
  }

  if (!(args.maxUsd > 0 && args.maxUsd <= 1)) {
    throw new Error(`--max-usd must be > 0 and <= 1. Received ${args.maxUsd}`);
  }

  console.log(`Submitting live BUY for ${pick.label} with max ${args.maxUsd} USDC on ${candidate.marketSlug}`);
  const result = await executeMarketOrder(config, {
    tokenId: pick.tokenId,
    side: "BUY",
    amount: args.maxUsd
  });

  console.log(JSON.stringify({
    ok: result.ok,
    orderId: result.orderId,
    avgPrice: result.avgPrice,
    filledNotionalUsd: result.filledNotionalUsd,
    rawResponse: result.rawResponse
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
