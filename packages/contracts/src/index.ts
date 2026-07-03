// Barrel: the four contract domains are defined in sibling files and
// re-exported here so `@autopoly/contracts` keeps its flat public surface.
// - trade-decision: live-order schemas + queue/job/admin/system enums
// - public-api: read-only shapes for the public web API
// - paper-trading: paper-fill simulation logic
// - rough-loop: dev-tool task schemas (consumed only by services/rough-loop)
export * from "./trade-decision.js";
export * from "./public-api.js";
export * from "./paper-trading.js";
export * from "./rough-loop.js";
