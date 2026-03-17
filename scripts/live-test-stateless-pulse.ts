import path from "node:path";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { AgentRuntimeProvider } from "../services/orchestrator/src/config.ts";
import type { PulseCandidate, PulseSnapshot } from "../services/orchestrator/src/pulse/market-pulse.ts";

interface StoredPulseSnapshot {
  generated_at_utc: string;
  provider: AgentRuntimeProvider;
  locale: "en" | "zh";
  title: string;
  total_fetched: number;
  total_filtered: number;
  selected_candidates: number;
  min_liquidity_usd: number;
  risk_flags: string[];
  candidates: PulseCandidate[];
}

function toAbsolutePath(root: string, value: string) {
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

export async function loadPulseSnapshotFromArtifacts(input: {
  artifactStorageRoot: string;
  pulseJsonPath: string;
  pulseMarkdownPath?: string | null;
}): Promise<PulseSnapshot> {
  const absoluteJsonPath = toAbsolutePath(process.cwd(), input.pulseJsonPath);
  const absoluteMarkdownPath = toAbsolutePath(
    process.cwd(),
    input.pulseMarkdownPath ?? absoluteJsonPath.replace(/\.json$/i, ".md")
  );
  const [jsonContent, markdown] = await Promise.all([
    readFile(absoluteJsonPath, "utf8"),
    readFile(absoluteMarkdownPath, "utf8")
  ]);
  const parsed = JSON.parse(jsonContent) as StoredPulseSnapshot;
  return {
    id: randomUUID(),
    generatedAtUtc: parsed.generated_at_utc,
    title: parsed.title,
    relativeMarkdownPath: path.relative(input.artifactStorageRoot, absoluteMarkdownPath),
    absoluteMarkdownPath,
    relativeJsonPath: path.relative(input.artifactStorageRoot, absoluteJsonPath),
    absoluteJsonPath,
    markdown,
    totalFetched: parsed.total_fetched,
    totalFiltered: parsed.total_filtered,
    selectedCandidates: parsed.selected_candidates,
    minLiquidityUsd: parsed.min_liquidity_usd,
    candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
    riskFlags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : [],
    tradeable: Array.isArray(parsed.risk_flags) ? parsed.risk_flags.length === 0 : true
  };
}
