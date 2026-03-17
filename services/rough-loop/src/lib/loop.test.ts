import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import type { RoughLoopConfig } from "../config.js";
import { runLoopOnce } from "./loop.js";
import { serializeRoughLoopDocument, type RoughLoopDocument } from "./markdown.js";

const execFile = promisify(execFileCallback);
const fakeProviderPath = path.resolve("services/rough-loop/test-fixtures/fake-provider.mjs");

async function initTempRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "rough-loop-"));
  await execFile("git", ["init"], { cwd: repoRoot });
  await execFile("git", ["config", "user.name", "Rough Loop Test"], { cwd: repoRoot });
  await execFile("git", ["config", "user.email", "rough-loop@test.local"], { cwd: repoRoot });
  await writeFile(path.join(repoRoot, ".gitignore"), "runtime-artifacts/\n.rough-loop.lock\n.rough-loop.pause\n", "utf8");
  await execFile("git", ["add", ".gitignore"], { cwd: repoRoot });
  await execFile("git", ["commit", "-m", "init"], { cwd: repoRoot });
  return repoRoot;
}

async function writeLoopDoc(repoRoot: string, document: RoughLoopDocument) {
  await writeFile(path.join(repoRoot, "rough-loop.md"), serializeRoughLoopDocument(document, "zh"), "utf8");
}

function createConfig(repoRoot: string, overrides: Partial<RoughLoopConfig> = {}): RoughLoopConfig {
  return {
    repoRoot,
    envFilePath: null,
    provider: "codex",
    loopFile: "rough-loop.md",
    loopFilePath: path.join(repoRoot, "rough-loop.md"),
    loopFileEnglishPath: path.join(repoRoot, "rough-loop.en.md"),
    artifactRoot: path.join(repoRoot, "runtime-artifacts", "rough-loop"),
    runsRoot: path.join(repoRoot, "runtime-artifacts", "rough-loop", "runs"),
    latestPath: path.join(repoRoot, "runtime-artifacts", "rough-loop", "latest.json"),
    heartbeatPath: path.join(repoRoot, "runtime-artifacts", "rough-loop", "heartbeat.json"),
    pollSeconds: 1,
    maxRetries: 3,
    taskTimeoutMinutes: 1,
    requireCleanTree: true,
    relaxGuardrails: false,
    autoCommit: true,
    autoPush: false,
    pauseFilePath: path.join(repoRoot, ".rough-loop.pause"),
    lockFilePath: path.join(repoRoot, ".rough-loop.lock"),
    shell: process.env.SHELL || "zsh",
    defaultVerificationCommands: ["pnpm typecheck", "pnpm test", "pnpm build"],
    systemManagedPaths: ["rough-loop.md", "rough-loop.en.md", "runtime-artifacts", ".rough-loop.lock", ".rough-loop.pause"],
    codex: {
      command: `node ${fakeProviderPath}`,
      model: ""
    },
    openclaw: {
      command: `node ${fakeProviderPath}`,
      model: ""
    },
    ...overrides
  };
}

