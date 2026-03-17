import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { serializeRoughLoopDocument } from "./lib/markdown.js";

const execFile = promisify(execFileCallback);
const fakeProviderPath = path.resolve("services/rough-loop/test-fixtures/fake-provider.mjs");

describe("rough-loop CLI smoke", () => {
  it("runs pnpm rough-loop:once against a temporary repo", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "rough-loop-smoke-"));

    try {
      await execFile("git", ["init"], { cwd: repoRoot });
      await execFile("git", ["config", "user.name", "Rough Loop Smoke"], { cwd: repoRoot });
      await execFile("git", ["config", "user.email", "rough-loop-smoke@test.local"], { cwd: repoRoot });
      await writeFile(path.join(repoRoot, ".gitignore"), "runtime-artifacts/\n.rough-loop.lock\n.rough-loop.pause\n", "utf8");
      await execFile("git", ["add", ".gitignore"], { cwd: repoRoot });
      await execFile("git", ["commit", "-m", "init"], { cwd: repoRoot });
      await mkdir(path.join(repoRoot, "docs"), { recursive: true });
      await writeFile(path.join(repoRoot, "rough-loop.md"), serializeRoughLoopDocument({
        locale: "zh",
        rules: ["规则"],
        queue: [
          {
            id: "RL-CLI-001",
            title: "CLI smoke task",
            status: "todo",
            priority: "P0",
            dependsOn: [],
            allowedPaths: ["docs"],
            definitionOfDone: ["Create docs/cli-smoke.md"],
            verification: ['node -e "process.exit(0)"'],
            context: ["Smoke test for the CLI command."],
            latestResult: ["Not started"],
            attempts: 0,
            section: "queue",
            createdOrder: 0
          }
        ],
        running: [],
        blocked: [],
        done: []
      }, "zh"), "utf8");

      const env = {
        ...process.env,
        ROUGH_LOOP_REPO_ROOT: repoRoot,
        ROUGH_LOOP_PROVIDER: "codex",
        ROUGH_LOOP_AUTO_COMMIT: "1",
        ROUGH_LOOP_REQUIRE_CLEAN_TREE: "1",
        CODEX_COMMAND: `node ${fakeProviderPath}`,
        FAKE_ROUGH_LOOP_MODE: "success",
        FAKE_ROUGH_LOOP_TARGET: "docs/cli-smoke.md",
        FAKE_ROUGH_LOOP_CONTENT: "# cli smoke\n"
      };

      await execFile("pnpm", ["rough-loop:once"], {
        cwd: "/Users/Aincrad/dev-proj/autonomous-poly-trading",
        env
      });

      const loopContent = await readFile(path.join(repoRoot, "rough-loop.md"), "utf8");
      const cliSmoke = await readFile(path.join(repoRoot, "docs", "cli-smoke.md"), "utf8");

      expect(loopContent).toContain("## Done（已完成）");
      expect(cliSmoke).toContain("# cli smoke");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  }, 120_000);
});
