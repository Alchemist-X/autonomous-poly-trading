// Session signer client helper — Phase 2 #3
//
// Wraps Privy's useSessionSigners SDK call so the UI doesn't have to know
// about the SDK shape, env-var gating, or the eventual Phase 3 KMS-backed
// signer wiring.
//
// Why a thin wrapper:
// - The SDK's addSessionSigners({address, signers: [{signerId, policyIds?}]})
//   needs a `signerId` that's been pre-registered on the Privy dashboard
//   and is paired with a server-side signing key (Turnkey / KMS / etc.).
//   That backend signer is Phase 3 territory — for Phase 2 #3 we ship the
//   UI + DB flow and gate the actual SDK call behind an env var so the
//   page works whether or not the signer exists yet.
// - Per plan §0 + §1.1: do NOT add custom scope tightening. We pass the
//   signerId straight through; policyIds (Polymarket CTF Exchange + Neg
//   Risk adapters) are configured server-side on the Privy dashboard, not
//   hardcoded here.
//
// TODO(phase 3): once Turnkey/KMS is wired up:
//   1. Set NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID in Vercel env.
//   2. Server backend (services/managed-trading) needs PRIVY_SESSION_SIGNER_PRIVATE_KEY
//      (or Turnkey credentials) to actually sign Polymarket orders on the
//      authorized user's behalf.
//   3. (Optional) Remove the "stub" branch below — by then the env var
//      will always be set in real deployments.

// Mirrors the SDK's SessionSignerInput shape (mutable array, as Privy expects).
// We construct a fresh array per call rather than mutating an existing one.
export type AddSessionSignerFn = (input: {
  address: string;
  signers: { signerId: string; policyIds?: string[] }[];
}) => Promise<unknown>;

export type RemoveSessionSignerFn = (input: {
  address: string;
}) => Promise<unknown>;

export type AuthorizeResult = {
  // Whether the SDK call actually ran. False = stub mode (env var missing).
  sdkInvoked: boolean;
  // The signerId we asked Privy to attach. May be null in stub mode.
  privySessionSignerId: string | null;
};

/**
 * Run the client-side session signer authorization flow.
 *
 * If NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID is set, calls Privy's
 * addSessionSigners for real. Otherwise returns a stub result so the
 * Phase 2 DB flow still works (UI flips, button toggles) and Phase 3
 * implementer just sets the env var to switch to real signing.
 */
export async function authorizeSessionSigner(
  addSessionSigners: AddSessionSignerFn,
  embeddedWalletAddress: string
): Promise<AuthorizeResult> {
  const signerId = process.env.NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID?.trim();

  if (!signerId) {
    // Stub mode — Phase 2 #3 ships the flow, Phase 3 plugs in the real signer.
    return { sdkInvoked: false, privySessionSignerId: null };
  }

  // Real SDK call. Polymarket-scoped policies (CTF Exchange + Neg Risk
  // adapters) live in the Privy dashboard policy config attached to this
  // signerId, NOT in this client code (per plan §0 / §1.1).
  await addSessionSigners({
    address: embeddedWalletAddress,
    signers: [{ signerId }]
  });
  return { sdkInvoked: true, privySessionSignerId: signerId };
}

/**
 * Run the client-side session signer revocation flow.
 *
 * Privy's removeSessionSigners revokes ALL session signers attached to
 * the given wallet, not just our specific signerId. That's fine for our
 * MVP (Raven is the only signer the user grants), but Phase 3 should
 * revisit if multi-signer scenarios appear.
 */
export async function revokeSessionSigner(
  removeSessionSigners: RemoveSessionSignerFn,
  embeddedWalletAddress: string
): Promise<{ sdkInvoked: boolean }> {
  const signerId = process.env.NEXT_PUBLIC_PRIVY_SESSION_SIGNER_ID?.trim();
  if (!signerId) {
    // Stub mode — same rationale as authorize.
    return { sdkInvoked: false };
  }
  await removeSessionSigners({ address: embeddedWalletAddress });
  return { sdkInvoked: true };
}

/**
 * Format an ISO timestamp as a user-readable "X ago + absolute" string.
 * Returns immutable strings — never mutates the input.
 */
export function formatAuthorizationTimestamp(iso: string): {
  relative: string;
  absolute: string;
} {
  const date = new Date(iso);
  const now = Date.now();
  const deltaMs = now - date.getTime();
  const deltaMin = Math.round(deltaMs / 60000);
  let relative: string;
  if (deltaMin < 1) {
    relative = "just now";
  } else if (deltaMin < 60) {
    relative = `${deltaMin}m ago`;
  } else if (deltaMin < 60 * 24) {
    relative = `${Math.round(deltaMin / 60)}h ago`;
  } else {
    relative = `${Math.round(deltaMin / 60 / 24)}d ago`;
  }
  const absolute = date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return { relative, absolute };
}
