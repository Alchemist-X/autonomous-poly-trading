import { readFile } from "node:fs/promises";
import type {
  OverviewResponse,
  PublicArtifactListItem,
  PublicPosition,
  PublicRunDetail,
  PublicRunSummary,
  PublicTrade
} from "@autopoly/contracts";

const now = new Date("2026-03-13T10:00:00.000Z");
const E2E_STATE_FILE_ENV = "AUTOPOLY_E2E_STATE_FILE";

export interface MockQueryState {
  overview: OverviewResponse;
  positions: PublicPosition[];
  trades: PublicTrade[];
  runs: PublicRunSummary[];
  runDetails: Record<string, PublicRunDetail>;
  reports: PublicArtifactListItem[];
  backtests: PublicArtifactListItem[];
}

export function createMockQueryState(): MockQueryState {
  const overview: OverviewResponse = {
    status: "running",
    cash_balance_usd: 5234.18,
    total_equity_usd: 11842.77,
    high_water_mark_usd: 12490.11,
    drawdown_pct: 0.0518,
    open_positions: 3,
    last_run_at: new Date(now.getTime() - 18 * 60 * 1000).toISOString(),
    latest_risk_event: "No active risk breach. Drawdown guard below 20%.",
    equity_curve: Array.from({ length: 10 }, (_, index) => {
      const total = 10950 + index * 85 + (index % 3 === 0 ? 40 : -20);
      return {
        timestamp: new Date(now.getTime() - (9 - index) * 6 * 60 * 60 * 1000).toISOString(),
        total_equity_usd: total,
        drawdown_pct: Math.max(0, (12490.11 - total) / 12490.11)
      };
    })
  };

  const positions: PublicPosition[] = [
    {
      id: "319a8db4-4677-4faa-8b3e-2b2bdf6694ba",
      event_slug: "will-the-fed-cut-rates-by-june",
      market_slug: "fed-cut-rates-by-june",
      token_id: "token-fed-cut-yes",
      side: "BUY",
      outcome_label: "Yes",
      size: 210,
      avg_cost: 0.43,
      current_price: 0.57,
      current_value_usd: 119.7,
      unrealized_pnl_pct: 0.3256,
      stop_loss_pct: 0.3,
      opened_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now.toISOString()
    },
    {
      id: "f6e836c4-f1f5-4c16-b9b9-b95e3af9ef80",
      event_slug: "will-openai-release-gpt-6-in-2026",
      market_slug: "openai-release-gpt-6-2026",
      token_id: "token-gpt6-no",
      side: "BUY",
      outcome_label: "No",
      size: 310,
      avg_cost: 0.62,
      current_price: 0.68,
      current_value_usd: 210.8,
      unrealized_pnl_pct: 0.0967,
      stop_loss_pct: 0.3,
      opened_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now.toISOString()
    },
    {
      id: "95dc018a-26d2-48d2-8f4d-a67b9d9ac4df",
      event_slug: "will-bitcoin-hit-150k-before-september",
      market_slug: "bitcoin-150k-before-september",
      token_id: "token-btc-no",
      side: "BUY",
      outcome_label: "No",
      size: 540,
      avg_cost: 0.71,
      current_price: 0.64,
      current_value_usd: 345.6,
      unrealized_pnl_pct: -0.0986,
      stop_loss_pct: 0.3,
      opened_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now.toISOString()
    }
  ];

  const trades: PublicTrade[] = [
    {
      id: "df6fa94d-8b79-4e7d-aa17-dd9cded0fdd0",
      market_slug: "fed-cut-rates-by-june",
      token_id: "token-fed-cut-yes",
      status: "filled",
      side: "BUY",
      requested_notional_usd: 90.3,
      filled_notional_usd: 90.3,
      avg_price: 0.43,
      order_id: "pm-order-1",
      timestamp_utc: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "edce07ad-c352-4e44-bc15-8cd218d8703f",
      market_slug: "openai-release-gpt-6-2026",
      token_id: "token-gpt6-no",
      status: "filled",
      side: "BUY",
      requested_notional_usd: 192.2,
      filled_notional_usd: 192.2,
      avg_price: 0.62,
      order_id: "pm-order-2",
      timestamp_utc: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "aa5a2750-ebcf-4404-a0d7-b44549d78406",
      market_slug: "bitcoin-150k-before-september",
      token_id: "token-btc-no",
      status: "filled",
      side: "BUY",
      requested_notional_usd: 383.4,
      filled_notional_usd: 383.4,
      avg_price: 0.71,
      order_id: "pm-order-3",
      timestamp_utc: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const runs: PublicRunSummary[] = [
    {
      id: "ca7297f2-6ab3-432d-a462-a3fa8e0800ec",
      mode: "full",
      runtime: "codex-skill-runtime",
      status: "completed",
      bankroll_usd: 12000,
      decision_count: 4,
      generated_at_utc: new Date(now.getTime() - 18 * 60 * 1000).toISOString()
    },
    {
      id: "03e5ce66-b97b-4ff0-b798-eb1e5e6d25d1",
      mode: "review",
      runtime: "codex-skill-runtime",
      status: "completed",
      bankroll_usd: 12000,
      decision_count: 3,
      generated_at_utc: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
    }
  ];

  const primaryRunDetail: PublicRunDetail = {
    ...runs[0]!,
    prompt_summary: "基于最新市场脉冲、当前组合和硬风控规则运行 codex skill runtime。",
    reasoning_md: "保留了一笔宏观利率仓位和一笔 AI `No` 仓位，同时移除了一个因流动性与市场脉冲过滤未通过的开仓候选。",
    logs_md: "- 已同步组合快照\n- 已按命名空间落盘 skill 驱动的市场脉冲\n- 风控引擎正常\n- 一笔交易因流动性上限被跳过",
    decisions: [
      {
        action: "hold",
        event_slug: "will-bitcoin-hit-150k-before-september",
        market_slug: "bitcoin-150k-before-september",
        token_id: "token-btc-no",
        side: "BUY",
        notional_usd: 0.01,
        order_type: "FOK",
        ai_prob: 0.74,
        market_prob: 0.64,
        edge: 0.1,
        confidence: "medium-high",
        thesis_md: "Despite recent price strength, the required deadline remains aggressive.",
        sources: [
          {
            title: "Market commentary",
            url: "https://example.com/market-commentary",
            retrieved_at_utc: now.toISOString()
          }
        ],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      },
      {
        action: "open",
        event_slug: "will-the-fed-cut-rates-by-june",
        market_slug: "fed-cut-rates-by-june",
        token_id: "token-fed-cut-yes",
        side: "BUY",
        notional_usd: 90.3,
        order_type: "FOK",
        ai_prob: 0.61,
        market_prob: 0.43,
        edge: 0.18,
        confidence: "high",
        thesis_md: "Recent macro data and Fed communication shifted the path toward easing.",
        sources: [
          {
            title: "Fed watch",
            url: "https://example.com/fed-watch",
            retrieved_at_utc: now.toISOString()
          }
        ],
        stop_loss_pct: 0.3,
        resolution_track_required: true
      }
    ],
    artifacts: [
      {
        kind: "pulse-report",
        title: "市场脉冲 2026-03-13 09:42 UTC",
        path: "reports/pulse/2026/03/13/pulse-20260313T094200Z-codex-full-ca7297f2-6ab3-432d-a462-a3fa8e0800ec.md",
        content: "# 市场脉冲\n\n当前首要想法：美联储在六月前降息。",
        published_at_utc: now.toISOString()
      }
    ],
    tracked_sources: [
      {
        id: "c52cc014-a98f-4c08-a480-0223dcd120e9",
        run_id: runs[0]!.id,
        decision_id: null,
        event_slug: "will-the-fed-cut-rates-by-june",
        market_slug: "fed-cut-rates-by-june",
        title: "Fed watch",
        url: "https://example.com/fed-watch",
        source_kind: "external",
        role: "decision-source",
        status: "captured",
        retrieved_at_utc: now.toISOString(),
        last_checked_at: now.toISOString(),
        note: null,
        content_hash: null
      }
    ],
    resolution_checks: [
      {
        id: "36b4033b-6989-48a5-a354-37fc3d1e02be",
        event_slug: "will-the-fed-cut-rates-by-june",
        market_slug: "fed-cut-rates-by-june",
        track_status: "watching",
        interval_minutes: 60,
        next_check_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        last_checked_at: now.toISOString(),
        summary: "结算源可自动追踪，当前快照无变化。",
        trackability: "完全",
        source_url: "https://example.com/fed-watch",
        source_type: "generic_url",
        report_path: "reports/resolution/2026/03/13/resolution-20260313T100000Z-resolution-watch-fed-cut-rates-by-june.md"
      }
    ]
  };

  const reports: PublicArtifactListItem[] = [
    {
      id: "2a352904-6350-4272-a34c-d52b2cf5e58e",
      title: "市场脉冲 2026-03-13 09:42 UTC",
      kind: "pulse-report",
      path: "reports/pulse/2026/03/13/pulse-20260313T094200Z-codex-full-ca7297f2-6ab3-432d-a462-a3fa8e0800ec.md",
      published_at_utc: now.toISOString()
    },
    {
      id: "493bb898-f724-4ec7-854c-22f502449672",
      title: "Resolution Watch: Fed by June",
      kind: "resolution-report",
      path: "reports/resolution-2026-03-13-080000.md",
      published_at_utc: new Date(now.getTime() - 90 * 60 * 1000).toISOString()
    }
  ];

  const backtests: PublicArtifactListItem[] = [
    {
      id: "f4302a1d-2420-4717-b93f-5587d245188a",
      title: "Backtest 2026-03-13 00:10 UTC",
      kind: "backtest-report",
      path: "reports/backtest-2026-03-13-001000.md",
      published_at_utc: new Date("2026-03-13T00:10:00.000Z").toISOString()
    }
  ];

  return {
    overview,
    positions,
    trades,
    runs,
    runDetails: {
      [primaryRunDetail.id]: primaryRunDetail
    },
    reports,
    backtests
  };
}

const defaultState = createMockQueryState();

export const mockOverview = defaultState.overview;
export const mockPositions = defaultState.positions;
export const mockTrades = defaultState.trades;
export const mockRuns = defaultState.runs;
export const mockRunDetail = defaultState.runDetails[mockRuns[0]!.id]!;
export const mockReports = defaultState.reports;
export const mockBacktests = defaultState.backtests;

async function readConfiguredStateFile(filePath: string): Promise<MockQueryState | null> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as MockQueryState;
  } catch {
    return null;
  }
}

export async function getConfiguredMockQueryState(): Promise<MockQueryState> {
  const filePath = process.env[E2E_STATE_FILE_ENV];
  if (!filePath) {
    return defaultState;
  }
  return (await readConfiguredStateFile(filePath)) ?? defaultState;
}
