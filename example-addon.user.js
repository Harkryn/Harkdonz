// ==UserScript==
// @name         Margonem Addon Loader - Przykładowy dodatek
// @namespace    margonem-addon-loader
// @version      1.0.1
// @description  Szablon pokazujący jak podpiąć nowy dodatek pod Margonem Addon Loader.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/example-addon.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/example-addon.user.js
// ==/UserScript==

(function register(config) {
  // Kolejkujemy rejestrację, gdyby ten skrypt wykonał się zanim załaduje się loader.
  if (window.MAL) {
    window.MAL.registerAddon(config);
  } else {
    (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
  }
})({
  id: 'przyklad',
  name: 'Przykładowy dodatek',
  description: 'Pokazuje jak korzystać z ustawień i cyklu życia dodatku.',
  version: '1.0.1',
  updateCheckUrl: 'https://raw.githubusercontent.com/Harkryn/Harkdonz/main/example-addon.user.js',
  defaultEnabled: false,
  defaultSettings: {
    powitanie: true,
    tekst: 'Witaj w Margonem!',
  },
  settingsSchema: [
    { key: 'powitanie', type: 'boolean', label: 'Pokaż powitanie w konsoli' },
    { key: 'tekst', type: 'text', label: 'Treść powitania', placeholder: 'Wpisz tekst...' },
  ],
  onEnable(settings) {
    if (settings.powitanie) {
      console.log('[Przykładowy dodatek] ' + settings.tekst);
    }
  },
  onDisable() {
    console.log('[Przykładowy dodatek] wyłączony.');
  },
  onSettingsChange(settings, key) {
    console.log('[Przykładowy dodatek] zmieniono "' + key + '":', settings[key]);
  },
});
