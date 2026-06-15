import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadEnvFile,
  resolveExplicitEnvCandidates,
  resolveFallbackEnvCandidates
} from "./env.js";

describe("env loader", () => {
  it("uses an absolute ENV_FILE as-is", () => {
    expect(resolveExplicitEnvCandidates("/etc/.env.pizza", "/a/b/c")).toEqual(["/etc/.env.pizza"]);
  });

  it("walks parent dirs for a relative ENV_FILE (cwd first, then ancestors)", () => {
    expect(resolveExplicitEnvCandidates(".env.pizza", "/a/b/c")).toEqual([
      "/a/b/c/.env.pizza",
      "/a/b/.env.pizza",
      "/a/.env.pizza",
      "/.env.pizza"
    ]);
  });

  it("fallback tries .env / .env.local / .env.aizen in order at each level", () => {
    const cands = resolveFallbackEnvCandidates("/a/b");
    expect(cands.slice(0, 5)).toEqual([
      "/a/b/.env",
      "/a/b/.env.local",
      "/a/b/.env.aizen",
      "/a/b/pm-PlaceOrder/.env.aizen",
      // path.join normalizes the ".." segment (matches the original loader).
      "/a/pm-PlaceOrder/.env.aizen"
    ]);
    // It walks all the way up to root.
    expect(cands).toContain("/.env");
  });

  describe("loadEnvFile", () => {
    let dir: string | null = null;
    const KEY = "RAVEN_ENV_LOADER_TEST_VALUE";

    afterEach(() => {
      delete process.env[KEY];
      delete process.env.ENV_FILE;
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
        dir = null;
      }
    });

    it("loads an explicit ENV_FILE and returns its path", () => {
      dir = mkdtempSync(path.join(tmpdir(), "raven-env-"));
      const file = path.join(dir, ".env.pizza");
      writeFileSync(file, `${KEY}=from_explicit\n`);
      const used = loadEnvFile(dir, { ENV_FILE: file } as NodeJS.ProcessEnv);
      expect(used).toBe(file);
      expect(process.env[KEY]).toBe("from_explicit");
    });

    it("fails closed when ENV_FILE is set but missing (no fallback to .env)", () => {
      dir = mkdtempSync(path.join(tmpdir(), "raven-env-"));
      // A .env exists, but ENV_FILE points elsewhere → must NOT load .env.
      writeFileSync(path.join(dir, ".env"), `${KEY}=from_dotenv\n`);
      const used = loadEnvFile(dir, { ENV_FILE: path.join(dir, ".env.does-not-exist") } as NodeJS.ProcessEnv);
      expect(used).toBeNull();
      expect(process.env[KEY]).toBeUndefined();
    });
  });
});
