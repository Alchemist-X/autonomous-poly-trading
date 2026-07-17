// Invite-token access gate for hosted deployments.
//
// Set RAVEN_ACCESS_TOKEN in the server env to lock the whole app (pages + API)
// behind a shared token; leave it unset for open local dev. Grant flow: visit
// any URL with ?token=<value> once — the gate sets an httpOnly cookie and
// redirects to the clean URL. APIs also accept an `x-raven-token` header.

import { NextRequest, NextResponse } from "next/server";
import { BASE_PATH } from "./lib/base-path";

const COOKIE = "raven-access";
// Note: `req.nextUrl.pathname` (and the matcher below) are basePath-stripped,
// so these patterns stay basePath-free even though the app mounts at /engine.
const PUBLIC_PATHS = [/^\/_next\//, /^\/favicon\.ico$/, /^\/raven-mascot\.png$/];

// Constant-time-ish comparison; avoids early-exit timing on the token match.
function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function accessPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Raven — access</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#15120c;color:#ede5d6;font-family:Georgia,serif">
<form method="GET" action="${BASE_PATH || "/"}" style="text-align:center;padding:24px">
<div style="font-size:22px;font-weight:600">Raven <span style="color:#ee7130">Forecasting Engine</span></div>
<p style="color:#a99d87;font-size:13px;margin:10px 0 18px">This instance is private. Enter your access token.</p>
<input name="token" autofocus placeholder="access token" style="background:#221b10;border:1px solid #3b3324;border-radius:9px;color:#ede5d6;font-size:14px;padding:10px 14px;outline:none;width:240px">
<button type="submit" style="margin-left:8px;background:#ee7130;color:#1c0d04;border:none;border-radius:9px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:11px 16px;cursor:pointer">Enter</button>
</form></body></html>`;
}

export default function proxy(req: NextRequest) {
  const expected = process.env.RAVEN_ACCESS_TOKEN;
  if (!expected) return NextResponse.next(); // gate disabled (local dev)

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((r) => r.test(pathname))) return NextResponse.next();

  const fromQuery = req.nextUrl.searchParams.get("token");
  const provided = fromQuery ?? req.headers.get("x-raven-token") ?? req.cookies.get(COOKIE)?.value ?? "";

  if (provided && tokenMatches(provided, expected)) {
    if (fromQuery) {
      // Grant the cookie and strip the token from the visible URL.
      const clean = req.nextUrl.clone();
      clean.searchParams.delete("token");
      const res = NextResponse.redirect(clean);
      res.cookies.set(COOKIE, expected, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.nextUrl.protocol === "https:",
        maxAge: 60 * 60 * 24 * 90,
        // Scope to the mount prefix so the cookie is not sent to the rest of
        // the shared domain once the main site reverse-proxies /engine/*.
        path: BASE_PATH || "/"
      });
      return res;
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized — provide the access token" }, { status: 401 });
  }
  return new NextResponse(accessPage(), {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

export const config = {
  // Everything except Next's static assets (also filtered above for safety).
  // Next prepends basePath to each matcher, so "/((?!…).*)" only covers
  // /engine/<something>; the bare "/" entry is needed to gate /engine itself.
  matcher: ["/", "/((?!_next/static|_next/image).*)"]
};
