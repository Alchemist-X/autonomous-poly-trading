import { roughLoopVerificationResultSchema, type RoughLoopVerificationCommandResult, type RoughLoopVerificationResult } from "@autopoly/contracts";
import type { RoughLoopConfig } from "../config.js";
import { runShellCommand } from "./process.js";

export async function runVerification(input: {
  config: RoughLoopConfig;
  commands: string[];
}): Promise<RoughLoopVerificationResult> {
  const commandResults: RoughLoopVerificationCommandResult[] = [];

  for (const command of input.commands) {
    const result = await runShellCommand({
      command,
      cwd: input.config.repoRoot,
      shell: input.config.shell,
      timeoutMs: input.config.taskTimeoutMinutes * 60_000
    });
    const passed = result.exitCode === 0 && !result.timedOut;
    commandResults.push({
      command,
      exitCode: result.exitCode,
      passed,
      stdout: result.stdout,
      stderr: result.stderr
    });

    if (!passed) {
      return roughLoopVerificationResultSchema.parse({
        passed: false,
        summary: result.timedOut
          ? `Verification command timed out: ${command}`
          : `Verification command failed: ${command}`,
        commandResults
      });
    }
  }

  return roughLoopVerificationResultSchema.parse({
    passed: true,
    summary: "All verification commands passed.",
    commandResults
  });
}
