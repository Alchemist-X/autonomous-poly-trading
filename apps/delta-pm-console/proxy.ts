// Access gate for hosted deployments (same battle-tested pattern as
// apps/raven-delta/proxy.ts — including the Next 16 bare-root matcher fix
// and the basePath-scoped cookie).
//
// Set DELTAPM_CONSOLE_TOKEN in the server env to lock the whole console
// (pages + API) behind a shared token; leave it unset for open local dev.
// Grant flow: visit any URL with ?token=<value> once — the gate sets an
// httpOnly cookie scoped to the basePath and redirects to the clean URL.

import { NextRequest, NextResponse } from "next/server";

const COOKIE = "delta-pm-console-access";
const PUBLIC_PATHS = [/^\/_next\//, /^\/favicon\.ico$/];

function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function accessPage(action: string): string {
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Delta PM 控制台 — 访问</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#15120c;color:#ede5d6;font-family:Georgia,serif">
<form method="GET" action="${action}" style="text-align:center;padding:24px">
<div style="font-size:22px;font-weight:600">Delta <span style="color:#ee7130">PM</span> 控制台</div>
<p style="color:#a99d87;font-size:13px;margin:10px 0 18px">内部运营页。输入访问码。</p>
<input name="token" autofocus placeholder="access code" style="background:#221b10;border:1px solid #3b3324;border-radius:9px;color:#ede5d6;font-size:14px;padding:10px 14px;outline:none;width:240px">
<button type="submit" style="margin-left:8px;background:#ee7130;color:#1c0d04;border:none;border-radius:9px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:11px 16px;cursor:pointer">进入</button>
</form></body></html>`;
}

function providedToken(req: NextRequest): string {
  const fromQuery = req.nextUrl.searchParams.get("token");
  if (fromQuery) return fromQuery;
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return req.headers.get("x-delta-pm-console-token") ?? req.cookies.get(COOKIE)?.value ?? "";
}

export default function proxy(req: NextRequest) {
  const expected = process.env.DELTAPM_CONSOLE_TOKEN?.trim();
  if (!expected) return NextResponse.next(); // gate disabled (local dev)

  const { pathname } = req.nextUrl; // basePath already stripped here
  const basePath = req.nextUrl.basePath || "";
  if (PUBLIC_PATHS.some((r) => r.test(pathname))) return NextResponse.next();

  const fromQuery = req.nextUrl.searchParams.get("token");
  const provided = providedToken(req);

  if (provided && tokenMatches(provided, expected)) {
    if (fromQuery) {
      const clean = req.nextUrl.clone();
      clean.searchParams.delete("token");
      const res = NextResponse.redirect(clean);
      res.cookies.set(COOKIE, expected, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.nextUrl.protocol === "https:",
        maxAge: 60 * 60 * 24 * 90,
        path: basePath || "/"
      });
      return res;
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized — provide the access token" }, { status: 401 });
  }
  return new NextResponse(accessPage(`${basePath}/`), {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

export const config = {
  matcher: ["/", "/((?!_next/static|_next/image).*)"]
};
