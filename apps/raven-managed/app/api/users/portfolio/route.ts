import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl, managedUsers } from "@autopoly/db";
import { verifyPrivyToken } from "../../../../lib/privy-server";

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

  // Phase 1: stub on-chain balance read. Phase 2 will use viem to query USDC.e
  // balance on Polygon for user.safeAddress.
  return NextResponse.json({
    userId: user.id,
    safeAddress: user.safeAddress,
    status: user.status,
    aiAutoTradeEnabled: user.aiAutoTradeEnabled,
    balanceUsdc: "0.00",
    positions: []
  });
}
