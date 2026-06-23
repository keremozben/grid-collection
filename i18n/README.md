# Multilingual site

The site ships a localized **landing page** *and* localized **legal pages**
(support / privacy / terms) per supported language, generated as **static HTML**
(GitHub Pages friendly — no framework, no client-side routing).

## Shared assets

- `styles.css` (repo root) is the **single stylesheet** for every page — the
  landing page, its 15 localized copies, and all legal pages. There is no inline
  CSS anywhere. Language-specific rules (CJK / Devanagari font stacks) live at
  the bottom, applied via the `html[lang="…"]` attribute.
- `lang.js` (repo root) remembers the visitor's language choice in
  `localStorage` and rewrites in-page navigation links so the selection persists
  across pages ("remember + rewrite links" — no surprise auto-redirects).

## Landing page

- `index.html` (repo root) is the **English source of truth** — edit content here.
- `i18n/en.json` holds the English values of every translatable string.
- `i18n/<code>.json` holds each translation (15 locales).
- `build-i18n.mjs` (zero-dependency) reads `index.html` + each locale JSON and
  writes `/<path>/index.html` for every language, handling:
  - text replacement (whitespace-flexible, so source line-wrapping is irrelevant),
  - `<html lang>`, `<link rel="canonical">`, `og:url`,
  - the language `<select>` switcher (marks the current language),
  - root-absolute asset/link paths (`/app-store.png`, `/support.html`, …),
  - an injected translated `window.DEMO_T` so the playable demo speaks the page
    language.
- `hreflang` alternates are declared in `index.html` `<head>` and copied to every
  page. `sitemap.xml` lists all locale homepages.

Missing translation keys fall back to English and are reported as warnings.

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
- The `common` block in each `legal/<code>.json` reuses the nav/footer wording
  from the matching `i18n/<code>.json` so the site stays consistent.
- Missing keys fall back to English (deep-merged).

## Regenerate after any change

```bash
node build-i18n.mjs    # landing pages  → /<lang>/index.html
node build-legal.mjs   # legal pages    → /<lang>/{support,privacy-policy,terms-of-service}.html
```

Then commit the generated files. `build-i18n.mjs` should say "No warnings — all
strings matched"; if a warning appears, the English source text for that key
changed — update `i18n/en.json` to match and rebuild. `build-legal.mjs` only
warns when a `legal/<code>.json` is missing (that locale falls back to English).

## Adding/Editing a string

1. Add the key + English text to `i18n/en.json`.
2. Add a matching replacement rule in `build-i18n.mjs` (`localize()`).
3. Add the translation to each `i18n/<code>.json`.
4. `node build-i18n.mjs`.

## Notes

- Legal pages (privacy/terms/support) are now fully localized — English at the
  root and per-language under `/<path>/`. Edit `i18n/legal/en.json` for content
  changes and the per-locale files for translations, then run `build-legal.mjs`.
