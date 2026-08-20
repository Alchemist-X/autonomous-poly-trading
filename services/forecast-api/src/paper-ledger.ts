// Shared reading + typing of the paper-agent's append-only ledger. The agent
// writes one JSON object per line (services/paper-agent/src/store.ts); every
// consumer here treats unknown event types as inert, so a new event kind on
// the agent side can never break the review endpoints.

import { existsSync, readFileSync } from "node:fs";

export interface PaperLedgerEvent {
  ts?: string;
  type?: string;
  positionId?: string;
  slug?: string;
  outcome?: string;
  outcomeIndex?: number;
  side?: "buy" | "sell" | string;
  style?: string;
  shares?: number;
  avgPrice?: number;
  feeUsd?: number;
  reason?: string;
  detail?: string;
  action?: string;
  kind?: string;
  edgePp?: number;
  netEdgePp?: number;
  probYes?: number;
  marketProbYes?: number;
  agentProbOutcome?: number;
  bestBid?: number;
  forecastId?: string;
  engineRounds?: number;
  evidenceCount?: number;
  saturatedAt?: "floor" | "ceil" | null;
  contaminated?: boolean;
  saturatedHold?: boolean;
  enter?: boolean;
  error?: string;
  [key: string]: unknown;
}

export function readLedger(file: string): PaperLedgerEvent[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as PaperLedgerEvent];
      } catch {
        return [];
      }
    });
}

/** Position ids are "<slug>:<outcomeIndex>" — 0 = YES, 1 = NO. */
export function outcomeIndexOf(positionId: string): number | null {
  const suffix = positionId.split(":").pop();
  const idx = Number(suffix);
  return suffix !== undefined && Number.isInteger(idx) && idx >= 0 ? idx : null;
}

export function slugOfPositionId(positionId: string): string {
  const parts = positionId.split(":");
  return parts.slice(0, -1).join(":") || positionId;
}
