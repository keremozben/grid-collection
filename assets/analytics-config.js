// Measurement settings — the only place they live (see README › Analytics).
// Read in the browser by assets/analytics.js and at build time by
// tools/build-langs.mjs (App Store campaign links).

/** GA4 measurement ID (web stream of the GA4 property). */
export const GA_MEASUREMENT_ID = "G-EHP1CQ1RV4";

/**
 * App Store Connect provider token for campaign links (`pt=`), from
 * App Store Connect → App Analytics → Campaigns → "Generate a campaign link".
 * Empty = links carry only `ct=`/`mt=` until the owner fills it in; then run
 * `node tools/build-langs.mjs`.
 */
export const APP_STORE_PROVIDER_TOKEN = "";

/** App Store app id (store links, smart banner, JSON-LD). */
export const APP_STORE_ID = "6761419296";
