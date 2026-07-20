import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  ACCESS_COOKIE_NAME,
  expectedAccessToken,
  isValidCode
} from "../../../../lib/live-predict-raven/access";
import { resolveRequestOrigin } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let code: unknown;
  try {
    const form = await request.formData();
    code = form.get("code");
  } catch {
    code = null;
  }

  const target = new URL("/live-predict-raven", resolveRequestOrigin(request));
  if (!isValidCode(code)) {
    target.searchParams.set("error", "1");
    return NextResponse.redirect(target, { status: 303 });
  }

  const response = NextResponse.redirect(target, { status: 303 });
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: expectedAccessToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS
  });
  return response;
}
