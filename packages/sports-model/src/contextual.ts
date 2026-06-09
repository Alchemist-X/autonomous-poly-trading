// Contextual-factors module ("情境因子", models 12–22) — a faithful reproduction
// of the situational adjustments emphasised in Kimi's 2026 World Cup report:
// per-venue home advantage (incl. the Mexico City altitude effect), altitude,
// heat/WBGT penalty, travel fatigue, rest advantage, and squad-rotation depth.
//
// Each export returns a *multiplicative adjustment factor* applied to a team's
// expected goals (λ). A factor of 1.0 means "no effect"; values < 1 dampen
// output, values > 1 amplify it. Factors compose by multiplication, so a
// neutral context (all 1.0) leaves λ unchanged.
//
// IMPORTANT: these are HEURISTIC / DIDACTIC reference implementations. The shapes
// and default coefficients here are illustrative — chosen for sensible monotone
// behaviour and bounded ranges, NOT calibrated against data. Real coefficients
// (per-venue HOME_ADV, per-km altitude penalty, WBGT slope, fatigue decay, etc.)
// are fit in Phase 1. Treat the numbers below as placeholders with the right
// sign and curvature, not as production values.
//
// Pure functions only: no mutation, no globals, no I/O, no Date/Math.random.

/**
 * Clamp a value into the inclusive range [lo, hi]. NaN/±Infinity fall through to
 * the nearest bound (NaN comparisons are false, so it returns `lo`).
 * @param value - raw value
 * @param lo - lower bound (inclusive)
 * @param hi - upper bound (inclusive)
 * @returns value constrained to [lo, hi]
 */
function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/**
 * Per-venue home-advantage lookup (report's HOME_ADV table). Keys are
 * lower-cased, hyphenated venue slugs. Mexico City carries an outsized factor
 * driven by its 2240 m altitude; sea-level North American venues sit near the
 * generic home-field default.
 *
 * Heuristic placeholder values — calibrated per-venue in Phase 1.
 */
const NAMED_VENUE_HOME_ADV: Readonly<Record<string, number>> = {
  "mexico-city": 1.25,
  guadalajara: 1.18,
  monterrey: 1.12,
  vancouver: 1.05,
  toronto: 1.06,
  "los-angeles": 1.08,
  "new-york": 1.08,
  seattle: 1.07,
  atlanta: 1.09,
  miami: 1.1,
  dallas: 1.1,
  houston: 1.11,
  "kansas-city": 1.09,
  philadelphia: 1.08,
  "san-francisco": 1.07,
  boston: 1.08,
};

/** Generic home-field factor used when a venue is not in the lookup table. */
const DEFAULT_VENUE_HOME_ADV = 1.1;

/**
 * Per-venue home-advantage factor (report model: per-venue HOME_ADV).
 * Case-insensitive lookup; "Mexico City" / "mexico-city" → 1.25,
 * "Vancouver" → 1.05. Unknown venues fall back to the generic 1.10.
 * Whitespace and underscores in the supplied name are normalised to hyphens.
 * @param venue - venue name or slug (case-insensitive)
 * @returns multiplicative λ factor for the home side at that venue
 */
export function namedVenueHomeAdvantage(venue: string): number {
  const key = venue.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return NAMED_VENUE_HOME_ADV[key] ?? DEFAULT_VENUE_HOME_ADV;
}

/** Options for {@link homeAdvantageMultiplier}. */
export interface HomeAdvantageOptions {
  /** Neutral-ground fixture (no home side); forces the factor to 1.0. */
  readonly neutralVenue?: boolean;
  /** Generic home-field factor for a non-neutral fixture. Default 1.10. */
  readonly base?: number;
}

/**
 * Generic home-advantage factor (report model: HOME_ADV baseline).
 * Returns `base` (default 1.10) for a home fixture, or 1.0 at a neutral venue.
 * @param opts - optional neutral flag and base factor
 * @returns multiplicative λ factor for the home side
 */
export function homeAdvantageMultiplier(opts?: HomeAdvantageOptions): number {
  if (opts?.neutralVenue) return 1.0;
  return opts?.base ?? 1.1;
}

/** Lower bound on the altitude factor — even extreme altitude caps stamina loss. */
const ALTITUDE_FLOOR = 0.8;

