import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { OverviewResponse, PublicPosition } from "@autopoly/contracts";
export {
  computeExchangeBuyMinNotionalUsd,
  isBelowExchangeBuyMinimum,
  isBelowExchangeSellMinimum
} from "../services/orchestrator/src/lib/execution-planning.ts";
export {
  applyPulseFilters,
  hasPulseFilters,
  type PulseFilterArgs
} from "../services/orchestrator/src/pulse/pulse-filters.ts";
import type { PulseFilterArgs } from "../services/orchestrator/src/pulse/pulse-filters.ts";

export function buildPulseLiveRunIdentityRows(input: {
  executionMode: string;
  decisionStrategy: string;
}): Array<[string, string]> {
  return [
    ["Execution Mode", input.executionMode],
    ["Decision Strategy", input.decisionStrategy]
  ];
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function buildPulseLiveOverview(input: {
  collateralBalanceUsd: number;
  positions: PublicPosition[];
}): OverviewResponse {
  const openExposureUsd = input.positions.reduce((sum, position) => sum + position.current_value_usd, 0);
  const totalEquityUsd = roundCurrency(input.collateralBalanceUsd + openExposureUsd);

  return {
    status: "running",
    cash_balance_usd: roundCurrency(input.collateralBalanceUsd),
    total_equity_usd: totalEquityUsd,
    high_water_mark_usd: totalEquityUsd,
    drawdown_pct: 0,
    open_positions: input.positions.length,
    last_run_at: null,
    latest_risk_event: null,
    equity_curve: [
      {
        timestamp: new Date().toISOString(),
        total_equity_usd: totalEquityUsd,
        drawdown_pct: 0
      }
    ]
  };
}

export function calculatePositionValueUsd(size: number, currentPrice: number) {
  return roundCurrency(size * currentPrice);
}

export function calculatePositionPnlPct(avgCost: number, currentPrice: number) {
  if (!(avgCost > 0)) {
    return 0;
  }
  return roundMetric((currentPrice - avgCost) / avgCost);
}

export function loadPulseFilterFile(filePath: string | null): PulseFilterArgs {
  if (!filePath) {
    // Try default location
    const defaultPath = path.resolve(process.cwd(), "services/orchestrator/pulse-filters.json");
    if (!existsSync(defaultPath)) {
      return { category: null, tag: null, minProb: null, maxProb: null, minLiquidity: null };
    }
    filePath = defaultPath;
  }
  if (!existsSync(filePath)) {
    return { category: null, tag: null, minProb: null, maxProb: null, minLiquidity: null };
  }
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  return {
    category: typeof raw.category === "string" ? raw.category : null,
    tag: typeof raw.tag === "string" ? raw.tag : null,
    minProb: typeof raw.minProb === "number" ? raw.minProb : null,
    maxProb: typeof raw.maxProb === "number" ? raw.maxProb : null,
    minLiquidity: typeof raw.minLiquidity === "number" ? raw.minLiquidity : null
  };
}

export function mergePulseFilters(base: PulseFilterArgs, override: PulseFilterArgs): PulseFilterArgs {
  return {
    category: override.category ?? base.category,
    tag: override.tag ?? base.tag,
    minProb: override.minProb ?? base.minProb,
    maxProb: override.maxProb ?? base.maxProb,
    minLiquidity: override.minLiquidity ?? base.minLiquidity
  };
}

export function parsePulseFilterArgs(argv: string[]): PulseFilterArgs {
  const get = (flag: string) => {
    const index = argv.indexOf(flag);
    const value = index >= 0 ? argv[index + 1] : undefined;
    return value && !value.startsWith("--") ? value : null;
  };
  const getNumber = (flag: string): number | null => {
    const raw = get(flag);
    if (raw == null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    category: get("--category"),
    tag: get("--tag"),
    minProb: getNumber("--min-prob"),
    maxProb: getNumber("--max-prob"),
    minLiquidity: getNumber("--min-liquidity")
  };
}

