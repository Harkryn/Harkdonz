// ==UserScript==
// @name         MAL - Ramki i dymki
// @namespace    margonem-addon-loader
// @version      1.0.1
// @description  Kosmetyczne przestylowanie dymków czatu oraz ramek awatarów/portretów.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/ramki-dymki.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/ramki-dymki.user.js
// ==/UserScript==

/**
 * Czysto kosmetyczny CSS na szerokich selektorach (dopasowanie po fragmencie klasy/id),
 * bo dokładna struktura DOM Margonem może się różnić między serwerami/wersjami.
 * Jeśli jakiś selektor niczego nie znajdzie, reguła po prostu nic nie zmienia - bezpieczne.
 */
(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})({
  id: 'ramki-dymki',
  name: 'Ramki i dymki',
  description: 'Przestylowuje dymki czatu i ramki awatarów w spójnym, ciemnym stylu.',
  version: '1.0.1',
  updateCheckUrl: 'https://raw.githubusercontent.com/Harkryn/Harkdonz/main/ramki-dymki.user.js',
  defaultEnabled: false,
  defaultSettings: {
    kolorAkcentu: '#7c5cff',
    zaokraglenie: 12,
    poswiata: true,
    dymki: true,
    ramkiAwatarow: true,
  },
  settingsSchema: [
    { key: 'kolorAkcentu', type: 'text', label: 'Kolor akcentu (hex)', placeholder: '#7c5cff' },
    { key: 'zaokraglenie', type: 'number', label: 'Zaokrąglenie rogów (px)', min: 0, max: 32 },
    { key: 'poswiata', type: 'boolean', label: 'Delikatna poświata wokół dymków' },
    { key: 'dymki', type: 'boolean', label: 'Stylizuj dymki czatu' },
    { key: 'ramkiAwatarow', type: 'boolean', label: 'Stylizuj ramki awatarów/portretów' },
  ],

  styleEl: null,

  buildCSS(settings) {
    const rules = [];
    const glow = settings.poswiata ? `, 0 0 10px ${settings.kolorAkcentu}55` : '';

    if (settings.dymki) {
      rules.push(`
        [class*="dymek"], [class*="bubble"], [class*="chat"] [class*="msg"], [class*="chat"] [class*="message"] {
          border-radius: ${settings.zaokraglenie}px !important;
          border: 1px solid ${settings.kolorAkcentu}88 !important;
          box-shadow: 0 2px 10px rgba(0,0,0,.35)${glow} !important;
          transition: box-shadow .2s ease, border-color .2s ease;
        }
      `);
    }

    if (settings.ramkiAwatarow) {
      rules.push(`
        [class*="avatar"], [class*="portret"], [class*="portrait"], [class*="frame"] img {
          border-radius: ${Math.max(0, settings.zaokraglenie - 4)}px !important;
          outline: 2px solid ${settings.kolorAkcentu} !important;
          outline-offset: 1px;
          box-shadow: 0 0 8px ${settings.kolorAkcentu}66${settings.poswiata ? ', 0 0 16px ' + settings.kolorAkcentu + '33' : ''} !important;
        }
      `);
    }

    return rules.join('\n');
  },

  apply(settings) {
    if (!this.styleEl) {
      this.styleEl = document.createElement('style');
      this.styleEl.id = 'mal-rd-style';
      document.head.appendChild(this.styleEl);
    }
    this.styleEl.textContent = this.buildCSS(settings);
  },

  onEnable(settings) {
    this.apply(settings);
  },

  onDisable() {
    if (this.styleEl) this.styleEl.textContent = '';
  },

  onSettingsChange(settings) {
    this.apply(settings);
  },
});
