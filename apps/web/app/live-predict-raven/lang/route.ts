import { NextResponse } from "next/server";
import { LANG_COOKIE_NAME, parseLang } from "../../../lib/live-predict-raven/i18n";

// Language toggle for /live-predict-raven: GET ?to=en|zh sets the (non-secret,
// non-httpOnly) preference cookie scoped to this page and bounces back to it.
// Anything other than "en" falls back to zh, the page's default language.

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function GET(request: Request): NextResponse {
  const url = new URL(request.url);
  const to = parseLang(url.searchParams.get("to"));
  const response = NextResponse.redirect(new URL("/live-predict-raven", url.origin), 302);
  response.cookies.set(LANG_COOKIE_NAME, to, {
    path: "/live-predict-raven",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    httpOnly: false,
    sameSite: "lax"
  });
  return response;
}
