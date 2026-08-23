// Lenient decoder for the Delta PM shadow-book audit feed
// (GET <upstream>/delta-pm/audit). The authoritative field vocabulary lives in
// packages/delta-pm-contracts/src/index.ts (NewsSignal / TradeThesis /
// PMDecision / decisionAuditSchema); it is mirrored HERE as plain view types
// instead of imported, so the web build never depends on that package's build
// order.
//
// Decoding policy: every field is optional. Older ledger rows may lack
// `decision.audit` (recorded since 2026-08-23), enum values may drift — an
// unknown enum is kept as its raw string and the label layer falls back to
// showing it verbatim. Only a payload that is not an object or has no `cases`
// array is rejected (returns null → caller falls back to the baked fixture).

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// ---------------------------------------------------------------------------
// View types (mirror of the delta-pm contracts, everything nullable)

export interface NewsView {
  newsId: string;
  title: string;
  publishedUtc: string;
  kind: string; // article | briefing | manual (raw)
  prefix: string; // exclusive | reportedly | none (raw)
  seenAtUtc: string;
  url: string | null;
}

export interface MaterialityView {
  tradeable: boolean | null;
  score: number | null;
  eventType: string;
  factLevel: string;
  tickers: string[];
  surpriseNote: string;
  reason: string;
}

export interface PricedInView {
  status: string; // none | partial | full | leaked | reverse | awaiting_market (raw)
  tEvalUtc: string;
  deltaTMinutes: number | null;
  realizedExcessPct: number | null; // percent units (0.11 => 0.11%)
  volumeZ: number | null;
  dataBasis: string;
  sessionBucket: string;
  benchmarkUsed: string;
  betaUsed: number | null;
  confidence: string;
  note: string;
}

export interface SignalView {
  id: string;
  fingerprint: string;
  firstSeenUtc: string | null;
  firstSeenBasis: string;
  expectedDirection: string;
  coarseImpactBand: string;
  materiality: MaterialityView | null;
  pricedIn: PricedInView | null;
  createdAtUtc: string;
}

export interface ImpactStepView {
  step: string;
  value: string;
}

export interface EvidenceView {
  point: string;
  source: string | null;
  url: string | null;
  credibility: string;
}

export interface ThesisView {
  id: string;
  ticker: string;
  direction: string; // long | short (raw)
  fairImpactPct: { min: number; max: number; point: number } | null; // percent units
  impactPath: ImpactStepView[];
  evidence: EvidenceView[];
  contamination: string; // none | soft | hard (raw)
  horizonHours: number | null;
  catalysts: string[];
  falsifiers: string[];
  limitations: string[];
  confidence: string;
  provider: string;
  createdAtUtc: string;
}

export interface AuditEdgeView {
  conservativePct: number | null;
  pointPct: number | null;
  realizedPct: number | null;
  residualPct: number | null;
}

export interface AuditThresholdView {
  takerFeePct: number | null;
  slippagePct: number | null;
  fundingPct: number | null;
  roundTripPct: number | null;
  costFloorPct: number | null;
  volFloorPct: number | null;
  thresholdPct: number | null;
}

export interface AuditStopMenuView {
  atr20d: number | null;
  atrStopPx: number | null;
  swingPx: number | null;
  hardFloorPx: number | null;
  chosenPx: number | null;
  stopDistPct: number | null; // fraction (0.0055 => 0.55%)
}

export interface GuardView {
  name: string;
  capUsd: number | null;
  notionalAfterUsd: number | null;
  clipped: boolean;
}

export interface AuditSizingView {
  equityUsd: number | null;
  riskBudgetPct: number | null; // fraction
  intendedNotionalUsd: number | null;
  guards: GuardView[];
  finalNotionalUsd: number | null;
  leverage: { configCap: number | null; volCap: number | null; venueCap: number | null; chosen: number | null } | null;
}

export interface AuditMarketView {
  markPx: number | null;
  dailyVolPct: number | null; // fraction
  maxDailyMovePct: number | null; // fraction
  fundingHourly: number | null; // fraction per hour
  beta: number | null;
}

