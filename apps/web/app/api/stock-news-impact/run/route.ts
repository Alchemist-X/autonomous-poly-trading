import { NextResponse } from "next/server";
import { deliverStockNewsImpactRun } from "../../../../lib/stock-news-delivery";
import {
  buildStockNewsImpactRun,
  DEFAULT_STOCK_NEWS_BODY,
  DEFAULT_STOCK_NEWS_HEADLINE,
  DEFAULT_STOCK_WATCHLIST
} from "../../../../lib/stock-news-impact";
import { isConsoleLocale, type ConsoleLocale } from "../../../../lib/research/locale";

export const runtime = "nodejs";

function readString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function readStringArray(value: unknown, maxItems: number): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }
  return [];
}

function readLocale(value: unknown): ConsoleLocale {
  if (isConsoleLocale(value)) return value;
  if (value === "zh-CN" || value === "zh-TW" || value === "zh") return "zh";
  return "en";
}

export async function GET() {
  const run = buildStockNewsImpactRun({
    headline: DEFAULT_STOCK_NEWS_HEADLINE,
    body: DEFAULT_STOCK_NEWS_BODY,
    watchlist: DEFAULT_STOCK_WATCHLIST,
    locale: "en"
  });
  return NextResponse.json({
    status: "ok",
    mode: run.mode,
    sample: run
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const headline = readString(record.headline, 500);
  if (!headline) {
    return NextResponse.json({ error: "headline is required." }, { status: 400 });
  }

  const run = buildStockNewsImpactRun({
    headline,
    body: readString(record.body, 1800),
    source: readString(record.source, 140),
    url: readString(record.url, 500),
    publishedAt: readString(record.publishedAt, 80),
    watchlist: readStringArray(record.watchlist, 40),
    locale: readLocale(record.locale)
  });
  const delivery = await deliverStockNewsImpactRun({
    run,
    emailRecipients: readStringArray(record.emailRecipients, 20),
    websocketTopic: readString(record.websocketTopic, 120)
  });

  return NextResponse.json({
    ...run,
    delivery
  });
}
