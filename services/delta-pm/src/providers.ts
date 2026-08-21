// LLM provider seam (raven-delta pattern): deepseek JSON-mode → claude-cli
// headless → rules fallback. LLM failures NEVER fail the pipeline silently —
// callers receive { engine, fallbackReason } and every degradation is
// user-visible in the run record. One zod-repair retry: validation errors are
// fed back to the model verbatim.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { z } from "zod";
import { config } from "./config.js";

const execFileAsync = promisify(execFile);

export interface ProviderResult<T> {
  value: T | null;
  engine: "deepseek" | "claude-cli" | "rules";
  fallbackReason: string | null;
  raw?: string;
}

function extractJson(text: string): string | null {
  // Models wrap JSON in prose/code fences; take the outermost object.
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

async function callDeepseek(system: string, user: string): Promise<string> {
  const res = await fetch(`${config.deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.deepseekApiKey}` },
    body: JSON.stringify({
      model: config.deepseekModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    }),
    signal: AbortSignal.timeout(config.analysisTimeoutMs)
  });
  if (!res.ok) throw new Error(`deepseek → ${res.status}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("deepseek → empty content");
  return content;
}

async function callClaudeCli(system: string, user: string): Promise<string> {
  // Prompt as positional arg (fits well under ARG_MAX for our payloads).
  const { stdout } = await execFileAsync(config.claudeCliPath, ["--print", "--append-system-prompt", system, user], {
    timeout: config.analysisTimeoutMs,
    maxBuffer: 4 * 1024 * 1024
  });
  return stdout;
}

export function resolveEngineOrder(): Array<"deepseek" | "claude-cli"> {
  if (config.provider === "deepseek") return ["deepseek"];
  if (config.provider === "claude") return ["claude-cli"];
  if (config.provider === "rules") return [];
  // auto: prefer deepseek when a key exists, then claude-cli.
  const order: Array<"deepseek" | "claude-cli"> = [];
  if (config.deepseekApiKey) order.push("deepseek");
  order.push("claude-cli");
  return order;
}

// Call an LLM and validate against `schema`, with one repair retry per
// engine. `rulesFallback` must always produce a valid value — the pipeline
// never dies because a model is down (it degrades visibly instead).
export async function callJson<S extends z.ZodTypeAny>(
  system: string,
  user: string,
  schema: S,
  rulesFallback: () => z.infer<S>
): Promise<ProviderResult<z.infer<S>>> {
  const reasons: string[] = [];
  for (const engine of resolveEngineOrder()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const call = engine === "deepseek" ? callDeepseek : callClaudeCli;
        const prompt =
          attempt === 0
            ? user
            : `${user}\n\nYour previous output failed schema validation:\n${reasons.at(-1)}\nReturn corrected JSON only.`;
        const raw = await call(system, prompt);
        const jsonText = extractJson(raw);
        if (!jsonText) throw new Error("no JSON object in output");
        const parsed = schema.safeParse(JSON.parse(jsonText));
        if (parsed.success) {
          return { value: parsed.data, engine: engine === "deepseek" ? "deepseek" : "claude-cli", fallbackReason: reasons.length ? reasons.join("; ") : null, raw };
        }
        reasons.push(`${engine} attempt ${attempt + 1}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ").slice(0, 500)}`);
      } catch (error) {
        reasons.push(`${engine} attempt ${attempt + 1}: ${error instanceof Error ? error.message : String(error)}`);
        break; // transport error → next engine, not another repair round
      }
    }
  }
  return { value: rulesFallback(), engine: "rules", fallbackReason: reasons.length ? reasons.join("; ") : "no LLM engine configured" };
}
