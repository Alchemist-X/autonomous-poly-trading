import type { OrchestratorConfig } from "../config.js";

export type PulseStageFlowPurpose = "market-scan" | "position-review";
export type PulseStageFlowImplementation = "implemented" | "partial" | "not_implemented";

export interface PulseStageFlowEstimate {
  additionalExternalCalls: {
    min: number;
    max: number;
    description: string;
  };
  additionalLlmCalls: {
    min: number;
    max: number;
    description: string;
  };
  additionalInputTokens: {
    min: number;
    max: number;
  };
  additionalOutputTokens: {
    min: number;
    max: number;
  };
  additionalWallClockSeconds: {
    min: number;
    max: number;
  };
}

export interface PulseStageFlowStep {
  id: string;
  diagramStage: "stage1" | "stage2";
  order: number;
  label: string;
  implementation: PulseStageFlowImplementation;
  currentImplementation: string[];
  gaps: string[];
  fullParityWork: string[];
  estimate: PulseStageFlowEstimate;
}

export interface PulseStageFlowReport {
  generated_at_utc: string;
  source_framework: "skills/probability-analysis";
  purpose: PulseStageFlowPurpose;
  selected_candidates: number;
  report_candidates: number;
  current_external_collection: {
    polymarket_event_scrapes: number;
    orderbook_reads: number;
    web_search_queries: number;
    web_search_timeout_seconds: number;
  };
  summary: {
    implemented_steps: number;
    partial_steps: number;
    not_implemented_steps: number;
    current_llm_report_calls: number;
    current_llm_search_calls: number;
    full_parity_incremental_estimate: PulseStageFlowEstimate;
  };
  steps: PulseStageFlowStep[];
}

type PulseStageFlowConfig = {
  pulseAiPrescreen: boolean;
  pulse: Pick<OrchestratorConfig["pulse"], "reportCandidates" | "webSearchEnabled" | "webSearchTimeoutSeconds">;
};

function scaleRange(base: { min: number; max: number }, selectedCandidates: number): { min: number; max: number } {
  const factor = Math.max(1, selectedCandidates) / 4;
  return {
    min: Math.round(base.min * factor),
    max: Math.round(base.max * factor)
  };
}

function estimate(input: {
  selectedCandidates: number;
  externalCalls?: { min: number; max: number; description: string };
  llmCalls?: { min: number; max: number; description: string };
  inputTokens?: { min: number; max: number };
  outputTokens?: { min: number; max: number };
  wallClockSeconds?: { min: number; max: number };
}): PulseStageFlowEstimate {
  return {
    additionalExternalCalls: input.externalCalls ?? {
      min: 0,
      max: 0,
      description: "No additional external calls beyond the current Pulse context."
    },
    additionalLlmCalls: input.llmCalls ?? {
      min: 0,
      max: 0,
      description: "Can be folded into the existing single report-render call."
    },
    additionalInputTokens: scaleRange(input.inputTokens ?? { min: 0, max: 0 }, input.selectedCandidates),
    additionalOutputTokens: scaleRange(input.outputTokens ?? { min: 0, max: 0 }, input.selectedCandidates),
    additionalWallClockSeconds: scaleRange(input.wallClockSeconds ?? { min: 0, max: 0 }, input.selectedCandidates)
  };
}

function addEstimates(estimates: PulseStageFlowEstimate[]): PulseStageFlowEstimate {
  return estimates.reduce<PulseStageFlowEstimate>(
    (total, item) => ({
      additionalExternalCalls: {
        min: total.additionalExternalCalls.min + item.additionalExternalCalls.min,
        max: total.additionalExternalCalls.max + item.additionalExternalCalls.max,
        description: "Sum of per-stage calls required for strict screenshot-flow parity."
      },
      additionalLlmCalls: {
        min: total.additionalLlmCalls.min + item.additionalLlmCalls.min,
        max: total.additionalLlmCalls.max + item.additionalLlmCalls.max,
        description: "Sum of extra LLM calls; the lower bound assumes all reasoning stays in the existing report render."
      },
      additionalInputTokens: {
        min: total.additionalInputTokens.min + item.additionalInputTokens.min,
        max: total.additionalInputTokens.max + item.additionalInputTokens.max
      },
      additionalOutputTokens: {
        min: total.additionalOutputTokens.min + item.additionalOutputTokens.min,
        max: total.additionalOutputTokens.max + item.additionalOutputTokens.max
      },
      additionalWallClockSeconds: {
        min: total.additionalWallClockSeconds.min + item.additionalWallClockSeconds.min,
        max: total.additionalWallClockSeconds.max + item.additionalWallClockSeconds.max
      }
    }),
    {
      additionalExternalCalls: { min: 0, max: 0, description: "" },
      additionalLlmCalls: { min: 0, max: 0, description: "" },
      additionalInputTokens: { min: 0, max: 0 },
      additionalOutputTokens: { min: 0, max: 0 },
      additionalWallClockSeconds: { min: 0, max: 0 }
    }
  );
}

