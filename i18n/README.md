# Multilingual site

The site ships a localized **landing page** *and* localized **legal pages**
(support / privacy / terms) per supported language, generated as **static HTML**
(GitHub Pages friendly — no framework, no client-side routing).

## Shared assets

- Every page uses the v2 design (dark game theme, system fonts). CSS is inlined
  into each page; there is no shared stylesheet and no Google Fonts.
- `lang.js` (repo root) remembers the visitor's language choice in
  `localStorage` and rewrites in-page navigation links (`data-nav` = home /
  support / privacy / terms) so the selection persists across pages ("remember +
  rewrite links" — no surprise auto-redirects).
- `v2.html` only redirects to `/` (the v2 preview became the homepage).

## Landing page

- `i18n/home/_template.html` is the page itself: markup, CSS and the game
  scripts, with `{{slot}}` placeholders. Edit design and behaviour here. (The
  leading underscore keeps it out of the published GitHub Pages site.)
- `i18n/home/en.json` is the **English source of truth** for the copy;
  `i18n/home/<code>.json` holds each translation (15 locales, same keys).
  Terms follow the game's own translations (level, stage, coins, helper tools…).
- Footer link labels and the switcher's aria-label come from the `common` block
  of `i18n/legal/<code>.json`, so the homepage and legal pages use the same words.
- `build-home.mjs` (zero-dependency) writes `/index.html` and
  `/<path>/index.html`, rendering per language: `<html lang>`, title / meta /
  OG / Twitter, canonical + `hreflang` alternates, every `data-i18n` text and
  `data-i18n-aria` label, numbers in the locale's format, the language
  `<select>`, root-absolute legal links, and the strings the scripts need.
- `sitemap.xml` lists all locale homepages.

Missing keys fall back to English and are reported as warnings.

## Languages

en (root) · tr · de · es · fr · it · pt-BR · pl · id · vi · ru · hi · zh-Hans ·
zh-Hant · ja · ko — folder paths are lowercased (`/pt-br/`, `/zh-hans/`).

## Legal pages

- `i18n/legal/en.json` is the **source of truth** for the support, privacy, and
  terms pages; `i18n/legal/<code>.json` holds each translation (15 locales).
- `build-legal.mjs` (zero-dependency) renders **all** legal pages from those
  JSON files — both the English versions at the repo root (`support.html`,
  `privacy-policy.html`, `terms-of-service.html`) and the localized
  `/<path>/<page>.html`. Each page carries the language `<select>` switcher,
  canonical + hreflang tags, and links `lang.js`.
- Missing keys fall back to English (deep-merged).

## Regenerate after any change

```bash
node build-home.mjs    # landing pages  → /<lang>/index.html
node build-legal.mjs   # legal pages    → /<lang>/{support,privacy-policy,terms-of-service}.html
```

Then commit the generated files. `build-home.mjs` should say "No warnings —
every locale has every key". `build-legal.mjs` only warns when a
`legal/<code>.json` is missing (that locale falls back to English).

## Adding/Editing a string

1. Add the key + English text to `i18n/home/en.json`.
2. Use it in `_template.html`: `data-i18n="key"` on an element with plain text,
   `data-i18n-aria="key"` next to an `aria-label`, or `t("key")` in a script.
3. Add the translation to each `i18n/home/<code>.json`.
4. `node build-home.mjs`.
