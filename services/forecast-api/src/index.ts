// Bootstrap: bind the HTTP + MCP surface and print the effective runtime
// state (single source of truth — host, port, gate, provider, storage root).

import { createServer } from "node:http";
import { loadConfig } from "./config";
import { log } from "./log";
import { forecastsRoot } from "./repo";
import { pickProvider } from "./run-manager";
import { createRequestHandler } from "./server";

const config = loadConfig();
const server = createServer(createRequestHandler(config));

// Engine runs stream for many minutes; never let node kill a ?wait=true
// response mid-run.
server.requestTimeout = 0;
server.headersTimeout = 60_000;
server.maxConnections = 200;

server.listen(config.port, config.host, () => {
  log.info(`forecast-api listening on http://${config.host}:${config.port}`);
  log.info(`mode: live · token gate: ${config.token ? "ON" : "OFF"} · provider default: ${pickProvider()}`);
  if (!config.token) {
    log.warn("token gate is OFF — anyone who can reach this port can start paid engine runs. Set FORECAST_API_TOKEN (or RAVEN_ACCESS_TOKEN) before exposing it.");
  }
  log.info(`forecasts root: ${forecastsRoot()}`);
  log.info(`endpoints: POST /v1/forecasts · GET /v1/forecasts/:id[/text|/pdf] · POST /mcp`);
});
