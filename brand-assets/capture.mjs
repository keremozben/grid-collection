// capture.mjs — render each brand-asset HTML to a pixel-exact PNG.
//
//   npm i -D playwright       (or: npx playwright install chromium)
//   node brand-assets/capture.mjs
//
// Outputs PNGs into the SITE ROOT (one level up) so index.html picks them up:
//   ../og-image.png  ../favicon.png  ../apple-touch-icon.png
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, ".."); // site root

const targets = [
  { file: "og-image.html", out: "og-image.png", w: 1200, h: 630 },
  { file: "favicon.html", out: "favicon.png", w: 512, h: 512 },
  { file: "apple-touch-icon.html", out: "apple-touch-icon.png", w: 180, h: 180 },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({
    viewport: { width: t.w, height: t.h },
    deviceScaleFactor: 2, // crisp / retina
  });
  await page.goto(pathToFileURL(join(here, t.file)).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(300); // let web fonts settle
  await page.screenshot({ path: join(root, t.out), clip: { x: 0, y: 0, width: t.w, height: t.h } });
  await page.close();
  console.log(`✓ ${t.out}  (${t.w}×${t.h} @2x)`);
}
await browser.close();
console.log("Done. PNGs written to site root.");
