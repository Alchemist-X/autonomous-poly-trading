import {
  createFreshPaperAppState,
  getConfiguredLocalStateFilePath,
  getExecutionMode,
  writeLocalAppState
} from "@autopoly/db";
import { createTerminalPrinter, formatUsd } from "@autopoly/terminal-ui";
import { loadConfig } from "../config.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const bankrollIndex = args.indexOf("--bankroll");
  const bankrollValue = bankrollIndex >= 0 ? Number(args[bankrollIndex + 1] ?? "") : null;
  return {
    json: args.includes("--json"),
    bankroll: Number.isFinite(bankrollValue) && bankrollValue != null && bankrollValue > 0
      ? bankrollValue
      : null
  };
}

async function main() {
  const args = parseArgs();
  const config = loadConfig();
  const executionMode = getExecutionMode();
  const localStateFile = getConfiguredLocalStateFilePath();

  if (executionMode !== "paper" || !localStateFile) {
    throw new Error("trial:reset-paper is only available when AUTOPOLY_EXECUTION_MODE=paper.");
  }

  const bankrollUsd = Number((args.bankroll ?? config.initialBankrollUsd).toFixed(2));
  const nextState = createFreshPaperAppState(bankrollUsd);
  nextState.actionLog.push(`${new Date().toISOString()} reset-paper bankroll ${bankrollUsd.toFixed(2)}`);
  await writeLocalAppState(nextState, localStateFile);

  const output = {
    localStateFile,
    bankrollUsd,
    status: nextState.overview.status,
    openPositions: nextState.overview.open_positions
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const printer = createTerminalPrinter();
  printer.section("Paper State Reset");
  printer.table([
    ["Local State File", localStateFile],
    ["Bankroll", formatUsd(bankrollUsd)],
    ["Status", nextState.overview.status],
    ["Open Positions", String(nextState.overview.open_positions)]
  ]);
  printer.list([
    "Next step: pnpm trial:recommend",
    `Verify state: ${localStateFile}`
  ], "info");
}

await main();
