import { NextResponse } from "next/server";
import {
  createAdminCookieValue,
  getAdminCookieName,
  resolveRequestOrigin
} from "../../../../lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (password !== (process.env.ADMIN_PASSWORD ?? "")) {
    return new Response("Invalid password", { status: 401 });
  }

  const response = NextResponse.redirect(new URL("/admin", request.url), {
    status: 303
  });
  response.headers.set("location", new URL("/admin", resolveRequestOrigin(request)).toString());
  response.cookies.set(getAdminCookieName(), createAdminCookieValue(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
  return response;
}
