// Builds every page of grid-collection.com in both languages from one source:
//
//   _src/<page>.html      templates (home + support / privacy / terms + 404)
//   _src/i18n/*.json      the dictionaries: { "en": {…}, "tr": {…} } per page,
//                         common.json for the strings every page shares
//
// English is the root (/), Turkish lives under /tr/. Output:
//   /index.html  /support.html  /privacy-policy.html  /terms-of-service.html
//   /tr/index.html  /tr/support.html  /tr/privacy-policy.html  /tr/terms-of-service.html
//   /404.html (both languages on one page)  /sitemap.xml
//
//   node tools/build-langs.mjs           (or: cd tools && pnpm build)
//
// Template slots
//   {{key}}            text from the page / common dictionary, HTML-escaped
//   {{html:key}}       the same, unescaped (the value carries markup)
//   {{en:key}} {{tr:key}}  a fixed language (404 page)
//   {{@lang}}          "en" | "tr"            {{@locale}}  "en-US" | "tr-TR"
//   {{@head}}          title, description, canonical, hreflang, icons, manifest,
//                      smart banner, Open Graph, Twitter card, JSON-LD (home),
//                      analytics module
//   {{@href:<page>}}   that page in the current language (home, support, privacy, terms)
//   {{@store:<place>}} App Store campaign link, ct=web_<place>
//   {{@langswitch}}    TR / EN links to this page in the other language
//   {{@footer}}        site footer (legal links + cookie preferences)
//   {{@consent}}       the consent banner (assets/analytics.js drives it)
//   {{@text}}          the page dictionary of the current language as JSON (home JS)
//
// No automatic redirect by browser language: Google must be able to crawl /tr/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "_src");
const ORIGIN = "https://grid-collection.com";
const LANGS = /** @type {const} */ (["en", "tr"]);
const LOCALE = { en: "en-US", tr: "tr-TR" };
const OG_LOCALE = { en: "en_US", tr: "tr_TR" };
const LANG_NAME = { en: "English", tr: "Türkçe" };

const { APP_STORE_ID, APP_STORE_PROVIDER_TOKEN } = await import(
  pathToFileURL(join(root, "assets", "analytics-config.js")).href
);
const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
/** App languages (App Store listing) — JSON-LD inLanguage. */
const APP_LANGUAGES = ["en", "tr", "de", "es", "fr", "hi", "id", "it", "ja", "ko", "pl", "pt-BR", "ru", "vi", "zh-Hans", "zh-Hant"];
/**
 * Real App Store rating for JSON-LD aggregateRating, or null to leave it out.
 * Never invent one. On 2026-10-22 the app had 3 ratings (TR store only).
 * @type {{ ratingValue: number, ratingCount: number } | null}
 */
const APP_RATING = null;

/** @typedef {"en" | "tr"} Lang */
/** @typedef {{ id: string, file: string, dict: string, legal?: string, priority: string, changefreq: string }} Page */
/** @type {Page[]} */
const PAGES = [
  { id: "home", file: "index.html", dict: "home", priority: "1.0", changefreq: "weekly" },
  { id: "support", file: "support.html", dict: "support", legal: "support", priority: "0.6", changefreq: "monthly" },
  { id: "privacy", file: "privacy-policy.html", dict: "privacy", legal: "privacy", priority: "0.3", changefreq: "yearly" },
  { id: "terms", file: "terms-of-service.html", dict: "terms", legal: "terms", priority: "0.3", changefreq: "yearly" },
];
const byId = Object.fromEntries(PAGES.map((p) => [p.id, p]));

/** Site path of a page in a language. @param {string} id @param {Lang} lang */
function path(id, lang) {
  const file = byId[id].file === "index.html" ? "" : byId[id].file;
  return lang === "en" ? `/${file}` : `/tr/${file}`;
}
/** Output file of a page in a language. @param {Page} page @param {Lang} lang */
const outFile = (page, lang) => join(root, lang === "en" ? "" : "tr", page.file);

/** @param {string} name @returns {Record<Lang, Record<string, string>>} */
const loadDict = (name) => JSON.parse(readFileSync(join(SRC, "i18n", `${name}.json`), "utf8"));
const common = loadDict("common");

/** @param {string} s */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** App Store campaign link for a button. @param {string} place */
function storeLink(place) {
  const q = new URLSearchParams();
  if (APP_STORE_PROVIDER_TOKEN) q.set("pt", APP_STORE_PROVIDER_TOKEN);
  q.set("ct", `web_${place}`);
  q.set("mt", "8");
  return `https://apps.apple.com/app/apple-store/id${APP_STORE_ID}?${q}`;
}

/** @param {Lang} lang */
const ogImage = (lang) => `${ORIGIN}/${lang === "en" ? "og-image.png" : "og-image-tr.png"}`;

