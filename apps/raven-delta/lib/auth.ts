// Access model: DELTA_ACCESS_TOKEN gates trust, not availability.
// - Token unset  -> local demo: every caller is trusted ("full").
// - Token set    -> callers presenting it are "full"; others are "public"
//   (analysis allowed, but email recipients restricted to the allowlist and
//   /api/ingest rejected outright).

export type CallerTrust = "full" | "public";

function configuredToken(): string | null {
  return process.env.DELTA_ACCESS_TOKEN?.trim() || null;
}

export function callerTrust(request: Request): CallerTrust {
  const expected = configuredToken();
  if (!expected) return "full";
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = request.headers.get("x-delta-token")?.trim() ?? "";
  return bearer === expected || alt === expected ? "full" : "public";
}

export function ingestAllowed(request: Request): boolean {
  // The ingest seam is machine-facing; when a token is configured it is
  // mandatory. Without a token (local dev) ingest stays open.
  return callerTrust(request) === "full";
}
