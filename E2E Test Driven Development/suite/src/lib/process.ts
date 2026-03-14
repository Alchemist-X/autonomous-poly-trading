import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import type { ManagedProcessHandle } from "../types.js";

function getPnpmCommand(): string {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

export async function spawnLoggedProcess(options: {
  name: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  logPath: string;
}): Promise<ManagedProcessHandle> {
  const logStream = createWriteStream(options.logPath, { flags: "a" });
  const child = spawn(getPnpmCommand(), options.args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => {
    logStream.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    logStream.write(chunk);
  });

  return {
    name: options.name,
    logPath: options.logPath,
    stop: async () => {
      await new Promise<void>((resolve) => {
        if (child.exitCode != null) {
          logStream.end(resolve);
          return;
        }
        child.once("exit", () => {
          logStream.end(resolve);
        });
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode == null) {
            child.kill("SIGKILL");
          }
        }, 3000);
      });
    }
  };
}
