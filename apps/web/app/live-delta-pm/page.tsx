import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ACCESS_COOKIE_NAME, isValidAccessToken } from "../../lib/live-delta-pm/access";
import { LANG_COOKIE_NAME, parseLang } from "../../lib/live-delta-pm/i18n";
import { bakedAuditPayload, fetchLiveAudit } from "../../lib/live-delta-pm/live";
import { DeltaPmReport } from "./report";
import { UnlockGate } from "./unlock-gate";

export const metadata: Metadata = {
  title: "Delta PM 决策链审计 — Predict Raven",
  description: "US-stock shadow-trading decision-chain audit (invite-code gated).",
  robots: { index: false, follow: false }
};

// Reads the access cookie on every request — never prerender a cached variant.
export const dynamic = "force-dynamic";

export default async function LiveDeltaPmPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const lang = parseLang(cookieStore.get(LANG_COOKIE_NAME)?.value);
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  if (!isValidAccessToken(token)) {
    const params = await searchParams;
    return <UnlockGate showError={params?.error === "1"} lang={lang} />;
  }
  // Live decision chain from the Tokyo VM; the baked fixture (real run data,
  // checked in) is the labeled fallback when the VM is down or when
  // LIVE_DELTA_PM_MOCK=1 forces deterministic local rendering.
  const live = await fetchLiveAudit();
  return <DeltaPmReport payload={live ?? bakedAuditPayload()} dataSource={live ? "live" : "baked"} lang={lang} />;
}
