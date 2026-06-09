import { NextResponse } from "next/server";
import { acceptInviteForCurrentUser } from "../../../../lib/prediction-access";
import { resolveRequestOrigin } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "");
  const result = await acceptInviteForCurrentUser(code);
  if (result.ok) {
    return NextResponse.redirect(new URL("/prediction-engine", resolveRequestOrigin(request)), {
      status: 303
    });
  }

  const url = new URL("/invite", resolveRequestOrigin(request));
  url.searchParams.set("error", result.error);
  return NextResponse.redirect(url, { status: 303 });
}
