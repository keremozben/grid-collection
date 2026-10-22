// Renders the share image template to the two PNGs the pages link to:
//   brand-assets/og-image.html?lang=en → /og-image.png
//   brand-assets/og-image.html?lang=tr → /og-image-tr.png
// 1200 × 630 at device scale 1 (what the platforms show), each under 300 KB
// (WhatsApp often drops bigger previews) — the script fails otherwise.
//
//   cd tools && pnpm install        (once; Playwright lives in tools/)
//   node brand-assets/capture.mjs
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const { chromium } = await import(pathToFileURL(join(root, "tools", "node_modules", "playwright", "index.mjs")).href);

const LIMIT = 300 * 1024;
const browser = await chromium.launch();
let failed = false;
for (const [lang, out] of [
  ["en", "og-image.png"],
  ["tr", "og-image-tr.png"],
]) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${pathToFileURL(join(here, "og-image.html")).href}?lang=${lang}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  if (errors.length) throw new Error(`${out}: ${errors.join("; ")}`);
  const file = join(root, out);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await page.close();
  const size = statSync(file).size;
  console.log(`${size <= LIMIT ? "✓" : "✗"} ${out}  1200×630  ${(size / 1024).toFixed(0)} KB`);
  if (size > LIMIT) failed = true;
}
await browser.close();
if (failed) {
  console.error("A share image is over 300 KB: simplify brand-assets/og-image.html (fewer gradients/shadows).");
  process.exit(1);
}