export function buildPulseStageFlowReport(input: {
  config: PulseStageFlowConfig;
  generatedAtUtc: string;
  purpose?: PulseStageFlowPurpose;
  selectedCandidates: number;
}): PulseStageFlowReport {
  const selectedCandidates = Math.max(1, input.selectedCandidates);
  const webSearchQueries = input.config.pulse.webSearchEnabled ? selectedCandidates * 4 : 0;
  const orderbookReads = selectedCandidates * 3;
  const purpose = input.purpose ?? "market-scan";

  const steps: PulseStageFlowStep[] = [
    {
      id: "resolution_definition",
      diagramStage: "stage1",
      order: 1,
      label: "Clarify resolution definition",
      implementation: "partial",
      currentImplementation: [
        "Pulse stores market question, URL, event slug, market slug, tags, end date, and Polymarket rules scraped from the event page.",
        "The report prompt requires missing data to be marked unavailable instead of invented."
      ],
      gaps: [
        "The Yes/No boundary is still written by the report LLM, not validated as a typed object.",
        "No machine gate confirms who can represent each party or which official source resolves the event."
      ],
      fullParityWork: [
        "Add a typed resolution-definition block per candidate before report rendering.",
        "Validate deadline, timezone, representative authority, and boundary traps before probability output."
      ],
      estimate: estimate({
        selectedCandidates,
        outputTokens: { min: 600, max: 1200 },
        wallClockSeconds: { min: 20, max: 45 }
      })
    },
    {
      id: "search_query_design",
      diagramStage: "stage1",
      order: 2,
      label: "Base reasoning and search-query design",
      implementation: "partial",
      currentImplementation: [
        "Pulse generates deterministic web-search queries from market question, category, and tags.",
        "AI pre-screen can optionally classify candidates before deep research."
      ],
      gaps: [
        "Queries are template-built, not decomposed by LLM into event-specific necessary conditions.",
        "The query plan is not archived as first-class evidence with expected source categories."
      ],
      fullParityWork: [
        "Add a query-plan artifact with 2-5 event nodes and source-specific queries per node.",
        "Let the report LLM consume both the deterministic queries and the event-node plan."
      ],
      estimate: estimate({
        selectedCandidates,
        outputTokens: { min: 800, max: 1500 },
        wallClockSeconds: { min: 15, max: 40 }
      })
    },
    {
      id: "evidence_collection",
      diagramStage: "stage1",
      order: 3,
      label: "Collect and list evidence",
      implementation: "partial",
      currentImplementation: [
        "Pulse scrapes Polymarket rules, context, comments, and CLOB order books.",
        "Pulse web-search stores Exa result titles, URLs, hosts, snippets, publish dates, status, and timeout/failure details."
      ],
      gaps: [
        "Current web-search does not fetch and compare full article/page bodies.",
        "Twitter/X, Reddit, Telegram, military maps, and some official/local sources are not authenticated or normalized.",
        "Source categories are inferred in the report instead of stored as a typed evidence table."
      ],
      fullParityWork: [
        "Fetch selected result pages and extract dated evidence records with source category, stance, and reliability.",
        "Add allowlisted official/mainstream/local/third-party connectors where API access is legal and stable."
      ],
      estimate: estimate({
        selectedCandidates,
        externalCalls: {
          min: selectedCandidates * 5,
          max: selectedCandidates * 10,
          description: "Additional page fetches for official, mainstream, party-local, and third-party source comparison."
        },
        inputTokens: { min: 8000, max: 20000 },
        outputTokens: { min: 900, max: 1800 },
        wallClockSeconds: { min: 60, max: 180 }
      })
    },
    {
      id: "evidence_weighting",
      diagramStage: "stage1",
      order: 4,
      label: "Update evidence weights",
      implementation: "partial",
      currentImplementation: [
        "The report prompt requires evidence chains, source lists, and confidence handling.",
        "Source recency and reliability are currently handled in prose by the report LLM."
      ],
      gaps: [
        "No typed per-evidence weight exists for support/opposition strength, recency, primary-source status, or corroboration.",
        "The executor cannot audit whether the final probability follows the evidence weights."
      ],
      fullParityWork: [
        "Add an evidence ledger with direction, strength, recency score, credibility score, and affected model node.",
        "Persist the ledger next to recommendation.json and expose it in the frontend."
      ],
      estimate: estimate({
        selectedCandidates,
        outputTokens: { min: 1500, max: 3000 },
        wallClockSeconds: { min: 45, max: 90 }
      })
    },
    {
      id: "structured_model",
      diagramStage: "stage2",
      order: 5,
      label: "Build a structured event model",
      implementation: "partial",
      currentImplementation: [
        "The report prompt requires probability evaluation, reasoning logic, and sizing guidance.",
        "Entry Planner parses probability rows from Markdown and recomputes edge/Kelly from extracted probabilities."
      ],
      gaps: [
        "Conditional nodes such as P(A) x P(B|A) x P(C|A,B) are not stored as machine-readable model nodes.",
        "The model can be explained in Markdown but cannot yet be programmatically checked for arithmetic consistency."
      ],
      fullParityWork: [
        "Add typed conditional-model nodes with probability, rationale, evidence links, and residual uncertainty.",
        "Validate that final P(Yes) equals the node product or explicitly records a calibrated override."
      ],
      estimate: estimate({
        selectedCandidates,
        outputTokens: { min: 1500, max: 3000 },
        wallClockSeconds: { min: 45, max: 120 }
      })
    },
    {
      id: "bayesian_update",
      diagramStage: "stage2",
      order: 6,
      label: "Bayesian-style evidence update",
      implementation: "partial",
      currentImplementation: [
        "The report prompt asks the LLM to explain probability changes and confidence.",
        "The final decision report later summarizes probability judgment and evidence coverage."
      ],
      gaps: [
        "Base-rate selection and each update step are not stored as a typed delta ledger.",
        "There is no second-pass verifier checking if evidence deltas are internally consistent."
      ],
      fullParityWork: [
        "Persist base probability, update deltas, final probability, and credible interval.",
        "Optionally add a second LLM verifier pass for probability arithmetic and source-use consistency."
      ],
      estimate: estimate({
        selectedCandidates,
        llmCalls: {
          min: 0,
          max: 1,
          description: "No extra call if folded into report render; one extra verifier call for strict audit mode."
        },
        inputTokens: { min: 0, max: 15000 },
        outputTokens: { min: 1000, max: 2500 },
        wallClockSeconds: { min: 30, max: 300 }
      })
    },
    {
      id: "conclusion_and_market_comparison",
      diagramStage: "stage2",
      order: 7,
      label: "Output conclusion and compare with market pricing",
      implementation: "implemented",
      currentImplementation: [
        "Entry Planner extracts AI probability, market probability, edge, confidence, and direction from the report.",
        "Execution planning applies risk controls, exchange thresholds, min trade size, and market-binding gates before any live order."
      ],
      gaps: [
        "For user-entered events without a mapped Polymarket market, market-price comparison is unavailable.",
        "The new Manus-style frontend is currently demo/read-only and does not trigger live orders."
      ],
      fullParityWork: [
        "Add event-to-market matching for arbitrary natural-language events.",
        "Expose comparison status as no market found / market found / edge found before any execution path."
      ],
      estimate: estimate({
        selectedCandidates,
        externalCalls: {
          min: 2,
          max: 6,
          description: "Gamma/CLOB lookups for event-to-market matching and current Yes/No prices."
        },
        inputTokens: { min: 500, max: 1200 },
        outputTokens: { min: 500, max: 1000 },
        wallClockSeconds: { min: 10, max: 45 }
      })
    }
  ];

  const fullParityEstimate = addEstimates(steps.map((step) => step.estimate));

  return {
    generated_at_utc: input.generatedAtUtc,
    source_framework: "skills/probability-analysis",
    purpose,
    selected_candidates: selectedCandidates,
    report_candidates: input.config.pulse.reportCandidates,
    current_external_collection: {
      polymarket_event_scrapes: selectedCandidates,
      orderbook_reads: orderbookReads,
      web_search_queries: webSearchQueries,
      web_search_timeout_seconds: input.config.pulse.webSearchTimeoutSeconds
    },
    summary: {
      implemented_steps: steps.filter((step) => step.implementation === "implemented").length,
      partial_steps: steps.filter((step) => step.implementation === "partial").length,
      not_implemented_steps: steps.filter((step) => step.implementation === "not_implemented").length,
      current_llm_report_calls: 1,
      current_llm_search_calls: 0,
      full_parity_incremental_estimate: fullParityEstimate
    },
    steps
  };
}
