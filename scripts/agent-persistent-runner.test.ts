import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  acquireRunnerLock,
  parseArgs
} from "./agent-persistent-runner.ts";

describe("agent persistent runner", () => {
  it("parses bounded smoke-run arguments", () => {
    const args = parseArgs([
      "--duration-minutes",
      "1",
      "--max-iterations",
      "3",
      "--interval-minutes",
      "0",
      "--mock-executor",
      "--archive-root",
      "runtime-artifacts/raven-agent-3iter-smoke"
    ]);

    expect(args).toMatchObject({
      durationMinutes: 1,
      maxIterations: 3,
      intervalMinutes: 0,
      mockExecutor: true
    });
    expect(args.archiveRoot).toContain("runtime-artifacts/raven-agent-3iter-smoke");
  });

  it("refuses to acquire an existing runner lock", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "raven-agent-runner-"));
    const lockPath = path.join(tempDir, "runner.lock");
    try {
      await writeFile(lockPath, "already running", "utf8");
      await expect(acquireRunnerLock(lockPath, path.join(tempDir, "session"))).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
