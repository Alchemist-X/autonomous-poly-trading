import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MockQueryState } from "./mock-data.js";
import { createMockQueryState } from "./mock-data.js";

export const executionModes = ["live", "paper"] as const;
export type ExecutionMode = (typeof executionModes)[number];

export interface LocalAppState extends MockQueryState {
  actionLog: string[];
}

function resolveRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function resolveStatePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(resolveRepoRoot(), filePath);
}

export function getExecutionMode(): ExecutionMode {
  return process.env.AUTOPOLY_EXECUTION_MODE === "paper" ? "paper" : "live";
}

export function createDefaultLocalAppState(): LocalAppState {
  return {
    ...createMockQueryState(),
    actionLog: []
  };
}

export function createFreshPaperAppState(bankrollUsd: number): LocalAppState {
  const roundedBankrollUsd = Number(bankrollUsd.toFixed(2));
  return {
    overview: {
      status: "running",
      cash_balance_usd: roundedBankrollUsd,
      total_equity_usd: roundedBankrollUsd,
      high_water_mark_usd: roundedBankrollUsd,
      drawdown_pct: 0,
      open_positions: 0,
      last_run_at: null,
      latest_risk_event: `Paper state initialized with ${roundedBankrollUsd.toFixed(2)} USD bankroll.`,
      equity_curve: []
    },
    positions: [],
    trades: [],
    runs: [],
    runDetails: {},
    reports: [],
    backtests: [],
    actionLog: []
  };
}

export function getConfiguredLocalStateFilePath(): string | null {
  const explicitPath = process.env.AUTOPOLY_LOCAL_STATE_FILE?.trim();
  if (explicitPath) {
    return resolveStatePath(explicitPath);
  }

  const e2ePath = process.env.AUTOPOLY_E2E_STATE_FILE?.trim();
  if (e2ePath) {
    return resolveStatePath(e2ePath);
  }

  if (getExecutionMode() === "paper") {
    return path.resolve(resolveRepoRoot(), "runtime-artifacts", "local", "paper-state.json");
  }

  return null;
}

export function shouldUseLocalState(): boolean {
  return Boolean(getConfiguredLocalStateFilePath());
}

async function ensureLocalStateFile(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await access(filePath);
  } catch {
    await writeFile(filePath, JSON.stringify(createDefaultLocalAppState(), null, 2), "utf8");
  }
}

function normalizeLocalState(value: unknown): LocalAppState {
  if (!value || typeof value !== "object") {
    return createDefaultLocalAppState();
  }

  const state = value as Partial<LocalAppState>;
  return {
    ...createDefaultLocalAppState(),
    ...state,
    actionLog: Array.isArray(state.actionLog) ? state.actionLog.map(String) : []
  };
}

function runHasPaperExecution(state: LocalAppState, runId: string): boolean {
  return state.trades.some((trade) =>
    typeof trade.order_id === "string" && trade.order_id.startsWith(`paper-${runId}-`)
  );
}

export function reconcileLocalAppState(state: LocalAppState): LocalAppState {
  const executedAwaitingRunIds = new Set<string>();

  for (const run of state.runs) {
    if (run.status === "awaiting-approval" && runHasPaperExecution(state, run.id)) {
      executedAwaitingRunIds.add(run.id);
    }
  }

  for (const [runId, detail] of Object.entries(state.runDetails)) {
    if (detail.status === "awaiting-approval" && runHasPaperExecution(state, runId)) {
      executedAwaitingRunIds.add(runId);
    }
  }

  const nextOpenPositions = state.positions.length;
  const needsOverviewSync = state.overview.open_positions !== nextOpenPositions;
  if (executedAwaitingRunIds.size === 0 && !needsOverviewSync) {
    return state;
  }

  const timestampUtc = new Date().toISOString();
  const nextRuns = state.runs.map((run) =>
    executedAwaitingRunIds.has(run.id) ? { ...run, status: "completed" as const } : run
  );
  const nextRunDetails = Object.fromEntries(
    Object.entries(state.runDetails).map(([runId, detail]) => [
      runId,
      executedAwaitingRunIds.has(runId)
        ? {
            ...detail,
            status: "completed" as const
          }
        : detail
    ])
  );
  const nextActionLog = executedAwaitingRunIds.size === 0
    ? state.actionLog
    : [
        ...state.actionLog,
        ...Array.from(executedAwaitingRunIds).map((runId) => `${timestampUtc} reconcile-run ${runId} completed`)
      ];

  return {
    ...state,
    overview: {
      ...state.overview,
      open_positions: nextOpenPositions
    },
    runs: nextRuns,
    runDetails: nextRunDetails,
    actionLog: nextActionLog
  };
}

export async function readLocalAppState(filePath = getConfiguredLocalStateFilePath()): Promise<LocalAppState> {
  if (!filePath) {
    return createDefaultLocalAppState();
  }

  await ensureLocalStateFile(filePath);
  const content = await readFile(filePath, "utf8");
  const normalized = normalizeLocalState(JSON.parse(content) as unknown);
  const reconciled = reconcileLocalAppState(normalized);
  if (JSON.stringify(reconciled) !== JSON.stringify(normalized)) {
    await writeFile(filePath, JSON.stringify(reconciled, null, 2), "utf8");
  }
  return reconciled;
}

export async function writeLocalAppState(state: LocalAppState, filePath = getConfiguredLocalStateFilePath()) {
  if (!filePath) {
    throw new Error("No local state file is configured.");
  }

  await ensureLocalStateFile(filePath);
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}

export async function updateLocalAppState(
  updater: (state: LocalAppState) => LocalAppState | Promise<LocalAppState>,
  filePath = getConfiguredLocalStateFilePath()
) {
  const current = await readLocalAppState(filePath);
  const next = reconcileLocalAppState(normalizeLocalState(await updater(current)));
  await writeLocalAppState(next, filePath);
  return next;
}

export function appendLocalAction(state: LocalAppState, action: string): LocalAppState {
  return {
    ...state,
    actionLog: [...state.actionLog, `${new Date().toISOString()} ${action}`]
  };
}
