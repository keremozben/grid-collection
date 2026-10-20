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
 *
 * Pages use the v2 design of the landing page (i18n/home/_template.html): CSS
 * is inlined from CSS below, system fonts only; no /styles.css or Google Fonts.
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
  `<a class="mail" href="mailto:${escAttr(email)}">${esc(email)}</a>`;

// escape a paragraph, then expand a {email} token into a mailto link
function para(sec) {
  let html = esc(sec.p);
  if (sec.email) html = html.replace("{email}", mailto(sec.email));
  return html;
}

// Same look as the landing page (card #13 design): the game's dark theme, a tilted
// plane of game cells behind the page, glass panels, system fonts only.
// Inlined into every page so a legal page needs no other request.
const CELL = (x, y, fill, op) =>
  `<rect x='${x}' y='${y}' width='34' height='34' rx='8' fill='${fill}' fill-opacity='${op}'/>`;
const FIELD_TILE = [
  [0, 0, "#ff6b35", 0.9], [42, 0, "#0f3460", 1], [84, 0, "#2d2d4a", 1], [126, 0, "#0f3460", 1],
  [0, 42, "#2d2d4a", 1], [42, 42, "#2d2d4a", 1], [84, 42, "#ff6b35", 0.9], [126, 42, "#2d2d4a", 1],
  [0, 84, "#0f3460", 1], [42, 84, "#ff6b35", 0.9], [84, 84, "#0f3460", 1], [126, 84, "#2d2d4a", 1],
  [0, 126, "#2d2d4a", 1], [42, 126, "#0f3460", 1], [84, 126, "#2d2d4a", 1], [126, 126, "#ff6b35", 0.9],
]
  .map((c) => CELL(...c))
  .join("");
const FIELD_SVG = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='168' height='168'>${FIELD_TILE}</svg>`,
)}")`;

