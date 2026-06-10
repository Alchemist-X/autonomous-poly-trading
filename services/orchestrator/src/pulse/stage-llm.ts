// Shared structured-LLM caller for the per-stage forecasting producers.
//
// Each forecasting stage (resolution, query plan, conditional model, ...) makes ONE structured
// LLM call that returns typed JSON. The model is invoked exactly like the rest of the orchestrator:
// a CLI subprocess (`claude --print` etc.) driven by the provider command template. To keep the
// producers unit-testable, they depend on the StageLlmCaller *interface* (injected); tests pass a
// mock that returns canned JSON, production passes createCliStageLlmCaller().

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AgentRuntimeProvider, OrchestratorConfig } from "../config.js";
import { resolveProviderSkillSettings } from "../runtime/skill-settings.js";

export interface StageLlmRequest {
  prompt: string;
  /** Short label for telemetry, e.g. "resolution:us-iran-nuclear-deal". */
  label: string;
  /** Resolved model id for this stage (see stage-models.ts). Falls back to the caller default. */
  model?: string;
  /** Per-call hard deadline in ms; <= 0 means unbounded. Defaults to the caller's default. */
  timeoutMs?: number;
}

export interface StageLlmResponse {
  raw: string;
  json: unknown;
  elapsedMs: number;
}

export type StageLlmCaller = (request: StageLlmRequest) => Promise<StageLlmResponse>;

/** Find the first balanced {...} or [...] span, respecting strings/escapes. */
function findFirstJsonSpan(text: string): string | null {
  const objIdx = text.indexOf("{");
  const arrIdx = text.indexOf("[");
  const startIdx = objIdx === -1 ? arrIdx : arrIdx === -1 ? objIdx : Math.min(objIdx, arrIdx);
  if (startIdx === -1) return null;

  const open = text[startIdx];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

/** Resilient JSON extraction from LLM output: direct parse, fenced block, or first balanced span. */
export function extractJsonValue(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("stage LLM returned empty output");

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // fall through
    }
  }

  const span = findFirstJsonSpan(trimmed);
  if (span) {
    try {
      return JSON.parse(span);
    } catch {
      // fall through
    }
  }

  throw new Error("no parseable JSON found in stage LLM output");
}

function interpolateCommand(template: string, vars: Record<string, string>): string {
  let command = template;
  for (const [key, value] of Object.entries(vars)) {
    command = command.replaceAll(`{{${key}}}`, value);
  }
  return command;
}

const SIGKILL_GRACE_MS = 5_000;

function runShell(command: string, cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // detached -> own process group, so a timeout kills the whole pipeline (`cat | claude`),
    // not just the /bin/sh wrapper — otherwise the claude subprocess survives as an orphan
    // and keeps burning tokens against a deleted temp dir.
    const child = spawn("/bin/sh", ["-lc", command], { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env, detached: true });
    let stdout = "";
    let stderr = "";
    let killTimer: ReturnType<typeof setTimeout> | null = null;
    const killGroup = (signal: NodeJS.Signals) => {
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, signal);
      } catch {
        try {
          child.kill(signal);
        } catch {
          // already gone
        }
      }
    };
    const timer = timeoutMs > 0
      ? setTimeout(() => {
          killGroup("SIGTERM");
          killTimer = setTimeout(() => killGroup("SIGKILL"), SIGKILL_GRACE_MS);
          reject(new Error(`stage LLM call timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : null;
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      reject(error);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || stdout.trim() || `stage LLM exited with code ${code}`));
    });
  });
}

/**
 * Stage-call command templates. Unlike the markdown-render default (which omits the model for
 * claude-code), these ALWAYS pass {{model}} so each forecasting stage can run on its assigned tier.
 * A configured provider COMMAND wins if set (it must include {{model}}).
 */
export function resolveStageCommandTemplate(provider: AgentRuntimeProvider, configuredCommand?: string): string | null {
  if (configuredCommand && configuredCommand.trim()) return configuredCommand;
  switch (provider) {
    case "claude-code":
      return "cat {{prompt_file}} | claude --print --model {{model}} > {{output_file}}";
    case "codex":
      return "cat {{prompt_file}} | codex exec --skip-git-repo-check -C {{repo_root}} -s read-only --color never -m {{model}} -o {{output_file}} -";
    default:
      return null;
  }
}

/**
 * Production caller that invokes the provider CLI (`claude --print --model <tier>`) once per
 * request and returns the parsed JSON. The per-request model (from stage-models.ts) wins over the
 * caller default so information stages run on Sonnet and judgment stages on Opus.
 */
export function createCliStageLlmCaller(input: {
  config: OrchestratorConfig;
  provider: AgentRuntimeProvider;
  defaultModel?: string;
  defaultTimeoutMs: number;
  /** Extra attempts when the model returns unparseable JSON (a fresh call usually fixes it). Default 1. */
  parseRetries?: number;
}): StageLlmCaller {
  const parseRetries = input.parseRetries ?? 1;

  const callOnce = async (request: StageLlmRequest, startedAt: number): Promise<StageLlmResponse> => {
    const settings = resolveProviderSkillSettings(input.config, input.provider);
    const command = resolveStageCommandTemplate(input.provider, settings.command);
    if (!command) throw new Error(`no stage-call command template for provider ${input.provider}`);

    const dir = await mkdtemp(path.join(tmpdir(), "pulse-stage-llm-"));
    try {
      const promptPath = path.join(dir, "prompt.txt");
      const outputPath = path.join(dir, "output.txt");
      await writeFile(promptPath, request.prompt, "utf8");
      const shellCommand = interpolateCommand(command, {
        repo_root: input.config.repoRoot,
        prompt_file: promptPath,
        output_file: outputPath,
        model: request.model || input.defaultModel || settings.model || "",
        skill_root: settings.skillRootDir ?? ""
      });
      const stdout = await runShell(shellCommand, input.config.repoRoot, request.timeoutMs ?? input.defaultTimeoutMs);
      let raw = "";
      try {
        raw = await readFile(outputPath, "utf8");
      } catch {
        raw = stdout;
      }
      if (!raw.trim()) raw = stdout;
      return { raw, json: extractJsonValue(raw), elapsedMs: Date.now() - startedAt };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };

  return async (request) => {
    const startedAt = Date.now();
    const context = `stage LLM [${request.label}] (model ${request.model || input.defaultModel || "default"})`;
    let lastError: unknown;
    for (let attempt = 0; attempt <= parseRetries; attempt += 1) {
      try {
        return await callOnce(request, startedAt);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        // Only an unparseable-output failure is worth a fresh attempt; timeouts and spawn
        // failures would just repeat (and double the spend) — surface those immediately.
        const isParseFailure = message.includes("no parseable JSON") || message.includes("returned empty output");
        if (!isParseFailure || attempt === parseRetries) {
          throw new Error(`${context} failed after ${attempt + 1} attempt(s): ${message}`);
        }
      }
    }
    // Unreachable: the loop always returns or throws. Kept for exhaustiveness.
    throw new Error(`${context} failed: ${String(lastError)}`);
  };
}
