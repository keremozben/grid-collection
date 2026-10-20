# Brand assets

Sources for the website's image assets.

## Logo and favicons — from the app icon

`app-icon-512.png` is a copy of the app's store icon
(`H:\grid-collection\assets\play-store-icon-512.png`). Every logo and favicon on
the site is derived from it:

```bash
npm i -D sharp   # once
node brand-assets/app-icon.mjs
```

| Site root file          | Size           | Used by                                              |
| ----------------------- | -------------- | ---------------------------------------------------- |
| `app-icon-128.png`      | 128 × 128      | Header logo (`.nav__logo`, rounded in CSS) on every page |
| `favicon.ico`           | 16 / 32 / 48   | `<link rel="icon">` + browsers' default `/favicon.ico` |
| `favicon-32x32.png`     | 32 × 32        | `<link rel="icon" sizes="32x32">` (browser tab)      |
| `favicon-192x192.png`   | 192 × 192      | `<link rel="icon" sizes="192x192">` (Android, Google — a multiple of 48) |
| `apple-touch-icon.png`  | 180 × 180      | iOS home-screen / Safari pinned icon                 |

The `<link>` tags live in `i18n/home/_template.html` and `build-legal.mjs`;
rebuild the pages after changing them. If the app icon changes, replace
`app-icon-512.png` and rerun the script.

iOS rounds the `apple-touch-icon` corners itself — the source is full-bleed on
purpose; don't pre-round it.

## Share image (HTML → PNG)

`og-image.html` is the Open Graph / Twitter share preview, in the in-app dark
theme (filled cell = blue `#004E89`, current cell = orange `#FF6B35`), captured
at 1200 × 630.

```bash
npx playwright install chromium   # once
node brand-assets/capture.mjs
```

`capture.mjs` renders at `deviceScaleFactor: 2`, so its raw output is twice the
capture size. The `og-image.png` committed to the site root is **downscaled to
1200 × 630** (matches the `og:image:width/height` the pages declare) and kept in
`optimized/` as well. Manual alternative: open the HTML, set the viewport to
1200 × 630, screenshot, and save it as `og-image.png` in the site root.

`optimized/og-image.jpg` (1200 × 630, ~104 KB) is an unused alternative: the dark
gradients compress poorly as PNG, so JPEG is ~4x smaller with no visible banding.
Switching to it means updating the `og:image`, `twitter:image` and JSON-LD
`image` references.

## Notes

- No connecting "path" is drawn — the game has none. The board shows only the
  four real cell types: **filled** (placed number, blue), **current** (last move,
  orange), **possible move** (orange highlight) and **passive** (dark), over the
  **active** cells.
- `og-image` is the real solvable 5×5 Level 1 shown mid-solve (6 moves placed).
