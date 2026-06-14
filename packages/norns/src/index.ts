// Norse-Norns capability tiers for the prediction / research engine.
//
// The three Norns name three capability/cost tiers. This module is a thin
// *alias and mapping* layer: anywhere the engine reads a model id, a tier name
// (urd / verdandi / skuld) may be used instead and is resolved to a concrete
// model. Raw model ids — and empty defaults — pass through unchanged, so every
// existing config keeps working. Nothing here changes behaviour unless a tier
// name is explicitly used.
//
//   Urd      — 轻 / 快   (the Norn of the past / origin)        light & fast
//   Verdandi — 中        (the Norn of the present / becoming)   balanced (default)
//   Skuld    — 旗舰      (the Norn of the future / what shall be) flagship, deepest

export const NORN_TIERS = ["urd", "verdandi", "skuld"] as const;
export type NornTier = (typeof NORN_TIERS)[number];

// Model families we map to. The orchestrator's CLI providers fold onto these:
//   codex → openai ; claude-code → anthropic ; openclaw → anthropic.
export const MODEL_FAMILIES = ["anthropic", "openai"] as const;
export type ModelFamily = (typeof MODEL_FAMILIES)[number];

// Soft knobs a driver can use to scale research effort/cost by tier.
export interface NornDepth {
  maxTokens: number;
  maxEvidence: number;
  researchPasses: number;
}

export interface NornTierSpec {
  tier: NornTier;
  order: number;
  label: string; // human label, e.g. "Skuld · 旗舰"
  blurb: string; // one-line capability description
  models: Record<ModelFamily, string>;
  depth: NornDepth;
}

export const DEFAULT_TIER: NornTier = "verdandi";

// Model ids are env-overridable everywhere; these are sensible defaults that map
// the three tiers onto the current Claude / OpenAI line-ups.
export const NORN_TIER_SPECS: Record<NornTier, NornTierSpec> = {
  urd: {
    tier: "urd",
    order: 1,
    label: "Urd · 轻快",
    blurb: "最快、最省。命途之初——适合粗筛、预检与高频调用。",
    models: { anthropic: "claude-haiku-4-5-20251001", openai: "gpt-4o-mini" },
    depth: { maxTokens: 1024, maxEvidence: 5, researchPasses: 1 }
  },
  verdandi: {
    tier: "verdandi",
    order: 2,
    label: "Verdandi · 均衡",
    blurb: "速度与深度均衡的默认档——当下之相。",
    models: { anthropic: "claude-sonnet-4-6", openai: "gpt-4o" },
    depth: { maxTokens: 2048, maxEvidence: 8, researchPasses: 2 }
  },
  skuld: {
    tier: "skuld",
    order: 3,
    label: "Skuld · 旗舰",
    blurb: "最深推理、最高质量——未来之债,留给最重要的判断。",
    models: { anthropic: "claude-opus-4-8", openai: "gpt-4o" },
    depth: { maxTokens: 4096, maxEvidence: 12, researchPasses: 3 }
  }
};

export const NORN_TIER_LIST: NornTierSpec[] = NORN_TIERS.map((tier) => NORN_TIER_SPECS[tier]);

export function isNornTier(value: unknown): value is NornTier {
  return (
    typeof value === "string" &&
    (NORN_TIERS as readonly string[]).includes(value.trim().toLowerCase())
  );
}

// Coerce arbitrary input to a tier, falling back to the default when unknown.
export function normalizeTier(value: unknown, fallback: NornTier = DEFAULT_TIER): NornTier {
  return isNornTier(value) ? (String(value).trim().toLowerCase() as NornTier) : fallback;
}

export function getTierSpec(tier: NornTier): NornTierSpec {
  return NORN_TIER_SPECS[tier];
}

// tier → concrete model id for a provider family.
export function resolveNornModel(tier: NornTier, family: ModelFamily): string {
  return NORN_TIER_SPECS[tier].models[family];
}

// THE alias seam. If `value` is a Norn tier name, map it to a concrete model for
// `family`; otherwise return it unchanged (including the empty string). This is
// what makes the layer non-breaking: existing raw model ids and empty defaults
// are passed straight through, untouched.
export function resolveModelAlias(value: string | null | undefined, family: ModelFamily): string {
  const raw = (value ?? "").trim();
  return isNornTier(raw) ? resolveNornModel(normalizeTier(raw), family) : raw;
}
