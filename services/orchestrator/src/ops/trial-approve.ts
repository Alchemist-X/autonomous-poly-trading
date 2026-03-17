import {
  getConfiguredLocalStateFilePath,
  getExecutionMode,
  updateLocalAppState
} from "@autopoly/db";
import { createTerminalPrinter, formatUsd, formatRatioPercent } from "@autopoly/terminal-ui";
import { loadConfig } from "../config.js";
import { approvePaperRun } from "./paper-trading.js";
import { checkpointAbsolutePath } from "./trial-recommend-checkpoint.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const runIdIndex = args.indexOf("--run-id");
  const runId = runIdIndex >= 0 ? args[runIdIndex + 1] ?? null : null;
  return {
    json: args.includes("--json"),
    latest: args.includes("--latest") || runId == null,
    runId
  };
}

function printHumanSummary(output: {
  localStateFile: string;
  runId: string;
  executedTradeCount: number;
  openPositions: number;
  totalEquityUsd: number;
  drawdownPct: number;
  status: string;
  checkpointPath: string;
}) {
  const printer = createTerminalPrinter();
  printer.section("Paper Approval");
  printer.note("success", "Paper execution completed", output.runId);
  printer.table([
    ["Local State File", output.localStateFile],
    ["Approved Run", output.runId],
    ["Executed Trades", String(output.executedTradeCount)],
    ["Open Positions", String(output.openPositions)],
    ["Total Equity", formatUsd(output.totalEquityUsd)],
    ["Drawdown", formatRatioPercent(output.drawdownPct)],
    ["System Status", output.status]
  ]);
  printer.section("Verify", `run ${output.runId}`);
  printer.table([
    ["Local State File", output.localStateFile],
    ["Checkpoint", output.checkpointPath],
    ["Approved Run", output.runId]
  ]);
  if (output.status === "halted") {
    printer.note("warn", "Risk stop is active", "drawdown exceeded the configured halt threshold");
  }
  printer.list([
    `Inspect local paper state: ${output.localStateFile}`,
    `Inspect checkpoint: ${output.checkpointPath}`
  ], "info");
}

async function main() {
  const args = parseArgs();
  const config = loadConfig();
  const executionMode = getExecutionMode();
  const localStateFile = getConfiguredLocalStateFilePath();

  if (executionMode !== "paper" || !localStateFile) {
    throw new Error("trial:approve is only available when AUTOPOLY_EXECUTION_MODE=paper.");
  }

  let approvalResult: ReturnType<typeof approvePaperRun> | undefined;
  const nextState = await updateLocalAppState((state) => {
    const approved = approvePaperRun({
      state,
      config,
      runId: args.runId ?? undefined,
      latest: args.latest
    });
    approvalResult = approved;
    return approved.state;
  }, localStateFile);

  const approved = approvalResult;
  if (!approved) {
    throw new Error("Paper approval did not produce a result.");
  }

  const output = {
    localStateFile,
    runId: approved.runId,
    executedTradeCount: approved.executedTradeCount,
    openPositions: nextState.positions.length,
    totalEquityUsd: nextState.overview.total_equity_usd,
    drawdownPct: nextState.overview.drawdown_pct,
    status: nextState.overview.status,
    checkpointPath: checkpointAbsolutePath(config, approved.runId)
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  printHumanSummary(output);
}

await main();
