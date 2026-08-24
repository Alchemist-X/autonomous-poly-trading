import { NextResponse } from "next/server";
import { resolveRequestOrigin } from "../../../lib/auth";
import { LANG_COOKIE_MAX_AGE_SECONDS, LANG_COOKIE_NAME, parseLang } from "../../../lib/live-delta-pm/i18n";

export const runtime = "nodejs";

// GET /live-delta-pm/lang?to=en|zh — persist the language choice in a cookie
// scoped to this page, then bounce back to the report (or the unlock gate).
// Not httpOnly: it is a display preference, not a credential.
export function GET(request: Request) {
  const lang = parseLang(new URL(request.url).searchParams.get("to"));
  const response = NextResponse.redirect(new URL("/live-delta-pm", resolveRequestOrigin(request)), {
    status: 303
  });
  response.cookies.set({
    name: LANG_COOKIE_NAME,
    value: lang,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/live-delta-pm",
    maxAge: LANG_COOKIE_MAX_AGE_SECONDS
  });
  return response;
}
