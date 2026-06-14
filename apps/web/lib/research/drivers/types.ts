// Driver contract. A driver knows how to turn one research request into a
// stream of events (via the shared `emit` callback). The route picks a driver
// from env and pipes its emits into the SSE response. Every driver produces the
// same event protocol, so the frontend never knows or cares which one ran.

import type { NornTier } from "@autopoly/norns";
import type { ResearchEvent } from "../events";
import type { EmitFn } from "../replay";

export interface ResearchRequest {
  eventText: string;
  // Optional market price (0-1 probability or 0-100 percent). Kept secondary:
  // the product's job is an independent probability; market is only an
  // after-the-fact comparison and may be omitted entirely.
  marketPrice?: number | null;
  // Norns capability tier (urd / verdandi / skuld). The route normalises this
  // from the request body before handing it to a driver; defaults to verdandi.
  tier?: NornTier;
}

export interface ResearchDriver {
  readonly id: "mock" | "api" | "vps";
  run(request: ResearchRequest, emit: EmitFn, signal?: AbortSignal): Promise<void>;
}

// Thrown by the live drivers (api / vps) when their required env is absent.
// The route catches this specifically and falls back to the mock driver with a
// visible notice — this is what makes mock ↔ real hot-swappable by env alone.
export class DriverNotConfiguredError extends Error {
  readonly missing: string[];
  constructor(message: string, missing: string[] = []) {
    super(message);
    this.name = "DriverNotConfiguredError";
    this.missing = missing;
  }
}

export type { EmitFn, ResearchEvent };
