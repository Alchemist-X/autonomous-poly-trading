// Canonical .env loader, shared by every service (executor / orchestrator /
// scripts) so ENV_FILE precedence can never silently diverge between them.
// This matters on the real-money path: `ENV_FILE=.env.pizza` must win — if it's
// set but missing we fail closed rather than quietly loading a different wallet.
//
// Imported via the `@autopoly/contracts/env` subpath ONLY (never re-exported
// from the package index) so the web bundle never pulls node:fs / dotenv.
//
// Precedence:
//   1. If ENV_FILE is set → resolve it (absolute, or walk parent dirs for a
//      relative path), load the first match with override:true, and STOP.
//      If ENV_FILE is set but no candidate exists → return null (fail closed;
//      do NOT fall through to .env).
//   2. Otherwise walk up from cwd trying .env / .env.local / .env.aizen
//      (+ pm-PlaceOrder nesting), loading the first match with override:false.

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Files tried per directory level when ENV_FILE is not set (first existing wins).
const FALLBACK_FILENAMES = [".env", ".env.local", ".env.aizen"] as const;
const FALLBACK_NESTED: ReadonlyArray<readonly string[]> = [
  ["pm-PlaceOrder", ".env.aizen"],
  ["..", "pm-PlaceOrder", ".env.aizen"]
];

function walkUp(cwd: string): string[] {
  const dirs: string[] = [];
  let dir = cwd;
  for (;;) {
    dirs.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return dirs;
}

// Ordered candidate paths for an explicit ENV_FILE. Absolute paths are used
// as-is; relative paths are resolved against cwd and each ancestor directory so
// a script run from a subdirectory still finds a repo-root env file. Pure.
export function resolveExplicitEnvCandidates(envFile: string, cwd: string): string[] {
  if (path.isAbsolute(envFile)) {
    return [envFile];
  }
  return walkUp(cwd).map((dir) => path.resolve(dir, envFile));
}

// Ordered fallback candidates (no ENV_FILE), walking up from cwd. Pure.
export function resolveFallbackEnvCandidates(cwd: string): string[] {
  const candidates: string[] = [];
  for (const dir of walkUp(cwd)) {
    for (const name of FALLBACK_FILENAMES) {
      candidates.push(path.join(dir, name));
    }
    for (const parts of FALLBACK_NESTED) {
      candidates.push(path.join(dir, ...parts));
    }
  }
  return candidates;
}

// Load the resolved .env into process.env and return the path used (or null if
// none matched). cwd/env are injectable for testing; production calls pass none.
export function loadEnvFile(cwd: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.ENV_FILE?.trim();
  if (explicit) {
    for (const candidate of resolveExplicitEnvCandidates(explicit, cwd)) {
      if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate, override: true });
        return candidate;
      }
    }
    // Fail closed: an explicit ENV_FILE that doesn't exist must NOT fall back.
    return null;
  }

  for (const candidate of resolveFallbackEnvCandidates(cwd)) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
      return candidate;
    }
  }
  return null;
}
