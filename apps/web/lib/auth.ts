import { createHash } from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "autopoly_admin_session";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createAdminCookieValue(password: string): string {
  return digest(password);
}

export function getAdminCookieName(): string {
  return ADMIN_COOKIE;
}

export function resolveRequestOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (forwardedHost) {
    const protocol = request.headers.get("x-forwarded-proto") ?? "http";
    return `${protocol}://${forwardedHost}`;
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  return new URL(request.url).origin;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_COOKIE)?.value;
  return Boolean(password) && cookieValue === createAdminCookieValue(password);
}