export interface DecisionAuditView {
  vetoedBy: string | null;
  edge: AuditEdgeView | null;
  threshold: AuditThresholdView | null;
  stopMenu: AuditStopMenuView | null;
  sizing: AuditSizingView | null;
  marketView: AuditMarketView | null;
}

export interface DecisionStopView {
  initialPx: number | null;
  hardFloorPx: number | null;
  rule: string;
  atr20d: number | null;
  trailArmed: boolean | null;
}

export interface DecisionView {
  id: string;
  ticker: string;
  action: string; // open | add | trim | close | flip | no_trade (raw)
  direction: string | null;
  refPx: number | null;
  sizeUsd: number | null;
  leverage: number | null;
  stop: DecisionStopView | null;
  targetPctExcess: { lo: number; hi: number } | null; // percent units
  horizonUtc: string | null;
  intendedRiskPct: number | null; // fraction
  realizedRiskPct: number | null; // fraction
  bindingConstraint: string | null;
  residualEdgePct: number | null; // percent units
  reason: string;
  audit: DecisionAuditView | null;
  createdAtUtc: string;
}

export interface ExecutionView {
  ts: string;
  type: string;
  ticker: string;
  direction: string | null;
  qty: number | null;
  fillPx: number | null;
  sizeUsd: number | null;
}

export interface PositionNowView {
  ticker: string;
  direction: string;
  qty: number | null;
  entryPx: number | null;
  entryUtc: string;
  notionalUsdAtEntry: number | null;
  leverage: number | null;
  stopPx: number | null;
  hardFloorPx: number | null;
  targetPctExcess: { lo: number; hi: number } | null;
  horizonUtc: string | null;
  extendedOnce: boolean | null;
  signalT0Utc: string | null;
  baselinePx: number | null;
  benchmarkBaselinePx: number | null;
  beta: number | null;
  trailArmed: boolean | null;
  highestClosePx: number | null;
  markPx: number | null; // not in every snapshot — display "—" when absent
  unrealizedPnlUsd: number | null;
}

export interface PostEventView {
  ts: string;
  type: string;
  pnlUsd: number | null;
  /** Remaining primitive fields, verbatim, so nothing is hidden from audit. */
  extras: Array<{ key: string; value: string }>;
}

export interface CaseView {
  news: NewsView;
  signal: SignalView | null;
  thesis: ThesisView | null;
  decision: DecisionView | null;
  execution: ExecutionView | null;
  positionNow: PositionNowView | null;
  postEvents: PostEventView[];
}

export interface PortfolioView {
  mode: string;
  initialCapitalUsd: number | null;
  realizedPnlUsd: number | null;
  positions: PositionNowView[];
  halted: boolean;
  haltedReason: string | null;
  updatedAtUtc: string;
}

export interface ReflectionFunnelView {
  newsSeen: number | null;
  signals: number | null;
  archivedNoTicker: number | null;
  archivedNotMaterial: number | null;
  archivedStale: number | null;
  archivedPricedIn: number | null;
  theses: number | null;
  decisionsOpen: number | null;
  decisionsNoTrade: number | null;
}

export interface ReflectionView {
  date: string;
  generatedAtUtc: string;
  funnel: ReflectionFunnelView | null;
  pricedInDistribution: Array<{ status: string; count: number }>;
  deltaT: { n: number | null; medianMinutes: number | null } | null;
  m1Calibration: {
    forwarded: { n: number | null; hits: number | null; hitRate: number | null } | null;
    archivedFullReverse: { n: number | null; movedWithNews: number | null } | null;
  } | null;
  contamination: { theses: number | null; hard: number | null; soft: number | null; rate: number | null } | null;
  engines: Array<{ name: string; count: number }>;
  noTradeReasons: Array<{ reason: string; count: number }>;
  book: {
    equityUsd: number | null;
    realizedPnlUsd: number | null;
    positions: number | null;
    halted: boolean | null;
  } | null;
}

