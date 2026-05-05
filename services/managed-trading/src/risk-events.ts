// Helper for inserting `risk_events` rows from the managed-pulse bridge.
//
// `risk_events` is the project-wide event ledger (see
// `packages/db/src/schema.ts`). Per CLAUDE.md §6 + §7 we want every
// dispatch failure persisted there so ops can replay later — but we
// also can't let a DB write failure abort the bridge run, so this
// module catches + logs and returns `boolean` instead of throwing.

import { randomUUID } from "node:crypto";
import { riskEvents } from "@autopoly/db";
import type { Db } from "./db-schema-adapter.js";

export type RiskEventSeverity = "info" | "warn" | "critical";

export interface RiskEventInput {
  readonly eventType: string;
  readonly severity: RiskEventSeverity;
  readonly message: string;
  readonly relatedTokenId?: string | null;
  readonly metadata?: Record<string, unknown>;
}

// Best-effort insert. Returns `true` on success, `false` on any error
// (the caller usually doesn't care; alerts already cover the user-facing
// signal). Logs to stderr via console.warn so the bridge's stderr stream
// captures it.
export async function recordRiskEvent(
  db: Db,
  input: RiskEventInput
): Promise<boolean> {
  try {
    await db.insert(riskEvents).values({
      id: randomUUID(),
      eventType: input.eventType,
      severity: input.severity,
      message: input.message,
      relatedTokenId: input.relatedTokenId ?? null,
      metadata: input.metadata ?? {}
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[managed-trading] recordRiskEvent failed (eventType=${input.eventType}): ${message}`
    );
    return false;
  }
}
