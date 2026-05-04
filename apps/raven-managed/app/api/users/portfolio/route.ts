import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl, managedUsers } from "@autopoly/db";
import { verifyPrivyToken } from "../../../../lib/privy-server";
import { getSafeBalance } from "../../../../lib/portfolio";

export async function GET(request: Request) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  const verified = await verifyPrivyToken(request.headers.get("authorization"));
  if (!verified) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(managedUsers)
    .where(eq(managedUsers.privyDid, verified.privyDid))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  // Phase 2: real on-chain USDC.e balance via viem. Cached 30 s per Safe.
  // Falls back to "0.00" when no Safe yet (pre-derivation users) or on
  // RPC failure.
  const balance = user.safeAddress
    ? await getSafeBalance(user.safeAddress)
    : { usdc: "0.00" };

  return NextResponse.json({
    userId: user.id,
    safeAddress: user.safeAddress,
    status: user.status,
    aiAutoTradeEnabled: user.aiAutoTradeEnabled,
    sessionSignerAuthorizedAt: user.sessionSignerAuthorizedAt
      ? user.sessionSignerAuthorizedAt.toISOString()
      : null,
    sessionSignerRevokedAt: user.sessionSignerRevokedAt
      ? user.sessionSignerRevokedAt.toISOString()
      : null,
    balanceUsdc: balance.usdc,
    positions: []
  });
}
