import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PaperReport } from "../../components/live-predict-raven/report";
import { UnlockGate } from "../../components/live-predict-raven/unlock-gate";
import { ACCESS_COOKIE_NAME, isValidAccessToken } from "../../lib/live-predict-raven/access";

export const metadata: Metadata = {
  title: "Paper Trading 复盘 — Predict Raven",
  description: "Tokyo VM paper-trading book review (invite-code gated).",
  robots: { index: false, follow: false }
};

// Reads the access cookie on every request — never prerender a cached variant.
export const dynamic = "force-dynamic";

export default async function LivePredictRavenPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  if (!isValidAccessToken(token)) {
    const params = await searchParams;
    return <UnlockGate showError={params?.error === "1"} />;
  }
  return <PaperReport />;
}