export interface AuditPayload {
  generatedAtUtc: string;
  bookStartedUtc: string | null;
  portfolio: PortfolioView | null;
  latestReflection: ReflectionView | null;
  cases: CaseView[];
}

// ---------------------------------------------------------------------------
// Parsers

function parseRange(raw: unknown): { min: number; max: number; point: number } | null {
  if (!isRec(raw)) return null;
  const min = num(raw.min);
  const max = num(raw.max);
  const point = num(raw.point);
  if (min === null || max === null || point === null) return null;
  return { min, max, point };
}

function parseLoHi(raw: unknown): { lo: number; hi: number } | null {
  if (!isRec(raw)) return null;
  const lo = num(raw.lo);
  const hi = num(raw.hi);
  if (lo === null || hi === null) return null;
  return { lo, hi };
}

function parseMateriality(raw: unknown): MaterialityView | null {
  if (!isRec(raw)) return null;
  return {
    tradeable: bool(raw.tradeable),
    score: num(raw.score),
    eventType: str(raw.eventType),
    factLevel: str(raw.factLevel),
    tickers: strArr(raw.tickers),
    surpriseNote: str(raw.surpriseNote),
    reason: str(raw.reason)
  };
}

function parsePricedIn(raw: unknown): PricedInView | null {
  if (!isRec(raw)) return null;
  return {
    status: str(raw.status),
    tEvalUtc: str(raw.tEvalUtc),
    deltaTMinutes: num(raw.deltaTMinutes),
    realizedExcessPct: num(raw.realizedExcessPct),
    volumeZ: num(raw.volumeZ),
    dataBasis: str(raw.dataBasis),
    sessionBucket: str(raw.sessionBucket),
    benchmarkUsed: str(raw.benchmarkUsed),
    betaUsed: num(raw.betaUsed),
    confidence: str(raw.confidence),
    note: str(raw.note)
  };
}

function parseSignal(raw: unknown): SignalView | null {
  if (!isRec(raw)) return null;
  return {
    id: str(raw.id),
    fingerprint: str(raw.fingerprint),
    firstSeenUtc: strOrNull(raw.firstSeenUtc),
    firstSeenBasis: str(raw.firstSeenBasis),
    expectedDirection: str(raw.expectedDirection),
    coarseImpactBand: str(raw.coarseImpactBand),
    materiality: parseMateriality(raw.materiality),
    pricedIn: parsePricedIn(raw.pricedIn),
    createdAtUtc: str(raw.createdAtUtc)
  };
}

function parseThesis(raw: unknown): ThesisView | null {
  if (!isRec(raw)) return null;
  const impactPath: ImpactStepView[] = Array.isArray(raw.impactPath)
    ? raw.impactPath.flatMap((s) => (isRec(s) ? [{ step: str(s.step), value: str(s.value) }] : []))
    : [];
  const evidence: EvidenceView[] = Array.isArray(raw.evidence)
    ? raw.evidence.flatMap((e) =>
        isRec(e)
          ? [
              {
                point: str(e.point),
                source: strOrNull(e.source),
                url: strOrNull(e.url),
                credibility: str(e.credibility)
              }
            ]
          : []
      )
    : [];
  return {
    id: str(raw.id),
    ticker: str(raw.ticker),
    direction: str(raw.direction),
    fairImpactPct: parseRange(raw.fairImpactPct),
    impactPath,
    evidence,
    contamination: str(raw.contamination),
    horizonHours: num(raw.horizonHours),
    catalysts: strArr(raw.catalysts),
    falsifiers: strArr(raw.falsifiers),
    limitations: strArr(raw.limitations),
    confidence: str(raw.confidence),
    provider: str(raw.provider),
    createdAtUtc: str(raw.createdAtUtc)
  };
}

