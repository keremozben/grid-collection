// @ts-check
// Shared by every page: remembers the language the visitor picked with the
// TR / EN links (localStorage "grid-site:v1", the same entry the home page
// keeps its sound setting in). Pages never redirect by language on their own;
// only the 404 page uses the stored choice to pick its home link.
const STORAGE_KEY = "grid-site:v1";

/** @returns {{ lang?: string, sound?: boolean }} */
export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

/** @param {{ lang?: string, sound?: boolean }} patch */
export function savePrefs(patch) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang: document.documentElement.lang, sound: true, ...loadPrefs(), ...patch }));
  } catch {
    /* storage blocked */
  }
}

document.addEventListener("click", (ev) => {
  const link = /** @type {HTMLAnchorElement | null} */ (/** @type {Element} */ (ev.target).closest?.("a[data-lang]"));
  if (link?.dataset.lang) savePrefs({ lang: link.dataset.lang });
});
