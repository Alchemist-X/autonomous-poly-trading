import { describe, expect, it } from "vitest";
import {
  buildCredentialsCheck,
  buildEnvFileCheck,
  buildExecutionModeCheck,
  buildSignerFunderCheck,
  getPreflightBlockingReason,
  type PreflightWalletIdentity
} from "./preflight-checks.ts";

// Characterization tests: lock the canonical (pulse-live) behavior that both
// forecast:live and agent:persistent now share, so future edits to the gates
// can't silently drift the two entries apart again.

const onchainos: PreflightWalletIdentity = {
  signerAddress: "0x1111111111111111111111111111111111111111",
  funderAddress: "0x2222222222222222222222222222222222222222",
  signatureType: 2,
  walletMode: "proxy"
};

describe("buildExecutionModeCheck", () => {
  it("passes only when the mode is live, and is always blocking", () => {
    const ok = buildExecutionModeCheck("live");
    expect(ok).toMatchObject({ key: "execution-mode", blocking: true, ok: true, summary: "Execution mode is live." });
    const bad = buildExecutionModeCheck("paper");
    expect(bad).toMatchObject({ blocking: true, ok: false });
    expect(bad.summary).toBe("AUTOPOLY_EXECUTION_MODE must be live. Received paper.");
    expect(buildExecutionModeCheck(undefined).summary).toBe("AUTOPOLY_EXECUTION_MODE must be live. Received -.");
  });
});

describe("buildEnvFileCheck", () => {
  it("uses the caller's run context in the failure message", () => {
    expect(buildEnvFileCheck("/x/.env.pizza", "forecast:live runs")).toMatchObject({
      blocking: true,
      ok: true,
      summary: "Using env file /x/.env.pizza."
    });
    expect(buildEnvFileCheck(null, "persistent live runs")).toMatchObject({
      ok: false,
      summary: "ENV_FILE is required for persistent live runs."
    });
  });
});

describe("buildCredentialsCheck", () => {
  it("onchainos: ok iff a wallet identity resolved", () => {
    const ok = buildCredentialsCheck({
      usesOnchainOsWallet: true,
      walletIdentity: onchainos,
      walletIdentityError: null,
      hasPrivateKey: false,
      hasFunderAddress: false,
      blocking: true
    });
    expect(ok.ok).toBe(true);
    expect(ok.summary).toContain("WALLET_PROVIDER=onchainos");
    expect(ok.summary).toContain("signatureType=2");

    const failed = buildCredentialsCheck({
      usesOnchainOsWallet: true,
      walletIdentity: null,
      walletIdentityError: "session expired",
      hasPrivateKey: false,
      hasFunderAddress: false,
      blocking: true
    });
    expect(failed.ok).toBe(false);
    expect(failed.summary).toBe("WALLET_PROVIDER=onchainos, but wallet identity could not be resolved: session expired.");
  });

  it("private-key path: ok iff both key and funder present; blocking is passthrough", () => {
    expect(
      buildCredentialsCheck({
        usesOnchainOsWallet: false,
        walletIdentity: null,
        walletIdentityError: null,
        hasPrivateKey: true,
        hasFunderAddress: true,
        blocking: false
      })
    ).toMatchObject({ ok: true, blocking: false, summary: "PRIVATE_KEY and FUNDER_ADDRESS are present." });

    expect(
      buildCredentialsCheck({
        usesOnchainOsWallet: false,
        walletIdentity: null,
        walletIdentityError: null,
        hasPrivateKey: true,
        hasFunderAddress: false,
        blocking: true
      })
    ).toMatchObject({ ok: false, blocking: true, summary: "Missing PRIVATE_KEY or FUNDER_ADDRESS." });
  });
});

describe("buildSignerFunderCheck", () => {
  it("is never blocking and reports match/mismatch/missing by name", () => {
    const match = buildSignerFunderCheck({
      usesOnchainOsWallet: false,
      walletIdentity: null,
      signerAddress: "0xabc",
      funderAddress: "0xABC",
      signerMatchesFunder: true
    });
    expect(match).toMatchObject({ blocking: false, ok: true, summary: "Signer address matches FUNDER_ADDRESS." });

    const mismatch = buildSignerFunderCheck({
      usesOnchainOsWallet: false,
      walletIdentity: null,
      signerAddress: "0xaaa",
      funderAddress: "0xbbb",
      signerMatchesFunder: false
    });
    expect(mismatch.summary).toContain("does not match FUNDER_ADDRESS");
    expect(mismatch.summary).toContain("proxy/funder setup may be intentional");

    expect(
      buildSignerFunderCheck({
        usesOnchainOsWallet: false,
        walletIdentity: null,
        signerAddress: "",
        funderAddress: "0xbbb",
        signerMatchesFunder: false
      }).summary
    ).toBe("Unable to derive signer address from PRIVATE_KEY.");

    expect(
      buildSignerFunderCheck({
        usesOnchainOsWallet: true,
        walletIdentity: onchainos,
        signerAddress: onchainos.signerAddress,
        funderAddress: onchainos.funderAddress,
        signerMatchesFunder: false
      }).summary
    ).toContain("trades through proxy funder");
  });
});

describe("getPreflightBlockingReason", () => {
  it("returns the first blocking failed check's summary, else null", () => {
    expect(getPreflightBlockingReason([{ key: "a", blocking: true, ok: true, summary: "ok" }])).toBeNull();
    expect(
      getPreflightBlockingReason([
        { key: "a", blocking: false, ok: false, summary: "non-blocking fail" },
        { key: "b", blocking: true, ok: false, summary: "blocked here" },
        { key: "c", blocking: true, ok: false, summary: "second block" }
      ])
    ).toBe("blocked here");
  });
});
