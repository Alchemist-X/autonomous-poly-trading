import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { createTerminalPrinter } from "@autopoly/terminal-ui";

interface DailyPulseArgs {
  help: boolean;
  recommendOnly: boolean;
  noStayOpen: boolean;
  passthrough: string[];
}

export function parseDailyPulseArgs(argv = process.argv.slice(2)): DailyPulseArgs {
  return {
    help: argv.includes("--help") || argv.includes("-h"),
    recommendOnly: argv.includes("--recommend-only"),
    noStayOpen: argv.includes("--no-stay-open"),
    passthrough: argv.filter(
      (arg) => arg !== "--execute" && arg !== "--recommend-only" && arg !== "--no-stay-open" && arg !== "--help" && arg !== "-h"
    )
  };
}

export function buildDailyPulseCommand(args: DailyPulseArgs) {
  const childArgs = ["scripts/pulse-live.ts"];
  if (args.recommendOnly) {
    childArgs.push("--recommend-only");
  }
  childArgs.push(...args.passthrough);

  return {
    command: "tsx",
    args: childArgs,
    env: {
      ...process.env,
      ENV_FILE: process.env.ENV_FILE ?? path.resolve(process.cwd(), ".env.pizza"),
      AUTOPOLY_EXECUTION_MODE: process.env.AUTOPOLY_EXECUTION_MODE ?? "live",
      AGENT_DECISION_STRATEGY: process.env.AGENT_DECISION_STRATEGY ?? "pulse-direct"
    }
  };
}

export function shouldStayOpenAfterRun(
  args: DailyPulseArgs,
  io: { stdinIsTTY: boolean; stdoutIsTTY: boolean } = {
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY)
  }
) {
  if (args.noStayOpen || args.passthrough.includes("--json")) {
    return false;
  }
  return io.stdinIsTTY && io.stdoutIsTTY;
}

function printHelp() {
  console.log(
    [
      "daily:forecast",
      "",
      "Default route: pulse-live daily pulse in live execute mode.",
      "",
      "Examples:",
      "  pnpm daily:forecast",
      "  pnpm daily:forecast -- --json",
      "  pnpm daily:forecast -- --pulse-json <path> --pulse-markdown <path>",
      "  pnpm daily:forecast -- --recommend-only --json",
      "  pnpm daily:forecast -- --no-stay-open",
      "",
      "Behavior:",
      "  - Defaults ENV_FILE to .env.pizza if unset.",
      "  - Defaults AUTOPOLY_EXECUTION_MODE to live if unset.",
      "  - Defaults AGENT_DECISION_STRATEGY to pulse-direct if unset.",
      "  - Uses forecast:live under the hood.",
      "  - Executes real-money flow unless --recommend-only is explicitly provided.",
      "  - Stays open in interactive terminals after each run unless --no-stay-open is provided."
    ].join("\n")
  );
}

async function runDailyPulseChild(args: DailyPulseArgs) {
  const command = buildDailyPulseCommand(args);
  const modeLabel = args.recommendOnly ? "recommend-only" : "execute";
  process.stderr.write(
    `[daily:forecast] mode=${modeLabel} env=${command.env.ENV_FILE} execution_mode=${command.env.AUTOPOLY_EXECUTION_MODE} strategy=${command.env.AGENT_DECISION_STRATEGY}\n`
  );

  return await new Promise<number>((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: process.cwd(),
      env: command.env,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? -1);
    });
  });
}

async function promptNextAction(lastExitCode: number) {
  const printer = createTerminalPrinter();
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  printer.section("daily:forecast Console");
  printer.note(lastExitCode === 0 ? "success" : "error", "last run", lastExitCode === 0 ? "completed" : `failed with exit code ${lastExitCode}`);
  printer.list([
    "Press Enter or type `rerun` to run daily pulse again.",
    "Type `recommend-only` to rerun without sending live orders.",
    "Type `quit` to leave this console."
  ], "info");

  try {
    while (true) {
      const answer = (await rl.question("daily:forecast> ")).trim().toLowerCase();
      if (answer === "" || answer === "rerun" || answer === "run") {
        return "rerun";
      }
      if (answer === "recommend-only" || answer === "preview") {
        return "recommend-only";
      }
      if (answer === "quit" || answer === "exit" || answer === "q") {
        return "quit";
      }
      printer.note("warn", "unknown command", "Use rerun | recommend-only | quit");
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const parsed = parseDailyPulseArgs();
  if (parsed.help) {
    printHelp();
    return;
  }

  const stayOpen = shouldStayOpenAfterRun(parsed);
  let currentArgs = parsed;
  let lastExitCode = 0;

  while (true) {
    lastExitCode = await runDailyPulseChild(currentArgs);
    if (!stayOpen) {
      if (lastExitCode !== 0) {
        throw new Error(`daily:forecast exited with code ${lastExitCode}`);
      }
      return;
    }

    const action = await promptNextAction(lastExitCode);
    if (action === "quit") {
      if (lastExitCode !== 0) {
        process.exit(lastExitCode);
      }
      return;
    }

    currentArgs = {
      ...parsed,
      recommendOnly: action === "recommend-only"
    };
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[daily:forecast] ${message}`);
  process.exit(1);
});
