/**
 * Shared preflight checks for the live-trading entry scripts.
 *
 * Before this, forecast:live (pulse-live.ts) and agent:persistent
 * (agent-persistent-runner.ts) each maintained their own copy of the
 * execution-mode / env-file / credentials / signer-funder gates. They had
 * DRIFTED — most importantly, only pulse-live handled the onchainos wallet in
 * its credentials/signer checks, so the same onchainos wallet passed the gate
 * from forecast:live but was rejected from agent:persistent.
 *
 * pulse-live is the canonical, battle-tested entry (the daily real-money path);
 * these builders reproduce its exact behavior. agent:persistent adopts them,
 * which incidentally closes the onchainos gap. (live-test's preflight keeps its
 * own differently-shaped, unit-tested pure function.)
 */
import { maskAddressForDisplay } from "./live-run-common.js";

export interface PreflightCheck {
  readonly key: string;
  readonly blocking: boolean;
  readonly ok: boolean;
  readonly summary: string;
}

// A resolved onchainos/proxy wallet identity, as returned by
// resolvePolymarketSigningIdentity. Typed structurally so this module stays
// free of the executor package import.
export interface PreflightWalletIdentity {
  readonly signerAddress: string;
  readonly funderAddress: string;
  readonly signatureType: number;
  readonly walletMode: string;
}

export function getPreflightBlockingReason(checks: readonly PreflightCheck[]): string | null {
  return checks.find((check) => check.blocking && !check.ok)?.summary ?? null;
}

export function buildExecutionModeCheck(executionMode: string | undefined): PreflightCheck {
  const ok = executionMode === "live";
  return {
    key: "execution-mode",
    blocking: true,
    ok,
    summary: ok ? "Execution mode is live." : `AUTOPOLY_EXECUTION_MODE must be live. Received ${executionMode ?? "-"}.`
  };
}

export function buildEnvFileCheck(envFilePath: string | null | undefined, runContext: string): PreflightCheck {
  return {
    key: "env-file",
    blocking: true,
    ok: Boolean(envFilePath),
    summary: envFilePath ? `Using env file ${envFilePath}.` : `ENV_FILE is required for ${runContext}.`
  };
}

export function buildCredentialsCheck(input: {
  usesOnchainOsWallet: boolean;
  walletIdentity: PreflightWalletIdentity | null;
  walletIdentityError: string | null;
  hasPrivateKey: boolean;
  hasFunderAddress: boolean;
  blocking: boolean;
}): PreflightCheck {
  const { usesOnchainOsWallet, walletIdentity, walletIdentityError, hasPrivateKey, hasFunderAddress, blocking } = input;
  return {
    key: "credentials",
    blocking,
    ok: usesOnchainOsWallet ? walletIdentity != null : Boolean(hasPrivateKey && hasFunderAddress),
    summary: usesOnchainOsWallet
      ? walletIdentity
        ? `WALLET_PROVIDER=onchainos. Active signer ${maskAddressForDisplay(walletIdentity.signerAddress)}; Polymarket funder ${maskAddressForDisplay(walletIdentity.funderAddress)}; signatureType=${walletIdentity.signatureType}.`
        : `WALLET_PROVIDER=onchainos, but wallet identity could not be resolved: ${walletIdentityError ?? "unknown error"}.`
      : hasPrivateKey && hasFunderAddress
        ? "PRIVATE_KEY and FUNDER_ADDRESS are present."
        : "Missing PRIVATE_KEY or FUNDER_ADDRESS."
  };
}

export function buildSignerFunderCheck(input: {
  usesOnchainOsWallet: boolean;
  walletIdentity: PreflightWalletIdentity | null;
  signerAddress: string;
  funderAddress: string;
  signerMatchesFunder: boolean;
}): PreflightCheck {
  const { usesOnchainOsWallet, walletIdentity, signerAddress, funderAddress, signerMatchesFunder } = input;
  return {
    key: "signer-funder",
    blocking: false,
    ok: true,
    summary: usesOnchainOsWallet
      ? walletIdentity
        ? `OnchainOS signer ${maskAddressForDisplay(walletIdentity.signerAddress)} trades through ${walletIdentity.walletMode} funder ${maskAddressForDisplay(walletIdentity.funderAddress)}.`
        : "OnchainOS signer/funder alignment is unavailable until the wallet session resolves."
      : !signerAddress
        ? "Unable to derive signer address from PRIVATE_KEY."
        : !funderAddress
          ? "FUNDER_ADDRESS is missing."
          : signerMatchesFunder
            ? "Signer address matches FUNDER_ADDRESS."
            : `Signer ${signerAddress} does not match FUNDER_ADDRESS ${funderAddress}. Proceeding in non-blocking mode (proxy/funder setup may be intentional).`
  };
}
