// Polymarket Safe address derivation.
//
// Polymarket Safes are deployed deterministically via CREATE2 — the address
// for a given EOA is known before the proxy is actually deployed (Polymarket
// auto-deploys it on first trade). We use the official SDK's `deriveSafe`
// helper, and source the SafeFactory address through `RelayClient.contractConfig`
// so any future contract upgrade only requires bumping the SDK version. We
// never hardcode factory addresses or replicate CREATE2 math here (see plan §1.1).

import { RelayClient, deriveSafe } from "@polymarket/builder-relayer-client";

const POLYGON_CHAIN_ID = 137;
const EOA_REGEX = /^0x[0-9a-fA-F]{40}$/;

// `RelayClient` requires a relayer URL even when only used for static config
// reads. Empty string is fine for derivation since no HTTP call is issued.
const RELAYER_URL_PLACEHOLDER = "";

let cachedSafeFactory: string | null = null;

function getSafeFactory(): string {
  if (cachedSafeFactory) return cachedSafeFactory;
  // Instantiate without a signer — derivation only needs the static
  // contractConfig populated by the SDK from chainId.
  const client = new RelayClient(RELAYER_URL_PLACEHOLDER, POLYGON_CHAIN_ID);
  const factory = client.contractConfig.SafeContracts.SafeFactory;
  if (!factory) {
    throw new Error("safe factory missing in SDK contract config");
  }
  cachedSafeFactory = factory;
  return factory;
}

export type SafeDerivationResult =
  | { ok: true; safeAddress: string }
  | { ok: false; reason: string };

// Derive a Polymarket Safe proxy address from an EOA.
// Returns the deterministic CREATE2 address — the proxy doesn't have to be
// deployed yet. Pure SDK call, no network or credentials required.
export function deriveSafeAddress(eoa: string): SafeDerivationResult {
  if (!eoa || !EOA_REGEX.test(eoa)) {
    return { ok: false, reason: "invalid eoa address" };
  }

  try {
    const factory = getSafeFactory();
    const safeAddress = deriveSafe(eoa, factory);
    return { ok: true, safeAddress };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `derivation failed: ${message}` };
  }
}
