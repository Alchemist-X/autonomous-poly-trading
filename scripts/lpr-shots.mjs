// One-off visual QA for the cookie-gated /live-predict-raven page.
// scripts/visual-qa.mjs cannot reach it (the access cookie has to be set
// first), so this unlocks via the real API route and then captures the page
// at desktop and mobile widths.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.env.LPR_BASE ?? "http://localhost:3210";
const code = process.env.LPR_CODE ?? "raven-labs";
const outDir = process.env.LPR_OUT ?? "runtime-artifacts/lpr-shots";
mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

const browser = await chromium.launch();
let failed = false;
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

  await page.goto(`${base}/live-predict-raven`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="code"]', code);
  await page.click('button[type="submit"]');
  await page.waitForURL(/live-predict-raven/, { waitUntil: "networkidle" });
  // Open every <details> so the tables and walk-throughs are captured too.
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => d.setAttribute("open", "")));
  await page.waitForTimeout(400);

  const full = path.join(outDir, `${vp.name}-full.png`);
  await page.screenshot({ path: full, fullPage: true });

  // Section crops: full-page shots of a report this long are unreadable.
  for (const [key, heading] of [
    ["decisions", "决策质量"],
    ["cases", "四个案例"],
    ["calibration", "校准（Brier）"],
    ["findings", "结论与建议"]
  ]) {
    const handle = await page.evaluateHandle((text) => {
      const h = [...document.querySelectorAll("h2, h3")].find((e) => e.textContent.includes(text));
      return h ? h.closest("section") ?? h.parentElement : null;
    }, heading);
    const el = handle.asElement();
    if (el) await el.screenshot({ path: path.join(outDir, `${vp.name}-${key}.png`) });
  }

  // The case section runs tens of thousands of pixels tall; capture the top of
  // the first card (header → tiles → chart → first round) as the readable crop.
  const box = await page.evaluate(() => {
    const el = document.querySelector("[class*='caseCard']");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Document coordinates: page.screenshot({fullPage,clip}) clips the full
    // page image, not the viewport.
    return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
  });
  if (box) {
    await page.screenshot({
      path: path.join(outDir, `${vp.name}-case-top.png`),
      fullPage: true,
      clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 1600) }
    });
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  if (overflow > 1) problems.push(`horizontal overflow: ${overflow}px`);
  console.log(`${vp.name}: ${full}  ${problems.length ? `PROBLEMS -> ${problems.join(" | ")}` : "clean"}`);
  if (problems.length) failed = true;
  await context.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
