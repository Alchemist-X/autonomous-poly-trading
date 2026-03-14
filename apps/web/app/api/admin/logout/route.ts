import { NextResponse } from "next/server";
import { getAdminCookieName, resolveRequestOrigin } from "../../../../lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin", request.url), {
    status: 303
  });
  response.headers.set("location", new URL("/admin", resolveRequestOrigin(request)).toString());
  response.cookies.delete(getAdminCookieName());
  return response;
}