function parseAudit(raw: unknown): DecisionAuditView | null {
  if (!isRec(raw)) return null;
  const edgeRec = isRec(raw.edge) ? raw.edge : null;
  const thrRec = isRec(raw.threshold) ? raw.threshold : null;
  const stopRec = isRec(raw.stopMenu) ? raw.stopMenu : null;
  const sizingRec = isRec(raw.sizing) ? raw.sizing : null;
  const mktRec = isRec(raw.marketView) ? raw.marketView : null;
  const levRec = sizingRec && isRec(sizingRec.leverage) ? sizingRec.leverage : null;
  return {
    vetoedBy: strOrNull(raw.vetoedBy),
    edge: edgeRec
      ? {
          conservativePct: num(edgeRec.conservativePct),
          pointPct: num(edgeRec.pointPct),
          realizedPct: num(edgeRec.realizedPct),
          residualPct: num(edgeRec.residualPct)
        }
      : null,
    threshold: thrRec
      ? {
          takerFeePct: num(thrRec.takerFeePct),
          slippagePct: num(thrRec.slippagePct),
          fundingPct: num(thrRec.fundingPct),
          roundTripPct: num(thrRec.roundTripPct),
          costFloorPct: num(thrRec.costFloorPct),
          volFloorPct: num(thrRec.volFloorPct),
          thresholdPct: num(thrRec.thresholdPct)
        }
      : null,
    stopMenu: stopRec
      ? {
          atr20d: num(stopRec.atr20d),
          atrStopPx: num(stopRec.atrStopPx),
          swingPx: num(stopRec.swingPx),
          hardFloorPx: num(stopRec.hardFloorPx),
          chosenPx: num(stopRec.chosenPx),
          stopDistPct: num(stopRec.stopDistPct)
        }
      : null,
    sizing: sizingRec
      ? {
          equityUsd: num(sizingRec.equityUsd),
          riskBudgetPct: num(sizingRec.riskBudgetPct),
          intendedNotionalUsd: num(sizingRec.intendedNotionalUsd),
          guards: Array.isArray(sizingRec.guards)
            ? sizingRec.guards.flatMap((g) =>
                isRec(g)
                  ? [
                      {
                        name: str(g.name),
                        capUsd: num(g.capUsd),
                        notionalAfterUsd: num(g.notionalAfterUsd),
                        clipped: g.clipped === true
                      }
                    ]
                  : []
              )
            : [],
          finalNotionalUsd: num(sizingRec.finalNotionalUsd),
          leverage: levRec
            ? {
                configCap: num(levRec.configCap),
                volCap: num(levRec.volCap),
                venueCap: num(levRec.venueCap),
                chosen: num(levRec.chosen)
              }
            : null
        }
      : null,
    marketView: mktRec
      ? {
          markPx: num(mktRec.markPx),
          dailyVolPct: num(mktRec.dailyVolPct),
          maxDailyMovePct: num(mktRec.maxDailyMovePct),
          fundingHourly: num(mktRec.fundingHourly),
          beta: num(mktRec.beta)
        }
      : null
  };
}

function parseDecision(raw: unknown): DecisionView | null {
  if (!isRec(raw)) return null;
  const stopRec = isRec(raw.stop) ? raw.stop : null;
  return {
    id: str(raw.id),
    ticker: str(raw.ticker),
    action: str(raw.action),
    direction: strOrNull(raw.direction),
    refPx: num(raw.refPx),
    sizeUsd: num(raw.sizeUsd),
    leverage: num(raw.leverage),
    stop: stopRec
      ? {
          initialPx: num(stopRec.initialPx),
          hardFloorPx: num(stopRec.hardFloorPx),
          rule: str(stopRec.rule),
          atr20d: num(stopRec.atr20d),
          trailArmed: bool(stopRec.trailArmed)
        }
      : null,
    targetPctExcess: parseLoHi(raw.targetPctExcess),
    horizonUtc: strOrNull(raw.horizonUtc),
    intendedRiskPct: num(raw.intendedRiskPct),
    realizedRiskPct: num(raw.realizedRiskPct),
    bindingConstraint: strOrNull(raw.bindingConstraint),
    residualEdgePct: num(raw.residualEdgePct),
    reason: str(raw.reason),
    audit: parseAudit(raw.audit),
    createdAtUtc: str(raw.createdAtUtc)
  };
}

