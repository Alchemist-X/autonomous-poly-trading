import { type RoughLoopProvider } from "@autopoly/contracts";
import type { RoughLoopConfig } from "../config.js";
import { runShellCommand, shellEscape } from "./process.js";

export interface ProviderExecutionResult {
  ok: boolean;
  summary: string;
  blocked: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const placeholderOnlyPattern = /^(?:<[^>\n]+>|＜[^＞\n]+＞|\[[^\]\n]+\])(?:[.。!！?？]+)?$/u;
const genericPlaceholderValues = new Set(["reason", "summary", "原因", "一句话总结"]);

function getProviderConfig(config: RoughLoopConfig): { provider: RoughLoopProvider; command: string; model: string } {
  if (config.provider === "openclaw") {
    return {
      provider: "openclaw",
      command: config.openclaw.command,
      model: config.openclaw.model
    };
  }

  return {
    provider: "codex",
    command: config.codex.command,
    model: config.codex.model
  };
}

function isPlaceholderStructuredValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  if (placeholderOnlyPattern.test(trimmed)) {
    return true;
  }
  const normalized = trimmed.replace(/[.。!！?？]+$/u, "").trim();
  return genericPlaceholderValues.has(normalized) || genericPlaceholderValues.has(normalized.toLowerCase());
}

function invalidStructuredMessage(kind: "ROUGH_LOOP_BLOCKED" | "ROUGH_LOOP_SUMMARY", value: string): string {
  return `Provider emitted placeholder ${kind} text (${value.trim()}). Use a concrete sentence instead of a template placeholder.`;
}

function parseOutcome(text: string): { blocked: boolean; summary: string } {
  const blockedMatch = text.match(/ROUGH_LOOP_BLOCKED:\s*(.+)/i);
  if (blockedMatch?.[1]) {
    const summary = blockedMatch[1].trim();
    if (isPlaceholderStructuredValue(summary)) {
      return {
        blocked: false,
        summary: invalidStructuredMessage("ROUGH_LOOP_BLOCKED", summary)
      };
    }
    return {
      blocked: true,
      summary
    };
  }

  const summaryMatch = text.match(/ROUGH_LOOP_SUMMARY:\s*(.+)/i);
  if (summaryMatch?.[1]) {
    const summary = summaryMatch[1].trim();
    if (isPlaceholderStructuredValue(summary)) {
      return {
        blocked: false,
        summary: invalidStructuredMessage("ROUGH_LOOP_SUMMARY", summary)
      };
    }
    return {
      blocked: false,
      summary
    };
  }

  const firstNonEmptyLine = text.split("\n").map((line) => line.trim()).find(Boolean);
  return {
    blocked: false,
    summary: firstNonEmptyLine || "Provider finished without a structured summary."
  };
}

export async function runProvider(input: {
  config: RoughLoopConfig;
  prompt: string;
}): Promise<ProviderExecutionResult> {
  const provider = getProviderConfig(input.config);
  const args: string[] = [
    "exec",
    "--skip-git-repo-check",
    "-C",
    input.config.repoRoot,
    "-s",
    "workspace-write",
    "--color",
    "never",
    "-"
  ];

  if (provider.model) {
    args.splice(args.length - 1, 0, "-m", provider.model);
  }

  const command = `${provider.command} ${args.map(shellEscape).join(" ")}`;
  const result = await runShellCommand({
    command,
    cwd: input.config.repoRoot,
    shell: input.config.shell,
    timeoutMs: input.config.taskTimeoutMinutes * 60_000,
    stdin: input.prompt
  });
  const combined = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n\n");
  const outcome = parseOutcome(combined);

  return {
    ok: result.exitCode === 0 && !result.timedOut,
    summary: outcome.summary,
    blocked: outcome.blocked,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timedOut: result.timedOut
  };
}
