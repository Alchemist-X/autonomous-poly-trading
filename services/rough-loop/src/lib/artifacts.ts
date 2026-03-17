import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type RoughLoopRunRecord } from "@autopoly/contracts";

function formatPart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateParts(isoTimestamp: string): { year: string; month: string; day: string; stamp: string } {
  const date = new Date(isoTimestamp);
  const year = String(date.getUTCFullYear());
  const month = formatPart(date.getUTCMonth() + 1);
  const day = formatPart(date.getUTCDate());
  const stamp = [
    year,
    month,
    day
  ].join("") + "T" + [
    formatPart(date.getUTCHours()),
    formatPart(date.getUTCMinutes()),
    formatPart(date.getUTCSeconds())
  ].join("") + "Z";

  return { year, month, day, stamp };
}

export interface RoughLoopRunArtifacts {
  runDir: string;
  taskSnapshotPath: string;
  promptPath: string;
  providerOutputPath: string;
  verificationLogPath: string;
  gitDiffPath: string;
  resultPath: string;
  summaryPath: string;
}

export async function createRunArtifactsRoot(root: string, runId: string, startedAtUtc: string): Promise<RoughLoopRunArtifacts> {
  const date = formatDateParts(startedAtUtc);
  const runDir = path.join(root, date.year, date.month, date.day, `${date.stamp}-${runId}`);
  await mkdir(runDir, { recursive: true });
  return {
    runDir,
    taskSnapshotPath: path.join(runDir, "task-snapshot.md"),
    promptPath: path.join(runDir, "prompt.md"),
    providerOutputPath: path.join(runDir, "provider-output.md"),
    verificationLogPath: path.join(runDir, "verification.log"),
    gitDiffPath: path.join(runDir, "git.diff.txt"),
    resultPath: path.join(runDir, "result.json"),
    summaryPath: path.join(runDir, "summary.md")
  };
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeTextFile(filePath, JSON.stringify(value, null, 2));
}

export async function writeRunRecordArtifacts(input: {
  latestPath: string;
  heartbeatPath: string;
  record: RoughLoopRunRecord | Record<string, unknown>;
}): Promise<void> {
  await writeJsonFile(input.latestPath, input.record);
  await writeJsonFile(input.heartbeatPath, {
    updated_at_utc: new Date().toISOString(),
    ...input.record
  });
}
