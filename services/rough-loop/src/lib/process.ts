import { spawn } from "node:child_process";

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function runShellCommand(input: {
  command: string;
  cwd: string;
  shell: string;
  timeoutMs: number;
  stdin?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.shell, ["-lc", input.command], {
      cwd: input.cwd,
      env: {
        ...process.env,
        ...input.env
      },
      stdio: "pipe"
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, input.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? (timedOut ? 124 : 1),
        stdout,
        stderr,
        timedOut
      });
    });

    if (input.stdin) {
      child.stdin.write(input.stdin);
    }
    child.stdin.end();
  });
}

export async function runBinary(input: {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: {
        ...process.env,
        ...input.env
      },
      stdio: "pipe"
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, input.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? (timedOut ? 124 : 1),
        stdout,
        stderr,
        timedOut
      });
    });
  });
}
