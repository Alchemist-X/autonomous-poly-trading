import { createHash, randomUUID } from "node:crypto";
import { access, open, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import {
  roughLoopRunRecordSchema,
  roughLoopSelectionResultSchema,
  type RoughLoopDocumentSection,
  type RoughLoopRunRecord,
  type RoughLoopSelectionResult,
  type RoughLoopTask
} from "@autopoly/contracts";
import type { RoughLoopConfig } from "../config.js";
import { createRunArtifactsRoot, writeJsonFile, writeRunRecordArtifacts, writeTextFile } from "./artifacts.js";
import { buildTaskPrompt } from "./prompt.js";
import { createInitialRoughLoopDocument, parseRoughLoopMarkdown, serializeRoughLoopDocument, type RoughLoopDocument } from "./markdown.js";
import { commitFiles, detectSensitivePath, isAllowedPath, pushCurrentBranch, readGitDiff, readGitStatus } from "./git.js";
import { runProvider } from "./provider.js";
import { runVerification } from "./verification.js";

export interface LoopRunOutcome {
  kind: "done" | "blocked" | "retry" | "idle" | "paused";
  record: RoughLoopRunRecord | null;
}

interface AttemptExecutionResult {
  state: "done" | "blocked" | "retry";
  summary: string;
  changedFiles: string[];
  taskChangedFiles: string[];
  verificationLog: string;
  verificationPassed: boolean;
  artifactsDir: string;
  verification: RoughLoopRunRecord["verification"];
}

function priorityRank(priority: RoughLoopTask["priority"]): number {
  switch (priority) {
    case "P0":
      return 0;
    case "P1":
      return 1;
    case "P2":
      return 2;
    default:
      return 99;
  }
}

function flattenTasks(document: RoughLoopDocument): RoughLoopTask[] {
  return [...document.queue, ...document.running, ...document.blocked, ...document.done];
}

function userDirtyFiles(files: string[], systemManagedPaths: string[]): string[] {
  return files.filter((file) => !systemManagedPaths.some((managed) => file === managed || file.startsWith(`${managed}/`)));
}

function cloneTask(task: RoughLoopTask, patch: Partial<RoughLoopTask>): RoughLoopTask {
  return {
    ...task,
    ...patch
  };
}

function upsertTask(document: RoughLoopDocument, task: RoughLoopTask, targetSection: Exclude<RoughLoopDocumentSection, "rules">): RoughLoopDocument {
  const next: RoughLoopDocument = {
    locale: document.locale,
    rules: [...document.rules],
    queue: [],
    running: [],
    blocked: [],
    done: []
  };

  for (const existing of flattenTasks(document)) {
    if (existing.id === task.id) {
      continue;
    }
    next[existing.section as Exclude<RoughLoopDocumentSection, "rules">].push(existing);
  }

  next[targetSection].push({
    ...task,
    section: targetSection
  });

  return next;
}

function setLatestResult(task: RoughLoopTask, summary: string): RoughLoopTask {
  return cloneTask(task, {
    latestResult: [summary]
  });
}

function dependencySet(document: RoughLoopDocument): Set<string> {
  return new Set(document.done.filter((task) => task.status === "done").map((task) => task.id));
}

function resolveVerificationCommands(task: RoughLoopTask, defaults: string[]): string[] {
  if (task.verification.length === 0) {
    return defaults;
  }
  if (task.verification.length === 1 && task.verification[0]?.trim().toLowerCase() === "default") {
    return defaults;
  }
  return task.verification;
}

function validateTaskForExecution(task: RoughLoopTask, relaxGuardrails: boolean): string | null {
  if (task.definitionOfDone.length === 0) {
    return "任务缺少完成定义，已转入 blocked。";
  }
  if (!relaxGuardrails && task.verification.length === 0) {
    return "任务缺少验证命令，已转入 blocked。";
  }
  if (!relaxGuardrails && task.allowedPaths.length === 0) {
    return "任务缺少允许改动路径，已转入 blocked。";
  }
  if (!relaxGuardrails && task.allowedPaths.some(detectSensitivePath)) {
    return "任务允许改动的路径涉及 secrets 或生产环境，已转入 blocked。";
  }
  return null;
}

function selectNextTask(document: RoughLoopDocument): RoughLoopSelectionResult {
  const doneIds = dependencySet(document);
  const sorted = [...document.queue]
    .filter((task) => task.status === "todo")
    .sort((left, right) => {
      const priorityDiff = priorityRank(left.priority) - priorityRank(right.priority);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return left.createdOrder - right.createdOrder;
    });

  for (const task of sorted) {
    const dependenciesReady = task.dependsOn.every((dependency: string) => doneIds.has(dependency));
    if (!dependenciesReady) {
      continue;
    }

    return roughLoopSelectionResultSchema.parse({
      selectedTaskId: task.id,
      reason: `Selected ${task.id}.`,
      blockedTaskIds: []
    });
  }

  return roughLoopSelectionResultSchema.parse({
    selectedTaskId: null,
    reason: sorted.length === 0 ? "No todo tasks are available." : "All todo tasks are waiting for dependencies.",
    blockedTaskIds: []
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureLoopDocuments(config: RoughLoopConfig): Promise<RoughLoopDocument> {
  const hasChinese = await fileExists(config.loopFilePath);
  if (!hasChinese) {
    const initial = createInitialRoughLoopDocument("zh");
    await writeFile(config.loopFilePath, serializeRoughLoopDocument(initial, "zh"), "utf8");
    await writeFile(config.loopFileEnglishPath, serializeRoughLoopDocument(initial, "en"), "utf8");
    return initial;
  }

  const chinese = parseRoughLoopMarkdown(await readFile(config.loopFilePath, "utf8"), "zh");
  await writeFile(config.loopFileEnglishPath, serializeRoughLoopDocument(chinese, "en"), "utf8");
  return chinese;
}

async function saveLoopDocuments(config: RoughLoopConfig, document: RoughLoopDocument): Promise<void> {
  await writeFile(config.loopFilePath, serializeRoughLoopDocument(document, "zh"), "utf8");
  await writeFile(config.loopFileEnglishPath, serializeRoughLoopDocument(document, "en"), "utf8");
}

function renderTaskSnapshot(task: RoughLoopTask, verificationCommands: string[]): string {
  const allowedPaths = task.allowedPaths.length === 0 ? ["<entire-repository>"] : task.allowedPaths;
  return [
    `# ${task.id} | ${task.title}`,
    "",
    `- Status: ${task.status}`,
    `- Priority: ${task.priority}`,
    `- Attempts: ${task.attempts}`,
    "",
    "## Allowed Paths",
    ...allowedPaths.map((value: string) => `- ${value}`),
    "",
    "## Definition of Done",
    ...task.definitionOfDone.map((value: string) => `- ${value}`),
    "",
    "## Verification",
    ...verificationCommands.map((value: string) => `- ${value}`),
    "",
    "## Context",
    ...(task.context.length === 0 ? ["- none"] : task.context.map((value: string) => `- ${value}`))
  ].join("\n");
}

async function readFileSignature(repoRoot: string, relativePath: string): Promise<string> {
  try {
    const content = await readFile(path.join(repoRoot, relativePath));
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return "__missing__";
  }
}

async function snapshotFileSignatures(repoRoot: string, files: string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(files.map(async (file) => [file, await readFileSignature(repoRoot, file)] as const));
  return new Map(entries);
}

async function detectTaskChangedFiles(input: {
  repoRoot: string;
  baselineFiles: string[];
  baselineSignatures: Map<string, string>;
  currentFiles: string[];
}): Promise<string[]> {
  const baselineSet = new Set(input.baselineFiles);
  const touched: string[] = [];

  for (const file of input.currentFiles) {
    if (!baselineSet.has(file)) {
      touched.push(file);
      continue;
    }

    const currentSignature = await readFileSignature(input.repoRoot, file);
    if (currentSignature !== input.baselineSignatures.get(file)) {
      touched.push(file);
    }
  }

  return [...new Set(touched)].sort();
}

function formatVerificationLog(input: NonNullable<RoughLoopRunRecord["verification"]>): string {
  const lines: string[] = [];
  for (const result of input.commandResults) {
    lines.push(`$ ${result.command}`);
    lines.push(`exitCode=${result.exitCode} passed=${result.passed}`);
    if (result.stdout.trim()) {
      lines.push(result.stdout.trim());
    }
    if (result.stderr.trim()) {
      lines.push(result.stderr.trim());
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

async function executeAttempt(input: {
  config: RoughLoopConfig;
  task: RoughLoopTask;
  baselineStatus: Awaited<ReturnType<typeof readGitStatus>>;
  verificationCommands: string[];
}): Promise<AttemptExecutionResult> {
  const startedAtUtc = new Date().toISOString();
  const runId = randomUUID();
  const artifacts = await createRunArtifactsRoot(input.config.runsRoot, runId, startedAtUtc);
  const prompt = buildTaskPrompt({
    task: input.task,
    repoStatus: input.baselineStatus,
    verificationCommands: input.verificationCommands,
    relaxGuardrails: input.config.relaxGuardrails
  });

  await writeTextFile(artifacts.taskSnapshotPath, renderTaskSnapshot(input.task, input.verificationCommands));
  await writeTextFile(artifacts.promptPath, prompt);
  const baselineSignatures = await snapshotFileSignatures(input.config.repoRoot, input.baselineStatus.changedFiles);

  const providerResult = await runProvider({
    config: input.config,
    prompt
  });
  const providerOutput = [
    `exitCode=${providerResult.exitCode}`,
    `timedOut=${providerResult.timedOut}`,
    "",
    providerResult.stdout.trim(),
    providerResult.stderr.trim()
  ].filter(Boolean).join("\n");
  await writeTextFile(artifacts.providerOutputPath, providerOutput);

  const statusAfterProvider = await readGitStatus(input.config.repoRoot);
  const diffAfterProvider = await readGitDiff(input.config.repoRoot);
  await writeTextFile(artifacts.gitDiffPath, diffAfterProvider);

  const changedUserFiles = userDirtyFiles(statusAfterProvider.changedFiles, input.config.systemManagedPaths);
  const taskChangedFiles = await detectTaskChangedFiles({
    repoRoot: input.config.repoRoot,
    baselineFiles: input.baselineStatus.changedFiles,
    baselineSignatures,
    currentFiles: statusAfterProvider.changedFiles
  });
  const allowedPaths = input.task.allowedPaths.length === 0 && input.config.relaxGuardrails
    ? [input.config.repoRoot]
    : input.task.allowedPaths;
  const disallowedFile = changedUserFiles.find((file) => !isAllowedPath(file, allowedPaths, input.config.systemManagedPaths));
  if (providerResult.blocked) {
    return {
      state: "blocked",
      summary: providerResult.summary,
      changedFiles: statusAfterProvider.changedFiles,
      taskChangedFiles,
      verificationLog: "",
      verificationPassed: false,
      artifactsDir: artifacts.runDir,
      verification: null
    };
  }
  if (!input.config.relaxGuardrails && changedUserFiles.some(detectSensitivePath)) {
    return {
      state: "blocked",
      summary: "Detected sensitive path changes. Manual review is required.",
      changedFiles: statusAfterProvider.changedFiles,
      taskChangedFiles,
      verificationLog: "",
      verificationPassed: false,
      artifactsDir: artifacts.runDir,
      verification: null
    };
  }
  if (!input.config.relaxGuardrails && disallowedFile) {
    return {
      state: "blocked",
      summary: `Detected edits outside Allowed Paths: ${disallowedFile}`,
      changedFiles: statusAfterProvider.changedFiles,
      taskChangedFiles,
      verificationLog: "",
      verificationPassed: false,
      artifactsDir: artifacts.runDir,
      verification: null
    };
  }
  if (!providerResult.ok) {
    return {
      state: "retry",
      summary: providerResult.timedOut ? "Provider timed out before completing the task." : providerResult.summary,
      changedFiles: statusAfterProvider.changedFiles,
      taskChangedFiles,
      verificationLog: "",
      verificationPassed: false,
      artifactsDir: artifacts.runDir,
      verification: null
    };
  }
  if (changedUserFiles.length === 0) {
    return {
      state: "retry",
      summary: "Provider finished without modifying any non-system files.",
      changedFiles: statusAfterProvider.changedFiles,
      taskChangedFiles,
      verificationLog: "",
      verificationPassed: false,
      artifactsDir: artifacts.runDir,
      verification: null
    };
  }

  const verification = await runVerification({
    config: input.config,
    commands: input.verificationCommands
  });
  const verificationLog = formatVerificationLog(verification);
  await writeTextFile(artifacts.verificationLogPath, verificationLog);

  return {
    state: verification.passed ? "done" : "retry",
    summary: verification.summary,
    changedFiles: statusAfterProvider.changedFiles,
    taskChangedFiles,
    verificationLog,
    verificationPassed: verification.passed,
    artifactsDir: artifacts.runDir,
    verification
  };
}

async function finalizeRunRecord(input: {
  config: RoughLoopConfig;
  task: RoughLoopTask;
  state: LoopRunOutcome["kind"];
  summary: string;
  attempt: number;
  changedFiles: string[];
  artifactsDir: string;
  verification: RoughLoopRunRecord["verification"];
  startedAtUtc: string;
}): Promise<RoughLoopRunRecord> {
  const record = roughLoopRunRecordSchema.parse({
    runId: path.basename(input.artifactsDir),
    taskId: input.task.id,
    provider: input.config.provider,
    status: input.state === "paused" || input.state === "idle" ? "skipped" : input.state,
    attempt: input.attempt,
    startedAtUtc: input.startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
    summary: input.summary,
    changedFiles: input.changedFiles,
    artifactsDir: input.artifactsDir,
    verification: input.verification
  });
  await writeRunRecordArtifacts({
    latestPath: input.config.latestPath,
    heartbeatPath: input.config.heartbeatPath,
    record
  });
  return record;
}

async function stageCommitIfNeeded(config: RoughLoopConfig, message: string, candidateFiles: string[]): Promise<string[]> {
  const status = await readGitStatus(config.repoRoot);
  const changedFileSet = new Set(status.changedFiles);
  const filesToCommit = [...new Set(candidateFiles)].filter((file) => changedFileSet.has(file));
  if (config.autoCommit && filesToCommit.length > 0) {
    await commitFiles(config.repoRoot, filesToCommit, message);
    if (config.autoPush) {
      await pushCurrentBranch(config.repoRoot);
    }
  }
  return filesToCommit;
}

function findTask(document: RoughLoopDocument, taskId: string): RoughLoopTask | null {
  return flattenTasks(document).find((task) => task.id === taskId) ?? null;
}

async function writeAttemptResult(input: {
  config: RoughLoopConfig;
  artifactsDir: string;
  result: Record<string, unknown>;
  summary: string;
}): Promise<void> {
  await writeJsonFile(path.join(input.artifactsDir, "result.json"), input.result);
  await writeTextFile(path.join(input.artifactsDir, "summary.md"), `# Summary\n\n${input.summary}\n`);
}

export async function acquireLoopLock(config: RoughLoopConfig): Promise<() => Promise<void>> {
  const handle = await open(config.lockFilePath, "wx");
  await handle.writeFile(JSON.stringify({
    pid: process.pid,
    started_at_utc: new Date().toISOString()
  }, null, 2));
  await handle.close();

  return async () => {
    await rm(config.lockFilePath, { force: true });
  };
}

export async function runLoopOnce(config: RoughLoopConfig): Promise<LoopRunOutcome> {
  if (await fileExists(config.pauseFilePath)) {
    await writeRunRecordArtifacts({
      latestPath: config.latestPath,
      heartbeatPath: config.heartbeatPath,
      record: {
        state: "paused",
        updated_at_utc: new Date().toISOString()
      }
    });
    return {
      kind: "paused",
      record: null
    };
  }

  let document = await ensureLoopDocuments(config);
  const initialStatus = await readGitStatus(config.repoRoot);
  const initialUserDirtyFiles = userDirtyFiles(initialStatus.changedFiles, config.systemManagedPaths);
  if (config.requireCleanTree && initialUserDirtyFiles.length > 0) {
    throw new Error(`Rough Loop requires a clean tree before starting: ${initialUserDirtyFiles.join(", ")}`);
  }

  let documentChanged = false;
  for (const task of [...document.queue]) {
    const invalidReason = validateTaskForExecution(task, config.relaxGuardrails);
    if (!invalidReason) {
      continue;
    }
    document = upsertTask(document, setLatestResult(cloneTask(task, { status: "blocked" }), invalidReason), "blocked");
    documentChanged = true;
  }
  if (documentChanged) {
    await saveLoopDocuments(config, document);
  }

  const selection = selectNextTask(document);
  if (!selection.selectedTaskId) {
    await writeRunRecordArtifacts({
      latestPath: config.latestPath,
      heartbeatPath: config.heartbeatPath,
      record: {
        state: "idle",
        updated_at_utc: new Date().toISOString(),
        reason: selection.reason
      }
    });
    return {
      kind: "idle",
      record: null
    };
  }

  let task = findTask(document, selection.selectedTaskId);
  if (!task) {
    throw new Error(`Selected task ${selection.selectedTaskId} was not found in the document.`);
  }

  while (task.attempts < config.maxRetries) {
    task = cloneTask(task, {
      status: "running",
      attempts: task.attempts + 1
    });
    document = upsertTask(document, setLatestResult(task, `开始第 ${task.attempts} 次尝试。`), "running");
    await saveLoopDocuments(config, document);

    const startedAtUtc = new Date().toISOString();
    const verificationCommands = resolveVerificationCommands(task, config.defaultVerificationCommands);
    const baselineStatus = await readGitStatus(config.repoRoot);
    const attempt = await executeAttempt({
      config,
      task,
      baselineStatus,
      verificationCommands
    });

    if (attempt.state === "done") {
      task = setLatestResult(cloneTask(task, { status: "done" }), attempt.summary);
      document = upsertTask(document, task, "done");
      await saveLoopDocuments(config, document);
      const changedFiles = await stageCommitIfNeeded(
        config,
        `rough-loop: complete ${task.id} ${task.title}`,
        [...attempt.taskChangedFiles, "rough-loop.md", "rough-loop.en.md"]
      );
      const finalDiff = await readGitDiff(config.repoRoot);
      await writeTextFile(path.join(attempt.artifactsDir, "git.diff.txt"), finalDiff);
      await writeAttemptResult({
        config,
        artifactsDir: attempt.artifactsDir,
        result: {
          state: "done",
          taskId: task.id,
          attempt: task.attempts,
          summary: attempt.summary,
          changedFiles,
          verification: attempt.verification
        },
        summary: attempt.summary
      });
      const record = await finalizeRunRecord({
        config,
        task,
        state: "done",
        summary: attempt.summary,
        attempt: task.attempts,
        changedFiles,
        artifactsDir: attempt.artifactsDir,
        verification: attempt.verification,
        startedAtUtc
      });
      return {
        kind: "done",
        record
      };
    }

    if (attempt.state === "blocked" || task.attempts >= config.maxRetries) {
      const blockedSummary = attempt.state === "blocked"
        ? attempt.summary
        : `验证连续失败已达到上限 ${config.maxRetries} 次：${attempt.summary}`;
      task = setLatestResult(cloneTask(task, { status: "blocked" }), blockedSummary);
      document = upsertTask(document, task, "blocked");
      await saveLoopDocuments(config, document);
      await writeAttemptResult({
        config,
        artifactsDir: attempt.artifactsDir,
        result: {
          state: "blocked",
          taskId: task.id,
          attempt: task.attempts,
          summary: blockedSummary,
          changedFiles: attempt.changedFiles,
          verification: attempt.verification
        },
        summary: blockedSummary
      });
      const record = await finalizeRunRecord({
        config,
        task,
        state: "blocked",
        summary: blockedSummary,
        attempt: task.attempts,
        changedFiles: attempt.changedFiles,
        artifactsDir: attempt.artifactsDir,
        verification: attempt.verification,
        startedAtUtc
      });
      return {
        kind: "blocked",
        record
      };
    }

    task = setLatestResult(cloneTask(task, { status: "todo" }), attempt.summary);
    document = upsertTask(document, task, "queue");
    await saveLoopDocuments(config, document);
    await writeAttemptResult({
      config,
      artifactsDir: attempt.artifactsDir,
      result: {
        state: "retry",
        taskId: task.id,
        attempt: task.attempts,
        summary: attempt.summary,
        changedFiles: attempt.changedFiles,
        verification: attempt.verification
      },
      summary: attempt.summary
    });
    const record = await finalizeRunRecord({
      config,
      task,
      state: "retry",
      summary: attempt.summary,
      attempt: task.attempts,
      changedFiles: attempt.changedFiles,
      artifactsDir: attempt.artifactsDir,
      verification: attempt.verification,
      startedAtUtc
    });

    if (task.attempts >= config.maxRetries) {
      return {
        kind: "blocked",
        record
      };
    }
  }

  return {
    kind: "idle",
    record: null
  };
}
