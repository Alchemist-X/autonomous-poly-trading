import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OverviewResponse, PublicPosition, RunMode } from "@autopoly/contracts";
import type { AgentRuntimeProvider, OrchestratorConfig } from "../config.js";
import type { PulseSnapshot } from "../pulse/market-pulse.js";

export type TrialRecommendCheckpointStage = "pulse_ready" | "provider_output_captured" | "completed";

export interface TrialRecommendCheckpoint {
  version: 1;
  runId: string;
  stage: TrialRecommendCheckpointStage;
  savedAtUtc: string;
  mode: RunMode;
  provider: AgentRuntimeProvider;
  executionMode: string;
  localStateFile: string | null;
  overview: OverviewResponse;
  positions: PublicPosition[];
  pulse: PulseSnapshot;
  providerTempDir: string | null;
  providerOutputPath: string | null;
  providerPromptPath: string | null;
  providerSchemaPath: string | null;
}

function checkpointRoot(config: OrchestratorConfig): string {
  return path.join(config.artifactStorageRoot, "checkpoints", "trial-recommend");
}

function checkpointPath(config: OrchestratorConfig, runId: string): string {
  return path.join(checkpointRoot(config), `${runId}.json`);
}

function latestCheckpointPath(config: OrchestratorConfig): string {
  return path.join(checkpointRoot(config), "latest.json");
}

export async function saveTrialRecommendCheckpoint(
  config: OrchestratorConfig,
  checkpoint: Omit<TrialRecommendCheckpoint, "version" | "savedAtUtc">
): Promise<string> {
  const root = checkpointRoot(config);
  await mkdir(root, { recursive: true });
  const next: TrialRecommendCheckpoint = {
    version: 1,
    savedAtUtc: new Date().toISOString(),
    ...checkpoint
  };
  const serialized = JSON.stringify(next, null, 2);
  const absolutePath = checkpointPath(config, checkpoint.runId);
  await writeFile(absolutePath, serialized, "utf8");
  await writeFile(latestCheckpointPath(config), serialized, "utf8");
  return absolutePath;
}

export async function loadTrialRecommendCheckpoint(input: {
  config: OrchestratorConfig;
  runId?: string;
  latest?: boolean;
}): Promise<TrialRecommendCheckpoint | null> {
  const absolutePath = input.runId
    ? checkpointPath(input.config, input.runId)
    : input.latest
      ? latestCheckpointPath(input.config)
      : null;
  if (!absolutePath) {
    return null;
  }

  try {
    return JSON.parse(await readFile(absolutePath, "utf8")) as TrialRecommendCheckpoint;
  } catch {
    return null;
  }
}

export function checkpointAbsolutePath(config: OrchestratorConfig, runId: string): string {
  return checkpointPath(config, runId);
}
