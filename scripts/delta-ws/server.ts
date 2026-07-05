/**
 * Raven Delta news-impact WebSocket hub.
 *
 * Dependency-free local hub: clients subscribe over WebSocket
 * (`ws://127.0.0.1:PORT/ws?topic=<topic>`) and internal tooling fans events
 * out via `POST /broadcast` with `{topic?, ...payload}`. Missing topic on
 * either side defaults to "delta". Frames go through the RFC 6455 codec in
 * ./frame.ts, so fragmented and masked client frames parse correctly.
 *
 * Optional auth: when DELTA_WS_TOKEN is set, /broadcast requires
 * `Authorization: Bearer <token>` and upgrades require `?token=<token>`.
 *
 * Run: DELTA_WS_PORT=8791 pnpm exec tsx scripts/delta-ws/server.ts
 */
import { createHash } from "node:crypto";
import http from "node:http";
import type { Duplex } from "node:stream";
import {
  createFrameReader,
  encodeCloseFrame,
  encodePingFrame,
  encodePongFrame,
  encodeTextFrame,
  isOverflow,
  OPCODE,
  type FrameReader,
  type ParsedFrame
} from "./frame.ts";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const PORT = Number(process.env.DELTA_WS_PORT || 8791);
const SHARED_TOKEN = process.env.DELTA_WS_TOKEN;
const DEFAULT_TOPIC = "delta";
const MAX_CLIENTS = 100;
const MAX_SOCKET_BUFFERED_BYTES = 1_048_576;
const MAX_REQUEST_BODY_BYTES = 1_000_000;
// 30s heartbeat by default; env override exists so tests can shrink it.
const PING_INTERVAL_MS = Number(process.env.DELTA_WS_PING_INTERVAL_MS || 30_000);
const MAX_MISSED_PONGS = 2;
const CLOSE_NORMAL = 1000;
const CLOSE_GOING_AWAY = 1001;
const SHUTDOWN_FLUSH_MS = 250;

// CLI script: colorized leveled console logging is the repo convention here.
const C = {
  info: (message: string) => console.log(`\x1b[36mINFO\x1b[0m  ${message}`),
  ok: (message: string) => console.log(`\x1b[32mOK\x1b[0m    ${message}`),
  warn: (message: string) => console.warn(`\x1b[33mWARN\x1b[0m  ${message}`),
  err: (message: string) => console.error(`\x1b[31mERR\x1b[0m   ${message}`)
};

interface ClientState {
  readonly topic: string;
  readonly reader: FrameReader;
  readonly missedPongs: number;
  readonly closing: boolean;
}

// The only shared mutable state: per-socket bookkeeping. The state records
// themselves are immutable — updates replace the map entry via patchClient.
const clients = new Map<Duplex, ClientState>();

function patchClient(socket: Duplex, patch: Partial<ClientState>): void {
  const current = clients.get(socket);
  if (current) {
    clients.set(socket, { ...current, ...patch });
  }
}

function dropClient(socket: Duplex, reason: string): void {
  if (!clients.delete(socket)) return;
  C.warn(`client dropped reason=${reason} clients=${clients.size}`);
  socket.destroy();
}

/**
 * Backpressure-aware write. A delivery only counts when write() returns true
 * (the frame fit in the kernel/stream buffer); clients whose outbound buffer
 * exceeds the cap are dropped instead of written to.
 */
function safeWrite(socket: Duplex, frame: Buffer): boolean {
  if (socket.writableLength > MAX_SOCKET_BUFFERED_BYTES) {
    dropClient(socket, "backpressure-buffer-over-cap");
    return false;
  }
  try {
    return socket.write(frame);
  } catch (error) {
    dropClient(socket, `write-failed(${error instanceof Error ? error.message : String(error)})`);
    return false;
  }
}

function broadcastToTopic(topic: string, payload: unknown): number {
  const frame = encodeTextFrame(JSON.stringify(payload));
  // Copy entries: safeWrite may drop clients (mutating the map) mid-loop.
  return [...clients].reduce((delivered, [socket, state]) => {
    if (state.topic !== topic) return delivered;
    return safeWrite(socket, frame) ? delivered + 1 : delivered;
  }, 0);
}

function topicCounts(): Record<string, number> {
  return [...clients.values()].reduce<Record<string, number>>(
    (counts, state) => ({ ...counts, [state.topic]: (counts[state.topic] ?? 0) + 1 }),
    {}
  );
}

// --- Inbound frame handling ------------------------------------------------

function handleClientClose(socket: Duplex): void {
  const state = clients.get(socket);
  clients.delete(socket);
  if (state && !state.closing) {
    // Complete the close handshake: echo Close(1000), then end the stream.
    try {
      socket.write(encodeCloseFrame(CLOSE_NORMAL));
    } catch {
      // Peer already gone; ending below is all that is left to do.
    }
  }
  socket.end();
  C.info(`client completed close handshake clients=${clients.size}`);
}

function handleFrame(socket: Duplex, frame: ParsedFrame): void {
  if (frame.opcode === OPCODE.CLOSE) {
    handleClientClose(socket);
    return;
  }
  if (frame.opcode === OPCODE.PING) {
    safeWrite(socket, encodePongFrame(frame.payload));
    return;
  }
  if (frame.opcode === OPCODE.PONG) {
    patchClient(socket, { missedPongs: 0 });
    return;
  }
  // Text/binary from clients is ignored: this hub is push-only.
}

function handleSocketData(socket: Duplex, chunk: Buffer): void {
  const state = clients.get(socket);
  if (!state) return;
  for (const event of state.reader.push(chunk)) {
    if (isOverflow(event)) {
      dropClient(socket, "frame-reader-overflow");
      return;
    }
    handleFrame(socket, event);
    if (!clients.has(socket)) return; // the frame handler closed this client
  }
}

