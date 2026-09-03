# Brand assets (HTML → PNG)

HTML/CSS sources for the website's image assets, in the in-app dark theme
(filled cell = blue `#004E89`, current cell = orange `#FF6B35`).

| Source HTML             | Capture size | Export to (site root)    | Used by                                  |
| ----------------------- | ------------ | ------------------------ | ---------------------------------------- |
| `og-image.html`         | 1200 × 630   | `og-image.png`           | Open Graph / Twitter share preview       |
| `favicon.html`          | 512 × 512    | `favicon.png`            | `<link rel="icon">` (browser tab)        |
| `apple-touch-icon.html` | 180 × 180    | `apple-touch-icon.png`   | iOS home-screen / Safari pinned icon     |

## Option A — automatic (recommended)

```bash
npx playwright install chromium   # once
node brand-assets/capture.mjs
```

Writes all three PNGs (at 2× / retina) straight into the site root, where
`index.html` already references them.

## Option B — manual screenshot

Open each HTML, set the browser viewport to the exact capture size, screenshot,
and save with the export name into the site root.

## Shipped sizes (what is actually in the site root)

`capture.mjs` renders at `deviceScaleFactor: 2`, so its raw output is twice the
capture size. The files committed to the site root are **downscaled to spec**
instead, and kept in `optimized/` as well:

| Site root file          | Shipped size | Why that size                                        |
| ----------------------- | ------------ | ---------------------------------------------------- |
| `og-image.png`          | 1200 × 630   | matches `og:image:width/height` declared in index.html |
| `favicon.png`           | 192 × 192    | Google requires a square favicon, a multiple of 48    |
| `apple-touch-icon.png`  | 180 × 180    | Apple's standard `apple-touch-icon` size              |

`optimized/og-image.jpg` (1200 × 630, ~104 KB) is an unused alternative: the dark
gradients compress poorly as PNG, so JPEG is ~4x smaller with no visible banding.
Switching to it means updating three references in `index.html` — `og:image`,
`twitter:image`, and the JSON-LD `image` field.

## Notes

- No connecting "path" is drawn — the game has none. Each board shows only the
  four real cell types: **filled** (placed number, blue), **current** (last move,
  orange), **possible move** (orange highlight) and **passive** (dark), over the
  **active** cells.
- `og-image` is the real solvable 5×5 Level 1 shown mid-solve (6 moves placed).
- The icons use a 5×5 grid with a real rule-compliant 3-move sequence and
  numbered cells, like the og-image.
- iOS rounds the `apple-touch-icon` corners itself — the source is full-bleed on
  purpose; don't pre-round it.