function parseExecution(raw: unknown): ExecutionView | null {
  if (!isRec(raw)) return null;
  return {
    ts: str(raw.ts),
    type: str(raw.type),
    ticker: str(raw.ticker),
    direction: strOrNull(raw.direction),
    qty: num(raw.qty),
    fillPx: num(raw.fillPx),
    sizeUsd: num(raw.sizeUsd)
  };
}

function parsePosition(raw: unknown): PositionNowView | null {
  if (!isRec(raw)) return null;
  return {
    ticker: str(raw.ticker),
    direction: str(raw.direction),
    qty: num(raw.qty),
    entryPx: num(raw.entryPx),
    entryUtc: str(raw.entryUtc),
    notionalUsdAtEntry: num(raw.notionalUsdAtEntry),
    leverage: num(raw.leverage),
    stopPx: num(raw.stopPx),
    hardFloorPx: num(raw.hardFloorPx),
    targetPctExcess: parseLoHi(raw.targetPctExcess),
    horizonUtc: strOrNull(raw.horizonUtc),
    extendedOnce: bool(raw.extendedOnce),
    signalT0Utc: strOrNull(raw.signalT0Utc),
    baselinePx: num(raw.baselinePx),
    benchmarkBaselinePx: num(raw.benchmarkBaselinePx),
    beta: num(raw.beta),
    trailArmed: bool(raw.trailArmed),
    highestClosePx: num(raw.highestClosePx),
    markPx: num(raw.markPx),
    unrealizedPnlUsd: num(raw.unrealizedPnlUsd)
  };
}

const POST_EVENT_KNOWN_KEYS = new Set(["ts", "type", "pnlUsd"]);

function parsePostEvent(raw: unknown): PostEventView | null {
  if (!isRec(raw)) return null;
  const extras: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(raw)) {
    if (POST_EVENT_KNOWN_KEYS.has(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      extras.push({ key, value: String(value) });
    }
  }
  return { ts: str(raw.ts), type: str(raw.type), pnlUsd: num(raw.pnlUsd), extras };
}

function parseNews(raw: unknown): NewsView | null {
  if (!isRec(raw)) return null;
  const title = str(raw.title);
  if (title.length === 0) return null; // a case without a headline is unrenderable
  return {
    newsId: str(raw.newsId),
    title,
    publishedUtc: str(raw.publishedUtc),
    kind: str(raw.kind),
    prefix: str(raw.prefix),
    seenAtUtc: str(raw.seenAtUtc),
    url: strOrNull(raw.url)
  };
}

function parseCase(raw: unknown): CaseView | null {
  if (!isRec(raw)) return null;
  const news = parseNews(raw.news);
  if (!news) return null;
  return {
    news,
    signal: parseSignal(raw.signal),
    thesis: parseThesis(raw.thesis),
    decision: parseDecision(raw.decision),
    execution: parseExecution(raw.execution),
    positionNow: parsePosition(raw.positionNow),
    postEvents: Array.isArray(raw.postEvents)
      ? raw.postEvents.flatMap((e) => {
          const parsed = parsePostEvent(e);
          return parsed ? [parsed] : [];
        })
      : []
  };
}

function parsePortfolio(raw: unknown): PortfolioView | null {
  if (!isRec(raw)) return null;
  return {
    mode: str(raw.mode),
    initialCapitalUsd: num(raw.initialCapitalUsd),
    realizedPnlUsd: num(raw.realizedPnlUsd),
    positions: Array.isArray(raw.positions)
      ? raw.positions.flatMap((p) => {
          const parsed = parsePosition(p);
          return parsed ? [parsed] : [];
        })
      : [],
    halted: raw.halted === true,
    haltedReason: strOrNull(raw.haltedReason),
    updatedAtUtc: str(raw.updatedAtUtc)
  };
}

