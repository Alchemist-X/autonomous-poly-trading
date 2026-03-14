import path from "node:path";
import type { ScenarioResult } from "../types.js";
import { writeScenarioReport } from "./artifacts.js";

export async function writeRunReport(artifactDir: string, name: string, results: ScenarioResult[]) {
  const reportPath = await writeScenarioReport(path.join(artifactDir, "reports"), name, results);
  return reportPath;
}
