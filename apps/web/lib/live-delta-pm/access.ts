import { createHash, timingSafeEqual } from "node:crypto";

// Invite-code gate for /live-delta-pm, mirroring /live-predict-raven's gate
// (same default code word as the /engine gate). The code is an access hurdle
// for a low-sensitivity internal review page, not a credential; override via
// env without redeploying the default.
const DEFAULT_CODE = "raven-labs";
const TOKEN_NAMESPACE = "live-delta-pm:v1:";

export const ACCESS_COOKIE_NAME = "ldp-access";
export const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function configuredCode(): string {
  const fromEnv = process.env.LIVE_DELTA_PM_CODE?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_CODE;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Stateless cookie token derived from the configured code. */
export function expectedAccessToken(): string {
  return sha256Hex(TOKEN_NAMESPACE + configuredCode());
}

export function isValidCode(input: unknown): boolean {
  if (typeof input !== "string") {
    return false;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    return false;
  }
  return safeEqualHex(sha256Hex(TOKEN_NAMESPACE + trimmed), expectedAccessToken());
}

export function isValidAccessToken(token: unknown): boolean {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
    return false;
  }
  return safeEqualHex(token, expectedAccessToken());
}
