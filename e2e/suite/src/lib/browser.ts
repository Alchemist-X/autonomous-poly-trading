import path from "node:path";
import { chromium } from "playwright";
import { ensureDir } from "./fs.js";

export async function recordBrowserSession<T>(options: {
  artifactDir: string;
  label: string;
  url: string;
  script: (page: import("playwright").Page) => Promise<T>;
}) {
  const videoDir = path.join(options.artifactDir, options.label, "video");
  await ensureDir(videoDir);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: videoDir,
      size: {
        width: 1440,
        height: 960
      }
    }
  });
  await context.tracing.start({
    screenshots: true,
    snapshots: true
  });

  const page = await context.newPage();
  const video = page.video();
  await page.goto(options.url, { waitUntil: "networkidle" });
  const result = await options.script(page);
  const screenshotPath = path.join(options.artifactDir, options.label, "final.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const tracePath = path.join(options.artifactDir, options.label, "trace.zip");
  await context.tracing.stop({ path: tracePath });
  await context.close();
  const videoPath = video ? await video.path() : "";
  await browser.close();

  return {
    result,
    screenshotPath,
    tracePath,
    videoPath
  };
}
