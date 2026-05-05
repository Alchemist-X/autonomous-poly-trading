// PolymarketAdapter — abstraction layer over Polymarket SDKs.
//
// Per plan §1.1, business code must not depend on Safe / CLOB internal
// details. This interface is the only surface the dispatcher and Phase 3
// trading flow are allowed to call. Concrete implementations forward to
// `@polymarket/builder-relayer-client` + `@polymarket/clob-client-v2`.
//
// The real implementation lives in `./polymarket-relayer-adapter.ts`
// (`PolymarketRelayerAdapter`). `StubPolymarketAdapter` (below) remains
// useful for dispatcher tests that need a typed adapter without booting
// any SDKs.

export type Address = `0x${string}`;

export type SafeDeployResult = {
  safeAddress: Address;
  deployTxHash: string | null;
  // True if the proxy was already deployed before this call.
  alreadyDeployed: boolean;
};

export type SafeBalance = {
  usdcRaw: bigint;
  usdcFormatted: string;
};

export type OrderSide = "BUY" | "SELL";

export type OrderRequest = {
  tokenId: string;
  side: OrderSide;
  // Limit price 0..1 (Polymarket convention).
  price: number;
  // Notional in USDC (formatted decimal string, e.g. "12.50").
  notionalUsd: string;
};

export type OrderResult = {
  orderId: string;
  status: "open" | "filled" | "partial" | "rejected";
  filledNotionalUsd: string;
  avgPrice: number | null;
  // Present on `rejected` results — classified human-readable message
  // for the dispatcher to persist in `managedDecisions.errorMessage`.
  // Absent on success.
  errorMessage?: string;
};

// Opaque session-signer reference. Concrete adapter holds the actual
// signer object (Privy session signer, KMS-wrapped key, etc.).
export type SessionSigner = {
  readonly id: string;
};

export type Position = {
  tokenId: string;
  marketSlug: string;
  side: "yes" | "no";
  size: string;
  avgCost: number;
  currentPrice: number;
  currentValueUsd: string;
  unrealizedPnlPct: number;
};

// All Polymarket interactions go through this interface. Phase 3 will
// land the concrete implementation; until then `StubPolymarketAdapter`
// satisfies the type and throws if anyone tries to use it.
export interface PolymarketAdapter {
  deploySafe(eoa: Address): Promise<SafeDeployResult>;
  getBalance(safeAddress: Address): Promise<SafeBalance>;
  placeOrder(
    safeAddress: Address,
    order: OrderRequest,
    sessionSigner: SessionSigner
  ): Promise<OrderResult>;
  getPositions(safeAddress: Address): Promise<Position[]>;
}

// Re-export the real implementation so callers can import via this
// barrel without knowing the file split.
export { PolymarketRelayerAdapter } from "./polymarket-relayer-adapter.js";
export type { PolymarketRelayerAdapterOptions } from "./polymarket-relayer-adapter.js";

// Skeleton implementation — useful for typecheck and dependency
// injection wiring. All methods throw on invocation.
export class StubPolymarketAdapter implements PolymarketAdapter {
  async deploySafe(_eoa: Address): Promise<SafeDeployResult> {
    throw new Error("StubPolymarketAdapter.deploySafe: not implemented");
  }

  async getBalance(_safeAddress: Address): Promise<SafeBalance> {
    throw new Error("StubPolymarketAdapter.getBalance: not implemented");
  }

  async placeOrder(
    _safeAddress: Address,
    _order: OrderRequest,
    _sessionSigner: SessionSigner
  ): Promise<OrderResult> {
    throw new Error("StubPolymarketAdapter.placeOrder: not implemented");
  }

  async getPositions(_safeAddress: Address): Promise<Position[]> {
    throw new Error("StubPolymarketAdapter.getPositions: not implemented");
  }
}
