/**
 * build-legal.mjs — generate the legal pages (support / privacy-policy /
 * terms-of-service) for English (repo root) AND every locale, from a single
 * source of truth: i18n/legal/<code>.json. Zero dependencies; run with:
 *
 *   node build-legal.mjs
 *
 * Output:
 *   /support.html, /privacy-policy.html, /terms-of-service.html   (English)
 *   /<path>/support.html, …                                       (each locale)
 *
 * Missing locale keys fall back to English (deep-merged). Every page carries
 * the language <select> switcher and links /lang.js, which remembers the
 * visitor's language choice and rewrites in-page navigation accordingly.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const I18N = join(ROOT, "i18n", "legal");

// path "" → served from the domain root ("/"); others from "/<path>/".
const LANGS = [
  { code: "en", path: "", hreflang: "en", name: "English" },
  { code: "tr", path: "tr", hreflang: "tr", name: "Türkçe" },
  { code: "de", path: "de", hreflang: "de", name: "Deutsch" },
  { code: "es", path: "es", hreflang: "es", name: "Español" },
  { code: "fr", path: "fr", hreflang: "fr", name: "Français" },
  { code: "it", path: "it", hreflang: "it", name: "Italiano" },
  { code: "pt-BR", path: "pt-br", hreflang: "pt-BR", name: "Português (BR)" },
  { code: "pl", path: "pl", hreflang: "pl", name: "Polski" },
  { code: "id", path: "id", hreflang: "id", name: "Bahasa Indonesia" },
  { code: "vi", path: "vi", hreflang: "vi", name: "Tiếng Việt" },
  { code: "ru", path: "ru", hreflang: "ru", name: "Русский" },
  { code: "hi", path: "hi", hreflang: "hi", name: "हिन्दी" },
  { code: "zh-Hans", path: "zh-hans", hreflang: "zh-Hans", name: "简体中文" },
  { code: "zh-Hant", path: "zh-hant", hreflang: "zh-Hant", name: "繁體中文" },
  { code: "ja", path: "ja", hreflang: "ja", name: "日本語" },
  { code: "ko", path: "ko", hreflang: "ko", name: "한국어" },
];

const PAGES = [
  { key: "support", slug: "support.html", nav: "support" },
  { key: "privacy", slug: "privacy-policy.html", nav: "privacy" },
  { key: "terms", slug: "terms-of-service.html", nav: "terms" },
];

const en = JSON.parse(readFileSync(join(I18N, "en.json"), "utf8"));

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
const baseOf = (lang) => (lang.path ? `/${lang.path}/` : "/");

// deep-merge locale over English so missing keys fall back to English
function merge(base, over) {
  if (Array.isArray(base)) {
    // arrays: merge element-by-element (translations keep the same order/length)
    return base.map((b, i) =>
      over && over[i] !== undefined && typeof b === "object"
        ? merge(b, over[i])
        : over && over[i] !== undefined
          ? over[i]
          : b,
    );
  }
  if (base && typeof base === "object") {
    const out = { ...base };
    for (const k of Object.keys(base)) {
      if (over && k in over) out[k] = merge(base[k], over[k]);
    }
    return out;
  }
  return over !== undefined ? over : base;
}

const mailto = (email) =>
  `<a href="mailto:${escAttr(email)}" style="color: var(--color-primary)">${esc(email)}</a>`;

// escape a paragraph, then expand a {email} token into a mailto link
function para(sec) {
  let html = esc(sec.p);
  if (sec.email) html = html.replace("{email}", mailto(sec.email));
  return html;
}

function navAndSwitcher(t, lang, activeNav) {
  const base = baseOf(lang);
  const link = (nav, file, label) =>
    `          <li><a href="${base}${file}" data-nav="${nav}"${
      nav === activeNav ? ' class="active"' : ""
    }>${esc(label)}</a></li>`;
  const options = LANGS.map((l) => {
    const ob = baseOf(l);
    return `          <option value="${ob}"${ob === base ? " selected" : ""}>${esc(l.name)}</option>`;
  }).join("\n");
  const c = t.common;
  return `    <nav>
      <div class="nav-container">
        <a href="${base}" class="logo" data-nav="home">Grid Collection</a>
        <ul class="nav-links">
${link("home", "", c.navHome)}
${link("support", "support.html", c.navSupport)}
${link("privacy", "privacy-policy.html", c.navPrivacy)}
${link("terms", "terms-of-service.html", c.navTerms)}
        </ul>
        <select
          class="lang-select"
          aria-label="${escAttr(c.langLabel)}"
          onchange="if(this.value)location.href=this.value"
        >
${options}
        </select>
      </div>
    </nav>`;
}

function footer(t, lang) {
  const base = baseOf(lang);
  const c = t.common;
  return `    <footer>
      <div class="footer-links">
        <a href="${base}support.html" data-nav="support">${esc(c.navSupport)}</a>
        <a href="${base}privacy-policy.html" data-nav="privacy">${esc(c.navPrivacy)}</a>
        <a href="${base}terms-of-service.html" data-nav="terms">${esc(c.navTerms)}</a>
      </div>
      <p>${esc(c.footer)}</p>
    </footer>`;
}

function contentSupport(p) {
  const items = p.items
    .map(
      (it) =>
        `        <li>\n          <strong>${esc(it.label)}</strong> ${esc(it.text)}\n          ${mailto(it.email)}\n        </li>`,
    )
    .join("\n");
  return `    <div class="content">
      <h1>${esc(p.h1)}</h1>

      <p>${esc(p.intro)}</p>

      <ul>
${items}
      </ul>
    </div>`;
}

function contentSections(p) {
  const body = p.sections
    .map((sec) => `      <h2>${esc(sec.h)}</h2>\n      <p>${para(sec)}</p>`)
    .join("\n\n");
  return `    <div class="content">
      <h1>${esc(p.h1)}</h1>

${body}
    </div>`;
}

function hreflangAlternates(page) {
  const lines = LANGS.map(
    (l) =>
      `    <link rel="alternate" hreflang="${l.hreflang}" href="https://grid-collection.com${baseOf(l)}${page.slug}" />`,
  );
  lines.push(
    `    <link rel="alternate" hreflang="x-default" href="https://grid-collection.com/${page.slug}" />`,
  );
  return lines.join("\n");
}

function render(t, lang, page) {
  const p = t[page.key];
  const base = baseOf(lang);
  const content =
    page.key === "support" ? contentSupport(p) : contentSections(p);
  return `<!doctype html>
<html lang="${lang.hreflang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escAttr(p.metaDescription)}" />
    <title>${escAttr(p.title)}</title>
    <link rel="canonical" href="https://grid-collection.com${base}${page.slug}" />
${hreflangAlternates(page)}
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/styles.css" />
    <!-- Google tag (gtag.js) -->
    <script
      async
      src="https://www.googletagmanager.com/gtag/js?id=G-EHP1CQ1RV4"
    ></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("js", new Date());

      gtag("config", "G-EHP1CQ1RV4");
    </script>
    <script src="/lang.js" defer></script>
  </head>
  <body>
${navAndSwitcher(t, lang, page.nav)}

${content}

${footer(t, lang)}
  </body>
</html>
`;
}

let built = 0;
const warnings = [];
for (const lang of LANGS) {
  let t = en;
  if (lang.code !== "en") {
    try {
      const over = JSON.parse(
        readFileSync(join(I18N, `${lang.code}.json`), "utf8"),
      );
      t = merge(en, over);
    } catch (e) {
      warnings.push(`[${lang.code}] no translation file — using English`);
    }
  }
  const dir = lang.path ? join(ROOT, lang.path) : ROOT;
  mkdirSync(dir, { recursive: true });
  for (const page of PAGES) {
    writeFileSync(join(dir, page.slug), render(t, lang, page), "utf8");
  }
  built++;
  console.log(`✓ ${lang.path ? "/" + lang.path : "(root)"} — ${PAGES.length} pages`);
}

console.log(`\nBuilt legal pages for ${built}/${LANGS.length} locales.`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log("  " + w);
}
