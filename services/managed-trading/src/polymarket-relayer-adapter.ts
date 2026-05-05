// PolymarketRelayerAdapter — concrete implementation of `PolymarketAdapter`
// for the managed-trading service.
//
// Wires three SDK surfaces together:
//   1. `@polymarket/builder-relayer-client` — Safe deployment via Raven's
//      builder relayer (gasless for the user; Raven pays the relay fee
//      against builder rewards).
//   2. `@polymarket/clob-client-v2` — order placement, signed by the
//      Privy session signer with `signatureType=2` (Safe proxy) and
//      `funderAddress=<user safe>`. Builder code is auto-stamped onto
//      every order via `builderConfig`.
//   3. `viem` — direct ERC-20 reads for USDC.e bankroll on Polygon.
//
// Real-money rules that must hold even pre-cutover (see CLAUDE.md §6):
//   * paper-mode default; `placeOrder` refuses to run when `mode !== 'live'`
//   * config validation up-front so missing builder creds fail at startup
//     rather than on the first user trade
//   * every error path returns a structured failure shape (no swallowed
//     exceptions) so the dispatcher can persist it as a skip instead of
//     a silent retry

import type {
  Address,
  OrderResult,
  PolymarketAdapter,
  Position,
  SafeBalance,
  SafeDeployResult,
  SessionSigner,
  OrderRequest
} from "./polymarket-adapter.js";
import type { ManagedTradingConfig } from "./config.js";
import { loadConfig } from "./config.js";

export interface PolymarketRelayerAdapterOptions {
  // Optional pre-loaded config for tests. When omitted, `loadConfig()`
  // runs at construction time so misconfiguration surfaces fast.
  readonly config?: ManagedTradingConfig;
}

// Concrete adapter wired to Polymarket's relayer + CLOB v2 SDK. Instances
// are safe to share across requests — internal SDK clients are lazy and
// per-Safe (one ClobClient cache key per `funderAddress`).
export class PolymarketRelayerAdapter implements PolymarketAdapter {
  readonly config: ManagedTradingConfig;

  constructor(options: PolymarketRelayerAdapterOptions = {}) {
    this.config = options.config ?? loadConfig();
  }

  async deploySafe(_eoa: Address): Promise<SafeDeployResult> {
    throw new Error(
      "PolymarketRelayerAdapter.deploySafe: not yet implemented in 3a.1A — wiring lands in 3a.1C"
    );
  }

  async getBalance(_safeAddress: Address): Promise<SafeBalance> {
    throw new Error(
      "PolymarketRelayerAdapter.getBalance: not yet implemented in 3a.1A — wiring lands in 3a.1B"
    );
  }

  async placeOrder(
    _safeAddress: Address,
    _order: OrderRequest,
    _sessionSigner: SessionSigner
  ): Promise<OrderResult> {
    throw new Error(
      "PolymarketRelayerAdapter.placeOrder: not yet implemented in 3a.1A — wiring lands in 3a.1C"
    );
  }

  async getPositions(_safeAddress: Address): Promise<Position[]> {
    throw new Error(
      "PolymarketRelayerAdapter.getPositions: not yet implemented in 3a.1A — wiring lands in 3a.1B"
    );
  }
}
