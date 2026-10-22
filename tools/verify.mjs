// Site check (Playwright + Chromium). Serves the repo like GitHub Pages
// (tools/serve.mjs) and checks:
//   seo      every page's static HTML: lang, title, description, canonical, hreflang,
//            Open Graph / Twitter, icons, manifest, smart banner, JSON-LD, 404, sitemap,
//            page weight, no data: URIs; and the same pages with JavaScript off
//   mobile   360 / 390 / 414 / 768 px: no horizontal overflow on any page, hero
//            buttons and stats fully on screen, touch play (Play board + Scale columns)
//   desktop  1920×1080, 3840×2160, 1366×768: every section of the home page works as
//            before (wordmark, rule board, play a real level, tools, journey, scale
//            spiral / number / columns with a real level solved in the popover)
//   consent  no request to Google and no _ga cookie before consent; banner in both
//            languages with equal buttons; accept loads gtag; withdrawing deletes cookies
//   events   every event of the analytics plan, read back from window.dataLayer
//            (gtag.js is stubbed, nothing reaches Google)
// Screenshots: screenshots/verify/<group>/ (gitignored).
//
//   cd tools && pnpm install          (once)
//   node tools/verify.mjs [--only=seo,mobile,desktop,consent,events] [--headed]
//
// The Scale section's popover is solved with the level's real solution, read in
// Node from the app repo (the site never publishes solutions):
//   --levels=H:\grid-collection\public\levels   (default; skipped if missing)
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serve } from "./serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const ONLY = (arg("only") || "seo,mobile,desktop,consent,events").split(",");
const LEVELS = arg("levels") || "H:/grid-collection/public/levels";
const PORT = 8137;
const BASE = `http://localhost:${PORT}`;
const ORIGIN = "https://grid-collection.com";
const SHOTS = join(root, "screenshots", "verify");

const PAGES = [
  { id: "home", en: "/", tr: "/tr/", file: "index.html" },
  { id: "support", en: "/support.html", tr: "/tr/support.html", file: "support.html" },
  { id: "privacy", en: "/privacy-policy.html", tr: "/tr/privacy-policy.html", file: "privacy-policy.html" },
  { id: "terms", en: "/terms-of-service.html", tr: "/tr/terms-of-service.html", file: "terms-of-service.html" },
];
const ALL_URLS = PAGES.flatMap((p) => [p.en, p.tr]);

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "  ✓" : "  ✗"} ${msg}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Real solution of a level by its global index (game order), from the app repo. */
function solutionOf(index) {
  const META = JSON.parse(readFileSync(join(LEVELS, "levels-meta.json"), "utf8")).grids;
  const DR = [-3, 3, 0, 0, -2, -2, 2, 2];
  const DC = [0, 0, -3, 3, -2, 2, -2, 2];
  let i = index;
  for (const grid of Object.keys(META)) {
    const cols = Number(grid.split("x")[1]);
    for (const st of Object.keys(META[grid]).map(Number).sort((a, b) => a - b)) {
      if (i < META[grid][st]) {
        const lv = JSON.parse(readFileSync(join(LEVELS, grid, `${st}.json`), "utf8"))[i];
        let cell = parseInt(lv.solution.slice(0, 2), 36);
        const out = [cell];
        for (const ch of lv.solution.slice(2)) out.push((cell += DR[+ch] * cols + DC[+ch]));
        return out;
      }
      i -= META[grid][st];
    }
  }
  return [];
}

/** gtag.js stand-in: like the real one it sets the _ga cookies; nothing leaves the machine. */
const GTAG_STUB = `document.cookie = "_ga=GA1.1.123.456; path=/"; document.cookie = "_ga_EHP1CQ1RV4=GS1.1.789; path=/"; window.__gtagStub = (window.__gtagStub || 0) + 1;`;

/** Context with Google stubbed; records every request that would have left for Google. */
async function newContext(browser, opts = {}, { consent = null, lang = null } = {}) {
  const ctx = await browser.newContext(opts);
  const google = [];
  await ctx.route(/googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net/, (route) => {
    google.push(route.request().url());
    if (route.request().url().includes("/gtag/js")) return route.fulfill({ contentType: "text/javascript", body: GTAG_STUB });
    return route.fulfill({ status: 204, body: "" });
  });
  await ctx.addInitScript(
    ([consent, lang]) => {
      if (sessionStorage.getItem("__init")) return;
      sessionStorage.setItem("__init", "1");
      if (consent) localStorage.setItem("grid-site:consent", consent);
      if (lang) localStorage.setItem("grid-site:v1", JSON.stringify({ lang, sound: true }));
    },
    [consent, lang],
  );
  return { ctx, google };
}

