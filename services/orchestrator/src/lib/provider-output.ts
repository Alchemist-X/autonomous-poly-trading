// Shared helpers for handling external provider-CLI output and run timing.
// Extracted verbatim from provider-runtime.ts and full-pulse.ts, which held
// byte-identical copies (Stage 2 dedup, 2026-07-03).
import { existsSync, statSync } from "node:fs";

/** Strip a single wrapping ``` code fence from a provider's stdout, if present. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const lines = trimmed.split("\n");
  if (lines.length < 3) {
    return trimmed;
  }

  return lines.slice(1, -1).join("\n").trim();
}

export function readOutputSizeBytes(outputPath: string | undefined): number {
  if (!outputPath || !existsSync(outputPath)) {
    return 0;
  }
  try {
    return statSync(outputPath).size;
  } catch {
    return 0;
  }
}

export function formatRemainingTimeoutMs(startedAt: number, timeoutMs: number | null): string {
  if (timeoutMs == null) {
    return "disabled";
  }
  const remainingMs = Math.max(0, timeoutMs - (Date.now() - startedAt));
  return `${Math.ceil(remainingMs / 1000)}s`;
}
