// @ts-check
// Analytics for every page: consent banner, GA4 (Consent Mode v2) and the one
// entry point for events, track(). See README › Analytics.
//
// - Nothing talks to Google until the visitor accepts: gtag.js is not even
//   requested, so no request goes out and no _ga cookie is written.
// - Default consent is "denied" for analytics_storage and all three ad
//   signals; accepting grants analytics_storage only (the site has no ads).
// - Events raised before consent are dropped, not queued (track() is a no-op).
// - Withdrawing consent (footer › Cookie preferences) stops collection and
//   deletes the GA cookies.
import { GA_MEASUREMENT_ID } from "./analytics-config.js";

const CONSENT_KEY = "grid-site:consent"; // "granted" | "denied"
const PREFS_KEY = "grid-site:v1"; // { lang, sound } — shared with the pages
const SENT_KEY = "grid-site:sections"; // section_view already sent this session
const DEMO_KEY = "grid-site:demo"; // demo played this session

/** @typedef {Record<string, string | number | boolean>} Params */

const w = /** @type {any} */ (window);
w.dataLayer = w.dataLayer || [];
/** gtag() must push the `arguments` object itself. @param {...unknown} _args */
function gtag(..._args) {
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments);
}

/** @param {Storage} store @param {string} key */
function read(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}
/** @param {Storage} store @param {string} key @param {string} value */
function write(store, key, value) {
  try {
    store.setItem(key, value);
  } catch {
    /* storage blocked */
  }
}

/** Whether events are being sent right now (consent granted on this page). */
let active = false;
let loaded = false;

/** @type {Params} */
const userProps = {
  site_lang: document.documentElement.lang || "en",
  sound_on: soundPref(),
  reduced_motion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  demo_played: read(sessionStorage, DEMO_KEY) === "1",
};

function soundPref() {
  try {
    const p = JSON.parse(read(localStorage, PREFS_KEY) || "null");
    return typeof p?.sound === "boolean" ? p.sound : true;
  } catch {
    return true;
  }
}

gtag("consent", "default", {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
});

function activate() {
  w[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  gtag("consent", "update", { analytics_storage: "granted" });
  active = true;
  if (!loaded) {
    loaded = true;
    gtag("set", "user_properties", userProps);
    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID);
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.append(s);
    startWebVitals();
  }
}

function deactivate() {
  if (!active) return;
  active = false;
  gtag("consent", "update", { analytics_storage: "denied" });
  w[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  deleteGaCookies();
}

/** Remove _ga and _ga_<id> on every domain level GA may have used. */
function deleteGaCookies() {
  const host = location.hostname;
  const parts = host.split(".");
  /** @type {string[]} */
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join(".")}`);
  domains.push(`; domain=${host}`);
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0].trim();
    if (name !== "_ga" && !name.startsWith("_ga_") && name !== "_gid") continue;
    for (const d of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
  }
}

/**
 * Send an event. Silently does nothing without consent.
 * @param {string} name
 * @param {Params} [params]
 */
export function track(name, params = {}) {
  if (!active) return;
  gtag("event", name, params);
}

/**
 * Update user properties (site_lang, sound_on, reduced_motion, demo_played).
 * @param {Params} props
 */
export function setUserProperties(props) {
  let changed = false;
  for (const [k, v] of Object.entries(props)) {
    if (userProps[k] !== v) {
      userProps[k] = v;
      changed = true;
    }
  }
  if (props.demo_played) write(sessionStorage, DEMO_KEY, "1");
  if (changed && active) gtag("set", "user_properties", userProps);
}

/* ---------------- consent banner ---------------- */
const banner = /** @type {HTMLElement | null} */ (document.querySelector("[data-consent]"));

/** @param {boolean} focus */
function openBanner(focus) {
  if (!banner) return;
  banner.hidden = false;
  if (focus) /** @type {HTMLElement | null} */ (banner.querySelector("button"))?.focus();
}

document.addEventListener("click", (ev) => {
  const target = /** @type {Element} */ (ev.target);
  const choice = /** @type {HTMLElement | null} */ (target.closest?.("[data-consent-choice]"));
  if (choice) {
    const granted = choice.dataset.consentChoice === "granted";
    write(localStorage, CONSENT_KEY, granted ? "granted" : "denied");
    if (granted) activate();
    else deactivate();
    if (banner) banner.hidden = true;
    return;
  }
  if (target.closest?.("[data-consent-open]")) openBanner(true);
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && banner && !banner.hidden && banner.contains(document.activeElement)) banner.hidden = true;
});

/* ---------------- declarative clicks: data-track="event" data-track-<param>="…" ---------------- */
document.addEventListener(
  "click",
  (ev) => {
    const el = /** @type {HTMLElement | null} */ (/** @type {Element} */ (ev.target).closest?.("[data-track]"));
    if (!el) return;
    /** @type {Params} */
    const params = {};
    for (const [k, v] of Object.entries(el.dataset)) {
      if (!k.startsWith("track") || k === "track" || v == null) continue;
      // trackPercentAtClick → percent_at_click
      const name = k.slice(5).replace(/^./, (c) => c.toLowerCase()).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      params[name] = v;
    }
    // same-tab navigations (language links): let GA flush with sendBeacon
    if (el instanceof HTMLAnchorElement && el.target !== "_blank" && !el.href.startsWith("mailto:")) params.transport_type = "beacon";
    track(/** @type {string} */ (el.dataset.track), params);
  },
  { capture: true },
);

/* ---------------- section_view: ≥ 50 % of a section (or of the viewport) seen, once per session ---------------- */
const sections = /** @type {HTMLElement[]} */ ([...document.querySelectorAll("[data-section]")]);
if (sections.length && "IntersectionObserver" in window) {
  /** @type {Set<string>} */
  const sent = new Set((read(sessionStorage, SENT_KEY) || "").split(",").filter(Boolean));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const id = /** @type {HTMLElement} */ (e.target).dataset.section || "";
        if (!e.isIntersecting || sent.has(id) || !active) continue;
        // tall sticky sections never reach 50 % of their own height: compare with the viewport too
        const need = 0.5 * Math.min(e.boundingClientRect.height, window.innerHeight);
        if (e.intersectionRect.height < need) continue;
        sent.add(id);
        write(sessionStorage, SENT_KEY, [...sent].join(","));
        track("section_view", { section: id });
      }
    },
    { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
  );
  sections.forEach((s) => io.observe(s));
}

/* ---------------- Core Web Vitals ---------------- */
function startWebVitals() {
  import("./vendor/web-vitals.js")
    .then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      /** @param {{ name: string, value: number, rating: string }} m */
      const send = (m) =>
        track("web_vitals", {
          name: m.name,
          value: m.name === "CLS" ? Math.round(m.value * 10000) / 10000 : Math.round(m.value),
          rating: m.rating,
        });
      onCLS(send);
      onINP(send);
      onLCP(send);
      onFCP(send);
      onTTFB(send);
    })
    .catch(() => {});
}

/* ---------------- start ---------------- */
const stored = read(localStorage, CONSENT_KEY);
if (stored === "granted") activate();
else if (stored !== "denied") openBanner(false);

// legal pages: one view event per load (support / privacy / terms)
const legalPage = document.body.dataset.legalPage;
if (legalPage) track("legal_view", { page: legalPage });
