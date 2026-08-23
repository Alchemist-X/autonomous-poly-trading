// Live data path for /live-delta-pm: server-side fetch of the Tokyo VM's
// /delta-pm/audit feed (the shadow-trading decision chain, newest 30 cases).
// Any failure — network, timeout, auth, shape drift — returns null and the
// caller falls back to the baked fixture, so the page never breaks when the
// VM is unreachable. The page banner names which source rendered.

import { parseAuditPayload, type AuditPayload } from "./decode";
import fixtureJson from "./fixture.json";

const DEFAULT_UPSTREAM = "http://34.85.97.32:8787";
const AUDIT_LIMIT = 30;
const FETCH_TIMEOUT_MS = 5000;
// Warm-instance memos: the success TTL keeps repeat views off the VM (the
// footer documents the 60s cache), and the failure backoff stops every view
// from paying the full timeout while the VM is down (deploys, instance stop —
// SYNs are silently dropped there).
const SUCCESS_TTL_MS = 60_000;
const FAILURE_BACKOFF_MS = 30_000;

function upstreamUrl(): string {
  const base = process.env.DELTA_PM_AUDIT_UPSTREAM?.trim() || DEFAULT_UPSTREAM;
  return `${base.replace(/\/+$/, "")}/delta-pm/audit?limit=${AUDIT_LIMIT}`;
}

function upstreamToken(): string {
  // The page's own invite code doubles as the API credential (the endpoint
  // accepts it alongside the main API token, same as /paper/snapshot) — no
  // extra secret to provision. SECURITY: this header crosses the public
  // internet as plain HTTP (bare-IP VM, no TLS yet). NEVER configure the real
  // FORECAST_API_TOKEN / RAVEN_ACCESS_TOKEN in this slot — the invite code is
  // the only credential that may travel this wire until the VM endpoint is
  // fronted by TLS.
  return process.env.LIVE_DELTA_PM_UPSTREAM_TOKEN?.trim() || "raven-labs";
}

let bakedMemo: AuditPayload | null = null;

/** The checked-in fixture (real run data), decoded once per process. */
export function bakedAuditPayload(): AuditPayload {
  if (!bakedMemo) {
    const parsed = parseAuditPayload(fixtureJson);
    if (!parsed) {
      // The fixture is checked in next to this file; failing to decode it is a
      // build defect, not a runtime condition — fail loudly.
      throw new Error("live-delta-pm fixture.json does not decode");
    }
    bakedMemo = parsed;
  }
  return bakedMemo;
}

let successMemo: { at: number; payload: AuditPayload } | null = null;
let lastFailureAt = 0;

/**
 * Fetch + decode the live audit feed. Returns null on any failure (caller
 * falls back to the baked fixture). LIVE_DELTA_PM_MOCK=1 short-circuits to
 * null so local dev renders the fixture deterministically.
 */
export async function fetchLiveAudit(nowMs: number = Date.now()): Promise<AuditPayload | null> {
  if (process.env.LIVE_DELTA_PM_MOCK === "1") return null;
  if (successMemo && nowMs - successMemo.at < SUCCESS_TTL_MS) return successMemo.payload;
  if (nowMs - lastFailureAt < FAILURE_BACKOFF_MS) return null;
  try {
    const res = await fetch(upstreamUrl(), {
      headers: { authorization: `Bearer ${upstreamToken()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok) {
      lastFailureAt = nowMs;
      return null;
    }
    const payload = parseAuditPayload(await res.json());
    if (payload) {
      successMemo = { at: nowMs, payload };
    } else {
      lastFailureAt = nowMs;
    }
    return payload;
  } catch {
    lastFailureAt = nowMs;
    return null;
  }
}
