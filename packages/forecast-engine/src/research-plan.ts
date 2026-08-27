// Phase-one research planner. It converts an audited event frame into a Focus
// Center plan before evidence gathering starts. The plan decides what to look
// for, which source classes deserve priority, and which single probability
// model the engine will use. It never estimates a second probability.

import { runAgent } from "./agent";
import { extractJsonObject } from "./claude-agent";
import type { AgentRunResult, RunAgentOptions } from "./claude-agent";
import { languageDirective } from "./language";
import type {
  EventFraming,
  ProbabilityModelKind,
  QuestionArchetype,
  ResearchFocus,
  ResearchPlan,
  ResearchPriority,
  SourcePriorityRule
} from "./types";

const ARCHETYPES = new Set<QuestionArchetype>([
  "personnel_transition",
  "product_release",
  "metric_threshold",
  "policy_regulation",
  "corporate_action",
  "geopolitical_event",
  "other"
]);
const MODELS = new Set<ProbabilityModelKind>(["hazard", "conjunction", "scenario_mixture", "binary_bayesian"]);
const PRIORITIES = new Set<ResearchPriority>(["high", "medium", "low"]);

function cleanId(value: unknown, fallback: string): string {
  const id =
    typeof value === "string"
      ? value
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/^-|-$/g, "")
      : "";
  return id || fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : [];
}

export function defaultResearchPlan(frame: EventFraming): ResearchPlan {
  return {
    archetype: "other",
    modelKind: "binary_bayesian",
    modelRationale:
      "Use one maintained binary probability because no more specific event structure has been selected yet.",
    decomposition: [
      "Check the settlement condition",
      "Establish an outside-view reference class",
      "Test the strongest case for YES and NO"
    ],
    focusAreas: [
      {
        id: "resolution-state",
        question: `What directly establishes whether the event meets this resolution rule: ${frame.resolutionCriteria}`,
        whyItMatters: "Direct settlement evidence should outrank commentary and proxies.",
        priority: "high",
        preferredSources: [
          frame.settlementSource || "authoritative primary source",
          "official records",
          "original data"
        ],
        completionCriteria:
          "At least one direct primary source and one independent cross-check, or an explicit record that no such source is available."
      },
      {
        id: "outside-view",
        question: "What comparable historical cases establish a defensible base rate?",
        whyItMatters: "A reference class prevents a few vivid current stories from overwhelming the outside view.",
        priority: "high",
        preferredSources: ["official historical records", "original datasets", "high-quality research"],
        completionCriteria: "Comparable cases include similarities, differences, and exact timing or outcomes."
      },
      {
        id: "strongest-countercase",
        question: "What is the strongest evidence against the current probability lean?",
        whyItMatters: "A forecast should survive deliberate falsification, not only collect confirming material.",
        priority: "high",
        preferredSources: ["primary sources", "independent original reporting", "original data"],
        completionCriteria:
          "The strongest counterclaim is sourced, assessed, and either retained or explicitly resolved."
      }
    ],
    sourcePriorities: defaultSourcePriorities(),
    minimumSearchQueries: 6,
    searchStrategy:
      "Search broadly, inspect primary material, cross-check the decisive claims, and keep only sources that add independent information."
  };
}

function defaultSourcePriorities(): SourcePriorityRule[] {
  return [
    {
      rank: 1,
      sourceClass: "Official records, original data, and direct statements",
      useWhen: "They directly establish the event, definition, date, or measured value.",
      rejectWhen: "The page is only promotional and does not support the claim."
    },
    {
      rank: 2,
      sourceClass: "Independent original reporting and peer-reviewed research",
      useWhen: "It contains attributable first-hand reporting, methods, or data not available from the subject.",
      rejectWhen: "It merely rewrites another outlet or hides the original source."
    },
    {
      rank: 3,
      sourceClass: "Specialist analysis and repositories",
      useWhen: "The method and underlying records can be inspected.",
      rejectWhen: "The conclusion cannot be traced to data or a named source."
    },
    {
      rank: 4,
      sourceClass: "Secondary summaries, commentary, and insider claims",
      useWhen: "They provide a lead that can be checked elsewhere.",
      rejectWhen: "They are the sole support for a high-impact claim."
    }
  ];
}

