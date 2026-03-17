#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const mode = process.env.FAKE_ROUGH_LOOP_MODE || "success";
const targetFile = process.env.FAKE_ROUGH_LOOP_TARGET || "notes.md";

await new Promise((resolve) => {
  process.stdin.resume();
  process.stdin.on("end", resolve);
});

if (mode === "blocked") {
  console.log("ROUGH_LOOP_BLOCKED: Human judgment is required.");
  process.exit(0);
}

if (mode === "timeout") {
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  console.log("ROUGH_LOOP_SUMMARY: Timeout finished.");
  process.exit(0);
}

if (mode === "noop") {
  console.log("ROUGH_LOOP_SUMMARY: No file changes were made.");
  process.exit(0);
}

const targetPath = path.resolve(process.cwd(), targetFile);
const content = process.env.FAKE_ROUGH_LOOP_CONTENT || "# fake provider output\n";

if (mode === "append" && targetFile) {
  let previous = "";
  try {
    previous = readFileSync(targetPath, "utf8");
  } catch {
    previous = "";
  }
  writeFileSync(targetPath, previous + content, "utf8");
  console.log(`ROUGH_LOOP_SUMMARY: Updated ${targetFile}.`);
  process.exit(0);
}

writeFileSync(targetPath, content, "utf8");
console.log(`ROUGH_LOOP_SUMMARY: Wrote ${targetFile}.`);
