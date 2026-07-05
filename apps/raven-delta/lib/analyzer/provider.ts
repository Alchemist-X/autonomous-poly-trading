// LLM engine providers. Modeled on packages/forecast-engine's adapters:
// - deepseek: OpenAI-compatible chat completion, json_object mode, with a
//   timeout that covers the BODY read (a drip-fed body must not stall a run).
// - claude-cli: headless `claude --print` spawn; auth resolves from whatever
//   the CLI can find (ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN / login).
// The zod repair loop lives here: one retry with the validation errors fed
// back; callers degrade to the rules engine when both attempts fail.

import { spawn } from "node:child_process";
import { deltaAnalysisSchema, type DeltaAnalysis, type EngineId } from "./schema";
import { buildRepairPrompt } from "./prompt";
import { findStock } from "./universe";

const DEFAULT_TIMEOUT_MS = 180_000;

export interface EngineResolution {
  engine: EngineId;
  reason: string;
}

export function resolveEngine(): EngineResolution {
  const forced = process.env.DELTA_PROVIDER?.trim().toLowerCase();
  if (forced === "deepseek" || forced === "rules") {
    return { engine: forced, reason: `DELTA_PROVIDER=${forced}` };
  }
  if (forced === "claude" || forced === "claude-cli") {
    return { engine: "claude-cli", reason: "DELTA_PROVIDER=claude" };
  }
  if (process.env.DEEPSEEK_API_KEY?.trim()) {
    return { engine: "deepseek", reason: "DEEPSEEK_API_KEY present" };
  }
  if (process.env.DELTA_CLAUDE_CLI?.trim() === "1") {
    return { engine: "claude-cli", reason: "DELTA_CLAUDE_CLI=1" };
  }
  return { engine: "rules", reason: "no LLM provider configured" };
}

function engineTimeoutMs(): number {
  const parsed = Number(process.env.DELTA_AGENT_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

// Balanced-scan JSON extraction: models occasionally wrap the object in prose
// or fences despite instructions. Whole-parse first, then outermost braces.
export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to substring scan
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function runDeepSeekPrompt(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is required for the deepseek engine.");
  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DELTA_DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  const timeoutMs = engineTimeoutMs();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        // json_object mode requires the word "json" in the prompt; the analysis
        // prompt always demands a JSON object, so this is safe to set.
        response_format: { type: "json_object" },
        max_tokens: 6000
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`deepseek API error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`deepseek request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function runClaudeCliPrompt(prompt: string): Promise<string> {
  const timeoutMs = engineTimeoutMs();
  const allowedTools = process.env.DELTA_ALLOWED_TOOLS ?? "WebSearch";
  const model = process.env.DELTA_CLAUDE_MODEL?.trim() || "";
  const args = ["--print", "--output-format", "json", "--allowedTools", allowedTools];
  if (model) args.push("--model", model);

  return await new Promise<string>((resolve, reject) => {
    const child = spawn("claude", args, { env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`claude CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude CLI exited ${code}: ${stderr.slice(-300)}`));
        return;
      }
      try {
        const envelope = JSON.parse(stdout) as { result?: string };
        resolve(envelope.result ?? "");
      } catch {
        // Older CLI versions may print the text directly.
        resolve(stdout);
      }
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function summarizeZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
    return issues
      .slice(0, 12)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
  }
  return String(error);
}

// Light normalization BEFORE zod: trims oversized arrays and coerces the
// mistakes models actually make, so the repair round is reserved for real
// contract violations.
function normalizeCandidate(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  const stocks = Array.isArray(record.impactedStocks) ? record.impactedStocks.slice(0, 5) : record.impactedStocks;
  return { ...record, impactedStocks: stocks };
}

// Server-side truth for inUniverse and duplicate tickers — never trust the
// model for facts the harness can compute.
function enforceUniverseFacts(analysis: DeltaAnalysis): DeltaAnalysis {
  const seen = new Set<string>();
  const stocks = analysis.impactedStocks.flatMap((stock) => {
    if (seen.has(stock.ticker)) return [];
    seen.add(stock.ticker);
    const known = findStock(stock.ticker);
    return [
      {
        ...stock,
        inUniverse: known !== null,
        company: known ? known.company : stock.company
      }
    ];
  });
  return { ...analysis, impactedStocks: stocks };
}

export async function runLlmAnalysis(engine: EngineId, prompt: string): Promise<DeltaAnalysis> {
  const runPrompt = engine === "deepseek" ? runDeepSeekPrompt : runClaudeCliPrompt;
  if (engine === "rules") throw new Error("runLlmAnalysis cannot run the rules engine.");

  const firstRaw = await runPrompt(prompt);
  const firstCandidate = normalizeCandidate(extractJsonObject(firstRaw));
  const firstParse = deltaAnalysisSchema.safeParse(firstCandidate);
  if (firstParse.success) return enforceUniverseFacts(firstParse.data);

  const repairRaw = await runPrompt(buildRepairPrompt(firstRaw, summarizeZodError(firstParse.error)));
  const repairCandidate = normalizeCandidate(extractJsonObject(repairRaw));
  const repairParse = deltaAnalysisSchema.safeParse(repairCandidate);
  if (repairParse.success) return enforceUniverseFacts(repairParse.data);

  throw new Error(`engine output failed schema validation twice: ${summarizeZodError(repairParse.error).slice(0, 400)}`);
}
