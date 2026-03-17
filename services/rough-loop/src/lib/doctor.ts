import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import type { RoughLoopConfig } from "../config.js";
import { createInitialRoughLoopDocument, parseRoughLoopMarkdown, serializeRoughLoopDocument } from "./markdown.js";
import { runShellCommand } from "./process.js";
import { verifyGitWritable, readGitStatus } from "./git.js";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

async function canAccess(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function runDoctor(config: RoughLoopConfig): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const providerCommand = config.provider === "openclaw" ? config.openclaw.command : config.codex.command;
  const providerCheck = await runShellCommand({
    command: `command -v ${providerCommand.split(/\s+/)[0]}`,
    cwd: config.repoRoot,
    shell: config.shell,
    timeoutMs: 15_000
  });
  checks.push({
    name: "provider-cli",
    ok: providerCheck.exitCode === 0,
    detail: providerCheck.exitCode === 0 ? `Found ${providerCommand}.` : `Missing provider command: ${providerCommand}.`
  });

  const gitWritable = await verifyGitWritable(config.repoRoot);
  checks.push({
    name: "git-writable",
    ok: gitWritable,
    detail: gitWritable ? "Git repository is writable." : "Current repo is not a writable git worktree."
  });

  const zhExists = await canAccess(config.loopFilePath);
  const enExists = await canAccess(config.loopFileEnglishPath);
  const hasLockFile = await canAccess(config.lockFilePath);
  checks.push({
    name: "rough-loop-doc",
    ok: zhExists,
    detail: zhExists ? "rough-loop.md exists." : "rough-loop.md is missing."
  });
  checks.push({
    name: "lock-file",
    ok: !hasLockFile,
    detail: hasLockFile ? "Found a leftover .rough-loop.lock file." : "No leftover lock file."
  });

  if (zhExists) {
    const zhDocument = parseRoughLoopMarkdown(await readFile(config.loopFilePath, "utf8"), "zh");
    const expectedEnglish = serializeRoughLoopDocument(zhDocument, "en");
    const actualEnglish = enExists
      ? serializeRoughLoopDocument(parseRoughLoopMarkdown(await readFile(config.loopFileEnglishPath, "utf8"), "en"), "en")
      : serializeRoughLoopDocument(createInitialRoughLoopDocument("en"), "en");
    checks.push({
      name: "english-mirror",
      ok: expectedEnglish === actualEnglish,
      detail: expectedEnglish === actualEnglish ? "English mirror is synchronized." : "rough-loop.en.md is out of sync."
    });
  }

  const status = await readGitStatus(config.repoRoot);
  checks.push({
    name: "clean-tree",
    ok: !config.requireCleanTree || status.clean,
    detail: status.clean ? "Working tree is clean." : `Working tree is dirty: ${status.changedFiles.join(", ")}`
  });

  return checks;
}
