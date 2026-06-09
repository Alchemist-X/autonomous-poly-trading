// Explicit per-stage model assignment for the typed forecasting pipeline.
//
// Mixed-model strategy (architecture decision, 2026-06-10):
//   - Information stages (clarify rules / design searches / gather evidence) -> Sonnet (cheaper, fast)
//   - Judgment stages (score evidence / build model / bayesian update / verify) -> Opus (deepest reasoning)
//
// This map is the single source of truth; producers read modelForStage(<stage>) and pass it on the
// LLM call so every `claude --print` runs on the right tier. Changing a tier here changes it everywhere.

export type StageModelTier = "sonnet" | "opus";

export const STAGE_MODEL_IDS: Record<StageModelTier, string> = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-8"
};

export type PulseStageId =
  | "resolution"          // stage 1
  | "query_plan"          // stage 2
  | "sources"             // stage 3
  | "evidence_ledger"     // stage 4
  | "conditional_model"   // stage 5
  | "bayes_ledger"        // stage 6
  | "verifier";           // stage 6 second-pass audit

export const PULSE_STAGE_MODEL: Record<PulseStageId, StageModelTier> = {
  resolution: "sonnet", //        stage 1 — clarify resolution rules (information)
  query_plan: "sonnet", //        stage 2 — design search queries (information)
  sources: "sonnet", //           stage 3 — gather + extract evidence (information)
  evidence_ledger: "opus", //     stage 4 — score / weigh evidence (judgment)
  conditional_model: "opus", //   stage 5 — P(A)xP(B|A)xP(C) decomposition (judgment)
  bayes_ledger: "opus", //        stage 6 — bayesian probability update (judgment)
  verifier: "opus" //             stage 6 audit — arithmetic / source-use consistency (judgment)
};

export function tierForStage(stage: PulseStageId): StageModelTier {
  return PULSE_STAGE_MODEL[stage];
}

export function modelForStage(stage: PulseStageId): string {
  return STAGE_MODEL_IDS[PULSE_STAGE_MODEL[stage]];
}
