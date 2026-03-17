import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendLocalAction,
  createDefaultLocalAppState,
  getConfiguredLocalStateFilePath,
  reconcileLocalAppState,
  readLocalAppState,
  updateLocalAppState
} from "./local-state.js";

const tempFiles: string[] = [];

afterEach(() => {
  delete process.env.AUTOPOLY_LOCAL_STATE_FILE;
  delete process.env.AUTOPOLY_E2E_STATE_FILE;
  delete process.env.AUTOPOLY_EXECUTION_MODE;
});

describe("local app state", () => {
  it("creates a default state file on first read", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autopoly-local-state-"));
    const stateFilePath = path.join(tempDir, "paper-state.json");
    tempFiles.push(stateFilePath);

    const state = await readLocalAppState(stateFilePath);

    expect(state.overview.status).toBe("running");
    expect(state.actionLog).toEqual([]);
  });

  it("updates and appends actions in place", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autopoly-local-state-"));
    const stateFilePath = path.join(tempDir, "paper-state.json");
    tempFiles.push(stateFilePath);

    const updated = await updateLocalAppState((state) => appendLocalAction({
      ...state,
      overview: {
        ...state.overview,
        status: "paused"
      }
    }, "pause"), stateFilePath);

    expect(updated.overview.status).toBe("paused");
    expect(updated.actionLog).toHaveLength(1);
    expect(updated.actionLog[0]).toContain("pause");
  });

  it("falls back to a configured paper path in paper mode", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autopoly-local-state-"));
    process.env.AUTOPOLY_EXECUTION_MODE = "paper";
    process.env.AUTOPOLY_LOCAL_STATE_FILE = path.join(tempDir, "paper-state.json");

    const state = await readLocalAppState();

    expect(state).toEqual(createDefaultLocalAppState());
  });

  it("resolves relative local state paths from the repository root", () => {
    process.env.AUTOPOLY_LOCAL_STATE_FILE = "runtime-artifacts/local/paper-state.json";

    expect(getConfiguredLocalStateFilePath()).toContain(path.join("runtime-artifacts", "local", "paper-state.json"));
  });

  it("reconciles awaiting paper runs that already have paper fills", () => {
    const state = createDefaultLocalAppState();
    const runId = "11111111-1111-4111-8111-111111111111";
    const nextState = reconcileLocalAppState({
      ...state,
      runs: [
        {
          id: runId,
          mode: "full",
          runtime: "codex-skill-runtime",
          status: "awaiting-approval",
          bankroll_usd: 10000,
          decision_count: 1,
          generated_at_utc: "2026-03-16T10:00:00.000Z"
        }
      ],
      runDetails: {
        [runId]: {
          id: runId,
          mode: "full",
          runtime: "codex-skill-runtime",
          status: "awaiting-approval",
          bankroll_usd: 10000,
          decision_count: 1,
          generated_at_utc: "2026-03-16T10:00:00.000Z",
          prompt_summary: "summary",
          reasoning_md: "reasoning",
          logs_md: "logs",
          decisions: [],
          artifacts: [],
          tracked_sources: [],
          resolution_checks: []
        }
      },
      trades: [
        {
          id: "trade-1",
          market_slug: "market-1",
          token_id: "token-1",
          status: "filled",
          side: "BUY",
          requested_notional_usd: 25,
          filled_notional_usd: 25,
          avg_price: 0.5,
          order_id: `paper-${runId}-1`,
          timestamp_utc: "2026-03-16T10:05:00.000Z"
        }
      ]
    });

    expect(nextState.runs[0]?.status).toBe("completed");
    expect(nextState.runDetails[runId]?.status).toBe("completed");
    expect(nextState.actionLog.at(-1)).toContain(`reconcile-run ${runId} completed`);
  });

  it("repairs stale local state files on read", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "autopoly-local-state-"));
    const stateFilePath = path.join(tempDir, "paper-state.json");
    const runId = "11111111-1111-4111-8111-111111111111";
    await writeFile(stateFilePath, JSON.stringify({
      ...createDefaultLocalAppState(),
      runs: [
        {
          id: runId,
          mode: "full",
          runtime: "codex-skill-runtime",
          status: "awaiting-approval",
          bankroll_usd: 10000,
          decision_count: 1,
          generated_at_utc: "2026-03-16T10:00:00.000Z"
        }
      ],
      runDetails: {
        [runId]: {
          id: runId,
          mode: "full",
          runtime: "codex-skill-runtime",
          status: "awaiting-approval",
          bankroll_usd: 10000,
          decision_count: 1,
          generated_at_utc: "2026-03-16T10:00:00.000Z",
          prompt_summary: "summary",
          reasoning_md: "reasoning",
          logs_md: "logs",
          decisions: [],
          artifacts: [],
          tracked_sources: [],
          resolution_checks: []
        }
      },
      trades: [
        {
          id: "trade-1",
          market_slug: "market-1",
          token_id: "token-1",
          status: "filled",
          side: "BUY",
          requested_notional_usd: 25,
          filled_notional_usd: 25,
          avg_price: 0.5,
          order_id: `paper-${runId}-1`,
          timestamp_utc: "2026-03-16T10:05:00.000Z"
        }
      ]
    }, null, 2), "utf8");

    const repaired = await readLocalAppState(stateFilePath);

    expect(repaired.runs[0]?.status).toBe("completed");
    expect(repaired.runDetails[runId]?.status).toBe("completed");
  });
});
