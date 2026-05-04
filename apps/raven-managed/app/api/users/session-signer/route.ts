import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl, managedUsers } from "@autopoly/db";
import { verifyPrivyToken } from "../../../../lib/privy-server";

// Phase 2 #3 — Session signer authorization state machine.
//
// Records the user's intent (authorize | revoke) on managed_users so the
// dashboard can flip its toggle and Phase 3's trade executor knows whether
// AI auto-trading is currently allowed for this user.
//
// IMPORTANT: this endpoint only records DB state. It does NOT verify the
// session signer was actually attached to the user's wallet on Privy's
// side (that happens client-side via useSessionSigners.addSessionSigners).
// TODO(phase 3): add server-side verification by calling
//   PrivyClient.getUser(privyDid) and inspecting walletAccount.delegated /
//   linked_accounts.session_signers to confirm signerId is attached
//   before flipping aiAutoTradeEnabled = true. For MVP we trust the
//   client (anyone tampering would only enable trading for themselves —
//   trade executor still does its own preflight per-order in Phase 3).

type SessionSignerBody = {
  action?: "authorize" | "revoke";
  privySessionSignerId?: string | null;
};

type ExistingMetadata = Record<string, unknown>;

function mergeMetadata(
  current: unknown,
  patch: Record<string, unknown>
): ExistingMetadata {
  const base: ExistingMetadata =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as ExistingMetadata) }
      : {};
  return { ...base, ...patch };
}

export async function POST(request: Request) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "database not configured" },
      { status: 503 }
    );
  }

  const verified = await verifyPrivyToken(request.headers.get("authorization"));
  if (!verified) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: SessionSignerBody;
  try {
    body = (await request.json()) as SessionSignerBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "authorize" && action !== "revoke") {
    return NextResponse.json(
      { error: "action must be 'authorize' or 'revoke'" },
      { status: 400 }
    );
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

  const now = new Date();
  const signerId = body.privySessionSignerId?.trim() || null;

  // Build immutable update payload — never mutate the row in place.
  const baseUpdate = {
    updatedAt: now
  };

  if (action === "authorize") {
    const metadataNext = mergeMetadata(user.metadata, {
      privySessionSignerId: signerId,
      sessionSignerAuthorizedAt: now.toISOString()
    });
    await db
      .update(managedUsers)
      .set({
        ...baseUpdate,
        sessionSignerAuthorizedAt: now,
        sessionSignerRevokedAt: null,
        aiAutoTradeEnabled: true,
        metadata: metadataNext
      })
      .where(eq(managedUsers.id, user.id));

    return NextResponse.json({
      aiAutoTradeEnabled: true,
      sessionSignerAuthorizedAt: now.toISOString(),
      sessionSignerRevokedAt: null
    });
  }

  // action === "revoke"
  // Keep sessionSignerAuthorizedAt as the historical "last authorized"
  // marker so the UI can render "Last authorized X, revoked Y".
  const metadataNext = mergeMetadata(user.metadata, {
    sessionSignerRevokedAt: now.toISOString()
  });
  await db
    .update(managedUsers)
    .set({
      ...baseUpdate,
      sessionSignerRevokedAt: now,
      aiAutoTradeEnabled: false,
      metadata: metadataNext
    })
    .where(eq(managedUsers.id, user.id));

  return NextResponse.json({
    aiAutoTradeEnabled: false,
    sessionSignerAuthorizedAt: user.sessionSignerAuthorizedAt
      ? user.sessionSignerAuthorizedAt.toISOString()
      : null,
    sessionSignerRevokedAt: now.toISOString()
  });
}
