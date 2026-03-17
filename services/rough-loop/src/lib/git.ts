import path from "node:path";
import { runBinary } from "./process.js";

export interface GitStatus {
  clean: boolean;
  changedFiles: string[];
}

export async function readGitStatus(repoRoot: string): Promise<GitStatus> {
  const [tracked, staged, untracked] = await Promise.all([
    runBinary({
      command: "git",
      args: ["diff", "--name-only", "--relative"],
      cwd: repoRoot,
      timeoutMs: 15_000
    }),
    runBinary({
      command: "git",
      args: ["diff", "--cached", "--name-only", "--relative"],
      cwd: repoRoot,
      timeoutMs: 15_000
    }),
    runBinary({
      command: "git",
      args: ["ls-files", "--others", "--exclude-standard"],
      cwd: repoRoot,
      timeoutMs: 15_000
    })
  ]);

  const changedFiles = new Set<string>();
  for (const value of [tracked.stdout, staged.stdout, untracked.stdout]) {
    for (const line of value.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
      changedFiles.add(line);
    }
  }

  return {
    clean: changedFiles.size === 0,
    changedFiles: [...changedFiles].sort()
  };
}

export async function readGitDiff(repoRoot: string): Promise<string> {
  const tracked = await runBinary({
    command: "git",
    args: ["diff", "--relative"],
    cwd: repoRoot,
    timeoutMs: 15_000
  });
  return tracked.stdout;
}

export async function verifyGitWritable(repoRoot: string): Promise<boolean> {
  const result = await runBinary({
    command: "git",
    args: ["rev-parse", "--is-inside-work-tree"],
    cwd: repoRoot,
    timeoutMs: 15_000
  });
  return result.exitCode === 0 && result.stdout.trim() === "true";
}

export async function commitFiles(repoRoot: string, files: string[], message: string): Promise<void> {
  const uniqueFiles = [...new Set(files)].sort();
  if (uniqueFiles.length === 0) {
    return;
  }

  await runBinary({
    command: "git",
    args: ["add", "--", ...uniqueFiles],
    cwd: repoRoot,
    timeoutMs: 15_000
  });

  const result = await runBinary({
    command: "git",
    args: ["commit", "-m", message],
    cwd: repoRoot,
    timeoutMs: 30_000,
    env: {
      GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || "Rough Loop",
      GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || "rough-loop@local",
      GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || "Rough Loop",
      GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || "rough-loop@local"
    }
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "git commit failed");
  }
}

export async function pushCurrentBranch(repoRoot: string): Promise<void> {
  const result = await runBinary({
    command: "git",
    args: ["push"],
    cwd: repoRoot,
    timeoutMs: 60_000
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "git push failed");
  }
}

export function isAllowedPath(filePath: string, allowedPaths: string[], systemManagedPaths: string[]): boolean {
  const normalized = filePath.split(path.sep).join("/");
  for (const systemPath of systemManagedPaths) {
    const systemNormalized = systemPath.split(path.sep).join("/");
    if (normalized === systemNormalized || normalized.startsWith(`${systemNormalized}/`)) {
      return true;
    }
  }

  for (const allowedPath of allowedPaths) {
    const normalizedAllowed = allowedPath.replace(/\\/g, "/").replace(/\/+$/, "");
    if (!normalizedAllowed) {
      continue;
    }
    if (normalized === normalizedAllowed || normalized.startsWith(`${normalizedAllowed}/`)) {
      return true;
    }
  }

  return false;
}

export function detectSensitivePath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return normalized.includes(".env")
    || normalized.includes("private")
    || normalized.includes("secret")
    || normalized.includes("id_rsa")
    || normalized.includes("production");
}
