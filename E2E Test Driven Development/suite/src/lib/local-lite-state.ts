import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  PublicArtifactListItem,
  PublicRunDetail,
  PublicRunSummary,
  PublicTrade
} from "@autopoly/contracts";
import { createMockQueryState, type MockQueryState } from "@autopoly/db";
import { ensureDir, readJsonFile, writeJsonFile } from "./fs.js";

export interface LocalLiteState extends MockQueryState {
  actionLog: string[];
}

export function createDefaultLocalLiteState(): LocalLiteState {
  return {
    ...createMockQueryState(),
    actionLog: []
  };
}

export async function createLocalLiteStateFile(filePath: string) {
  await ensureDir(path.dirname(filePath));
  await writeJsonFile(filePath, createDefaultLocalLiteState());
}

export async function readLocalLiteState(filePath: string): Promise<LocalLiteState> {
  return readJsonFile<LocalLiteState>(filePath);
}

export async function updateLocalLiteState(filePath: string, updater: (state: LocalLiteState) => LocalLiteState | Promise<LocalLiteState>) {
  const current = await readLocalLiteState(filePath);
  const next = await updater(current);
  await writeJsonFile(filePath, next);
  return next;
}

export function appendAction(state: LocalLiteState, action: string): LocalLiteState {
  return {
    ...state,
    actionLog: [...state.actionLog, `${new Date().toISOString()} ${action}`]
  };
}

export function applyPause(state: LocalLiteState): LocalLiteState {
  return appendAction({
    ...state,
    overview: {
      ...state.overview,
      status: "paused",
      latest_risk_event: "Local-lite admin pause activated."
    }
  }, "pause");
}

export function applyResume(state: LocalLiteState): LocalLiteState {
  return appendAction({
    ...state,
    overview: {
      ...state.overview,
      status: "running",
      latest_risk_event: "Local-lite admin resume activated."
    }
  }, "resume");
}

function buildSyntheticReport(now: string): PublicArtifactListItem {
  return {
    id: randomUUID(),
    title: `Pulse ${now}`,
    kind: "pulse-report",
    path: `reports/pulse-${now.replaceAll(":", "-")}.md`,
    published_at_utc: now
  };
}

function buildSyntheticTrade(now: string): PublicTrade {
  return {
    id: randomUUID(),
    market_slug: "local-lite-macro-cycle",
    token_id: "token-local-lite-smoke",
    status: "filled",
    side: "BUY",
    requested_notional_usd: 25,
    filled_notional_usd: 25,
    avg_price: 0.5,
    order_id: `local-lite-${now.replaceAll(":", "-")}`,
    timestamp_utc: now
  };
}

function buildSyntheticRun(now: string, bankrollUsd: number): {
  run: PublicRunSummary;
  detail: PublicRunDetail;
  report: PublicArtifactListItem;
} {
  const runId = randomUUID();
  const report = buildSyntheticReport(now);
  const run: PublicRunSummary = {
    id: runId,
    mode: "full",
    runtime: "local-lite-fake-orchestrator",
    status: "completed",
    bankroll_usd: bankrollUsd,
    decision_count: 2,
    generated_at_utc: now
  };
  const detail: PublicRunDetail = {
    ...run,
    prompt_summary: "Local-lite fake orchestrator generated a synthetic cycle for E2E verification.",
    reasoning_md: "This run exists only to validate public visibility, admin flow, and artifact wiring.",
    logs_md: "- Local-lite run created\n- Public polling should detect this update",
    decisions: [
      {
        action: "hold",
        event_slug: "bitcoin-150k-before-september",
        market_slug: "bitcoin-150k-before-september",
        token_id: "token-btc-no",
        side: "BUY",
        notional_usd: 0.01,
        order_type: "FOK",
        ai_prob: 0.62,
        market_prob: 0.58,
        edge: 0.04,
        confidence: "medium",
        thesis_md: "Hold existing synthetic position for UI verification.",
        sources: [
          {
            title: "Local-lite source",
            url: "https://example.com/local-lite",
            retrieved_at_utc: now
          }
        ],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      },
      {
        action: "open",
        event_slug: "local-lite-macro-cycle",
        market_slug: "local-lite-macro-cycle",
        token_id: "token-local-lite-smoke",
        side: "BUY",
        notional_usd: 25,
        order_type: "FOK",
        ai_prob: 0.6,
        market_prob: 0.44,
        edge: 0.16,
        confidence: "high",
        thesis_md: "Synthetic open decision used to validate runs, details, and report updates.",
        sources: [
          {
            title: "Local-lite pulse",
            url: "https://example.com/local-lite-pulse",
            retrieved_at_utc: now
          }
        ],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      }
    ],
    artifacts: [
      {
        kind: "pulse-report",
        title: report.title,
        path: report.path,
        content: "# Local-lite pulse\n\nGenerated during E2E verification.",
        published_at_utc: now
      }
    ]
  };

  return { run, detail, report };
}

export function applyRunNow(state: LocalLiteState): { state: LocalLiteState; runId: string } {
  const now = new Date().toISOString();
  const { run, detail, report } = buildSyntheticRun(now, state.overview.total_equity_usd);
  const nextCurve = [
    ...state.overview.equity_curve.slice(-11),
    {
      timestamp: now,
      total_equity_usd: Number((state.overview.total_equity_usd + 12.5).toFixed(2)),
      drawdown_pct: state.overview.drawdown_pct
    }
  ];
  const trade = buildSyntheticTrade(now);

  return {
    runId: run.id,
    state: appendAction({
      ...state,
      overview: {
        ...state.overview,
        total_equity_usd: Number((state.overview.total_equity_usd + 12.5).toFixed(2)),
        cash_balance_usd: Number((state.overview.cash_balance_usd - trade.requested_notional_usd).toFixed(2)),
        last_run_at: now,
        latest_risk_event: "Local-lite run executed successfully.",
        equity_curve: nextCurve
      },
      runs: [run, ...state.runs],
      runDetails: {
        ...state.runDetails,
        [run.id]: detail
      },
      reports: [report, ...state.reports],
      trades: [trade, ...state.trades]
    }, "run-now")
  };
}

export function applyFlatten(state: LocalLiteState): LocalLiteState {
  const now = new Date().toISOString();
  const flattenTrades = state.positions.map<PublicTrade>((position) => ({
    id: randomUUID(),
    market_slug: position.market_slug,
    token_id: position.token_id,
    status: "manual_flatten",
    side: "SELL",
    requested_notional_usd: position.current_value_usd,
    filled_notional_usd: position.current_value_usd,
    avg_price: position.current_price,
    order_id: `flatten-${position.id}`,
    timestamp_utc: now
  }));

  return appendAction({
    ...state,
    positions: [],
    trades: [...flattenTrades, ...state.trades],
    overview: {
      ...state.overview,
      open_positions: 0,
      latest_risk_event: "Local-lite flatten completed."
    }
  }, "flatten");
}
