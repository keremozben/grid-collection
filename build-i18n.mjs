/**
 * build-i18n.mjs — generate localized landing pages from index.html (English
 * source of truth) + i18n/<code>.json. Zero dependencies; run with:
 *
 *   node build-i18n.mjs
 *
 * Output: /<path>/index.html for every locale (e.g. /tr/, /pt-br/, /zh-hans/).
 * index.html itself (English) is NOT modified. Legal pages stay English at root;
 * localized pages link to them with absolute paths.
 *
 * Text is matched whitespace-flexibly against the English values in en.json, so
 * line-wrapping in the HTML source doesn't matter. Missing translations fall
 * back to English (and are reported).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const I18N = join(ROOT, "i18n");

const LANGS = [
  { code: "tr", path: "tr", hreflang: "tr" },
  { code: "de", path: "de", hreflang: "de" },
  { code: "es", path: "es", hreflang: "es" },
  { code: "fr", path: "fr", hreflang: "fr" },
  { code: "it", path: "it", hreflang: "it" },
  { code: "pt-BR", path: "pt-br", hreflang: "pt-BR" },
  { code: "pl", path: "pl", hreflang: "pl" },
  { code: "id", path: "id", hreflang: "id" },
  { code: "vi", path: "vi", hreflang: "vi" },
  { code: "ru", path: "ru", hreflang: "ru" },
  { code: "hi", path: "hi", hreflang: "hi" },
  { code: "zh-Hans", path: "zh-hans", hreflang: "zh-Hans" },
  { code: "zh-Hant", path: "zh-hant", hreflang: "zh-Hant" },
  { code: "ja", path: "ja", hreflang: "ja" },
  { code: "ko", path: "ko", hreflang: "ko" },
];

const en = JSON.parse(readFileSync(join(I18N, "en.json"), "utf8"));
const source = readFileSync(join(ROOT, "index.html"), "utf8");

let warnings = [];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wsFlex = (s) => escRe(s).replace(/\s+/g, "\\s+");
const attrSafe = (s) => s.replace(/"/g, "”"); // keep attributes from breaking

function localize(html, t, lang) {
  const warn = (m) => warnings.push(`[${lang.code}] ${m}`);

  // --- exact, unique full-string swaps (single-line source) ---
  const exact = (enVal, locVal, all = true, safe = false) => {
    if (!html.includes(enVal)) return warn(`miss exact: ${enVal.slice(0, 48)}`);
    const v = safe ? attrSafe(locVal) : locVal;
    html = all ? html.split(enVal).join(v) : html.replace(enVal, () => v);
  };
  // --- whitespace-flexible swap for text that may wrap across lines ---
  const flex = (enVal, locVal) => {
    const re = new RegExp(wsFlex(enVal));
    if (!re.test(html)) return warn(`miss flex: ${enVal.slice(0, 48)}`);
    html = html.replace(re, () => locVal);
  };
  // --- context regex swap ---
  const ctx = (re, fn, label) => {
    if (!re.test(html)) return warn(`miss ctx: ${label}`);
    html = html.replace(re, fn);
  };

  // Head / meta (attribute context → attrSafe)
  ctx(new RegExp("(<title>\\s*)" + wsFlex(en.title) + "(\\s*</title>)"),
    (_m, a, b) => a + t.title + b, "title");
  exact(en.metaDescription, t.metaDescription, true, true);
  exact(en.ogTitle, t.ogTitle, true, true); // og:title + twitter:title
  exact(en.ogDescription, t.ogDescription, true, true);
  exact(en.twitterDescription, t.twitterDescription, true, true);

  // Nav + footer links
  ctx(/>Home<\/a>/, () => `>${t.navHome}</a>`, "navHome");
  ctx(/>Support<\/a>/g, () => `>${t.navSupport}</a>`, "navSupport");
  ctx(/>Privacy Policy<\/a>/g, () => `>${t.navPrivacy}</a>`, "navPrivacy");
  ctx(/>Terms of Service<\/a>/g, () => `>${t.navTerms}</a>`, "navTerms");

  // Hero
  flex(en.heroTagline, t.heroTagline);
  ctx(/>Grid Sizes<\/div>/, () => `>${t.statGridSizes}</div>`, "statGridSizes");
  ctx(/>Levels<\/div>/, () => `>${t.statLevels}</div>`, "statLevels");
  ctx(/>Hours of Fun<\/div>/, () => `>${t.statHours}</div>`, "statHours");
  exact('alt="Download on the App Store"', `alt="${attrSafe(t.badgeAppStoreAlt)}"`, false);
  exact('alt="Coming soon to Google Play"', `alt="${attrSafe(t.badgeGooglePlayAlt)}"`, false);
  ctx(/>Coming soon<\/span>/, () => `>${t.comingSoon}</span>`, "comingSoon");
  ctx(/>Level 1<\/div>/, () => `>${t.mockTitle}</div>`, "mockTitle");

  // Features
  exact(en.featuresHeading, t.featuresHeading, false);
  for (const n of [1, 2, 3, 4, 5, 6]) {
    exact(en[`f${n}Title`], t[`f${n}Title`], false);
    flex(en[`f${n}Body`], t[`f${n}Body`]);
  }

  // How to play
  exact(en.howHeading, t.howHeading, false);
  ctx(/(class="step-title">)Start(<\/div>)/, (_m, a, b) => a + t.step1Title + b, "step1Title");
  ctx(/(class="step-title">)Move(<\/div>)/, (_m, a, b) => a + t.step2Title + b, "step2Title");
  ctx(/(class="step-title">)Fill(<\/div>)/, (_m, a, b) => a + t.step3Title + b, "step3Title");
  flex(en.step1Desc, t.step1Desc);
  flex(en.step2Desc, t.step2Desc);
  flex(en.step3Desc, t.step3Desc);

  // Demo (static, SEO-visible). Buttons/statuses/cta come from injected DEMO_T.
  ctx(/(<h2 id="demo-title">)Try It Now(<\/h2>)/, (_m, a, b) => a + t.demo.title + b, "demoTitle");
  flex(en.demo.subtitle, t.demo.subtitle);

  // Footer
  flex(en.footerRights, t.footerRights);

  // --- structural: lang, canonical/og:url, switcher, asset/link paths ---
  html = html.replace('<html lang="en">', `<html lang="${lang.hreflang}">`);
  html = html.split('https://grid-collection.com/"').join(`https://grid-collection.com/${lang.path}/"`);
  html = html.replace('value="/" selected', 'value="/"');
  html = html.replace(`value="/${lang.path}/"`, `value="/${lang.path}/" selected`);
  html = html.replace('href="index.html" class="active"', `href="/${lang.path}/" class="active"`);
  for (const p of ["support.html", "privacy-policy.html", "terms-of-service.html"]) {
    html = html.split(`href="${p}"`).join(`href="/${p}"`);
  }
  for (const p of ["app-store.png", "google-play.png"]) {
    html = html.split(`src="${p}"`).join(`src="/${p}"`);
  }
  for (const p of ["favicon.png", "apple-touch-icon.png"]) {
    html = html.split(`href="${p}"`).join(`href="/${p}"`);
  }

  // Inject translated DEMO_T so the interactive demo speaks the page language.
  html = html.replace("<body>", `<body>\n    <script>window.DEMO_T=${JSON.stringify(t.demo)};</script>`);

  return html;
}

// deep-merge locale over English so missing keys fall back to English
function merge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = over[k] && typeof over[k] === "object" && !Array.isArray(over[k])
      ? merge(base[k] || {}, over[k])
      : over[k];
  }
  return out;
}

let built = 0;
for (const lang of LANGS) {
  const file = join(I18N, `${lang.code}.json`);
  if (!existsSync(file)) {
    warnings.push(`[${lang.code}] SKIPPED — i18n/${lang.code}.json not found`);
    continue;
  }
  const t = merge(en, JSON.parse(readFileSync(file, "utf8")));
  const out = localize(source, t, lang);
  const dir = join(ROOT, lang.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), out, "utf8");
  built++;
  console.log(`✓ /${lang.path}/index.html`);
}

console.log(`\nBuilt ${built}/${LANGS.length} locales.`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log("  " + w);
} else {
  console.log("No warnings — all strings matched.");
}