describe("runLoopOnce", () => {
  it("blocks tasks that miss verification commands", async () => {
    const repoRoot = await initTempRepo();
    try {
      await writeLoopDoc(repoRoot, {
        locale: "zh",
        rules: ["规则"],
        queue: [
          {
            id: "RL-100",
            title: "缺少验证命令",
            status: "todo",
            priority: "P1",
            dependsOn: [],
            allowedPaths: ["docs"],
            definitionOfDone: ["补齐文档"],
            verification: [],
            context: ["测试 invalid task"],
            latestResult: ["尚未开始"],
            attempts: 0,
            section: "queue",
            createdOrder: 0
          }
        ],
        running: [],
        blocked: [],
        done: []
      });

      const outcome = await runLoopOnce(createConfig(repoRoot));
      const content = await readFile(path.join(repoRoot, "rough-loop.md"), "utf8");

      expect(outcome.kind).toBe("idle");
      expect(content).toContain("## Blocked（阻塞）");
      expect(content).toContain("任务缺少验证命令");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("completes a valid task, writes artifacts, and auto-commits the result", async () => {
    const repoRoot = await initTempRepo();
    try {
      await mkdir(path.join(repoRoot, "docs"), { recursive: true });
      await writeLoopDoc(repoRoot, {
        locale: "zh",
        rules: ["规则"],
        queue: [
          {
            id: "RL-101",
            title: "写入 notes.md",
            status: "todo",
            priority: "P0",
            dependsOn: [],
            allowedPaths: ["docs"],
            definitionOfDone: ["生成 docs/notes.md"],
            verification: ['node -e "process.exit(0)"'],
            context: ["测试成功路径"],
            latestResult: ["尚未开始"],
            attempts: 0,
            section: "queue",
            createdOrder: 0
          }
        ],
        running: [],
        blocked: [],
        done: []
      });

      process.env.FAKE_ROUGH_LOOP_MODE = "success";
      process.env.FAKE_ROUGH_LOOP_TARGET = "docs/notes.md";
      process.env.FAKE_ROUGH_LOOP_CONTENT = "# done\n";

      const outcome = await runLoopOnce(createConfig(repoRoot));
      const loopContent = await readFile(path.join(repoRoot, "rough-loop.md"), "utf8");
      const noteContent = await readFile(path.join(repoRoot, "docs", "notes.md"), "utf8");
      const latestRecord = JSON.parse(await readFile(path.join(repoRoot, "runtime-artifacts", "rough-loop", "latest.json"), "utf8"));
      const { stdout: statusStdout } = await execFile("git", ["status", "--short"], { cwd: repoRoot });

      expect(outcome.kind).toBe("done");
      expect(loopContent).toContain("## Done（已完成）");
      expect(loopContent).toContain("All verification commands passed.");
      expect(noteContent).toContain("# done");
      expect(latestRecord.status).toBe("done");
      expect(statusStdout.trim()).toBe("");
    } finally {
      delete process.env.FAKE_ROUGH_LOOP_MODE;
      delete process.env.FAKE_ROUGH_LOOP_TARGET;
      delete process.env.FAKE_ROUGH_LOOP_CONTENT;
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("retries verification failures and blocks the task after hitting the retry limit", async () => {
    const repoRoot = await initTempRepo();
    try {
      await mkdir(path.join(repoRoot, "docs"), { recursive: true });
      await writeLoopDoc(repoRoot, {
        locale: "zh",
        rules: ["规则"],
        queue: [
          {
            id: "RL-102",
            title: "验证失败后重试",
            status: "todo",
            priority: "P1",
            dependsOn: [],
            allowedPaths: ["docs"],
            definitionOfDone: ["生成 docs/retry.md"],
            verification: ['node -e "process.exit(1)"'],
            context: ["测试 retry -> blocked"],
            latestResult: ["尚未开始"],
            attempts: 0,
            section: "queue",
            createdOrder: 0
          }
        ],
        running: [],
        blocked: [],
        done: []
      });

      process.env.FAKE_ROUGH_LOOP_MODE = "append";
      process.env.FAKE_ROUGH_LOOP_TARGET = "docs/retry.md";
      process.env.FAKE_ROUGH_LOOP_CONTENT = "retry\n";

      const outcome = await runLoopOnce(createConfig(repoRoot, { maxRetries: 2, autoCommit: false }));
      const loopContent = await readFile(path.join(repoRoot, "rough-loop.md"), "utf8");

      expect(outcome.kind).toBe("blocked");
      expect(loopContent).toContain("## Blocked（阻塞）");
      expect(loopContent).toContain("验证连续失败已达到上限 2 次");
      expect(loopContent).toContain("#### Attempts（尝试次数）\n2");
    } finally {
      delete process.env.FAKE_ROUGH_LOOP_MODE;
      delete process.env.FAKE_ROUGH_LOOP_TARGET;
      delete process.env.FAKE_ROUGH_LOOP_CONTENT;
      await rm(repoRoot, { recursive: true, force: true });
    }
  }, 15_000);

  it("refuses to start when non-system files are already dirty", async () => {
    const repoRoot = await initTempRepo();
    try {
      await writeLoopDoc(repoRoot, {
        locale: "zh",
        rules: ["规则"],
        queue: [],
        running: [],
        blocked: [],
        done: []
      });
      await writeFile(path.join(repoRoot, "scratch.txt"), "dirty\n", "utf8");

      await expect(runLoopOnce(createConfig(repoRoot))).rejects.toThrow("Rough Loop requires a clean tree");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("allows dirty tree and missing path guards in relaxed mode", async () => {
    const repoRoot = await initTempRepo();
    try {
      await mkdir(path.join(repoRoot, "docs"), { recursive: true });
      await writeLoopDoc(repoRoot, {
        locale: "zh",
        rules: ["规则"],
        queue: [
          {
            id: "RL-103",
            title: "放宽护栏模式",
            status: "todo",
            priority: "P1",
            dependsOn: [],
            allowedPaths: [],
            definitionOfDone: ["生成 docs/relaxed.md"],
            verification: ['node -e "process.exit(0)"'],
            context: ["测试 relaxed guardrails"],
            latestResult: ["尚未开始"],
            attempts: 0,
            section: "queue",
            createdOrder: 0
          }
        ],
        running: [],
        blocked: [],
        done: []
      });
      await writeFile(path.join(repoRoot, "scratch.txt"), "dirty\n", "utf8");

      process.env.FAKE_ROUGH_LOOP_MODE = "success";
      process.env.FAKE_ROUGH_LOOP_TARGET = "docs/relaxed.md";
      process.env.FAKE_ROUGH_LOOP_CONTENT = "# relaxed\n";

      const outcome = await runLoopOnce(createConfig(repoRoot, {
        relaxGuardrails: true,
        requireCleanTree: false,
        autoCommit: false
      }));
      const relaxedContent = await readFile(path.join(repoRoot, "docs", "relaxed.md"), "utf8");

      expect(outcome.kind).toBe("done");
      expect(relaxedContent).toContain("# relaxed");
    } finally {
      delete process.env.FAKE_ROUGH_LOOP_MODE;
      delete process.env.FAKE_ROUGH_LOOP_TARGET;
      delete process.env.FAKE_ROUGH_LOOP_CONTENT;
      await rm(repoRoot, { recursive: true, force: true });
    }
  }, 15_000);

  it("commits only task-touched files when auto-commit is enabled in relaxed mode", async () => {
    const repoRoot = await initTempRepo();
    try {
      await mkdir(path.join(repoRoot, "docs"), { recursive: true });
      await writeLoopDoc(repoRoot, {
        locale: "zh",
        rules: ["规则"],
        queue: [
          {
            id: "RL-104",
            title: "只提交任务触碰文件",
            status: "todo",
            priority: "P0",
            dependsOn: [],
            allowedPaths: [],
            definitionOfDone: ["生成 docs/commit-scope.md"],
            verification: ['node -e "process.exit(0)"'],
            context: ["测试 auto-commit 只提交任务触碰文件"],
            latestResult: ["尚未开始"],
            attempts: 0,
            section: "queue",
            createdOrder: 0
          }
        ],
        running: [],
        blocked: [],
        done: []
      });
      await writeFile(path.join(repoRoot, "scratch.txt"), "leave-me-dirty\n", "utf8");

      process.env.FAKE_ROUGH_LOOP_MODE = "success";
      process.env.FAKE_ROUGH_LOOP_TARGET = "docs/commit-scope.md";
      process.env.FAKE_ROUGH_LOOP_CONTENT = "# commit scope\n";

      const outcome = await runLoopOnce(createConfig(repoRoot, {
        relaxGuardrails: true,
        requireCleanTree: false,
        autoCommit: true
      }));
      const { stdout: statusStdout } = await execFile("git", ["status", "--short"], { cwd: repoRoot });
      const { stdout: showStdout } = await execFile("git", ["show", "--stat", "--oneline", "-1"], { cwd: repoRoot });

      expect(outcome.kind).toBe("done");
      expect(statusStdout).toContain("?? scratch.txt");
      expect(showStdout).toContain("docs/commit-scope.md");
      expect(showStdout).not.toContain("scratch.txt");
    } finally {
      delete process.env.FAKE_ROUGH_LOOP_MODE;
      delete process.env.FAKE_ROUGH_LOOP_TARGET;
      delete process.env.FAKE_ROUGH_LOOP_CONTENT;
      await rm(repoRoot, { recursive: true, force: true });
    }
  }, 15_000);
});
