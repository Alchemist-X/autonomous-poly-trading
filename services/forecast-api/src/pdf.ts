// HTML → PDF via headless Chromium (same pipeline as
// scripts/pulse-decision-report.ts, incl. the self-healing browser install).
// PDFs are cached next to the engine's state.json and regenerated whenever the
// state file is newer than the cached PDF.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { eventDir, statePath } from "./repo";

async function installPlaywrightChromium(): Promise<void> {
  const require = createRequire(import.meta.url);
  const playwrightEntry = require.resolve("playwright");
  const cliPath = path.join(path.dirname(playwrightEntry), "cli.js");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, "install", "chromium"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`playwright install chromium failed with code ${code ?? "-"}\n${output.trim()}`));
    });
  });
}

async function htmlToPdf(htmlPath: string, pdfPath: string): Promise<void> {
  const playwright = await import("playwright");
  let browser: Awaited<ReturnType<typeof playwright.chromium.launch>>;
  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("playwright install") && !message.includes("Executable doesn't exist")) {
      throw error;
    }
    await installPlaywrightChromium();
    browser = await playwright.chromium.launch({ headless: true });
  }
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}

// Serialize PDF renders: Chromium is the heaviest thing this service runs, and
// concurrent launches on a small VM would stack up memory spikes.
let pdfChain: Promise<void> = Promise.resolve();

export async function ensurePdf(eventId: string, html: string): Promise<string> {
  const dir = eventDir(eventId);
  mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(dir, "answer.pdf");
  const htmlPath = path.join(dir, "answer.html");

  const stateFile = statePath(eventId);
  if (existsSync(pdfPath) && existsSync(stateFile)) {
    const fresh = statSync(pdfPath).mtimeMs >= statSync(stateFile).mtimeMs;
    if (fresh) return pdfPath;
  }
  // Snapshot the state vintage BEFORE the (slow) render: if the engine writes
  // a newer round mid-render, backdating the PDF's mtime to this snapshot
  // keeps the cache check honest and the next request re-renders.
  const stateVintageMs = existsSync(stateFile) ? statSync(stateFile).mtimeMs : null;

  const render = pdfChain.then(async () => {
    writeFileSync(htmlPath, html, "utf8");
    await htmlToPdf(htmlPath, pdfPath);
    if (stateVintageMs !== null) {
      const t = new Date(stateVintageMs);
      utimesSync(pdfPath, t, t);
    }
  });
  // Keep the chain alive even when a render fails, or every later request
  // would inherit the same stale rejection.
  pdfChain = render.catch(() => undefined);
  await render;
  return pdfPath;
}
