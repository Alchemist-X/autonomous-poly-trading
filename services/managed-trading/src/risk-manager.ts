// Per-user risk caps for the managed-trading dispatcher.
//
// `getRiskCapsForTier` maps a user's RiskTier to fixed per-position /
// per-event / total / max-positions / minimum-notional caps. The
// `balanced` tier intentionally mirrors the current Pizza wallet caps
// (15 % / 80 % / 30 % / 22 positions / $5) — services/executor enforces
// these on the single-wallet path; this module mirrors them per user.
//
// `applyCaps` is a pure function: take a list of pre-sized
// ProposedDecision rows + caps + current bankroll, return the kept rows
// (possibly truncated) and the skipped rows (with a reason). Order of
// cap application is deterministic and documented inline so the result
// is reproducible across replays.

import type {
  AppliedDecision,
  ProposedDecision,
  RiskTier,
  SkippedDecision
} from "./types.js";

export interface RiskCaps {
  readonly perPositionPct: number;
  readonly totalExposurePct: number;
  readonly perEventPct: number;
  readonly maxPositions: number;
  readonly minNotionalUsd: number;
}

const TIER_CAPS: Record<RiskTier, RiskCaps> = {
  conservative: {
    perPositionPct: 0.10,
    totalExposurePct: 0.50,
    perEventPct: 0.20,
    maxPositions: 15,
    minNotionalUsd: 5
  },
  balanced: {
    perPositionPct: 0.15,
    totalExposurePct: 0.80,
    perEventPct: 0.30,
    maxPositions: 22,
    minNotionalUsd: 5
  },
  aggressive: {
    perPositionPct: 0.20,
    totalExposurePct: 0.95,
    perEventPct: 0.40,
    maxPositions: 30,
    minNotionalUsd: 5
  }
};

export function getRiskCapsForTier(tier: RiskTier): RiskCaps {
  return TIER_CAPS[tier];
}

export interface ApplyCapsResult {
  readonly kept: AppliedDecision[];
  readonly skipped: SkippedDecision[];
}

// Round to two decimal places (USD cents) — caps are notional thresholds
// and we never need sub-cent precision in storage.
function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

// Deterministic ordering for total-exposure trimming: when total
// exposure exceeds the cap we keep the highest-edge decisions first,
// dropping low-edge tail decisions. Ties broken by larger notional
// (reflecting Kelly conviction) so the result is stable.
function byEdgeDesc(a: ProposedDecision, b: ProposedDecision): number {
  if (b.edge !== a.edge) {
    return b.edge - a.edge;
  }
  return b.notionalUsd - a.notionalUsd;
}

