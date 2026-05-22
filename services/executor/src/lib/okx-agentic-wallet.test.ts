import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OkxAgenticSigner,
  parseOnchainOsEnvelope,
  pickActiveEvmAddress,
  resolveOkxAgenticAddress,
  resolvePrimaryType
} from "./okx-agentic-wallet.js";
import {
  fetchPolymarketProxyWallet,
  resolvePolymarketSigningIdentity
} from "./polymarket-sdk.js";

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

function createFakeOnchainOsScript(lines: string[]) {
  const dir = path.join(os.tmpdir(), `fake-onchainos-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  const filePath = path.join(dir, "onchainos");
  const body = `#!/bin/sh
set -eu
cmd="$*"
${lines.join("\n")}
`;
  writeFileSync(filePath, body, "utf8");
  chmodSync(filePath, 0o755);
  return filePath;
}

describe("resolvePrimaryType", () => {
  it("skips EIP712Domain and returns the typed payload name", () => {
    expect(resolvePrimaryType({
      EIP712Domain: [{ name: "name", type: "string" }],
      ClobAuth: [{ name: "address", type: "address" }]
    })).toBe("ClobAuth");
  });
});

describe("parseOnchainOsEnvelope", () => {
  it("parses the trailing JSON line after a human-readable prefix", () => {
    const envelope = parseOnchainOsEnvelope<{
      signature: string;
    }>('Session expired. Please log in again: onchainos wallet login\n{"ok":false,"error":"session expired"}');

    expect(envelope.ok).toBe(false);
    expect(envelope.error).toBe("session expired");
  });

  it("parses pretty stdout JSON when stderr only contains a warning", () => {
    const envelope = parseOnchainOsEnvelope<{
      loggedIn: boolean;
    }>(
      '{\n  "ok": true,\n  "data": {\n    "loggedIn": true\n  }\n}\n',
      "Warning: OS keyring write failed, using file fallback\n"
    );

    expect(envelope.ok).toBe(true);
    expect(envelope.data?.loggedIn).toBe(true);
  });
});

describe("pickActiveEvmAddress", () => {
  it("prefers the active account address", () => {
    const address = pickActiveEvmAddress(
      {
        accounts: [
          { accountId: "a", evmAddress: "0x1111111111111111111111111111111111111111", isActive: false },
          { accountId: "b", evmAddress: "0x2222222222222222222222222222222222222222", isActive: true }
        ]
      },
      {
        currentAccountId: "a",
        loggedIn: true
      }
    );

    expect(address).toBe("0x2222222222222222222222222222222222222222");
  });

  it("falls back to the current account id when no explicit active flag exists", () => {
    const address = pickActiveEvmAddress(
      {
        accounts: [
          { accountId: "a", evmAddress: "0x1111111111111111111111111111111111111111" },
          { accountId: "b", evmAddress: "0x2222222222222222222222222222222222222222" }
        ]
      },
      {
        currentAccountId: "b",
        loggedIn: true
      }
    );

    expect(address).toBe("0x2222222222222222222222222222222222222222");
  });

  it("supports the compact current-account balance shape returned by onchainos", () => {
    const address = pickActiveEvmAddress(
      {
        accountId: "acct-2",
        evmAddress: "0x2222222222222222222222222222222222222222"
      },
      {
        currentAccountId: "acct-2",
        loggedIn: true
      }
    );

    expect(address).toBe("0x2222222222222222222222222222222222222222");
  });
});

describe("OkxAgenticSigner", () => {
  it("resolves the active wallet address from onchainos balance output", async () => {
    const script = createFakeOnchainOsScript([
      'if [ "$cmd" = "wallet status" ]; then',
      '  echo \'{"ok":true,"data":{"loggedIn":true,"currentAccountId":"acct-2"}}\'',
      "  exit 0",
      "fi",
      'if [ "$cmd" = "wallet balance" ]; then',
      '  echo \'{"ok":true,"data":{"accounts":[{"accountId":"acct-1","evmAddress":"0x1111111111111111111111111111111111111111"},{"accountId":"acct-2","evmAddress":"0x2222222222222222222222222222222222222222","isActive":true}]}}\'',
      "  exit 0",
      "fi",
      'echo \'{"ok":false,"error":"unexpected command"}\'',
      "exit 1"
    ]);

    const address = await resolveOkxAgenticAddress({
      onchainosBin: script
    });

    expect(address).toBe("0x2222222222222222222222222222222222222222");
  });

  it("delegates typed-data signing to onchainos", async () => {
    const script = createFakeOnchainOsScript([
      'if [ "$cmd" = "wallet status" ]; then',
      '  echo \'{"ok":true,"data":{"loggedIn":true,"currentAccountId":"acct-2"}}\'',
      "  exit 0",
      "fi",
      'if [ "$cmd" = "wallet balance" ]; then',
      '  echo \'{"ok":true,"data":{"accounts":[{"accountId":"acct-2","evmAddress":"0x2222222222222222222222222222222222222222","isActive":true}]}}\'',
      "  exit 0",
      "fi",
      'case "$cmd" in',
      '  "wallet sign-message --type eip712"*)',
      '    echo \'{"ok":true,"data":{"signature":"0xsigned"}}\'',
      "    exit 0",
      "    ;;",
      "esac",
      'echo \'{"ok":false,"error":"unexpected command"}\'',
      "exit 1"
    ]);

    const signer = new OkxAgenticSigner({
      chainId: 137,
      onchainosBin: script
    });

    const signature = await signer._signTypedData(
      { name: "ClobAuthDomain", version: "1", chainId: 137 },
      {
        ClobAuth: [{ name: "address", type: "address" }]
      },
      { address: "0x2222222222222222222222222222222222222222" }
    );

    expect(signature).toBe("0xsigned");
  });

  it("fails fast when onchainos hangs", async () => {
    const script = createFakeOnchainOsScript([
      "sleep 1",
      'echo \'{"ok":true,"data":{"loggedIn":true}}\''
    ]);

    await expect(resolveOkxAgenticAddress({
      onchainosBin: script,
      onchainosTimeoutMs: 50
    })).rejects.toThrow("onchainos command timed out after 50ms");
  });
});

describe("Polymarket signing identity", () => {
  it("uses an explicit deposit-wallet funder as signature type 3 when the OnchainOS signer differs", async () => {
    const script = createFakeOnchainOsScript([
      'if [ "$cmd" = "wallet status" ]; then',
      '  echo \'{"ok":true,"data":{"loggedIn":true,"currentAccountId":"acct-2"}}\'',
      "  exit 0",
      "fi",
      'if [ "$cmd" = "wallet balance" ]; then',
      '  echo \'{"ok":true,"data":{"accounts":[{"accountId":"acct-2","evmAddress":"0x2222222222222222222222222222222222222222","isActive":true}]}}\'',
      "  exit 0",
      "fi",
      'echo \'{"ok":false,"error":"unexpected command"}\'',
      "exit 1"
    ]);

    const identity = await resolvePolymarketSigningIdentity({
      walletProvider: "onchainos",
      privateKey: "",
      funderAddress: "0x3333333333333333333333333333333333333333",
      signatureType: 0,
      onchainosBin: script
    });

    expect(identity).toEqual({
      walletProvider: "onchainos",
      signerAddress: "0x2222222222222222222222222222222222222222",
      funderAddress: "0x3333333333333333333333333333333333333333",
      signatureType: 3,
      walletMode: "proxy",
      proxyWallet: "0x3333333333333333333333333333333333333333"
    });
  });

  it("auto-discovers a Polymarket proxy wallet from the public profile", async () => {
    const script = createFakeOnchainOsScript([
      'if [ "$cmd" = "wallet status" ]; then',
      '  echo \'{"ok":true,"data":{"loggedIn":true,"currentAccountId":"acct-2"}}\'',
      "  exit 0",
      "fi",
      'if [ "$cmd" = "wallet balance" ]; then',
      '  echo \'{"ok":true,"data":{"accounts":[{"accountId":"acct-2","evmAddress":"0x2222222222222222222222222222222222222222","isActive":true}]}}\'',
      "  exit 0",
      "fi",
      'echo \'{"ok":false,"error":"unexpected command"}\'',
      "exit 1"
    ]);
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      proxyWallet: "0x4444444444444444444444444444444444444444"
    }), { status: 200 })) as typeof fetch;

    const identity = await resolvePolymarketSigningIdentity({
      walletProvider: "onchainos",
      privateKey: "",
      funderAddress: "",
      signatureType: 0,
      onchainosBin: script
    });

    expect(identity.funderAddress).toBe("0x4444444444444444444444444444444444444444");
    expect(identity.proxyWallet).toBe("0x4444444444444444444444444444444444444444");
    expect(identity.signatureType).toBe(3);
    expect(identity.walletMode).toBe("proxy");
  });

  it("returns null when the public profile does not expose a proxy wallet", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      proxyWallet: null
    }), { status: 200 })) as typeof fetch;

    await expect(fetchPolymarketProxyWallet("0x2222222222222222222222222222222222222222")).resolves.toBeNull();
  });
});
