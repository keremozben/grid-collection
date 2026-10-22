// Copies the web-vitals ES module into the site (assets/vendor/web-vitals.js):
// the site loads nothing from a CDN. Run after updating the package:
//   pnpm up web-vitals && node vendor.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, "node_modules", "web-vitals");
const { version, license } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const code = readFileSync(join(pkgDir, "dist", "web-vitals.js"), "utf8").replace(/\n\/\/# sourceMappingURL=.*\s*$/, "\n");
const out = join(resolve(here, ".."), "assets", "vendor", "web-vitals.js");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `/*! web-vitals ${version} — https://github.com/GoogleChrome/web-vitals — ${license} License (Google LLC) */\n${code}`);
console.log(`web-vitals ${version} → assets/vendor/web-vitals.js`);