function buildPrompt(frame: EventFraming): string {
  return `You are the research planner for a rigorous forecasting system. Build the Focus Center plan that will guide later web research. Do not estimate a probability and do not repeat the existing prior.

QUESTION: ${frame.normalizedQuestion}
RESOLUTION CRITERIA: ${frame.resolutionCriteria}
RESOLUTION DATE: ${frame.resolutionDate ?? "open-ended"}
SETTLEMENT SOURCE: ${frame.settlementSource || "unspecified"}
ASSUMPTIONS: ${frame.assumptions}

Design a plan that makes the research agent search more broadly while selecting better evidence rather than rewarding raw link count.

REQUIREMENTS:
1. Classify the question and select ONE probability model. Use hazard for time-to-event or multi-horizon exits; conjunction when several necessary conditions must all occur; scenario_mixture for mutually exclusive paths; otherwise binary_bayesian.
2. Decompose the event into the few causal or settlement components that determine the answer.
3. Create 3-7 focus areas. Each must be a concrete research question with a completion criterion. High-priority areas must include the outside-view reference class, direct settlement evidence, and the strongest countercase when relevant.
4. Rank source classes. Prefer official records, original data, direct statements, original reporting, and peer-reviewed research. Secondary summaries and anonymous claims are leads unless independently corroborated.
5. Encourage breadth: recommend at least 6 distinct search queries per research round when live search is available, including a primary-source query and a disconfirmation query. Quality outranks count.
6. Never create a second or challenger probability.

OUTPUT only one JSON object:
{
  "archetype": "personnel_transition|product_release|metric_threshold|policy_regulation|corporate_action|geopolitical_event|other",
  "model_kind": "hazard|conjunction|scenario_mixture|binary_bayesian",
  "model_rationale": "...",
  "decomposition": ["..."],
  "focus_areas": [{"id":"short-stable-id","question":"...","why_it_matters":"...","priority":"high|medium|low","preferred_sources":["..."],"completion_criteria":"..."}],
  "source_priorities": [{"rank":1,"source_class":"...","use_when":"...","reject_when":"..."}],
  "minimum_search_queries": 6,
  "search_strategy": "..."
}
${languageDirective()}`;
}

export function validateResearchPlan(raw: unknown, frame: EventFraming): ResearchPlan {
  if (!raw || typeof raw !== "object") throw new Error("research plan is not an object");
  const o = raw as Record<string, unknown>;
  const fallback = defaultResearchPlan(frame);
  const archetype = ARCHETYPES.has(o.archetype as QuestionArchetype)
    ? (o.archetype as QuestionArchetype)
    : fallback.archetype;
  const modelKind = MODELS.has(o.model_kind as ProbabilityModelKind)
    ? (o.model_kind as ProbabilityModelKind)
    : fallback.modelKind;
  const areasRaw = Array.isArray(o.focus_areas) ? o.focus_areas : [];
  const focusAreas: ResearchFocus[] = areasRaw
    .map((item, index) => {
      const a = item as Record<string, unknown>;
      if (typeof a.question !== "string" || !a.question.trim()) return null;
      return {
        id: cleanId(a.id, `focus-${index + 1}`),
        question: a.question.trim(),
        whyItMatters: typeof a.why_it_matters === "string" ? a.why_it_matters.trim() : "",
        priority: PRIORITIES.has(a.priority as ResearchPriority) ? (a.priority as ResearchPriority) : "medium",
        preferredSources: strings(a.preferred_sources),
        completionCriteria: typeof a.completion_criteria === "string" ? a.completion_criteria.trim() : ""
      } satisfies ResearchFocus;
    })
    .filter((x): x is ResearchFocus => x !== null)
    .slice(0, 7);
  const prioritiesRaw = Array.isArray(o.source_priorities) ? o.source_priorities : [];
  const sourcePriorities: SourcePriorityRule[] = prioritiesRaw
    .map((item, index) => {
      const s = item as Record<string, unknown>;
      if (typeof s.source_class !== "string" || !s.source_class.trim()) return null;
      return {
        rank: Number.isFinite(Number(s.rank)) ? Math.max(1, Math.round(Number(s.rank))) : index + 1,
        sourceClass: s.source_class.trim(),
        useWhen: typeof s.use_when === "string" ? s.use_when.trim() : "",
        rejectWhen: typeof s.reject_when === "string" ? s.reject_when.trim() : ""
      } satisfies SourcePriorityRule;
    })
    .filter((x): x is SourcePriorityRule => x !== null)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 6);
  return {
    archetype,
    modelKind,
    modelRationale:
      typeof o.model_rationale === "string" && o.model_rationale.trim()
        ? o.model_rationale.trim()
        : fallback.modelRationale,
    decomposition: strings(o.decomposition).slice(0, 8).length
      ? strings(o.decomposition).slice(0, 8)
      : fallback.decomposition,
    focusAreas: focusAreas.length >= 3 ? focusAreas : fallback.focusAreas,
    sourcePriorities: sourcePriorities.length ? sourcePriorities : fallback.sourcePriorities,
    minimumSearchQueries: Math.min(
      12,
      Math.max(6, Number.isFinite(Number(o.minimum_search_queries)) ? Math.round(Number(o.minimum_search_queries)) : 6)
    ),
    searchStrategy:
      typeof o.search_strategy === "string" && o.search_strategy.trim()
        ? o.search_strategy.trim()
        : fallback.searchStrategy
  };
}

export async function createResearchPlan(
  frame: EventFraming,
  opts: { model?: string; runAgentFn?: (prompt: string, opts: RunAgentOptions) => Promise<AgentRunResult> } = {}
): Promise<ResearchPlan> {
  const call = opts.runAgentFn ?? runAgent;
  const prompt = buildPrompt(frame);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await call(prompt, { model: opts.model, allowedTools: "" });
    if (result.exitCode !== 0)
      throw new Error(`research planning failed: ${result.stderrTail || `exit ${result.exitCode}`}`);
    try {
      return validateResearchPlan(result.jsonObject ?? extractJsonObject(result.rawFinalText), frame);
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  return defaultResearchPlan(frame);
}
