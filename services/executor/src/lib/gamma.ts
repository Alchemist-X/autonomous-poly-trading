// Single transport for every executor call to the Polymarket Gamma API.
//
// The Gamma clients across the executor (polymarket-sdk.ts, redeem.ts,
// orderbook-limits.ts) each hardcoded the host and hit DIFFERENT endpoints
// (/events/slug, /markets, /public-profile) with DIFFERENT response parsing and
// DIFFERENT error handling — some throw, some degrade gracefully. Those choices
// legitimately differ per call site, so this helper owns ONLY the transport:
// the base URL and a consistent client user-agent. Callers keep their own
// parsing + error handling.
export const GAMMA_BASE = "https://gamma-api.polymarket.com";

export function gammaFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${GAMMA_BASE}${path}`, {
    ...init,
    headers: { "user-agent": "@autopoly/executor", ...init?.headers }
  });
}
