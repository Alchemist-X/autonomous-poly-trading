import {
  createTerminalPrinter,
  formatDuration,
  shouldUseHumanOutput,
  type Tone
} from "@autopoly/terminal-ui";
import { loadConfig } from "./config.js";
import { runDoctor } from "./lib/doctor.js";
import { acquireLoopLock, runLoopOnce } from "./lib/loop.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.find((arg) => !arg.startsWith("--")) ?? "daemon";
  return {
    mode,
    json: args.includes("--json")
  };
}

function outcomeTone(kind: "done" | "blocked" | "retry" | "idle" | "paused"): Tone {
  switch (kind) {
    case "done":
      return "success";
    case "blocked":
      return "error";
    case "retry":
      return "warn";
    case "paused":
      return "warn";
    case "idle":
      return "muted";
    default:
      return "info";
  }
}

function printOutcomeHuman(input: {
  mode: string;
  pollSeconds: number;
  outcome: Awaited<ReturnType<typeof runLoopOnce>>;
}) {
  const printer = createTerminalPrinter();
  printer.section(`Rough Loop ${input.mode}`);
  printer.note(outcomeTone(input.outcome.kind), `Result ${input.outcome.kind}`, input.outcome.record?.summary ?? "No task executed in this iteration.");

  if (!input.outcome.record) {
    if (input.mode === "daemon" && (input.outcome.kind === "idle" || input.outcome.kind === "paused")) {
      printer.keyValue("Next Poll", `${formatDuration(input.pollSeconds * 1000)} later`, "muted");
    }
    return;
  }

  const record = input.outcome.record;
  printer.table([
    ["Task ID", record.taskId],
    ["Run ID", record.runId],
    ["Status", record.status],
    ["Attempt", String(record.attempt)],
    ["Provider", record.provider],
    ["Artifacts", record.artifactsDir]
  ]);

  if (record.changedFiles.length > 0) {
    printer.section("Changed Files");
    printer.list(record.changedFiles);
  }

  if (record.verification) {
    printer.section("Verification", record.verification.summary);
    for (const result of record.verification.commandResults) {
      printer.note(result.passed ? "success" : "error", result.command, `exit ${result.exitCode}`);
    }
  }

  if (input.mode === "daemon" && (input.outcome.kind === "idle" || input.outcome.kind === "paused")) {
    printer.keyValue("Next Poll", `${formatDuration(input.pollSeconds * 1000)} later`, "muted");
  }
}

function printDoctorHuman(checks: Awaited<ReturnType<typeof runDoctor>>) {
  const printer = createTerminalPrinter();
  const ok = checks.every((check) => check.ok);
  printer.section("Rough Loop Doctor");
  printer.note(ok ? "success" : "error", ok ? "All checks passed" : "Doctor found issues");
  for (const check of checks) {
    printer.note(check.ok ? "success" : "error", check.name, check.detail);
  }
}

async function runDaemon() {
  const config = loadConfig();
  const releaseLock = await acquireLoopLock(config);
  const useJson = args.json || !shouldUseHumanOutput(process.stdout);

  const cleanup = async () => {
    await releaseLock();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void cleanup();
  });
  process.once("SIGTERM", () => {
    void cleanup();
  });

  try {
    while (true) {
      const outcome = await runLoopOnce(config);
      if (useJson) {
        printJson({
          模式: "daemon",
          结果: outcome.kind,
          记录: outcome.record
        });
      } else {
        printOutcomeHuman({
          mode: "daemon",
          pollSeconds: config.pollSeconds,
          outcome
        });
      }

      if (outcome.kind === "idle" || outcome.kind === "paused") {
        await sleep(config.pollSeconds * 1000);
        continue;
      }

      await sleep(1_000);
    }
  } finally {
    await releaseLock();
  }
}

async function runOnceCommand() {
  const config = loadConfig();
  const releaseLock = await acquireLoopLock(config);
  const useJson = args.json || !shouldUseHumanOutput(process.stdout);
  try {
    const outcome = await runLoopOnce(config);
    if (useJson) {
      printJson({
        模式: "once",
        结果: outcome.kind,
        记录: outcome.record
      });
    } else {
      printOutcomeHuman({
        mode: "once",
        pollSeconds: config.pollSeconds,
        outcome
      });
    }
  } finally {
    await releaseLock();
  }
}

async function runDoctorCommand() {
  const config = loadConfig();
  const checks = await runDoctor(config);
  const ok = checks.every((check) => check.ok);
  if (args.json || !shouldUseHumanOutput(process.stdout)) {
    printJson({
      模式: "doctor",
      通过: ok,
      检查: checks
    });
  } else {
    printDoctorHuman(checks);
  }
  if (!ok) {
    process.exitCode = 1;
  }
}

const args = parseArgs();

if (args.json) {
  process.env.NO_COLOR = "1";
}

switch (args.mode) {
  case "daemon":
    await runDaemon();
    break;
  case "once":
    await runOnceCommand();
    break;
  case "doctor":
    await runDoctorCommand();
    break;
  default:
    throw new Error(`Unsupported rough-loop mode: ${args.mode}`);
}
