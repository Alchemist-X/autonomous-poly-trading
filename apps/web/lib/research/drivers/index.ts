// Driver selector — the single place env decides which chain runs.
//
//   RESEARCH_DRIVER = mock (default) | api | vps
//
// `mock` always works with zero config. `api` (Chain B) and `vps` (Chain A) are
// hot-swapped in by setting this var; if the chosen live driver isn't fully
// configured it throws DriverNotConfiguredError and the route transparently
// falls back to mock with a visible notice. That fallback is what lets you flip
// real ↔ mock by env alone without redeploying UI.

import { apiDriver } from "./api-driver";
import { mockDriver } from "./mock-driver";
import { vpsAgentDriver } from "./vps-agent-driver";
import type { ResearchDriver } from "./types";

export type RequestedDriverId = "mock" | "api" | "vps";

const REGISTRY: Record<RequestedDriverId, ResearchDriver> = {
  mock: mockDriver,
  api: apiDriver,
  vps: vpsAgentDriver
};

export function resolveRequestedDriverId(): RequestedDriverId {
  const raw = process.env.RESEARCH_DRIVER?.trim().toLowerCase();
  if (raw === "api" || raw === "vps" || raw === "mock") {
    return raw;
  }
  return "mock";
}

export function getDriver(id: RequestedDriverId): ResearchDriver {
  return REGISTRY[id];
}

export { mockDriver };
export type { ResearchDriver };
