import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "./lib/world-cup/i18n";

// Localized surfaces live under /[locale]/. A bare request (no locale prefix) is
// redirected to the visitor's locale — the NEXT_LOCALE cookie if set (a
// remembered manual choice), else the Accept-Language match, else English.
// Already-prefixed requests just refresh the cookie so the choice sticks.
const LOCALIZED = ["/world-cup", "/prediction-engine"];
const COOKIE = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const firstSegment = pathname.split("/")[1];

  if (isLocale(firstSegment)) {
    const res = NextResponse.next();
    if (req.cookies.get(LOCALE_COOKIE)?.value !== firstSegment) {
      res.cookies.set(LOCALE_COOKIE, firstSegment, COOKIE);
    }
    return res;
  }

  if (LOCALIZED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const remembered = req.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(remembered) ? remembered : negotiateLocale(req.headers.get("accept-language"));
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    const res = NextResponse.redirect(url);
    res.cookies.set(LOCALE_COOKIE, locale, COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/world-cup",
    "/world-cup/:path*",
    "/prediction-engine",
    "/prediction-engine/:path*",
    "/en/:path*",
    "/zh-CN/:path*",
    "/zh-TW/:path*"
  ]
};
