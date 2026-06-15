// Pure access-control policy rules — env + input only, no DB/auth imports.
//
// Extracted from prediction-access.ts so the gating rules (who is an admin, who
// gets auto-activated, how booleans are read from env) can be unit-tested
// directly. prediction-access.ts (which imports next-auth + the DB) re-imports
// these; importing that module into a test runner fails on next-auth's
// `next/server` resolution, hence this dependency-free split.

export function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value);
}

function readCsvEnv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function emailDomain(value: string | null): string | null {
  const atIndex = value?.lastIndexOf("@") ?? -1;
  return atIndex >= 0 ? value!.slice(atIndex + 1).toLowerCase() : null;
}

// Auto-activation policy: everyone is auto-activated when invites are not
// required; otherwise only emails whose domain is in the allowlist.
export function shouldAutoActivate(email: string | null): boolean {
  if (!readBooleanEnv("PREDICTION_INVITE_REQUIRED", true)) {
    return true;
  }
  const domain = emailDomain(email);
  return Boolean(domain && readCsvEnv("PREDICTION_AUTO_ACTIVATE_EMAIL_DOMAINS").includes(domain));
}

export function isAdminEmail(email: string | null): boolean {
  return Boolean(email && readCsvEnv("PREDICTION_ADMIN_EMAILS").includes(email));
}
