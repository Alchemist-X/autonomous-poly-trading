// GET /api/state — server-side poll seam between the console UI and the
// delta-pm service. Fetches `${DELTAPM_STATUS_URL}/status` with a 3s timeout,
// keeps the last good snapshot in module memory, and on failure serves that
// last-good copy flagged `stale: true` so the dashboard degrades instead of
// blanking. DELTAPM_CONSOLE_MOCK=1 serves the bundled fixture (timestamps
// re-based to now so the page looks live).

import { NextResponse } from "next/server";
import { decodeSnapshot, type StateResponse, type StatusSnapshot } from "../../../lib/types";
import fixture from "../../../fixtures/status.json";

export const dynamic = "force-dynamic";

const STATUS_URL = process.env.DELTAPM_STATUS_URL ?? "http://127.0.0.1:8792";
const MOCK = process.env.DELTAPM_CONSOLE_MOCK === "1";
const FETCH_TIMEOUT_MS = 3000;

// Module-memory last-good cache. Survives across requests within one server
// process; dev-server module reloads simply reset it (harmless).
let lastGood: { snapshot: StatusSnapshot; fetchedAtUtc: string } | null = null;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Shift every ISO timestamp in the fixture by (now − fixture.nowUtc) so mock data reads as live. */
function rebaseTimestamps(value: unknown, deltaMs: number): unknown {
  if (typeof value === "string" && ISO_RE.test(value)) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t + deltaMs).toISOString() : value;
  }
  if (Array.isArray(value)) return value.map((v) => rebaseTimestamps(v, deltaMs));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = rebaseTimestamps(v, deltaMs);
    return out;
  }
  return value;
}

function respond(body: StateResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(): Promise<NextResponse> {
  const ingestConfigured = MOCK || Boolean(process.env.DELTAPM_INGEST_TOKEN);
  const nowIso = new Date().toISOString();

  if (MOCK) {
    const base = Date.parse((fixture as { service?: { nowUtc?: string } }).service?.nowUtc ?? "");
    const deltaMs = Number.isFinite(base) ? Date.now() - base : 0;
    const snapshot = decodeSnapshot(rebaseTimestamps(fixture, deltaMs));
    return respond({
      ok: true,
      stale: false,
      fetchedAtUtc: nowIso,
      error: null,
      ingestConfigured,
      mock: true,
      snapshot
    });
  }

  try {
    const res = await fetch(`${STATUS_URL}/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`service returned HTTP ${res.status}`);
    const snapshot = decodeSnapshot(await res.json());
    lastGood = { snapshot, fetchedAtUtc: nowIso };
    return respond({
      ok: true,
      stale: false,
      fetchedAtUtc: nowIso,
      error: null,
      ingestConfigured,
      mock: false,
      snapshot
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return respond({
      ok: false,
      stale: lastGood !== null,
      fetchedAtUtc: lastGood?.fetchedAtUtc ?? null,
      error: message,
      ingestConfigured,
      mock: false,
      snapshot: lastGood?.snapshot ?? null
    });
  }
}
