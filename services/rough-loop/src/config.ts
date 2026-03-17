import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { roughLoopProviderSchema, type RoughLoopProvider } from "@autopoly/contracts";
import { loadEnvFile } from "./lib/env-file.js";

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readString(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  return raw === "1" || raw.toLowerCase() === "true";
}

function readEnum<T extends readonly string[]>(name: string, fallback: T[number], allowed: T): T[number] {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  return allowed.includes(raw) ? raw : fallback;
}

export interface RoughLoopProviderConfig {
  command: string;
  model: string;
}

export interface RoughLoopConfig {
  repoRoot: string;
  envFilePath: string | null;
  provider: RoughLoopProvider;
  loopFile: string;
  loopFilePath: string;
  loopFileEnglishPath: string;
  artifactRoot: string;
  runsRoot: string;
  latestPath: string;
  heartbeatPath: string;
  pollSeconds: number;
  maxRetries: number;
  taskTimeoutMinutes: number;
  requireCleanTree: boolean;
  relaxGuardrails: boolean;
  autoCommit: boolean;
  autoPush: boolean;
  pauseFilePath: string;
  lockFilePath: string;
  shell: string;
  defaultVerificationCommands: string[];
  systemManagedPaths: string[];
  codex: RoughLoopProviderConfig;
  openclaw: RoughLoopProviderConfig;
}

function readProviderConfig(prefix: "CODEX" | "OPENCLAW", fallbackCommand: string): RoughLoopProviderConfig {
  return {
    command: readString(`${prefix}_COMMAND`, fallbackCommand),
    model: readString(`${prefix}_MODEL`, "")
  };
}

export function loadConfig(): RoughLoopConfig {
  const envFilePath = loadEnvFile();
  const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const repoRoot = path.resolve(readString("ROUGH_LOOP_REPO_ROOT", defaultRepoRoot));
  const artifactRoot = path.resolve(repoRoot, readString("ARTIFACT_STORAGE_ROOT", "runtime-artifacts"), "rough-loop");
  const loopFile = readString("ROUGH_LOOP_FILE", "rough-loop.md");
  const loopFilePath = path.resolve(repoRoot, loopFile);
  const loopFileEnglishPath = path.resolve(repoRoot, loopFile.replace(/\.md$/i, ".en.md"));
  const relaxGuardrails = readBoolean("ROUGH_LOOP_RELAX_GUARDRAILS", false);

  return {
    repoRoot,
    envFilePath,
    provider: readEnum("ROUGH_LOOP_PROVIDER", "codex", roughLoopProviderSchema.options),
    loopFile,
    loopFilePath,
    loopFileEnglishPath,
    artifactRoot,
    runsRoot: path.join(artifactRoot, "runs"),
    latestPath: path.join(artifactRoot, "latest.json"),
    heartbeatPath: path.join(artifactRoot, "heartbeat.json"),
    pollSeconds: readNumber("ROUGH_LOOP_POLL_SECONDS", 60),
    maxRetries: readNumber("ROUGH_LOOP_MAX_RETRIES", 3),
    taskTimeoutMinutes: readNumber("ROUGH_LOOP_TASK_TIMEOUT_MINUTES", 45),
    requireCleanTree: relaxGuardrails ? false : readBoolean("ROUGH_LOOP_REQUIRE_CLEAN_TREE", true),
    relaxGuardrails,
    autoCommit: readBoolean("ROUGH_LOOP_AUTO_COMMIT", true),
    autoPush: readBoolean("ROUGH_LOOP_AUTO_PUSH", false),
    pauseFilePath: path.resolve(repoRoot, readString("ROUGH_LOOP_PAUSE_FILE", ".rough-loop.pause")),
    lockFilePath: path.resolve(repoRoot, ".rough-loop.lock"),
    shell: process.env.SHELL || "zsh",
    defaultVerificationCommands: ["pnpm typecheck", "pnpm test", "pnpm build"],
    systemManagedPaths: ["rough-loop.md", "rough-loop.en.md", "runtime-artifacts", ".rough-loop.lock", ".rough-loop.pause"],
    codex: readProviderConfig("CODEX", "codex"),
    openclaw: readProviderConfig("OPENCLAW", "openclaw")
  };
}