/**
 * Altitude adjustment (report model: altitude effect, e.g. Mexico City 2240 m on
 * lowland teams). For match altitudes ABOVE the team's habitual baseline, thinner
 * air depresses stamina-driven output:
 *   factor = 1 − perKmPenalty · max(0, (matchAltitude − teamBaseline) / 1000)
 * floored at 0.80. Teams playing at or below their baseline altitude are
 * acclimatised and receive 1.0 (no penalty).
 * @param matchAltitudeMeters - venue altitude in metres
 * @param teamBaselineAltitudeMeters - team's habitual/home altitude in metres
 * @param perKmPenalty - fractional λ loss per km of excess altitude (default 0.04)
 * @returns multiplicative λ factor in [0.80, 1.0]
 */
export function altitudeAdjustmentFactor(
  matchAltitudeMeters: number,
  teamBaselineAltitudeMeters: number,
  perKmPenalty = 0.04,
): number {
  const excessKm = Math.max(
    0,
    (matchAltitudeMeters - teamBaselineAltitudeMeters) / 1000,
  );
  const factor = 1 - perKmPenalty * excessKm;
  return Math.max(ALTITUDE_FLOOR, factor);
}

/** Lower bound on the heat factor — capped high-intensity-running loss. */
const HEAT_FLOOR = 0.85;

/**
 * Heat / WBGT penalty (report model: WBGT high-intensity-running reduction).
 * Wet-Bulb Globe Temperature above the comfort threshold cuts sprint volume and
 * therefore goal output:
 *   factor = 1 − perDegreePenalty · max(0, wbgt − threshold)
 * floored at 0.85. At or below the threshold the factor is 1.0.
 * @param wbgtCelsius - Wet-Bulb Globe Temperature in °C
 * @param threshold - comfort threshold in °C below which there is no penalty (default 28)
 * @param perDegreePenalty - fractional λ loss per °C above threshold (default 0.01)
 * @returns multiplicative λ factor in [0.85, 1.0]
 */
export function heatPenaltyFactor(
  wbgtCelsius: number,
  threshold = 28,
  perDegreePenalty = 0.01,
): number {
  const excess = Math.max(0, wbgtCelsius - threshold);
  const factor = 1 - perDegreePenalty * excess;
  return Math.max(HEAT_FLOOR, factor);
}

/** Lower bound on the travel-fatigue factor. */
const TRAVEL_FLOOR = 0.85;
/** Maximum fatigue weight from distance alone (caps at very long hauls). */
const TRAVEL_MAX_DISTANCE_WEIGHT = 0.1;
/** Distance (km) that saturates the distance weight to its maximum. */
const TRAVEL_DISTANCE_SCALE = 50000;
/** Rest days at/above which travel fatigue is fully recovered. */
const TRAVEL_FULL_REST_DAYS = 4;

/**
 * Travel-fatigue penalty (report model: travel fatigue). Two multiplicands shape
 * the factor: a distance weight that rises with kilometres flown (saturating at
 * {@link TRAVEL_MAX_DISTANCE_WEIGHT} once distance reaches
 * {@link TRAVEL_DISTANCE_SCALE} km), and a recovery gate that scales that weight
 * by how short the rest is — full effect at 0 rest days, linearly vanishing to
 * zero once rest reaches {@link TRAVEL_FULL_REST_DAYS} days:
 *   distanceWeight = min(0.10, distanceKm / 50000)
 *   restGate       = clamp((4 − restDays) / 4, 0, 1)
 *   factor         = 1 − distanceWeight · restGate   (floored at 0.85)
 * So a long flight with ample rest, or any distance with ≥4 rest days, yields
 * 1.0; the penalty only bites when long travel meets a short turnaround.
 * @param distanceKm - distance travelled to the venue, in km
 * @param restDays - days of rest before the fixture
 * @returns multiplicative λ factor in [0.85, 1.0]
 */
export function travelFatigueFactor(
  distanceKm: number,
  restDays: number,
): number {
  const distanceWeight = Math.min(
    TRAVEL_MAX_DISTANCE_WEIGHT,
    Math.max(0, distanceKm) / TRAVEL_DISTANCE_SCALE,
  );
  const restGate = clamp(
    (TRAVEL_FULL_REST_DAYS - restDays) / TRAVEL_FULL_REST_DAYS,
    0,
    1,
  );
  const factor = 1 - distanceWeight * restGate;
  return Math.max(TRAVEL_FLOOR, factor);
}

