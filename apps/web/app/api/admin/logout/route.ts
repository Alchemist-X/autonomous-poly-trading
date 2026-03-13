import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName } from "../../../../lib/auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(getAdminCookieName());
  return NextResponse.redirect(new URL("/admin", request.url));
}
