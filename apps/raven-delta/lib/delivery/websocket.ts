// WebSocket channel: POSTs the run digest to the local delta hub
// (scripts/delta-ws/server.ts) which fans out to subscribed dashboards.
// The receipt reports the hub's actual delivered count — "accepted by the
// hub" and "reached a subscriber" are different facts (review finding #29).

import type { DeltaRun, DeliveryReceipt } from "../analyzer/schema";
import { failureDetail, pick, postJson, receipt, type DeliveryLocale } from "./shared";

export const DEFAULT_WS_TOPIC = "delta";

function broadcastUrl(): string | null {
  const explicit = process.env.DELTA_WS_BROADCAST_URL?.trim();
  if (explicit) return explicit;
  if (process.env.VERCEL) return null; // serverless: no local hub to reach
  const port = process.env.DELTA_WS_PORT?.trim() || "8791";
  return `http://127.0.0.1:${port}/broadcast`;
}

export function wsDigest(run: DeltaRun, topic: string): Record<string, unknown> {
  return {
    topic,
    type: "raven-delta-run",
    runId: run.id,
    engine: run.engine,
    generatedAtUtc: run.generatedAtUtc,
    headline: run.news.headline,
    worthAttention: run.analysis.attention.worthAttention,
    attentionScore: run.analysis.attention.score,
    verdict: run.analysis.attention.verdict,
    impactedStocks: run.analysis.impactedStocks.map((stock) => ({
      ticker: stock.ticker,
      direction: stock.direction,
      magnitude: stock.magnitude,
      action: stock.action,
      expectedMovePct: stock.expectedMovePct,
      confidence: stock.confidence
    })),
    tradingPlan: run.analysis.tradingPlan
  };
}

export async function broadcastRun(run: DeltaRun, topicInput: string | null, locale: DeliveryLocale): Promise<DeliveryReceipt> {
  const topic = topicInput?.trim() || DEFAULT_WS_TOPIC;
  const url = broadcastUrl();
  if (!url) {
    return receipt({
      channel: "websocket",
      status: "simulated",
      provider: "simulated",
      target: topic,
      detail: pick(
        locale,
        "Set DELTA_WS_BROADCAST_URL or run the local hub (pnpm delta:ws) to push real events.",
        "配置 DELTA_WS_BROADCAST_URL 或启动本地 hub（pnpm delta:ws）后才会真实推送。"
      )
    });
  }

  const token = process.env.DELTA_WS_TOKEN?.trim();
  const result = await postJson(url, wsDigest(run, topic), token ? { authorization: `Bearer ${token}` } : {});
  if (!result.ok) {
    return receipt({ channel: "websocket", status: "failed", provider: "delta-hub", target: topic, detail: failureDetail(locale, "ws-broadcast", result) });
  }

  let delivered: number | null = null;
  try {
    const parsed = JSON.parse(result.body) as { delivered?: number };
    if (typeof parsed.delivered === "number") delivered = parsed.delivered;
  } catch {
    // hub responded non-JSON: treat as accepted with unknown fan-out
  }

  if (delivered === 0) {
    return receipt({
      channel: "websocket",
      status: "skipped",
      provider: "delta-hub",
      target: topic,
      detail: pick(locale, "Hub reachable but no subscriber on this topic.", "hub 可达，但该 topic 当前没有订阅者。")
    });
  }
  return receipt({
    channel: "websocket",
    status: "sent",
    provider: "delta-hub",
    target: topic,
    detail:
      delivered === null
        ? pick(locale, "Broadcast accepted by the hub.", "广播已被 hub 接收。")
        : pick(locale, `Delivered to ${delivered} subscriber(s).`, `已推送给 ${delivered} 个订阅者。`)
  });
}