const CSS = `
    :root {
      color-scheme: dark;
      --c-bg: #0b0b16;
      --c-bg-2: #1a1a2e;
      --c-filled: #0f3460;
      --c-passive: #2d2d4a;
      --c-orange: #ff6b35;
      --c-orange-l: #ff8a5c;
      --c-accent: #f7c59f;
      --c-text: #ffffff;
      --c-text-2: rgba(255, 255, 255, 0.78);
      --c-text-3: rgba(255, 255, 255, 0.6);
      --c-line: rgba(255, 255, 255, 0.1);
      --c-line-2: rgba(255, 255, 255, 0.18);
      --c-glass: rgba(22, 22, 42, 0.72);
      --font: "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
      --mono: ui-monospace, "SF Mono", "Cascadia Code", "Cascadia Mono", Consolas, monospace;
      --radius-md: 0.9rem;
      --radius-lg: 1.4rem;
      --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    }
    *, *::before, *::after { box-sizing: border-box; }
    html {
      font-size: clamp(16px, 0.8333vw, 22px);
      background: var(--c-bg);
      -webkit-text-size-adjust: 100%;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      font-family: var(--font);
      line-height: 1.6;
      color: var(--c-text);
      background: radial-gradient(120% 90% at 50% 100%, var(--c-bg-2) 0%, var(--c-bg) 70%);
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, p { margin: 0; }
    a { color: inherit; }
    ::selection { background: var(--c-orange); color: #fff; }
    :focus-visible { outline: 0.15rem solid var(--c-accent); outline-offset: 0.2rem; border-radius: 0.3rem; }

    /* tilted plane of game cells, like the v2 hero floor */
    .field {
      /* 200vh plane tilted 50deg under a 70vh perspective projects onto the bottom ~40% of the viewport */
      position: fixed; left: -120%; right: -120%; bottom: 0; height: 200vh; z-index: 0; pointer-events: none;
      background: ${FIELD_SVG} center bottom / 9rem 9rem repeat;
      opacity: 0.75;
      transform: perspective(70vh) rotateX(50deg);
      transform-origin: 50% 100%;
      -webkit-mask-image: linear-gradient(to top, #000 0%, transparent 60%);
      mask-image: linear-gradient(to top, #000 0%, transparent 60%);
    }
    .glow {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background:
        radial-gradient(90% 60% at 50% 105%, rgba(255, 107, 53, 0.22), transparent 60%),
        linear-gradient(to bottom, rgba(5, 5, 12, 0.6), transparent 30%);
    }

    /* ---------- nav ---------- */
    .nav {
      position: sticky; top: 0; z-index: 10;
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem 1.5rem;
      padding: 0.75rem clamp(1rem, 3vw, 3rem);
      background: rgba(11, 11, 22, 0.72);
      backdrop-filter: blur(1.2rem) saturate(1.4);
      -webkit-backdrop-filter: blur(1.2rem) saturate(1.4);
      border-bottom: 1px solid var(--c-line);
    }
    .nav__brand {
      display: flex; align-items: center; gap: 0.75rem; min-height: 2.75rem; text-decoration: none;
      font-weight: 800; font-size: 1.15rem; letter-spacing: -0.01em;
    }
    .nav__logo { display: block; width: 1.9rem; height: 1.9rem; border-radius: 0.45rem; }
    .nav__links { display: flex; gap: 0.25rem; list-style: none; margin: 0; padding: 0; }
    .nav__link {
      display: inline-flex; align-items: center; min-height: 2.75rem; padding: 0 1rem;
      border-radius: 99rem; text-decoration: none; font-size: 0.95rem; font-weight: 600; color: var(--c-text-2);
      white-space: nowrap; transition: color 0.2s, background 0.2s;
    }
    .nav__link:hover { color: #fff; background: rgba(255, 255, 255, 0.07); }
    .nav__link--active { color: #fff; background: rgba(255, 107, 53, 0.18); }
    .lang-select {
      min-height: 2.75rem; padding: 0 2.4rem 0 1rem; border-radius: 99rem;
      border: 1px solid var(--c-line); color: var(--c-text);
      background: rgba(255, 255, 255, 0.06) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%23ff8a5c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") right 1rem center / 0.75rem no-repeat;
      font: 600 0.9rem var(--font); cursor: pointer; appearance: none; -webkit-appearance: none;
      transition: border-color 0.2s;
    }
    .lang-select:hover { border-color: var(--c-line-2); }
    .lang-select option { background: var(--c-bg-2); color: var(--c-text); }

    /* ---------- document ---------- */
    .doc {
      position: relative; z-index: 1; flex: 1;
      width: min(100% - 2rem, 50rem); margin: 0 auto; padding: clamp(2.5rem, 7vw, 6rem) 0 clamp(4rem, 9vw, 8rem);
    }
    .doc__title {
      font-size: clamp(2.1rem, 6vw, 4.2rem); line-height: 1.05; font-weight: 900; letter-spacing: -0.035em;
      hyphens: auto; -webkit-hyphens: auto; overflow-wrap: break-word;
      background: linear-gradient(100deg, #fff 0%, #fff 55%, var(--c-accent) 100%);
      -webkit-background-clip: text; background-clip: text; color: transparent;
      text-wrap: balance;
    }
    .doc__title::before {
      content: ""; display: block; width: 0.85rem; height: 0.85rem; margin-bottom: 1.4rem; border-radius: 0.2rem;
      background: var(--c-orange); box-shadow: 0 0 1.4rem rgba(255, 107, 53, 0.6);
    }
    .doc__panel {
      margin-top: 2.5rem; padding: clamp(1.4rem, 4vw, 2.6rem); border-radius: var(--radius-lg);
      background: var(--c-glass); border: 1px solid var(--c-line);
      backdrop-filter: blur(1rem); -webkit-backdrop-filter: blur(1rem);
      box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.35);
    }
    .doc__intro { font-size: 1.15rem; color: var(--c-text-2); }
    .doc__heading {
      font-size: 1.25rem; line-height: 1.3; font-weight: 800; letter-spacing: -0.01em;
      hyphens: auto; -webkit-hyphens: auto; overflow-wrap: break-word;
    }
    .doc__heading:not(:first-child) { margin-top: 2.2rem; padding-top: 2.2rem; border-top: 1px solid var(--c-line); }
    .doc__text { margin-top: 0.7rem; color: var(--c-text-2); overflow-wrap: break-word; }
    .mail {
      color: var(--c-orange-l); font-weight: 600; text-decoration: underline;
      text-decoration-color: rgba(255, 138, 92, 0.45); text-underline-offset: 0.2em; overflow-wrap: anywhere;
    }
    .mail:hover { color: #fff; text-decoration-color: var(--c-orange); }

    /* ---------- support contacts ---------- */
    .contacts { display: grid; gap: 1rem; margin: 2rem 0 0; padding: 0; list-style: none; }
    .contact {
      position: relative; padding: 1.3rem 1.4rem 1.3rem 3.6rem; border-radius: var(--radius-md);
      background: rgba(255, 255, 255, 0.04); border: 1px solid var(--c-line);
      color: var(--c-text-2);
    }
    .contact::before {
      content: ""; position: absolute; left: 1.4rem; top: 1.6rem; width: 1.1rem; height: 1.1rem; border-radius: 0.25rem;
      background: var(--c-filled);
    }
    .contact:first-child::before { background: var(--c-orange); }
    .contact__label { display: block; color: var(--c-text); font-weight: 700; }

    /* ---------- footer ---------- */
    .footer {
      position: relative; z-index: 1;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem 2rem;
      padding: 1.6rem clamp(1rem, 3vw, 3rem); border-top: 1px solid var(--c-line);
      background: rgba(8, 8, 16, 0.75); backdrop-filter: blur(1rem); -webkit-backdrop-filter: blur(1rem);
      font-size: 0.95rem; color: var(--c-text-3);
    }
    .footer__links { display: flex; gap: 0.25rem; flex-wrap: wrap; }
    .footer__link {
      display: inline-flex; align-items: center; min-height: 2.75rem; padding: 0 0.9rem; border-radius: 0.6rem;
      text-decoration: none; color: var(--c-text-2);
    }
    .footer__link:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }

    @media (prefers-reduced-motion: no-preference) {
      .doc__title, .doc__panel { animation: rise 0.9s var(--ease-out) backwards; }
      .doc__panel { animation-delay: 0.12s; }
      @keyframes rise { from { opacity: 0; transform: translateY(1.5rem); } }
    }
    @media (max-width: 760px) {
      .nav { gap: 0.5rem 0.75rem; }
      .nav__brand { order: 1; font-size: 1.05rem; }
      .lang-select { order: 2; max-width: 9rem; padding-left: 0.85rem; text-overflow: ellipsis; }
      .nav__menu { order: 3; flex: 1 0 100%; margin: 0 -0.5rem; }
      .nav__links { flex-wrap: wrap; }
      .nav__link { padding: 0 0.75rem; }
      .footer { justify-content: center; text-align: center; }
      .footer__links { justify-content: center; }
    }`;

