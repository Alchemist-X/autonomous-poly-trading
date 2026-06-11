// Polymarket CLOB market-channel WebSocket client. Subscribes to clob asset_ids
// (the clobTokenIds from the cache) and streams order-book + price-change events.
// Uses the native global WebSocket (Node >= 22). Batches large id sets across
// multiple connections and auto-reconnects with backoff.

export const POLYMARKET_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

export interface PolymarketWsEvent {
  readonly event_type?: string; // "book" | "price_change" | "last_trade_price" | "tick_size_change"
  readonly asset_id?: string;
  readonly market?: string;
  readonly [key: string]: unknown;
}

export interface PolymarketWsOptions {
  readonly assetIds: readonly string[];
  readonly onEvent: (event: PolymarketWsEvent) => void;
  readonly onStatus?: (status: string) => void;
  readonly url?: string;
  readonly batchSize?: number; // asset_ids per connection
  readonly pingIntervalMs?: number;
  readonly reconnect?: boolean;
}

interface WsMessageEvent { readonly data: unknown }
interface WsLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((ev: WsMessageEvent) => void) | null;
  onclose: (() => void) | null;
  onerror: ((ev: unknown) => void) | null;
}
type WsCtor = new (url: string) => WsLike;

function getWebSocketCtor(): WsCtor {
  const ctor = (globalThis as { WebSocket?: WsCtor }).WebSocket;
  if (!ctor) throw new Error("Global WebSocket is unavailable — needs Node >= 22 (or a ws polyfill).");
  return ctor;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface Connection {
  ws: WsLike | null;
  pingTimer: ReturnType<typeof setInterval> | null;
  closedByClient: boolean;
  attempts: number;
}

export class PolymarketMarketWs {
  private readonly opts: Required<Omit<PolymarketWsOptions, "onStatus">> & Pick<PolymarketWsOptions, "onStatus">;
  private readonly batches: string[][];
  private readonly connections: Connection[] = [];

  constructor(opts: PolymarketWsOptions) {
    this.opts = {
      url: opts.url ?? POLYMARKET_WS_URL,
      batchSize: opts.batchSize ?? 400,
      pingIntervalMs: opts.pingIntervalMs ?? 10_000,
      reconnect: opts.reconnect ?? true,
      assetIds: opts.assetIds,
      onEvent: opts.onEvent,
      onStatus: opts.onStatus
    };
    this.batches = chunk([...new Set(opts.assetIds)].filter(Boolean), this.opts.batchSize);
  }

  private status(msg: string): void {
    this.opts.onStatus?.(msg);
  }

  start(): void {
    if (this.batches.length === 0) {
      this.status("no asset_ids to subscribe");
      return;
    }
    this.batches.forEach((batch, i) => {
      const conn: Connection = { ws: null, pingTimer: null, closedByClient: false, attempts: 0 };
      this.connections.push(conn);
      this.openConnection(conn, batch, i);
    });
  }

  private openConnection(conn: Connection, assetIds: string[], index: number): void {
    const Ctor = getWebSocketCtor();
    const ws = new Ctor(this.opts.url);
    conn.ws = ws;

    ws.onopen = () => {
      conn.attempts = 0;
      ws.send(JSON.stringify({ assets_ids: assetIds, type: "market" }));
      this.status(`conn#${index} open, subscribed ${assetIds.length} assets`);
      conn.pingTimer = setInterval(() => {
        try { ws.send("PING"); } catch { /* ignore */ }
      }, this.opts.pingIntervalMs);
    };

    ws.onmessage = (ev) => {
      const data = typeof ev.data === "string" ? ev.data : String(ev.data ?? "");
      if (!data || data === "PONG") return;
      let parsed: unknown;
      try { parsed = JSON.parse(data); } catch { return; }
      const events = Array.isArray(parsed) ? parsed : [parsed];
      for (const e of events) {
        if (e && typeof e === "object") this.opts.onEvent(e as PolymarketWsEvent);
      }
    };

    ws.onerror = () => { this.status(`conn#${index} error`); };

    ws.onclose = () => {
      if (conn.pingTimer) { clearInterval(conn.pingTimer); conn.pingTimer = null; }
      if (conn.closedByClient || !this.opts.reconnect) { this.status(`conn#${index} closed`); return; }
      conn.attempts += 1;
      const backoff = Math.min(30_000, 1000 * 2 ** Math.min(conn.attempts, 5));
      this.status(`conn#${index} closed, reconnecting in ${backoff}ms (attempt ${conn.attempts})`);
      setTimeout(() => { if (!conn.closedByClient) this.openConnection(conn, assetIds, index); }, backoff);
    };
  }

  stop(): void {
    for (const conn of this.connections) {
      conn.closedByClient = true;
      if (conn.pingTimer) { clearInterval(conn.pingTimer); conn.pingTimer = null; }
      try { conn.ws?.close(); } catch { /* ignore */ }
    }
  }

  get connectionCount(): number {
    return this.batches.length;
  }
}
