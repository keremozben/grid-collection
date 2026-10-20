/**
 * build-home.mjs — generate the landing page (v2 design) for English (repo
 * root) AND every locale from one template. Zero dependencies; run with:
 *
 *   node build-home.mjs
 *
 * Input:
 *   i18n/home/_template.html   page markup, CSS and scripts ({{token}} slots)
 *   i18n/home/<code>.json      copy per language (en.json is the source)
 *   i18n/legal/<code>.json     "common" block: footer link labels + the
 *                              language switcher label, shared with the legal
 *                              pages so both use the same wording
 *
 * Output:
 *   /index.html (English), /<path>/index.html (each locale)
 *
 * Every page is fully rendered in its language (title, meta, OG, every
 * data-i18n / data-i18n-aria text), carries canonical + hreflang alternates,
 * the language <select> switcher, root-absolute links to that language's legal
 * pages, and links /lang.js (remembers the visitor's language choice).
 * Missing keys fall back to English and are reported as warnings.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const HOME = join(ROOT, "i18n", "home");
const LEGAL = join(ROOT, "i18n", "legal");
const SITE = "https://grid-collection.com";

// Same list and order as build-legal.mjs. path "" → served from "/".
const LANGS = [
  { code: "en", path: "", locale: "en-US", og: "en_US", name: "English" },
  { code: "tr", path: "tr", locale: "tr-TR", og: "tr_TR", name: "Türkçe" },
  { code: "de", path: "de", locale: "de-DE", og: "de_DE", name: "Deutsch" },
  { code: "es", path: "es", locale: "es-ES", og: "es_ES", name: "Español" },
  { code: "fr", path: "fr", locale: "fr-FR", og: "fr_FR", name: "Français" },
  { code: "it", path: "it", locale: "it-IT", og: "it_IT", name: "Italiano" },
  { code: "pt-BR", path: "pt-br", locale: "pt-BR", og: "pt_BR", name: "Português (BR)" },
  { code: "pl", path: "pl", locale: "pl-PL", og: "pl_PL", name: "Polski" },
  { code: "id", path: "id", locale: "id-ID", og: "id_ID", name: "Bahasa Indonesia" },
  { code: "vi", path: "vi", locale: "vi-VN", og: "vi_VN", name: "Tiếng Việt" },
  { code: "ru", path: "ru", locale: "ru-RU", og: "ru_RU", name: "Русский" },
  { code: "hi", path: "hi", locale: "hi-IN", og: "hi_IN", name: "हिन्दी" },
  { code: "zh-Hans", path: "zh-hans", locale: "zh-Hans", og: "zh_CN", name: "简体中文" },
  { code: "zh-Hant", path: "zh-hant", locale: "zh-Hant", og: "zh_TW", name: "繁體中文" },
  { code: "ja", path: "ja", locale: "ja-JP", og: "ja_JP", name: "日本語" },
  { code: "ko", path: "ko", locale: "ko-KR", og: "ko_KR", name: "한국어" },
];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
const baseOf = (lang) => (lang.path ? `/${lang.path}/` : "/");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
// JSON that is safe inside an inline <script>
const scriptJson = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

const template = readFileSync(join(HOME, "_template.html"), "utf8").replace(/\r\n/g, "\n");
const en = readJson(join(HOME, "en.json"));

const hreflang = [
  ...LANGS.map((l) => `  <link rel="alternate" hreflang="${l.code}" href="${SITE}${baseOf(l)}" />`),
  `  <link rel="alternate" hreflang="x-default" href="${SITE}/" />`,
].join("\n");

function langSelect(lang, label) {
  const base = baseOf(lang);
  const options = LANGS.map((l) => {
    const ob = baseOf(l);
    return `        <option value="${ob}"${ob === base ? " selected" : ""}>${esc(l.name)}</option>`;
  }).join("\n");
  return `      <select class="lang-select" aria-label="${escAttr(label)}" onchange="if(this.value)location.href=this.value">
${options}
      </select>`;
}

function render(lang, warnings) {
  let own = {};
  if (lang.code !== "en") {
    try {
      own = readJson(join(HOME, `${lang.code}.json`));
    } catch {
      warnings.push(`[${lang.code}] no i18n/home/${lang.code}.json — using English`);
    }
    if (Object.keys(own).length) {
      for (const k of Object.keys(en)) if (!(k in own)) warnings.push(`[${lang.code}] missing "${k}"`);
      for (const k of Object.keys(own)) if (!(k in en)) warnings.push(`[${lang.code}] unknown key "${k}"`);
    }
  }
  const text = { ...en, ...own };
  const common = readJson(join(LEGAL, `${lang.code}.json`)).common;
  const base = baseOf(lang);
  const slots = {
    lang: lang.code,
    url: `${SITE}${base}`,
    ogLocale: lang.og,
    base,
    hreflang,
    langSelect: langSelect(lang, common.langLabel),
    "meta.title": escAttr(text["meta.title"]),
    "meta.desc": escAttr(text["meta.desc"]),
    "sound.on": esc(text["sound.on"]),
    "footer.support": esc(common.navSupport),
    "footer.privacy": esc(common.navPrivacy),
    "footer.terms": esc(common.navTerms),
    textJson: scriptJson(text),
    localeJson: scriptJson(lang.locale),
  };
  const fmt = new Intl.NumberFormat(lang.locale);
  return template
    .replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
      if (!(key in slots)) throw new Error(`unknown template slot ${m}`);
      return slots[key];
    })
    .replace(/(<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)[^<]*(<\/\2>)/g, (m, open, tag, key, close) => {
      if (!(key in text)) throw new Error(`unknown data-i18n key "${key}"`);
      return open + esc(text[key]) + close;
    })
    .replace(/aria-label="[^"]*"( data-i18n-aria="([^"]+)")/g, (m, attr, key) => {
      if (!(key in text)) throw new Error(`unknown data-i18n-aria key "${key}"`);
      return `aria-label="${escAttr(text[key])}"${attr}`;
    })
    .replace(/(data-count="(\d+)">)[^<]*</g, (m, open, n) => `${open}${fmt.format(Number(n))}<`);
}

const warnings = [];
for (const lang of LANGS) {
  const dir = lang.path ? join(ROOT, lang.path) : ROOT;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), render(lang, warnings), "utf8");
  console.log(`✓ ${lang.path ? "/" + lang.path + "/" : "/"}index.html`);
}

console.log(`\nBuilt the landing page for ${LANGS.length} locales.`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log("  " + w);
} else {
  console.log("No warnings — every locale has every key.");
}