function navAndSwitcher(t, lang, activeNav) {
  const base = baseOf(lang);
  const link = (nav, file, label) =>
    `          <li><a class="nav__link${nav === activeNav ? " nav__link--active" : ""}" href="${base}${file}" data-nav="${nav}"${
      nav === activeNav ? ' aria-current="page"' : ""
    }>${esc(label)}</a></li>`;
  const options = LANGS.map((l) => {
    const ob = baseOf(l);
    return `        <option value="${ob}"${ob === base ? " selected" : ""}>${esc(l.name)}</option>`;
  }).join("\n");
  const c = t.common;
  return `    <header class="nav">
      <a href="${base}" class="nav__brand" data-nav="home">
        <img class="nav__logo" src="/app-icon-128.png" width="128" height="128" alt="" />
        <span>Grid Collection</span>
      </a>
      <nav class="nav__menu">
        <ul class="nav__links">
${link("home", "", c.navHome)}
${link("support", "support.html", c.navSupport)}
${link("privacy", "privacy-policy.html", c.navPrivacy)}
${link("terms", "terms-of-service.html", c.navTerms)}
        </ul>
      </nav>
      <select
        class="lang-select"
        aria-label="${escAttr(c.langLabel)}"
        onchange="if(this.value)location.href=this.value"
      >
${options}
      </select>
    </header>`;
}

function footer(t, lang) {
  const base = baseOf(lang);
  const c = t.common;
  return `    <footer class="footer">
      <p>${esc(c.footer)}</p>
      <div class="footer__links">
        <a class="footer__link" href="${base}support.html" data-nav="support">${esc(c.navSupport)}</a>
        <a class="footer__link" href="${base}privacy-policy.html" data-nav="privacy">${esc(c.navPrivacy)}</a>
        <a class="footer__link" href="${base}terms-of-service.html" data-nav="terms">${esc(c.navTerms)}</a>
      </div>
    </footer>`;
}

function contentSupport(p) {
  const items = p.items
    .map(
      (it) =>
        `          <li class="contact">\n            <strong class="contact__label">${esc(it.label)}</strong> ${esc(it.text)}\n            ${mailto(it.email)}\n          </li>`,
    )
    .join("\n");
  return `    <main class="doc">
      <h1 class="doc__title">${esc(p.h1)}</h1>

      <div class="doc__panel">
        <p class="doc__intro">${esc(p.intro)}</p>

        <ul class="contacts">
${items}
        </ul>
      </div>
    </main>`;
}

function contentSections(p) {
  const body = p.sections
    .map(
      (sec) =>
        `        <h2 class="doc__heading">${esc(sec.h)}</h2>\n        <p class="doc__text">${para(sec)}</p>`,
    )
    .join("\n\n");
  return `    <main class="doc">
      <h1 class="doc__title">${esc(p.h1)}</h1>

      <div class="doc__panel">
${body}
      </div>
    </main>`;
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
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#0b0b16" />
    <title>${escAttr(p.title)}</title>
    <link rel="canonical" href="https://grid-collection.com${base}${page.slug}" />
${hreflangAlternates(page)}
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
    <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
    <link rel="icon" href="/favicon-192x192.png" type="image/png" sizes="192x192" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <style>${CSS}
    </style>
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
    <div class="field" aria-hidden="true"></div>
    <div class="glow" aria-hidden="true"></div>
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
