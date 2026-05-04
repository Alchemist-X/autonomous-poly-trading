import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, hasDatabaseUrl, managedUsers } from "@autopoly/db";
import { eq } from "drizzle-orm";
import { verifyPrivyToken } from "../../../../lib/privy-server";
import { deriveSafeAddress } from "../../../../lib/polymarket-safe";

type RegisterBody = {
  privyDid?: string;
  email?: string | null;
  eoaAddress?: string;
};

export async function POST(request: Request) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  const verified = await verifyPrivyToken(request.headers.get("authorization"));
  if (!verified) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const privyDid = body.privyDid?.trim();
  const eoa = body.eoaAddress?.trim().toLowerCase();
  if (!privyDid || !eoa || !/^0x[0-9a-f]{40}$/.test(eoa)) {
    return NextResponse.json({ error: "missing privyDid or eoaAddress" }, { status: 400 });
  }
  if (privyDid !== verified.privyDid && !verified.privyDid.startsWith("dev:")) {
    return NextResponse.json({ error: "privyDid does not match token" }, { status: 403 });
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(managedUsers)
    .where(eq(managedUsers.privyDid, privyDid))
    .limit(1);

  const found = existing[0];
  if (found) {
    return NextResponse.json({
      userId: found.id,
      safeAddress: found.safeAddress,
      status: found.status
    });
  }

  // Derive the Polymarket Safe proxy address deterministically. The proxy
  // doesn't have to be deployed yet — Polymarket auto-deploys on first trade.
  // If derivation fails (malformed input, SDK issue), proceed with null and
  // log a warning so registration never breaks.
  const derivation = deriveSafeAddress(eoa);
  let safeAddress: string | null = null;
  if (derivation.ok) {
    safeAddress = derivation.safeAddress.toLowerCase();
  } else {
    console.warn(
      `[register] safe derivation failed for ${eoa}: ${derivation.reason}`
    );
  }

  const id = randomUUID();
  await db.insert(managedUsers).values({
    id,
    privyDid,
    email: body.email ?? null,
    eoaAddress: eoa,
    safeAddress,
    status: "pending_deploy",
    aiAutoTradeEnabled: false,
    riskTier: "balanced"
  });

  return NextResponse.json({
    userId: id,
    safeAddress,
    status: "pending_deploy"
  });
}