/** @param {Page} page @param {Lang} lang @param {(k: string) => string} t */
function head(page, lang, t) {
  const url = ORIGIN + path(page.id, lang);
  const title = t("meta.title");
  const desc = t("meta.desc");
  const alt = t("og.alt");
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" hreflang="en" href="${ORIGIN + path(page.id, "en")}" />`,
    `<link rel="alternate" hreflang="tr" href="${ORIGIN + path(page.id, "tr")}" />`,
    `<link rel="alternate" hreflang="x-default" href="${ORIGIN + path(page.id, "en")}" />`,
    ...ICONS,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Grid Collection" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    `<meta property="og:locale:alternate" content="${OG_LOCALE[lang === "en" ? "tr" : "en"]}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:image" content="${ogImage(lang)}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${ogImage(lang)}" />`,
    `<meta name="twitter:image:alt" content="${esc(alt)}" />`,
  ];
  if (page.id === "home") lines.push(`<script type="application/ld+json">${jsonLd(lang, url, desc)}</script>`);
  lines.push(`<script type="module" src="/assets/analytics.js"></script>`);
  return lines.map((l) => `  ${l}`).join("\n");
}

const ICONS = [
  `<meta name="color-scheme" content="dark" />`,
  `<meta name="theme-color" content="#0b0b16" />`,
  `<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />`,
  `<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />`,
  `<link rel="icon" href="/favicon-192x192.png" type="image/png" sizes="192x192" />`,
  `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
  `<link rel="manifest" href="/site.webmanifest" />`,
  `<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}" />`,
];