// Apply per-user risk caps to a Phase 2 candidate list. Pure function.
//
// Order of application (deterministic):
//   1. per-position cap   — truncate each row's notional to bankroll * perPositionPct
//   2. per-event cap      — for each event_slug, keep highest-edge decisions until per-event cap reached; drop the rest
//   3. total-exposure cap — sort all kept rows by edge desc; keep adding until total notional reaches bankroll * totalExposurePct; drop the rest
//   4. max-positions cap  — keep the top N rows by edge desc
//   5. min-notional gate  — drop any row whose final notional is below caps.minNotionalUsd
//
// Only `open` actions consume bankroll. `close` / `reduce` / `hold`
// rows pass through untouched (they unwind existing positions and the
// dispatcher never increases exposure on them).
export function applyCaps(
  decisions: ReadonlyArray<ProposedDecision>,
  caps: RiskCaps,
  bankrollUsd: number
): ApplyCapsResult {
  const kept: AppliedDecision[] = [];
  const skipped: SkippedDecision[] = [];

  if (bankrollUsd <= 0) {
    for (const decision of decisions) {
      skipped.push({
        ...decision,
        skippedReason: "blocked_by_zero_bankroll: user safe has no USDC available"
      });
    }
    return { kept, skipped };
  }

  // Split: only `open` rows go through cap maths. Everything else
  // (close/reduce/hold) bypasses the bankroll gates.
  const openRows: ProposedDecision[] = [];
  const passthroughRows: ProposedDecision[] = [];
  for (const decision of decisions) {
    if (decision.action === "open") {
      openRows.push(decision);
    } else {
      passthroughRows.push(decision);
    }
  }

  const perPositionLimit = bankrollUsd * caps.perPositionPct;
  const perEventLimit = bankrollUsd * caps.perEventPct;
  const totalExposureLimit = bankrollUsd * caps.totalExposurePct;

  // Step 1 — per-position cap.
  const stage1: ProposedDecision[] = [];
  for (const row of openRows) {
    const cappedNotional = Math.min(row.notionalUsd, perPositionLimit);
    if (cappedNotional <= 0) {
      skipped.push({
        ...row,
        skippedReason: `blocked_by_per_position_cap: zero notional after cap (limit=${perPositionLimit.toFixed(2)})`
      });
      continue;
    }
    stage1.push({
      ...row,
      notionalUsd: roundUsd(cappedNotional)
    });
  }

  // Step 2 — per-event cap. Within each event_slug bucket, keep
  // highest-edge first; truncate notional or drop overflow rows.
  const stage2: ProposedDecision[] = [];
  const eventBuckets = new Map<string, ProposedDecision[]>();
  for (const row of stage1) {
    const bucket = eventBuckets.get(row.eventSlug) ?? [];
    bucket.push(row);
    eventBuckets.set(row.eventSlug, bucket);
  }
  for (const [, bucket] of eventBuckets) {
    bucket.sort(byEdgeDesc);
    let used = 0;
    for (const row of bucket) {
      const headroom = perEventLimit - used;
      if (headroom <= 0) {
        skipped.push({
          ...row,
          skippedReason: `blocked_by_per_event_cap: event already at ${used.toFixed(2)} / limit ${perEventLimit.toFixed(2)}`
        });
        continue;
      }
      const allowed = Math.min(row.notionalUsd, headroom);
      stage2.push({ ...row, notionalUsd: roundUsd(allowed) });
      used += allowed;
    }
  }

  // Step 3 — total-exposure cap. Highest-edge first; truncate or drop.
  stage2.sort(byEdgeDesc);
  const stage3: ProposedDecision[] = [];
  let totalUsed = 0;
  for (const row of stage2) {
    const headroom = totalExposureLimit - totalUsed;
    if (headroom <= 0) {
      skipped.push({
        ...row,
        skippedReason: `blocked_by_total_exposure_cap: total already at ${totalUsed.toFixed(2)} / limit ${totalExposureLimit.toFixed(2)}`
      });
      continue;
    }
    const allowed = Math.min(row.notionalUsd, headroom);
    stage3.push({ ...row, notionalUsd: roundUsd(allowed) });
    totalUsed += allowed;
  }

  // Step 4 — max-positions cap. Already edge-sorted; just slice.
  const stage4: ProposedDecision[] = [];
  for (let i = 0; i < stage3.length; i += 1) {
    const row = stage3[i]!;
    if (i >= caps.maxPositions) {
      skipped.push({
        ...row,
        skippedReason: `blocked_by_max_positions: already at ${caps.maxPositions} positions`
      });
      continue;
    }
    stage4.push(row);
  }

  // Step 5 — min-notional gate.
  for (const row of stage4) {
    if (row.notionalUsd + 1e-9 < caps.minNotionalUsd) {
      skipped.push({
        ...row,
        skippedReason: `blocked_by_min_notional: ${row.notionalUsd.toFixed(2)} below ${caps.minNotionalUsd.toFixed(2)}`
      });
      continue;
    }
    kept.push({
      ...row,
      bankrollRatio: bankrollUsd > 0 ? row.notionalUsd / bankrollUsd : 0
    });
  }

  // Passthrough rows (close/reduce/hold) — emit as-is without cap math.
  for (const row of passthroughRows) {
    kept.push({
      ...row,
      bankrollRatio: bankrollUsd > 0 ? row.notionalUsd / bankrollUsd : 0
    });
  }

  return { kept, skipped };
}