// --- HTTP endpoints ----------------------------------------------------------

function writeJson(response: http.ServerResponse, statusCode: number, body: unknown): void {
  // Same-host tooling only: deliberately no access-control-allow-* headers.
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    request.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_REQUEST_BODY_BYTES) {
        reject(new Error("Request body too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function isBroadcastAuthorized(request: http.IncomingMessage): boolean {
  if (!SHARED_TOKEN) return true; // open mode for the local demo
  return request.headers.authorization === `Bearer ${SHARED_TOKEN}`;
}

async function handleBroadcast(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
  if (!isBroadcastAuthorized(request)) {
    C.warn("broadcast rejected: missing or invalid bearer token");
    writeJson(response, 401, { ok: false, error: "Unauthorized. Send 'Authorization: Bearer <DELTA_WS_TOKEN>'." });
    return;
  }
  try {
    const body = await readJsonBody(request);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      writeJson(response, 400, { ok: false, error: "Body must be a JSON object." });
      return;
    }
    const { topic: rawTopic, ...rest } = body as Record<string, unknown>;
    if (rawTopic !== undefined && typeof rawTopic !== "string") {
      writeJson(response, 400, { ok: false, error: "'topic' must be a string when present." });
      return;
    }
    const topic = rawTopic ?? DEFAULT_TOPIC;
    const message = {
      type: "delta-news-impact",
      topic,
      receivedAtUtc: new Date().toISOString(),
      ...rest
    };
    const delivered = broadcastToTopic(topic, message);
    C.ok(`broadcast topic=${topic} delivered=${delivered}`);
    writeJson(response, 200, { ok: true, topic, delivered });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    C.err(`broadcast failed: ${message}`);
    writeJson(response, 400, { ok: false, error: message });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);
  if (request.method === "GET" && url.pathname === "/healthz") {
    writeJson(response, 200, {
      ok: true,
      clients: clients.size,
      topics: topicCounts(),
      websocketUrl: `ws://127.0.0.1:${PORT}/ws`,
      broadcastUrl: `http://127.0.0.1:${PORT}/broadcast`
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/broadcast") {
    await handleBroadcast(request, response);
    return;
  }
  writeJson(response, 404, { ok: false, error: "Not found. Use /ws for WebSocket, /broadcast for HTTP fan-out." });
});

// --- WebSocket upgrade -------------------------------------------------------

server.on("upgrade", (request, socket) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  if (SHARED_TOKEN && url.searchParams.get("token") !== SHARED_TOKEN) {
    C.warn("upgrade rejected: missing or invalid ?token");
    socket.destroy();
    return;
  }
  if (clients.size >= MAX_CLIENTS) {
    C.warn(`upgrade rejected: client cap reached (${MAX_CLIENTS})`);
    socket.destroy();
    return;
  }
  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string") {
    socket.destroy();
    return;
  }
  const accept = createHash("sha1").update(`${key}${WS_GUID}`).digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      ""
    ].join("\r\n")
  );

  const topic = url.searchParams.get("topic") || DEFAULT_TOPIC;
  clients.set(socket, { topic, reader: createFrameReader(), missedPongs: 0, closing: false });
  C.info(`client connected topic=${topic} clients=${clients.size}`);
  safeWrite(socket, encodeTextFrame(JSON.stringify({ type: "hello", topic, connectedAtUtc: new Date().toISOString() })));

  socket.on("data", (chunk: Buffer) => handleSocketData(socket, chunk));
  socket.on("close", () => {
    if (clients.delete(socket)) {
      C.info(`client disconnected clients=${clients.size}`);
    }
  });
  socket.on("error", () => dropClient(socket, "socket-error"));
});

// --- Heartbeat -----------------------------------------------------------

const heartbeat = setInterval(() => {
  for (const [socket, state] of [...clients]) {
    if (state.missedPongs >= MAX_MISSED_PONGS) {
      dropClient(socket, `missed-${state.missedPongs}-pongs`);
      continue;
    }
    patchClient(socket, { missedPongs: state.missedPongs + 1 });
    safeWrite(socket, encodePingFrame());
  }
}, PING_INTERVAL_MS);

// --- Lifecycle -----------------------------------------------------------

server.listen(PORT, "127.0.0.1", () => {
  C.info("execution mode: demo-live-push | decision source: AI implementation");
  C.ok(`Raven Delta WebSocket hub listening on ws://127.0.0.1:${PORT}/ws (default topic "${DEFAULT_TOPIC}")`);
  C.info(`Broadcast endpoint: http://127.0.0.1:${PORT}/broadcast`);
  C.info(SHARED_TOKEN ? "auth: shared token required (DELTA_WS_TOKEN set)" : "auth: open (set DELTA_WS_TOKEN to require a token)");
});

process.on("SIGINT", () => {
  C.warn("SIGINT: shutting down Raven Delta hub.");
  clearInterval(heartbeat);
  const goingAway = encodeCloseFrame(CLOSE_GOING_AWAY);
  for (const [socket] of clients) {
    patchClient(socket, { closing: true });
    try {
      socket.write(goingAway);
      socket.end();
    } catch {
      // Socket already unusable; the destroy pass below covers it.
    }
  }
  // Give Close(1001) frames a moment to flush before hard-destroying stragglers.
  setTimeout(() => {
    for (const [socket] of clients) socket.destroy();
    clients.clear();
    server.close(() => process.exit(0));
    // Safety net in case server.close never fires (e.g. stuck keep-alive).
    setTimeout(() => process.exit(0), 1_000).unref();
  }, SHUTDOWN_FLUSH_MS);
});