const watchErrors = (page) => {
  const errors = [];
  // the 404 page itself answers 404 on purpose
  page.on("console", (m) => m.type() === "error" && !m.location().url.includes("/no-such-page") && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
};

const server = await serve(PORT);
const browser = await chromium.launch({
  headless: !args.includes("--headed"),
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});

/* =====================================================================
   SEO — static HTML of every page
   ===================================================================== */
if (ONLY.includes("seo")) {
  console.log("\n== SEO / static HTML");
  const get = async (u) => {
    const r = await fetch(BASE + u);
    return { status: r.status, text: await r.text() };
  };
  const attr = (html, re) => html.match(re)?.[1] ?? null;
  const meta = (html, key) => attr(html, new RegExp(`<meta (?:name|property)="${key.replace(/[:]/g, "\\:")}" content="([^"]*)"`));
  const urlOf = (p, lang) => ORIGIN + p[lang];
  for (const p of PAGES) {
    for (const lang of ["en", "tr"]) {
      const u = p[lang];
      const { status, text: h } = await get(u);
      const other = lang === "en" ? "tr" : "en";
      const problems = [];
      if (status !== 200) problems.push(`HTTP ${status}`);
      if (attr(h, /<html lang="([^"]+)"/) !== lang) problems.push("html lang");
      const title = attr(h, /<title>([^<]+)<\/title>/) || "";
      const desc = meta(h, "description") || "";
      if (!title || title.length > 65) problems.push(`title "${title}" (${title.length})`);
      if (desc.length < 50 || desc.length > 170) problems.push(`description ${desc.length} chars`);
      if (attr(h, /<link rel="canonical" href="([^"]+)"/) !== urlOf(p, lang)) problems.push("canonical");
      for (const l of ["en", "tr"]) if (attr(h, new RegExp(`hreflang="${l}" href="([^"]+)"`)) !== urlOf(p, l)) problems.push(`hreflang ${l}`);
      if (attr(h, /hreflang="x-default" href="([^"]+)"/) !== urlOf(p, "en")) problems.push("x-default");
      if (meta(h, "og:url") !== urlOf(p, lang)) problems.push("og:url");
      if (meta(h, "og:locale") !== (lang === "en" ? "en_US" : "tr_TR")) problems.push("og:locale");
      if (meta(h, "og:locale:alternate") !== (other === "en" ? "en_US" : "tr_TR")) problems.push("og:locale:alternate");
      const img = meta(h, "og:image");
      if (img !== `${ORIGIN}/${lang === "en" ? "og-image.png" : "og-image-tr.png"}`) problems.push(`og:image ${img}`);
      for (const k of ["og:title", "og:description", "og:type", "og:site_name", "og:image:alt", "og:image:type", "og:image:width", "og:image:height", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"])
        if (!meta(h, k)) problems.push(k);
      if (meta(h, "apple-itunes-app") !== "app-id=6761419296") problems.push("apple-itunes-app");
      for (const icon of ['href="/favicon.ico"', 'href="/favicon-32x32.png"', 'href="/favicon-192x192.png"', 'rel="apple-touch-icon" href="/apple-touch-icon.png"', 'rel="manifest" href="/site.webmanifest"'])
        if (!h.includes(icon)) problems.push(icon);
      if (/(src|href)="data:/.test(h)) problems.push("data: URI");
      if (/\{\{[@\w:.-]+\}\}/.test(h)) problems.push("unfilled template slot");
      if (h.includes("googletagmanager.com/gtag/js")) problems.push("gtag.js referenced statically");
      if (!h.includes('src="/assets/analytics.js"')) problems.push("analytics module missing");
      // switch links go to the same page in the other language; internal links stay in this language
      if (!h.includes(`href="${p[other]}" hreflang="${other}"`)) problems.push("language link");
      const internal = [...h.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]).filter((x) => /^\/(tr\/)?(support|privacy-policy|terms-of-service)\.html$|^\/(tr\/)?$/.test(x));
      const wrongLang = internal.filter((x) => (lang === "tr") !== x.startsWith("/tr/") && !h.includes(`href="${x}" hreflang=`));
      if (wrongLang.length) problems.push(`links to the other language: ${[...new Set(wrongLang)].join(" ")}`);
      check(problems.length === 0, `${u}: ${problems.length ? problems.join(", ") : `"${title}"`}`);
      if (p.id === "home") {
        const bytes = Buffer.byteLength(h);
        check(bytes < 250 * 1024, `${u} weighs ${(bytes / 1024).toFixed(0)} KB (< 250 KB)`);
        const ld = JSON.parse(attr(h, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || "{}");
        const ldOk =
          ld["@type"] === "MobileApplication" && ld.operatingSystem === "iOS" && ld.applicationCategory === "GameApplication" &&
          ld.offers?.price === "0" && ld.installUrl?.includes("id6761419296") && ld.sameAs?.length && ld.screenshot?.length === 3 &&
          ld.inLanguage?.length === 16 && ld.publisher?.name && ld.description === desc && !("aggregateRating" in ld);
        check(ldOk, `${u} JSON-LD ${ld["@type"]}: offers, installUrl, sameAs, ${ld.screenshot?.length} screenshots, ${ld.inLanguage?.length} languages, no invented rating`);
        for (const s of ld.screenshot || []) check((await fetch(BASE + s.replace(ORIGIN, ""))).ok, `  screenshot ${s.replace(ORIGIN, "")} served`);
        const store = [...h.matchAll(/href="(https:\/\/apps\.apple\.com[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
        const cts = store.map((s) => new URL(s).searchParams.get("ct"));
        check(
          store.length >= 2 && store.every((s) => s.startsWith("https://apps.apple.com/app/apple-store/id6761419296?") && /[?&]mt=8/.test(s)) && cts.includes("web_hero") && cts.includes("web_cta"),
          `${u} App Store links are campaign links: ct=${cts.join(", ")}`,
        );
        const play = [...h.matchAll(/<a [^>]*data-track-platform="android"[^>]*>/g)].map((m) => m[0]);
        check(play.length === 2 && play.every((a) => a.includes('href="mailto:') && a.includes('data-track-status="coming_soon"')), `${u} Google Play "coming soon" mailto measured as store_click coming_soon`);
      }
    }
  }
  // texts that must not come back
  const all = PAGES.flatMap((p) => [p.en, p.tr]).map((u) => readFileSync(join(root, u.endsWith("/") ? `${u}index.html` : u), "utf8")).join("\n");
  check(!/Kullanım Şartları/.test(all), "one name for the terms page (no 'Kullanım Şartları')");
  check(!/(?<!9)5[.,]000\+|10×10 → |NUMBER PLACEMENT/i.test(all), "no outdated product facts");
  for (const [f, lang] of [["og-image.png", "en"], ["og-image-tr.png", "tr"]]) {
    const buf = readFileSync(join(root, f));
    const w = buf.readUInt32BE(16), hgt = buf.readUInt32BE(20), kb = statSync(join(root, f)).size / 1024;
    check(w === 1200 && hgt === 630 && kb < 300, `${f} (${lang}) ${w}×${hgt}, ${kb.toFixed(0)} KB`);
  }
  // 404
  const nf = await get("/no-such-page");
  check(nf.status === 404 && nf.text.includes('name="robots" content="noindex"') && nf.text.includes('href="/"') && nf.text.includes('href="/tr/"') && nf.text.includes('lang="tr"'), "404.html: 404 status, noindex, links home in both languages");
  check(!/(href|src)="(?!\/|https?:|mailto:|#)/.test(nf.text), "404.html uses root-absolute URLs only");
  // sitemap
  const sm = (await get("/sitemap.xml")).text;
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc><lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)].map((m) => m[1]);
  check(locs.length === 8 && ALL_URLS.every((u) => locs.includes(ORIGIN + u)) && !sm.includes("in place"), `sitemap.xml: ${locs.length} URLs with lastmod`);
  const manifest = JSON.parse((await get("/site.webmanifest")).text);
  check(manifest.name === "Grid Collection" && manifest.theme_color && manifest.icons.length >= 2, "site.webmanifest: name, theme_color, icons");
  for (const f of ["/llms.txt", "/robots.txt", "/assets/levels.bin", "/assets/logo-256.webp", "/icon-512.png"]) check((await fetch(BASE + f)).ok, `${f} served`);

  // JavaScript off: each URL still reads in its own language
  const { ctx } = await newContext(browser, { javaScriptEnabled: false, viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const expect = {
    "/": ["One rule, eight directions", "Your", "Small rule."],
    "/tr/": ["Tek kural, sekiz yön", "Sıra", "Küçük kural."],
    "/support.html": ["Game Support & Bug Reports"],
    "/tr/support.html": ["Oyun Desteği ve Hata Bildirimleri"],
    "/privacy-policy.html": ["Website (grid-collection.com)", "Google Analytics 4"],
    "/tr/privacy-policy.html": ["Web Sitesi (grid-collection.com)", "Google Analytics 4"],
    "/terms-of-service.html": ["Terms of Service", "Grid Collection is a puzzle game"],
    "/tr/terms-of-service.html": ["Hizmet Şartları", "Grid Collection bir bulmaca oyunu"],
  };
  for (const [u, words] of Object.entries(expect)) {
    await page.goto(BASE + u);
    const text = await page.evaluate(() => document.body.innerText);
    const missing = words.filter((w) => !text.includes(w));
    const lang = await page.evaluate(() => document.documentElement.lang);
    const grid = /\bGRID\b/.test(text);
    check(
      missing.length === 0 && lang === (u.startsWith("/tr/") ? "tr" : "en") && !grid,
      `JS off ${u}: lang=${lang}${missing.length ? `, missing ${missing.join(" | ")}` : ""}${grid ? ", 'GRID' used as the app name" : ""}`,
    );
  }
  await ctx.close();
}

/* =====================================================================
   MOBILE — 360 / 390 / 414 / 768
   ===================================================================== */
if (ONLY.includes("mobile")) {
  for (const width of [360, 390, 414, 768]) {
    console.log(`\n== mobile ${width}px`);
    const out = join(SHOTS, `mobile-${width}`);
    mkdirSync(out, { recursive: true });
    const { ctx } = await newContext(
      browser,
      { viewport: { width, height: width < 700 ? 800 : 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
      { consent: "denied" },
    );
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    for (const u of [...ALL_URLS, "/no-such-page"]) {
      await page.goto(BASE + u);
      await page.waitForTimeout(u.endsWith("/") ? 2600 : 600);
      const r = await page.evaluate(() => {
        const d = document.documentElement;
        // what overflow-x: clip would hide: elements whose box leaves the viewport
        const out = [...document.querySelectorAll("main *, header *, footer *, .hero *")].filter((e) => {
          const s = getComputedStyle(e);
          if (s.position === "fixed" || e.closest("[aria-hidden='true'], canvas, .lvl-pop, .play__fx")) return false;
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && (b.right > d.clientWidth + 1 || b.left < -1);
        });
        return { sw: d.scrollWidth, cw: d.clientWidth, out: out.slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`) };
      });
      check(r.sw === r.cw && r.out.length === 0, `${u}: scrollWidth ${r.sw} = clientWidth ${r.cw}${r.out.length ? `, off-screen: ${r.out.join(" ")}` : ""}`);
      const name = u === "/" ? "home-en" : u === "/tr/" ? "home-tr" : u.replace(/^\//, "").replace(/\//g, "-").replace(".html", "");
      await page.screenshot({ path: join(out, `${name}.png`) });
    }
    // home: hero buttons + stats fully visible and tappable
    for (const u of ["/", "/tr/"]) {
      await page.goto(BASE + u);
      await page.waitForTimeout(3000);
      const vis = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const items = [...document.querySelectorAll(".hero__actions > *, .hero__stat, .hero__tagline, .wordmark, .nav__tools > *")];
        return items.map((e) => {
          const b = e.getBoundingClientRect();
          return { c: e.className.split(" ")[0], ok: b.left >= 0 && b.right <= W + 0.5, h: Math.round(b.height) };
        });
      });
      const bad = vis.filter((v) => !v.ok);
      check(bad.length === 0, `${u} hero: ${vis.length} buttons/stats/wordmark inside the viewport${bad.length ? ` (${bad.map((b) => b.c).join(", ")} cut)` : ""}`);
      const small = vis.filter((v) => /badge|btn|seg|sound-btn/.test(v.c) && v.h < 44);
      check(small.length === 0, `${u} hero/nav tap targets ≥ 44 px${small.length ? `: ${small.map((s) => `${s.c} ${s.h}px`).join(", ")}` : ""}`);
    }
    if (width === 390) {
      // touch play: the Play board's real 5x5 level, tapped through
      await page.goto(`${BASE}/tr/`);
      await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
      await page.waitForTimeout(2500);
      await page.evaluate(() => document.querySelector("#play").scrollIntoView({ behavior: "instant" }));
      await page.waitForTimeout(1500);
      const sol = await page.evaluate(() => window.__site.levels[0].solution);
      for (const k of sol) {
        await page.locator(`.pcell[data-cell="${k}"]`).tap();
        await page.waitForTimeout(40);
      }
      await page.waitForTimeout(1900);
      check((await page.locator(".play .result--open").count()) === 1, "touch: Play board level solved by tapping");
      await page.screenshot({ path: join(out, "home-tr-play-win.png") });
      // Scale columns: a tap opens and pins a real level
      const c = await page.evaluate(() => {
        const s = document.querySelector(".count");
        return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight };
      });
      await page.evaluate((y) => window.scrollTo(0, y), c.top + (c.h - 800) * 0.95);
      await page.waitForTimeout(3000);
      const ready = await page.evaluate(() => window.__site.Count.debug.hasData);
      const [x, y] = await page.evaluate(() => window.__site.Count.debug.screenOf(30000));
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(600);
      const pinned = await page.evaluate(() => window.__site.Count.debug.pinned);
      check(ready && pinned >= 0, `touch: Scale column tap pins level #${pinned}`);
      await page.screenshot({ path: join(out, "home-tr-scale-pinned.png") });
      for (const [p, n] of [[0.02, "journey-5x5"], [0.62, "journey-extreme"]]) {
        const j = await page.evaluate(() => {
          const s = document.querySelector(".journey");
          return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight };
        });
        await page.evaluate((yy) => window.scrollTo(0, yy), j.top + (j.h - 800) * p);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: join(out, `home-tr-${n}.png`) });
      }
    }
    check(errors.length === 0, `console errors: ${errors.length}${errors.length ? `\n    ${errors.join("\n    ")}` : ""}`);
    await ctx.close();
  }
}

/* =====================================================================
   DESKTOP — the home page sections, as before
   ===================================================================== */
if (ONLY.includes("desktop")) {
  for (const vp of [
    { name: "1920x1080", width: 1920, height: 1080 },
    { name: "3840x2160", width: 3840, height: 2160 },
    { name: "1366x768", width: 1366, height: 768 },
  ]) {
    console.log(`\n== desktop ${vp.name}`);
    const out = join(SHOTS, `desktop-${vp.name}`);
    mkdirSync(out, { recursive: true });
    const { ctx } = await newContext(browser, { viewport: { width: vp.width, height: vp.height } }, { consent: "denied" });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
    await page.goto(`${BASE}/tr/`);
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
    await page.waitForTimeout(4200);
    check(await page.evaluate(() => window.__site.Field.hasGL), "WebGL2 field running");
    const wmCells = await page.locator('[data-ref="wordmark-hero"] .wm__cell--on').count();
    check(wmCells > 40, `wordmark cells: ${wmCells}`);
    const logo = await page.evaluate(() => {
      const img = document.querySelector(".nav__logo");
      return { natural: img.naturalWidth, src: img.getAttribute("src") };
    });
    check(logo.natural === 256 && logo.src === "/assets/logo-256.webp", `nav logo from a file: ${logo.src} (${logo.natural}px)`);
    check(!(await page.evaluate(() => window.__site.LevelData.bytes)), "level data not loaded at the top of the page");
    await page.mouse.click(vp.width * 0.2, vp.height * 0.85);
    await page.waitForTimeout(700);
    await shot("01-hero");
    check((await page.locator("[data-count='95000']").textContent())?.includes("95.000"), "hero counter (tr) 95.000");

    // Rule
    await page.evaluate(() => document.querySelector("#rule").scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(1500);
    check((await page.locator(".rcell--target").count()) === 8, "rule board: 8 targets from the centre");
    await page.locator(".rcell--target").first().hover();
    await page.waitForTimeout(200);
    check((await page.locator(".rcell--skip").count()) === 2, "rule board: skip preview");
    for (const n of [0, 1]) {
      const bb = await page.locator(".rcell--target").nth(n).boundingBox();
      await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(500);
    check((await page.locator('[data-ref="rule-moves"]').textContent()) === "2", "rule board counts moves");
    const ruleEnd = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let n = 0; n < 60; n++) {
        const ts = [...document.querySelectorAll(".rcell--target")];
        if (!ts.length) break;
        ts[0].click();
        await sleep(30);
      }
      await sleep(900);
      return document.querySelector(".rule__result").classList.contains("result--open");
    });
    check(ruleEnd, "rule board dead end opens the overlay");
    await shot("02-rule-dead-end");
    await page.evaluate(() => document.querySelector('.rule__result [data-action="rule-reset"]').click());
    await page.waitForTimeout(400);

    // Play
    await page.evaluate(() => document.querySelector("#play").scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(1500);
    const tabs = await page.locator(".play-tab__grid").allTextContents();
    check(tabs.join(",") === "5×5,6×6,7×7,8×8,9×9,10×10", `one level per grid size: ${tabs.join(",")}`);
    const sol = await page.evaluate(() => window.__site.levels[0].solution);
    for (const k of sol) {
      await page.locator(`.pcell[data-cell="${k}"]`).click();
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1900);
    check((await page.locator(".play .result--open").count()) === 1 && (await page.locator(".result__star--on").count()) === 3, "real 5x5 solution wins with 3 stars");
    await shot("03-play-win");
    await page.locator('[data-action="play-next"]').click();
    await page.waitForTimeout(700);
    await page.locator('[data-action="play-tool"][data-tool="reveal50"]').click();
    await page.waitForTimeout(2200);
    const t1 = await page.evaluate(() => {
      const st = window.__site.Play.state;
      return { moves: st.moves, want: Math.round(st.level.solution.length * 0.5), dis: ["placeStart", "reveal25", "reveal50", "reveal75"].map((id) => document.querySelector(`[data-tool="${id}"]`).disabled) };
    });
    check(t1.moves === t1.want && t1.dis.join() === "true,true,true,false", `reveal 50%: ${t1.moves}/${t1.want}, disabled=${t1.dis.join()}`);
    await page.locator('[data-action="play-tab"][data-index="5"]').click();
    await page.waitForTimeout(700);
    await page.locator('[data-action="play-solve"]').click();
    await page.waitForTimeout(7000);
    check((await page.locator(".play .result--open").count()) === 1, "10x10 watch-solution reaches the win");
    await shot("04-play-solve-10x10");

    // Journey
    const j = await page.evaluate(() => {
      const s = document.querySelector(".journey");
      return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight };
    });
    for (const [p, name] of [[0.02, "05-journey-5x5"], [0.33, "06-journey-8x8"], [0.62, "07-journey-extreme"], [0.99, "08-journey-solved"]]) {
      await page.evaluate((y) => window.scrollTo(0, y), j.top + (j.h - vp.height) * p);
      await page.waitForTimeout(1900);
      await shot(name);
    }
    check(Number(await page.locator('[data-ref="journey-count"]').textContent()) >= 395, "extreme board solves itself (≥ 395/400)");
    await page.locator('[data-action="journey-step"][data-index="3"]').click();
    await page.waitForTimeout(3500);
    check((await page.locator('[data-ref="journey-size"]').textContent()) === "8×8", "journey step click shows 8×8");

    // Count (Scale)
    const c = await page.evaluate(() => {
      const s = document.querySelector(".count");
      return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight };
    });
    for (const [p, name] of [[0.03, "09-count-spiral"], [0.5, "10-count-number"], [0.95, "11-count-columns"]]) {
      await page.evaluate((y) => window.scrollTo(0, y), c.top + (c.h - vp.height) * p);
      await page.waitForTimeout(p === 0.03 ? 2500 : 2600);
      if (p === 0.03) check(await page.evaluate(() => window.__site.Count.debug.hasData), "level data fetched (/assets/levels.bin) near the Scale section");
      const [x, y] = await page.evaluate((i) => window.__site.Count.debug.screenOf(i), 41234);
      await page.mouse.move(x, y);
      await page.waitForTimeout(500);
      const hov = await page.evaluate(() => ({ h: window.__site.Count.debug.hovered, open: !document.querySelector(".lvl-pop").hidden, rot: window.__site.Count.debug.rot }));
      if (p === 0.95) check(hov.h >= 0 && hov.open, `${name}: hover opens a level board`);
      else check(!hov.open, `${name}: hover shows no board`);
      if (p === 0.03) {
        check((await page.evaluate(() => window.__site.Count.debug.symCount)) === 384, "384 symmetric boards shine in the spiral");
        await page.waitForTimeout(800);
        const rot2 = await page.evaluate(() => window.__site.Count.debug.rot);
        check(hov.h >= 0 && Math.abs(rot2 - hov.rot) < 0.01, "spiral stops while a dot is hovered");
      }
      await shot(name);
      if (p === 0.95) {
        await page.mouse.click(x, y);
        await page.waitForTimeout(400);
        const pinned = await page.evaluate(() => window.__site.Count.debug.pinned);
        check(pinned === hov.h, `click pins level #${pinned}`);
        if (existsSync(join(LEVELS, "levels-meta.json"))) {
          for (const k of solutionOf(pinned)) {
            await page.evaluate((cc) => document.querySelector(`.lvl-pop .pcell[data-cell="${cc}"]`).click(), k);
            await page.waitForTimeout(25);
          }
          await page.waitForTimeout(900);
          const hint = await page.locator('[data-ref="lvl-pop-hint"]').textContent();
          check(/Çözüldü|Solved/.test(hint), `pinned real level solved in the popover: ${hint}`);
          await shot("12-count-pinned-solved");
        } else console.log(`  · ${LEVELS} not found: popover solve skipped`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
        check(await page.evaluate(() => document.querySelector(".lvl-pop").hidden), "Esc closes the board");
      }
    }
    // Features + CTA
    await page.evaluate(() => document.querySelector("#features").scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(1600);
    await shot("13-features");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);
    await shot("14-cta");
    // Language link: /tr/ → /
    await page.locator('.nav a[data-lang="en"]').click();
    await page.waitForURL(`${BASE}/`);
    await page.waitForTimeout(4000); // the hero counters count up from 0 for ~3.5 s
    const lang = await page.evaluate(() => document.documentElement.lang);
    const stat = await page.locator("[data-count='95000']").textContent();
    check(lang === "en" && stat?.includes("95,000"), `EN link: lang=${lang}, counter=${stat}`);
    check((await page.evaluate(() => localStorage.getItem("grid-site:v1")))?.includes('"en"'), "language choice saved");
    await shot("15-hero-en");
    check(errors.length === 0, `console errors: ${errors.length}${errors.length ? `\n    ${errors.join("\n    ")}` : ""}`);
    await ctx.close();
  }
}

/* =====================================================================
   CONSENT
   ===================================================================== */
if (ONLY.includes("consent")) {
  console.log("\n== consent");
  const out = join(SHOTS, "consent");
  mkdirSync(out, { recursive: true });
  for (const [u, accept, reject] of [["/", "Accept", "Reject"], ["/tr/", "Kabul et", "Reddet"], ["/tr/privacy-policy.html", "Kabul et", "Reddet"], ["/support.html", "Accept", "Reject"]]) {
    const { ctx, google } = await newContext(browser, { viewport: { width: 1366, height: 800 } });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await page.goto(BASE + u);
    await page.waitForTimeout(u.endsWith("/") ? 3500 : 800);
    // scroll + interact a little: still nothing may leave
    await page.mouse.wheel(0, 1600);
    await page.waitForTimeout(800);
    const cookies = (await ctx.cookies()).map((c) => c.name);
    const gtagTag = await page.evaluate(() => !!document.querySelector('script[src*="googletagmanager"]'));
    check(google.length === 0 && !gtagTag && !cookies.some((n) => n.startsWith("_ga")), `${u}: before consent no Google request (${google.length}), no gtag.js tag, no _ga cookie`);
    const banner = page.locator("[data-consent]");
    const btns = await page.evaluate(() =>
      [...document.querySelectorAll("[data-consent-choice]")].map((b) => {
        const s = getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return { text: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), bg: s.backgroundColor, border: s.borderColor, weight: s.fontWeight, size: s.fontSize };
      }),
    );
    const same = btns.length === 2 && ["w", "h", "bg", "border", "weight", "size"].every((k) => btns[0][k] === btns[1][k]);
    check((await banner.isVisible()) && btns.map((b) => b.text).sort().join("|") === [accept, reject].sort().join("|") && same, `${u}: banner shown in the page's language (${btns.map((b) => b.text).join(" / ")}), buttons of equal weight`);
    await page.screenshot({ path: join(out, `${u.replace(/\//g, "_") || "root"}-banner.png`) });
    if (u === "/tr/") {
      // accept → gtag.js loads (stub), consent update granted, _ga set
      await page.getByRole("button", { name: accept }).click();
      await page.waitForTimeout(600);
      const dl = await page.evaluate(() => window.dataLayer.map((a) => [...a]));
      const def = dl.find((a) => a[0] === "consent" && a[1] === "default");
      const upd = dl.find((a) => a[0] === "consent" && a[1] === "update");
      check(
        def && ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"].every((k) => def[2][k] === "denied") && upd?.[2]?.analytics_storage === "granted" && !("ad_storage" in upd[2]),
        "Consent Mode v2: all denied by default; accept grants analytics_storage only",
      );
      check(google.some((x) => x.includes("/gtag/js?id=G-EHP1CQ1RV4")) && dl.some((a) => a[0] === "config" && a[1] === "G-EHP1CQ1RV4"), "accept loads gtag.js and configures G-EHP1CQ1RV4");
      check((await ctx.cookies()).some((c) => c.name === "_ga"), "_ga cookie exists after consent (stub)");
      check(await page.evaluate(() => localStorage.getItem("grid-site:consent")) === "granted", "choice stored in localStorage");
      // reload: no banner, gtag loads straight away
      await page.reload();
      await page.waitForTimeout(1200);
      check(!(await banner.isVisible()), "after reload: banner stays closed");
      // withdraw from the footer
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: "Çerez tercihleri" }).click();
      await page.waitForTimeout(300);
      check(await banner.isVisible(), "footer 'Çerez tercihleri' reopens the banner");
      await page.screenshot({ path: join(out, "tr-reopened.png") });
      await page.getByRole("button", { name: reject }).click();
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => ({ disabled: window["ga-disable-G-EHP1CQ1RV4"], n: window.dataLayer.length, cookie: document.cookie }));
      check(after.disabled === true && !/_ga/.test(after.cookie) && !(await ctx.cookies()).some((c) => c.name.startsWith("_ga")), "reject after accept: GA disabled and _ga cookies deleted");
      await page.locator('[data-action="sound"]').click();
      await page.waitForTimeout(200);
      check((await page.evaluate(() => window.dataLayer.length)) === after.n, "no events are queued after withdrawal");
      check(await page.evaluate(() => localStorage.getItem("grid-site:consent")) === "denied", "withdrawal stored");
    }
    if (u === "/") {
      await page.getByRole("button", { name: reject }).click();
      await page.waitForTimeout(300);
      await page.reload();
      await page.waitForTimeout(1500);
      check(!(await banner.isVisible()) && google.length === 0, "reject: banner closed after reload, still no Google request");
    }
    check(errors.length === 0, `${u} console errors: ${errors.length}${errors.length ? `\n    ${errors.join("\n    ")}` : ""}`);
    await ctx.close();
  }
}

/* =====================================================================
   EVENTS — the analytics plan, read from dataLayer (consent granted, gtag stubbed)
   ===================================================================== */
if (ONLY.includes("events")) {
  console.log("\n== events");
  const { ctx } = await newContext(browser, { viewport: { width: 1600, height: 900 } }, { consent: "granted" });
  // App Store links open a new tab: never reach Apple, close it
  await ctx.route(/apps\.apple\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  ctx.on("page", (p) => p.close().catch(() => {}));
  const errors = watchErrors(page);
  const events = () => page.evaluate(() => window.dataLayer.filter((a) => a[0] === "event").map((a) => ({ name: a[1], p: { ...a[2] } })));
  const has = async (name, test = () => true) => (await events()).filter((e) => e.name === name && test(e.p));
  const keepHere = () =>
    page.evaluate(() =>
      document.addEventListener("click", (e) => {
        const a = e.target.closest("a");
        if (a && (a.href.startsWith("mailto:") || a.dataset.lang)) e.preventDefault();
      }),
    );
  await page.goto(`${BASE}/tr/`);
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
  await keepHere();
  await page.waitForTimeout(3000);
  const props = await page.evaluate(() => window.dataLayer.filter((a) => a[0] === "set" && a[1] === "user_properties").map((a) => ({ ...a[2] })));
  check(props.length > 0 && ["site_lang", "sound_on", "reduced_motion", "demo_played"].every((k) => k in props[0]) && props[0].site_lang === "tr", `user properties: ${JSON.stringify(props[0])}`);

  // static clicks
  await page.locator(".hero__actions a.badge").first().click();
  await page.locator(".hero__actions a.badge--ghost").click();
  await page.locator('.nav a[data-lang="en"]').click();
  await page.locator('[data-action="sound"]').click();
  await page.waitForTimeout(300);
  check((await has("store_click", (p) => p.platform === "ios" && p.location === "hero" && p.status === "live")).length === 1, "store_click {ios, hero, live}");
  check((await has("store_click", (p) => p.platform === "android" && p.location === "hero" && p.status === "coming_soon")).length === 1, "store_click {android, hero, coming_soon}");
  check((await has("lang_switch", (p) => p.from === "tr" && p.to === "en")).length === 1, "lang_switch {from: tr, to: en}");
  check((await has("sound_toggle", (p) => p.on === false)).length === 1, "sound_toggle {on: false}");
  const soundProp = await page.evaluate(() => window.dataLayer.filter((a) => a[0] === "set" && a[1] === "user_properties").at(-1)[2].sound_on);
  check(soundProp === false, "user property sound_on follows the toggle");
  await page.locator('[data-action="sound"]').click();

  // Rule board → rule_demo_end
  await page.evaluate(() => document.querySelector("#rule").scrollIntoView({ behavior: "instant" }));
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let n = 0; n < 60; n++) {
      const ts = [...document.querySelectorAll(".rcell--target")];
      if (!ts.length) break;
      ts[0].click();
      await sleep(20);
    }
  });
  await page.waitForTimeout(300);
  const rde = await has("rule_demo_end");
  check(rde.length === 1 && rde[0].p.moves > 0 && ["dead", "complete"].includes(rde[0].p.result), `rule_demo_end ${JSON.stringify(rde[0]?.p)}`);
  const demoProp = await page.evaluate(() => window.dataLayer.filter((a) => a[0] === "set" && a[1] === "user_properties").at(-1)[2].demo_played);
  check(demoProp === true, "user property demo_played = true after playing");

  // Play: win level 1 with one undo
  await page.evaluate(() => document.querySelector("#play").scrollIntoView({ behavior: "instant" }));
  await page.waitForTimeout(1500);
  const sol = await page.evaluate(() => window.__site.levels[0].solution);
  await page.locator(`.pcell[data-cell="${sol[0]}"]`).click();
  await page.locator(`.pcell[data-cell="${sol[1]}"]`).click();
  await page.locator('.play__controls [data-action="play-undo"]').click();
  for (const k of sol.slice(1)) {
    await page.locator(`.pcell[data-cell="${k}"]`).click();
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(1600);
  const dls = await has("demo_level_start");
  check(dls.length === 1 && dls[0].p.level_index === 0 && dls[0].p.grid === "5x5", `demo_level_start ${JSON.stringify(dls[0]?.p)}`);
  const dle = await has("demo_level_end");
  check(dle.length === 1 && dle[0].p.stars === 3 && dle[0].p.percent === 100 && dle[0].p.perfect === false && dle[0].p.undos === 1 && dle[0].p.tools_used === 0, `demo_level_end ${JSON.stringify(dle[0]?.p)}`);
  // level 2: a helper, then watch the solution
  await page.locator('.play .result--open [data-action="play-next"]').click();
  await page.waitForTimeout(700);
  await page.locator('[data-action="play-tool"][data-tool="reveal25"]').click();
  await page.waitForTimeout(1500);
  check((await has("demo_tool_use", (p) => p.tool === "reveal25")).length === 1, "demo_tool_use {tool: reveal25}");
  await page.locator('[data-action="play-solve"]').click();
  await page.waitForTimeout(300);
  const dws = await has("demo_watch_solution");
  check(dws.length === 1 && dws[0].p.level_index === 1 && dws[0].p.percent_at_click > 0, `demo_watch_solution ${JSON.stringify(dws[0]?.p)}`);
  await page.waitForTimeout(5000);
  check((await has("demo_level_end")).length === 1, "watching the solution sends no demo_level_end");

  // Journey step + Count pin
  const j = await page.evaluate(() => {
    const s = document.querySelector(".journey");
    return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight };
  });
  await page.evaluate((y) => window.scrollTo(0, y), j.top + (j.h - 900) * 0.2);
  await page.waitForTimeout(1200);
  await page.locator('[data-action="journey-step"][data-index="6"]').click();
  await page.waitForTimeout(200);
  check((await has("journey_step", (p) => p.grid === "extreme")).length === 1, "journey_step {grid: extreme}");
  const c = await page.evaluate(() => {
    const s = document.querySelector(".count");
    return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight };
  });
  await page.evaluate((y) => window.scrollTo(0, y), c.top + (c.h - 900) * 0.95);
  await page.waitForTimeout(3000);
  const [x, y] = await page.evaluate(() => window.__site.Count.debug.screenOf(50000));
  await page.mouse.move(x, y);
  await page.waitForTimeout(500);
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);
  const clo = await has("count_level_open");
  check(clo.length === 1 && /^\d+x\d+-\d+-\d+$/.test(clo[0].p.level_id), `count_level_open ${JSON.stringify(clo[0]?.p)}`);
  await page.keyboard.press("Escape");

  // section_view: once per section
  await page.evaluate(() => document.querySelector("#features").scrollIntoView({ behavior: "instant" }));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  const sv = (await has("section_view")).map((e) => e.p.section);
  const want = ["hero", "rule", "play", "collection", "scale", "features", "download"];
  check(want.every((s) => sv.includes(s)) && new Set(sv).size === sv.length, `section_view once each: ${sv.join(", ")}`);
  // CTA store click
  await page.evaluate(() => document.querySelector("#download").scrollIntoView({ behavior: "instant" }));
  await page.waitForTimeout(800);
  await page.locator(".cta__actions a.badge").first().click();
  await page.locator(".cta__actions a.badge--ghost").click();
  await page.waitForTimeout(200);
  check((await has("store_click", (p) => p.location === "cta")).length === 2, "store_click from the CTA (ios + android)");
  // web vitals (FCP/TTFB right away; LCP/CLS when the page is hidden)
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(500);
  const wv = await has("web_vitals");
  check(wv.length >= 2 && wv.every((e) => typeof e.p.value === "number" && ["good", "needs-improvement", "poor"].includes(e.p.rating)), `web_vitals: ${wv.map((e) => `${e.p.name}=${e.p.value} (${e.p.rating})`).join(", ")}`);
  check(errors.length === 0, `home console errors: ${errors.length}${errors.length ? `\n    ${errors.join("\n    ")}` : ""}`);

  // legal pages
  for (const [u, pageId] of [["/support.html", "support"], ["/tr/privacy-policy.html", "privacy"], ["/terms-of-service.html", "terms"]]) {
    await page.goto(BASE + u);
    await keepHere();
    await page.waitForTimeout(500);
    check((await has("legal_view", (p) => p.page === pageId)).length === 1, `legal_view {page: ${pageId}} on ${u}`);
    if (pageId === "support") {
      for (const k of ["support", "info", "contact"]) await page.locator(`a[href="mailto:${k}@grid-collection.com"]`).click();
      await page.waitForTimeout(200);
      const sc = (await has("support_contact")).map((e) => e.p.mailto);
      check(sc.join(",") === "support,info,contact", `support_contact {mailto}: ${sc.join(", ")}`);
    }
  }
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
