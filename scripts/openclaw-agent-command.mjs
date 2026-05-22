#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : fallback;
}

function parseJsonEnvelope(stdout, stderr) {
  const trimmed = stdout.trim();
  if (trimmed) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to trailing-line JSON extraction for verbose CLIs.
    }
  }

  const combined = [stdout, stderr].filter(Boolean).join("\n");
  const lines = combined.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith("{") && !line.startsWith("[")) {
      continue;
    }
    try {
      return JSON.parse(line);
    } catch {
      continue;
    }
  }

  throw new Error("OpenClaw did not return a JSON envelope.");
}

function extractTextPayload(envelope) {
  const candidates = [
    envelope?.payloads,
    envelope?.result?.payloads,
    envelope?.data?.payloads,
    envelope?.payload,
    envelope?.result,
    envelope?.data,
    envelope?.output,
    envelope?.text,
    envelope?.message
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (Array.isArray(candidate)) {
      const payload = candidate.find((item) => typeof item?.text === "string" && item.text.trim());
      if (payload) {
        return payload.text.trim();
      }
    }
    if (candidate && typeof candidate === "object" && typeof candidate.text === "string" && candidate.text.trim()) {
      return candidate.text.trim();
    }
  }

  throw new Error("OpenClaw JSON did not contain a text payload.");
}

async function runOpenClaw(input) {
  return await new Promise((resolve, reject) => {
    const child = spawn(input.bin, [
      "agent",
      "--agent",
      input.agent,
      "--message",
      input.prompt,
      "--json"
    ], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || `openclaw agent exited with code ${code}`));
    });
  });
}

async function main() {
  const promptFile = readArg("--prompt-file");
  const outputFile = readArg("--output-file");
  const agent = readArg("--agent", process.env.OPENCLAW_AGENT || "main");
  const bin = readArg("--openclaw-bin", process.env.OPENCLAW_BIN || "openclaw");

  if (!promptFile || !outputFile) {
    throw new Error("Usage: openclaw-agent-command.mjs --prompt-file <path> --output-file <path> [--agent main] [--openclaw-bin openclaw]");
  }

  const prompt = await readFile(promptFile, "utf8");
  const result = await runOpenClaw({ bin, agent, prompt });
  const envelope = parseJsonEnvelope(result.stdout, result.stderr);
  const text = extractTextPayload(envelope);
  await writeFile(outputFile, `${text}\n`, "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
