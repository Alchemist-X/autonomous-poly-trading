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

export async function isAdminAuthenticated(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_COOKIE)?.value;
  return Boolean(password) && cookieValue === createAdminCookieValue(password);
}

