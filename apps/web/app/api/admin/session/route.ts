import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminCookieValue, getAdminCookieName } from "../../../../lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (password !== (process.env.ADMIN_PASSWORD ?? "")) {
    return new Response("Invalid password", { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(getAdminCookieName(), createAdminCookieValue(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return NextResponse.redirect(new URL("/admin", request.url));
}
