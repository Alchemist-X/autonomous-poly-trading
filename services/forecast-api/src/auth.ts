// Bearer/x-api-key token gate. When no token is configured the gate is open
// (local dev) — production deployments must set FORECAST_API_TOKEN or
// RAVEN_ACCESS_TOKEN (see config.ts).

import type { IncomingMessage } from "node:http";

// Constant-time-ish comparison (XOR fold after length check), matching the
// apps/raven proxy gate.
export function tokenEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function presentedToken(req: Pick<IncomingMessage, "headers">, url: URL): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey === "string" && apiKey.trim()) return apiKey.trim();
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken;
  return null;
}

export function isAuthorized(
  req: Pick<IncomingMessage, "headers">,
  url: URL,
  configuredToken: string | null
): boolean {
  if (!configuredToken) return true;
  const presented = presentedToken(req, url);
  return presented !== null && tokenEquals(presented, configuredToken);
}
