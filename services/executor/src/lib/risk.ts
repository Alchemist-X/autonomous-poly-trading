export function calculatePositionPnlPct(avgCost: number, currentPrice: number): number {
  if (avgCost <= 0) {
    return 0;
  }
  return (currentPrice - avgCost) / avgCost;
}

export function shouldTriggerStopLoss(avgCost: number, currentPrice: number, thresholdPct: number): boolean {
  return calculatePositionPnlPct(avgCost, currentPrice) <= -thresholdPct;
}

