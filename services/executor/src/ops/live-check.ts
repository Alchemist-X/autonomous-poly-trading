import { loadConfig } from "../config.js";
import {
  executeMarketOrder,
  fetchActiveMarkets,
  fetchEventBySlug,
  fetchMarketBySlug,
  getCollateralBalanceAllowance,
  readBook,
  type BookSnapshot
} from "../lib/polymarket.js";
import {
  createTerminalPrinter,
  formatUsd,
  getErrorMessage,
  printErrorSummary,
  shouldUseHumanOutput
} from "@autopoly/terminal-ui";

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
    json: has("--json"),
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

async function resolveEventSlug(config: ReturnType<typeof loadConfig>, slug: string): Promise<CandidateMarket | null> {
  const event = await fetchEventBySlug(config, slug);
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

async function resolveMarketSlug(config: ReturnType<typeof loadConfig>, slug: string): Promise<CandidateMarket | null> {
  const markets = await fetchMarketBySlug(config, slug);
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
  const markets = await fetchActiveMarkets(config, 100);

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
  const useHumanOutput = !args.json && shouldUseHumanOutput(process.stdout);
  const printer = createTerminalPrinter();
  const config = loadConfig();
  const balance = await getCollateralBalanceAllowance(config);
  if (!balance) {
    throw new Error("No live Polymarket client available. Check env file discovery.");
  }
  const usdcBalance = Number((balance as any)?.balance ?? 0) / 1e6;
  const resolved = args.slug
    ? await (async () => {
        const candidate = await resolveMarketSlug(config, args.slug) ?? await resolveEventSlug(config, args.slug);
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
  const snapshot = {
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
  };

  if (args.json) {
    if (!args.shouldTrade) {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }
  } else if (useHumanOutput) {
    printer.section(args.shouldTrade ? "Executor Live Trade" : "Executor Live Check");
    printer.table([
      ["Env File", config.envFilePath ?? "-"],
      ["Wallet", snapshot.funderAddressPreview],
      ["USDC Balance", formatUsd(snapshot.usdcBalance)],
      ["Market", candidate.marketSlug],
      ["Event", candidate.eventTitle],
      ["Direction", pick.label],
      ["Token", snapshot.tokenIdPreview]
    ]);
    printer.section("Market Snapshot");
    printer.table([
      ["Question", candidate.question],
      ["Liquidity", formatUsd(candidate.liquidity)],
      ["YES Price", candidate.priceYes.toFixed(4)],
      ["NO Price", candidate.priceNo.toFixed(4)],
      ["Best Bid", String(candidate.bestBid ?? "-")],
      ["Best Ask", String(candidate.bestAsk ?? "-")],
      ["Restricted", candidate.restricted === true ? "yes" : "no"]
    ]);
    printer.section("Order Book");
    printer.table([
      ["Best Bid", pick.book.bestBid.toFixed(4)],
      ["Best Ask", pick.book.bestAsk.toFixed(4)],
      ["Midpoint", (((pick.book.bestBid + pick.book.bestAsk) / 2)).toFixed(4)],
      ["Spread", (pick.book.bestAsk - pick.book.bestBid).toFixed(4)]
    ]);
  } else {
    console.log(JSON.stringify(snapshot, null, 2));
  }

  if (!args.shouldTrade) {
    return;
  }

  if (!(args.maxUsd > 0 && args.maxUsd <= 1)) {
    throw new Error(`--max-usd must be > 0 and <= 1. Received ${args.maxUsd}`);
  }

  if (useHumanOutput) {
    printer.note("warn", `Submitting live BUY for ${pick.label}`, `${args.maxUsd} USDC max on ${candidate.marketSlug}`);
  } else {
    console.log(`Submitting live BUY for ${pick.label} with max ${args.maxUsd} USDC on ${candidate.marketSlug}`);
  }
  const result = await executeMarketOrder(config, {
    tokenId: pick.tokenId,
    side: "BUY",
    amount: args.maxUsd
  });

  const tradeOutput = {
    ok: result.ok,
    orderId: result.orderId,
    avgPrice: result.avgPrice,
    filledNotionalUsd: result.filledNotionalUsd,
    rawResponse: result.rawResponse
  };

  if (args.json) {
    console.log(JSON.stringify({
      ...snapshot,
      trade: tradeOutput
    }, null, 2));
    return;
  }

  if (useHumanOutput) {
    printer.section("Trade Result");
    printer.note(result.ok ? "success" : "error", result.ok ? "Order accepted" : "Order rejected", result.orderId ?? "no order id");
    printer.table([
      ["Average Price", result.avgPrice == null ? "-" : result.avgPrice.toFixed(4)],
      ["Filled Notional", result.filledNotionalUsd == null ? "-" : formatUsd(result.filledNotionalUsd)]
    ]);
    return;
  }

  console.log(JSON.stringify(tradeOutput, null, 2));
}

main().catch((error) => {
  const args = parseArgs();
  if (args.json) {
    console.log(JSON.stringify({
      ok: false,
      command: "ops:check",
      error: getErrorMessage(error)
    }, null, 2));
    process.exit(1);
  }

  const printer = createTerminalPrinter();
  printErrorSummary(printer, {
    title: "Executor Live Check Failed",
    stage: "live-check",
    error,
    context: [["Command", "pnpm --filter @autopoly/executor ops:check"]],
    nextSteps: [
      "Verify PRIVATE_KEY and FUNDER_ADDRESS in the active env file.",
      "Retry with --json if you need machine-readable diagnostics."
    ]
  });
  process.exit(1);
});
