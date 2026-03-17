export interface DrawdownSnapshot {
  totalEquityUsd: number;
  highWaterMarkUsd: number;
}

export function calculateDrawdownPct(snapshot: DrawdownSnapshot): number {
  if (snapshot.highWaterMarkUsd <= 0) {
    return 0;
  }
  const drop = snapshot.highWaterMarkUsd - snapshot.totalEquityUsd;
  return Math.max(0, drop / snapshot.highWaterMarkUsd);
}

export function shouldHaltForDrawdown(snapshot: DrawdownSnapshot, thresholdPct: number): boolean {
  return calculateDrawdownPct(snapshot) >= thresholdPct;
}

export interface KellyInput {
  aiProb: number;
  marketProb: number;
  bankrollUsd: number;
}

export interface KellyOutput {
  fullKellyPct: number;
  quarterKellyPct: number;
  quarterKellyUsd: number;
}

export function calculateQuarterKelly(input: KellyInput): KellyOutput {
  if (input.marketProb <= 0 || input.marketProb >= 1 || input.aiProb <= input.marketProb) {
    return {
      fullKellyPct: 0,
      quarterKellyPct: 0,
      quarterKellyUsd: 0
    };
  }

  const fullKellyPct = Math.max(0, (input.aiProb - input.marketProb) / (1 - input.marketProb));
  const quarterKellyPct = fullKellyPct / 4;
  return {
    fullKellyPct,
    quarterKellyPct,
    quarterKellyUsd: input.bankrollUsd * quarterKellyPct
  };
}

export interface TradeGuardInput {
  requestedUsd: number;
  bankrollUsd: number;
  minTradeUsd?: number;
  maxTradePct: number;
  liquidityCapUsd: number;
  totalExposureUsd: number;
  maxTotalExposurePct: number;
  eventExposureUsd?: number;
  maxEventExposurePct?: number;
  openPositions: number;
  maxPositions: number;
  edge: number;
}

export function applyTradeGuards(input: TradeGuardInput): number {
  if (input.openPositions >= input.maxPositions) {
    return 0;
  }

  const hardCap = Math.min(
    input.requestedUsd,
    input.bankrollUsd * input.maxTradePct,
    input.liquidityCapUsd
  );
  const exposureHeadroom = Math.max(0, input.bankrollUsd * input.maxTotalExposurePct - input.totalExposureUsd);
  const eventExposureHeadroom =
    typeof input.maxEventExposurePct === "number"
      ? Math.max(0, input.bankrollUsd * input.maxEventExposurePct - (input.eventExposureUsd ?? 0))
      : Number.POSITIVE_INFINITY;

  let edgeMultiplier = 0;
  if (input.edge > 0.2) {
    edgeMultiplier = 1;
  } else if (input.edge >= 0.1) {
    edgeMultiplier = 0.6;
  } else if (input.edge >= 0.05) {
    edgeMultiplier = 0.3;
  }

  const amount = Math.min(hardCap * edgeMultiplier, exposureHeadroom, eventExposureHeadroom);
  const minTradeUsd = input.minTradeUsd ?? 10;
  return amount >= minTradeUsd ? amount : 0;
}
