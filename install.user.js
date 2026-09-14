// ==UserScript==
// @name         Harkdonz — Panel dodatków
// @namespace    harkdonz.margonem
// @version      1.0.0
// @description  Jedyny skrypt, jaki trzeba zainstalować. Ładuje panel Harkdonz i wszystkie dodatki na żywo z repozytorium — nie trzeba instalować ich osobno.
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/install.user.js
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/install.user.js
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      raw.githubusercontent.com
// @require      https://raw.githubusercontent.com/Harkryn/Harkdonz/main/bootstrap.js?v=1.0.0
// ==/UserScript==
(function () {
  'use strict';
  const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  if (page.top !== page.self || page.HarkdonzRuntime) return;
  if (typeof harkdonzBootstrap !== 'function') {
    console.error('[Harkdonz] Brak pliku startowego. Zainstaluj ponownie aktualny instalator.');
    return;
  }
  harkdonzBootstrap(page, (options) => GM_xmlhttpRequest(options));
})();
