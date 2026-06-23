/**
 * lang.js — site-wide language persistence.
 *
 * Behaviour ("remember + rewrite links"):
 *  - When the visitor picks a language from the .lang-select switcher, the
 *    choice is saved to localStorage (the <select>'s inline onchange still does
 *    the actual navigation; we save first via a capture-phase listener).
 *  - On every page load, if a language was previously remembered, the in-page
 *    navigation links (logo / Home / Support / Privacy / Terms, marked with
 *    data-nav) are rewritten to point at that language's version — so the
 *    visitor keeps browsing in their chosen language. The current page is never
 *    auto-redirected.
 */
(function () {
  "use strict";

  // lang code (matches <html lang>) → site path
  var LANGS = {
    en: "/",
    tr: "/tr/",
    de: "/de/",
    es: "/es/",
    fr: "/fr/",
    it: "/it/",
    "pt-BR": "/pt-br/",
    pl: "/pl/",
    id: "/id/",
    vi: "/vi/",
    ru: "/ru/",
    hi: "/hi/",
    "zh-Hans": "/zh-hans/",
    "zh-Hant": "/zh-hant/",
    ja: "/ja/",
    ko: "/ko/",
  };
  // data-nav key → file within a language base
  var FILES = {
    home: "",
    support: "support.html",
    privacy: "privacy-policy.html",
    terms: "terms-of-service.html",
  };
  var KEY = "gridLang";

  // reverse map: site path → lang code
  var BY_PATH = {};
  for (var code in LANGS) BY_PATH[LANGS[code]] = code;

  function read() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }
  function save(code) {
    try {
      localStorage.setItem(KEY, code);
    } catch (e) {
      /* private mode / disabled storage — ignore */
    }
  }

  var current = document.documentElement.lang || "en";
  if (!LANGS[current]) current = "en";

  // --- persist the choice when the switcher is used --------------------------
  // Capture phase so this runs BEFORE the <select>'s inline onchange navigates.
  var sel = document.querySelector(".lang-select");
  if (sel) {
    sel.addEventListener(
      "change",
      function () {
        var picked = BY_PATH[this.value];
        if (picked) save(picked);
      },
      true,
    );
  }

  // --- apply a remembered choice to in-page navigation -----------------------
  var stored = read();
  var target = stored && LANGS[stored] ? stored : current;
  if (target !== current) {
    var base = LANGS[target];
    var links = document.querySelectorAll("[data-nav]");
    for (var i = 0; i < links.length; i++) {
      var nav = links[i].getAttribute("data-nav");
      if (FILES[nav] !== undefined) links[i].setAttribute("href", base + FILES[nav]);
    }
    // reflect the remembered language in the switcher
    if (sel) sel.value = base;
  }
})();
