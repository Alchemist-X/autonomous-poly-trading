import { createHash } from "node:crypto";
import http from "node:http";
import type { Socket } from "node:net";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const PORT = Number(process.env.STOCK_NEWS_WS_PORT || 8791);
const clients = new Set<Socket>();

const C = {
  info: (message: string) => console.log(`\x1b[36mINFO\x1b[0m  ${message}`),
  ok: (message: string) => console.log(`\x1b[32mOK\x1b[0m    ${message}`),
  warn: (message: string) => console.warn(`\x1b[33mWARN\x1b[0m  ${message}`),
  err: (message: string) => console.error(`\x1b[31mERR\x1b[0m   ${message}`)
};

function encodeTextFrame(payload: string): Buffer {
  const data = Buffer.from(payload);
  if (data.length < 126) {
    return Buffer.concat([Buffer.from([0x81, data.length]), data]);
  }
  if (data.length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
    return Buffer.concat([header, data]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(data.length), 2);
  return Buffer.concat([header, data]);
}

function encodeControlFrame(opcode: number): Buffer {
  return Buffer.from([0x80 | opcode, 0]);
}

function send(socket: Socket, payload: unknown): boolean {
  try {
    socket.write(encodeTextFrame(JSON.stringify(payload)));
    return true;
  } catch {
    clients.delete(socket);
    socket.destroy();
    return false;
  }
}

function broadcast(payload: unknown): number {
  let sent = 0;
  for (const client of clients) {
    if (send(client, payload)) sent += 1;
  }
  return sent;
}

function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 1_000_000) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
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

function writeJson(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${PORT}`}`);
  if (request.method === "OPTIONS") {
    writeJson(response, 204, {});
    return;
  }
  if (request.method === "GET" && url.pathname === "/healthz") {
    writeJson(response, 200, {
      ok: true,
      clients: clients.size,
      websocketUrl: `ws://127.0.0.1:${PORT}/ws`,
      broadcastUrl: `http://127.0.0.1:${PORT}/broadcast`
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/broadcast") {
    try {
      const body = await readJsonBody(request);
      const payload = {
        type: "stock-news-impact",
        receivedAtUtc: new Date().toISOString(),
        ...(body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : { payload: body })
      };
      const delivered = broadcast(payload);
      C.ok(`broadcast topic=${String(payload.topic || "stock-news-impact")} clients=${delivered}`);
      writeJson(response, 200, { ok: true, delivered });
    } catch (error) {
      C.err(error instanceof Error ? error.message : String(error));
      writeJson(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  writeJson(response, 404, { ok: false, error: "Not found. Use /ws for WebSocket, /broadcast for HTTP fan-out." });
});

server.on("upgrade", (request, socket) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${PORT}`}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string") {
    socket.destroy();
    return;
  }
  const accept = createHash("sha1").update(`${key}${WS_GUID}`).digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));
  clients.add(socket);
  C.info(`client connected clients=${clients.size}`);
  send(socket, {
    type: "hello",
    topic: "stock-news-impact",
    connectedAtUtc: new Date().toISOString()
  });
  socket.on("data", (chunk: Buffer) => {
    const opcode = chunk[0] ? chunk[0] & 0x0f : 0;
    if (opcode === 0x8) {
      clients.delete(socket);
      socket.end();
      return;
    }
    if (opcode === 0x9) {
      socket.write(encodeControlFrame(0x0a));
    }
  });
  socket.on("close", () => {
    clients.delete(socket);
    C.info(`client disconnected clients=${clients.size}`);
  });
  socket.on("error", () => {
    clients.delete(socket);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  C.info("execution mode: inspect/demo-live-push | decision source: AI implementation");
  C.ok(`Stock news WebSocket hub listening on ws://127.0.0.1:${PORT}/ws`);
  C.info(`Broadcast endpoint: http://127.0.0.1:${PORT}/broadcast`);
});

process.on("SIGINT", () => {
  C.warn("Shutting down stock news WebSocket hub.");
  for (const client of clients) client.destroy();
  server.close(() => process.exit(0));
});
