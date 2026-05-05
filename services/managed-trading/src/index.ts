// Barrel export for the managed-trading service.
//
// Phase 2 scope: paper-mode dispatcher that consumes pre-sized
// `ProposedDecision[]` and persists per-user decisions to the
// `managed_*` tables. Phase 3 swaps in real CLOB execution.

export * from "./types.js";
export * from "./polymarket-adapter.js";
export * from "./risk-manager.js";
export * from "./dispatcher.js";
export * from "./config.js";
export * from "./proposed-decision-mapper.js";
export * from "./alerts.js";
export * from "./risk-events.js";