function parseReflection(raw: unknown): ReflectionView | null {
  if (!isRec(raw)) return null;
  const funnelRec = isRec(raw.funnel) ? raw.funnel : null;
  const deltaTRec = isRec(raw.deltaT) ? raw.deltaT : null;
  const m1Rec = isRec(raw.m1Calibration) ? raw.m1Calibration : null;
  const contRec = isRec(raw.contamination) ? raw.contamination : null;
  const bookRec = isRec(raw.book) ? raw.book : null;
  const fwdRec = m1Rec && isRec(m1Rec.forwarded) ? m1Rec.forwarded : null;
  const afrRec = m1Rec && isRec(m1Rec.archivedFullReverse) ? m1Rec.archivedFullReverse : null;
  return {
    date: str(raw.date),
    generatedAtUtc: str(raw.generatedAtUtc),
    funnel: funnelRec
      ? {
          newsSeen: num(funnelRec.newsSeen),
          signals: num(funnelRec.signals),
          archivedNoTicker: num(funnelRec.archivedNoTicker),
          archivedNotMaterial: num(funnelRec.archivedNotMaterial),
          archivedStale: num(funnelRec.archivedStale),
          archivedPricedIn: num(funnelRec.archivedPricedIn),
          theses: num(funnelRec.theses),
          decisionsOpen: num(funnelRec.decisionsOpen),
          decisionsNoTrade: num(funnelRec.decisionsNoTrade)
        }
      : null,
    pricedInDistribution: isRec(raw.pricedInDistribution)
      ? Object.entries(raw.pricedInDistribution).flatMap(([status, count]) => {
          const n = num(count);
          return n === null ? [] : [{ status, count: n }];
        })
      : [],
    deltaT: deltaTRec ? { n: num(deltaTRec.n), medianMinutes: num(deltaTRec.medianMinutes) } : null,
    m1Calibration: m1Rec
      ? {
          forwarded: fwdRec ? { n: num(fwdRec.n), hits: num(fwdRec.hits), hitRate: num(fwdRec.hitRate) } : null,
          archivedFullReverse: afrRec ? { n: num(afrRec.n), movedWithNews: num(afrRec.movedWithNews) } : null
        }
      : null,
    contamination: contRec
      ? { theses: num(contRec.theses), hard: num(contRec.hard), soft: num(contRec.soft), rate: num(contRec.rate) }
      : null,
    engines: isRec(raw.engines)
      ? Object.entries(raw.engines).flatMap(([name, count]) => {
          const n = num(count);
          return n === null ? [] : [{ name, count: n }];
        })
      : [],
    noTradeReasons: Array.isArray(raw.noTradeReasons)
      ? raw.noTradeReasons.flatMap((r) => {
          if (!isRec(r)) return [];
          const count = num(r.count);
          return [{ reason: str(r.reason), count: count ?? 0 }];
        })
      : [],
    book: bookRec
      ? {
          equityUsd: num(bookRec.equityUsd),
          realizedPnlUsd: num(bookRec.realizedPnlUsd),
          positions: num(bookRec.positions),
          halted: bool(bookRec.halted)
        }
      : null
  };
}

/**
 * Decode the audit payload. Returns null only when the payload is not an
 * object with a `cases` array — every field inside is optional.
 * Cases are re-sorted newest-first by news.seenAtUtc.
 */
export function parseAuditPayload(json: unknown): AuditPayload | null {
  if (!isRec(json) || !Array.isArray(json.cases)) return null;
  const cases = json.cases.flatMap((c) => {
    const parsed = parseCase(c);
    return parsed ? [parsed] : [];
  });
  cases.sort((a, b) => {
    const ta = Date.parse(a.news.seenAtUtc);
    const tb = Date.parse(b.news.seenAtUtc);
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  return {
    generatedAtUtc: str(json.generatedAtUtc),
    bookStartedUtc: strOrNull(json.bookStartedUtc),
    portfolio: parsePortfolio(json.portfolio),
    latestReflection: parseReflection(json.latestReflection),
    cases
  };
}
