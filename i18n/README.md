# Multilingual landing pages

The site ships a localized landing page per supported language, generated as
**static HTML** (GitHub Pages friendly — no framework, no client-side routing).

## How it works

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

## Regenerate after any change

```bash
node build-i18n.mjs
```

Then commit the generated `/<lang>/index.html` files. Output should say
"No warnings — all strings matched." If a warning appears, the English source
text for that key changed — update `i18n/en.json` to match and rebuild.

## Adding/Editing a string

1. Add the key + English text to `i18n/en.json`.
2. Add a matching replacement rule in `build-i18n.mjs` (`localize()`).
3. Add the translation to each `i18n/<code>.json`.
4. `node build-i18n.mjs`.

## Notes

- Legal pages (privacy/terms/support) are served in English at the root; the app
  itself carries the fully localized legal text. Localizing those HTML pages too
  is a possible follow-up (the translations already exist in the app locales).
