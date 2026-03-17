import { readFile } from "node:fs/promises";

export interface TextMetrics {
  bytes: number;
  chars: number;
  lines: number;
  approxTokens: number;
}

export function measureText(content: string): TextMetrics {
  return {
    bytes: Buffer.byteLength(content, "utf8"),
    chars: content.length,
    lines: content.length === 0 ? 0 : content.split("\n").length,
    approxTokens: Math.max(1, Math.round(content.length / 4))
  };
}

export function combineTextMetrics(metrics: TextMetrics[]): TextMetrics {
  return metrics.reduce<TextMetrics>((total, current) => ({
    bytes: total.bytes + current.bytes,
    chars: total.chars + current.chars,
    lines: total.lines + current.lines,
    approxTokens: total.approxTokens + current.approxTokens
  }), {
    bytes: 0,
    chars: 0,
    lines: 0,
    approxTokens: 0
  });
}

export async function readTextMetrics(filePath: string): Promise<TextMetrics> {
  const content = await readFile(filePath, "utf8");
  return measureText(content);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTextMetrics(metrics: TextMetrics): string {
  return `${formatBytes(metrics.bytes)} / ${metrics.chars.toLocaleString("en-US")} chars / ~${metrics.approxTokens.toLocaleString("en-US")} tok`;
}
