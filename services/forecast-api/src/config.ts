// Env-driven service configuration. The API token falls back to
// RAVEN_ACCESS_TOKEN so a single-token deployment (the GCP VM) works without
// new secrets; set FORECAST_API_TOKEN to decouple API callers from web users.

export interface ServiceConfig {
  port: number;
  host: string;
  token: string | null;
  maxConcurrentRuns: number;
  waitTimeoutMs: number;
  publicBaseUrl: string | null;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  return {
    port: readNumber("FORECAST_API_PORT", 8787),
    host: env.FORECAST_API_HOST ?? "0.0.0.0",
    // `||` (not ??): an empty `FORECAST_API_TOKEN=` line in .env must fall
    // back to RAVEN_ACCESS_TOKEN, not silently disable the gate.
    token: env.FORECAST_API_TOKEN || env.RAVEN_ACCESS_TOKEN || null,
    maxConcurrentRuns: readNumber("FORECAST_API_MAX_CONCURRENT", 2),
    waitTimeoutMs: readNumber("FORECAST_API_WAIT_TIMEOUT_MS", 20 * 60_000),
    publicBaseUrl: env.FORECAST_API_PUBLIC_URL?.replace(/\/+$/, "") ?? null
  };
}