/** Half-width of the rest-advantage band (factor bounded to 1 ± this). */
const REST_ADV_BAND = 0.08;
/** Per-day sensitivity of the rest-advantage factor. */
const REST_ADV_PER_DAY = 0.02;

/**
 * Rest-advantage factor (report model: rest advantage). Driven by the *relative*
 * rest edge: a fresher team (more rest days than its opponent) gets a factor > 1,
 * a more tired team gets < 1, and equal rest gives exactly 1.0. The edge is
 * scaled by {@link REST_ADV_PER_DAY} per day and bounded to
 * [1 − {@link REST_ADV_BAND}, 1 + {@link REST_ADV_BAND}] ≈ [0.92, 1.08].
 * @param restDaysTeam - the team's rest days
 * @param restDaysOpponent - the opponent's rest days
 * @returns multiplicative λ factor in ~[0.92, 1.08]
 */
export function restAdvantageFactor(
  restDaysTeam: number,
  restDaysOpponent: number,
): number {
  const edge = restDaysTeam - restDaysOpponent;
  const raw = 1 + REST_ADV_PER_DAY * edge;
  return clamp(raw, 1 - REST_ADV_BAND, 1 + REST_ADV_BAND);
}

/** Squad depth that maps to the neutral (1.0) rotation factor. */
const ROTATION_NEUTRAL_DEPTH = 0.5;
/** Factor at zero depth (thinnest squad) — the lower bound of the map. */
const ROTATION_MIN = 0.95;
/** Factor at full depth (elite squad) — the upper bound of the map. */
const ROTATION_MAX = 1.03;

/**
 * Squad-rotation depth factor (report model: squad-rotation depth). A deeper
 * squad sustains output through a congested World Cup schedule; a thin squad
 * fades. `squadDepthIndex` ∈ [0, 1] (1 = elite depth) is clamped, then mapped
 * piecewise-linearly so that the neutral depth ({@link ROTATION_NEUTRAL_DEPTH})
 * yields exactly 1.0, depth 0 → {@link ROTATION_MIN} (0.95), and depth 1 →
 * {@link ROTATION_MAX} (1.03). Result lies in ~[0.95, 1.03].
 * @param squadDepthIndex - depth score in [0, 1] (1 = elite depth)
 * @returns multiplicative λ factor in ~[0.95, 1.03]
 */
export function rotationDepthFactor(squadDepthIndex: number): number {
  const depth = clamp(squadDepthIndex, 0, 1);
  if (depth >= ROTATION_NEUTRAL_DEPTH) {
    // Map [0.5, 1.0] linearly onto [1.0, ROTATION_MAX].
    const t = (depth - ROTATION_NEUTRAL_DEPTH) / (1 - ROTATION_NEUTRAL_DEPTH);
    return 1 + t * (ROTATION_MAX - 1);
  }
  // Map [0, 0.5] linearly onto [ROTATION_MIN, 1.0].
  const t = depth / ROTATION_NEUTRAL_DEPTH;
  return ROTATION_MIN + t * (1 - ROTATION_MIN);
}

/**
 * Combine any number of multiplicative factors into a single adjustment by
 * taking their product. The product of an empty list is 1.0 (the multiplicative
 * identity), matching the "no effect" convention.
 * @param factors - individual multiplicative λ factors
 * @returns the product of all supplied factors
 */
export function combineFactors(...factors: number[]): number {
  return factors.reduce((product, factor) => product * factor, 1);
}

/**
 * Apply a set of contextual factors to a base expected-goals value:
 * `baseLambda · combineFactors(...factors)`. With no factors (or all 1.0) the
 * base λ is returned unchanged.
 * @param baseLambda - the unadjusted expected goals (Poisson rate)
 * @param factors - individual multiplicative λ factors to apply
 * @returns the contextually adjusted λ
 */
export function applyToLambda(baseLambda: number, ...factors: number[]): number {
  return baseLambda * combineFactors(...factors);
}
