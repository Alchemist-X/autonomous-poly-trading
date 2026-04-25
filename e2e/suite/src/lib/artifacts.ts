import path from "node:path";
import type { ScenarioArtifact, ScenarioResult } from "../types.js";
import { ensureDir, writeJsonFile } from "./fs.js";

export function createArtifact(kind: ScenarioArtifact["kind"], label: string, filePath: string): ScenarioArtifact {
  return {
    kind,
    label,
    path: filePath
  };
}

export async function createScenarioArtifactDir(rootDir: string, scenarioId: string) {
  const dirPath = path.join(rootDir, scenarioId);
  await ensureDir(dirPath);
  return dirPath;
}

export async function writeScenarioReport(rootDir: string, name: string, results: ScenarioResult[]) {
  const filePath = path.join(rootDir, `${name}.json`);
  await writeJsonFile(filePath, {
    generated_at_utc: new Date().toISOString(),
    name,
    results
  });
  return filePath;
}