/** @param {Lang} lang @param {string} url @param {string} desc */
function jsonLd(lang, url, desc) {
  /** @type {Record<string, unknown>} */
  const data = {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: "Grid Collection",
    description: desc,
    url,
    image: ogImage(lang),
    operatingSystem: "iOS",
    applicationCategory: "GameApplication",
    genre: ["Puzzle", "Logic"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock", url: APP_STORE_URL },
    installUrl: APP_STORE_URL,
    sameAs: [APP_STORE_URL],
    screenshot: ["home", "gameplay-7x7", "stages"].map((s) => `${ORIGIN}/assets/screens/${lang}-${s}.webp`),
    inLanguage: APP_LANGUAGES,
    publisher: { "@type": "Person", name: "Kerem Özben", url: "https://apps.apple.com/developer/kerem-ozben/id1889505570" },
  };
  if (APP_RATING) data.aggregateRating = { "@type": "AggregateRating", bestRating: 5, worstRating: 1, ...APP_RATING };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** @param {Page} page @param {Lang} lang */
function langSwitch(page, lang) {
  const links = LANGS.slice()
    .reverse()
    .map((l) => {
      const current = l === lang;
      const track = current ? "" : ` data-track="lang_switch" data-track-from="${lang}" data-track-to="${l}"`;
      return `<a class="seg__btn" href="${path(page.id, l)}" hreflang="${l}" lang="${l}" aria-label="${LANG_NAME[l]}"${current ? ' aria-current="page"' : ""} data-lang="${l}"${track}>${l.toUpperCase()}</a>`;
    });
  return `<div class="seg" role="group" aria-label="{{a11y.lang}}">${links.join("")}</div>`;
}

const FOOTER = `<footer class="footer">
    <p class="footer__rights">{{footer.rights}}</p>
    <nav class="footer__links" aria-label="{{a11y.footer}}">
      <a class="footer__link" href="{{@href:support}}" data-page="support">{{nav.support}}</a>
      <a class="footer__link" href="{{@href:privacy}}" data-page="privacy">{{nav.privacy}}</a>
      <a class="footer__link" href="{{@href:terms}}" data-page="terms">{{nav.terms}}</a>
      <button class="footer__link footer__link--button" type="button" data-consent-open>{{consent.prefs}}</button>
    </nav>
  </footer>`;

const CONSENT = `<section class="consent" data-consent role="region" aria-labelledby="consent-title" hidden>
    <style>
      .consent {
        position: fixed; z-index: 95; right: 1.25rem; bottom: 1.25rem; width: min(26rem, calc(100% - 2.5rem));
        padding: 1.2rem 1.3rem; border-radius: 1.1rem; color: #fff; font-size: 0.95rem; line-height: 1.5;
        background: rgba(16, 16, 32, 0.94); border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.55); backdrop-filter: blur(1rem); -webkit-backdrop-filter: blur(1rem);
      }
      .consent[hidden] { display: none; }
      .consent__title { margin: 0; display: flex; align-items: center; gap: 0.6rem; font-weight: 800; font-size: 1.05rem; }
      .consent__title::before { content: ""; width: 0.7rem; height: 0.7rem; border-radius: 0.18rem; background: #ff6b35; box-shadow: 0 0 1rem rgba(255, 107, 53, 0.6); }
      .consent__text { margin: 0.5rem 0 0; color: rgba(255, 255, 255, 0.78); }
      .consent__text a { color: #ff8a5c; text-underline-offset: 0.2em; }
      .consent__actions { margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
      .consent__btn {
        min-height: 2.9rem; padding: 0 1rem; border-radius: 0.8rem; cursor: pointer;
        font: inherit; font-weight: 700; color: #fff;
        background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.3);
        transition: background 0.2s, border-color 0.2s;
      }
      .consent__btn:hover { background: rgba(255, 107, 53, 0.22); border-color: #ff6b35; }
      .consent__btn:focus-visible { outline: 0.15rem solid #f7c59f; outline-offset: 0.2rem; }
      @media (max-width: 600px) { .consent { right: 0.75rem; bottom: 0.75rem; width: calc(100% - 1.5rem); font-size: 15px; } }
    </style>
    <p class="consent__title" id="consent-title">{{consent.title}}</p>
    <p class="consent__text">{{consent.text}} <a href="{{@href:privacy}}#website">{{consent.more}}</a></p>
    <div class="consent__actions">
      <button class="consent__btn" type="button" data-consent-choice="denied">{{consent.reject}}</button>
      <button class="consent__btn" type="button" data-consent-choice="granted">{{consent.accept}}</button>
    </div>
  </section>`;

/**
 * Fill a template for one language.
 * @param {string} html @param {Page | null} page @param {Lang} lang @param {Record<Lang, Record<string, string>>} dict
 */
function render(html, page, lang, dict) {
  /** @param {Lang} l @param {string} k */
  const look = (l, k) => {
    const v = dict[l]?.[k] ?? common[l][k];
    if (v == null) throw new Error(`${page?.file ?? "404.html"}: missing ${l} text "${k}"`);
    return v;
  };
  /** @param {string} k */
  const t = (k) => look(lang, k);
  if (page) {
    html = html
      .replace("{{@head}}", head(page, lang, t))
      .replace("{{@langswitch}}", langSwitch(page, lang))
      .replace("{{@text}}", JSON.stringify(dict[lang], null, 2).replace(/\n/g, "\n    "));
  }
  html = html.replace("{{@footer}}", FOOTER).replace("{{@consent}}", CONSENT);
  html = html.replace(/\{\{@lang\}\}/g, lang).replace(/\{\{@locale\}\}/g, LOCALE[lang]);
  html = html.replace(/\{\{@href:(\w+)\}\}/g, (_, id) => {
    if (!byId[id]) throw new Error(`unknown page "${id}"`);
    return path(id, lang);
  });
  html = html.replace(/\{\{@store:(\w+)\}\}/g, (_, place) => storeLink(place).replace(/&/g, "&amp;"));
  html = html.replace(/\{\{(en|tr):([\w.-]+)\}\}/g, (_, l, k) => esc(look(l, k)));
  html = html.replace(/\{\{html:([\w.-]+)\}\}/g, (_, k) => t(k));
  html = html.replace(/\{\{([\w.-]+)\}\}/g, (_, k) => esc(t(k)));
  // the current page's links: highlighted, aria-current
  if (page) {
    html = html.replace(/<a class="(nav__link|footer__link)" ([^>]*)data-page="(\w+)"/g, (m, cls, rest, id) =>
      id === page.id ? `<a class="${cls} ${cls}--active" ${rest}aria-current="page" data-page="${id}"` : m,
    );
  }
  const left = html.match(/\{\{[@\w:.-]+\}\}/);
  if (left) throw new Error(`${page?.file ?? "404.html"} (${lang}): unresolved slot ${left[0]}`);
  return html;
}

/** Previous lastmod per URL, so unchanged pages keep their date. */
const sitemapPath = join(root, "sitemap.xml");
/** @type {Record<string, string>} */
const oldLastmod = {};
if (existsSync(sitemapPath)) {
  for (const m of readFileSync(sitemapPath, "utf8").matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) oldLastmod[m[1]] = m[2];
}
const today = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, local time

const urls = [];
for (const page of PAGES) {
  const tpl = readFileSync(join(SRC, page.file), "utf8").replace(/\r\n/g, "\n");
  const dict = loadDict(page.dict);
  for (const lang of LANGS) {
    const out = outFile(page, lang);
    const html = render(tpl, page, lang, dict);
    const before = existsSync(out) ? readFileSync(out, "utf8").replace(/\r\n/g, "\n") : "";
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    const loc = ORIGIN + path(page.id, lang);
    urls.push({ loc, lastmod: before === html && oldLastmod[loc] ? oldLastmod[loc] : today, page });
    console.log(`${(lang === "en" ? "" : "tr/") + page.file}  ${(html.length / 1024).toFixed(0)} KB`);
  }
}

// 404: GitHub Pages serves it for any missing path → root-absolute URLs, both languages.
{
  const tpl = readFileSync(join(SRC, "404.html"), "utf8").replace(/\r\n/g, "\n");
  const html = render(tpl.replace("{{@icons}}", ICONS.map((l) => `  ${l}`).join("\n")), null, "en", { en: {}, tr: {} });
  writeFileSync(join(root, "404.html"), html);
  console.log("404.html");
}

const sitemap = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
  ...urls.map(
    ({ loc, lastmod, page }) =>
      `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority>` +
      LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${ORIGIN + path(page.id, l)}"/>`).join("") +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN + path(page.id, "en")}"/></url>`,
  ),
  `</urlset>`,
  ``,
].join("\n");
writeFileSync(sitemapPath, sitemap);
console.log(`sitemap.xml  ${urls.length} URLs`);
