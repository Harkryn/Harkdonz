// ==UserScript==
// @name         MAL - Ramki i dymki
// @namespace    margonem-addon-loader
// @version      2.0.0
// @description  Kolorowe ramki wokół przedmiotów wg rzadkości (unikat/heroiczny/ulepszony/legendarny) + dopasowane dymki (tooltipy) - przepisane z zestawu Shacal Customizer pod nasz loader.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/ramki-dymki.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/ramki-dymki.user.js
// ==/UserScript==

/**
 * To co się nazywa "ramki i dymki" u Shacala to system ramek wokół przedmiotów wg
 * rzadkości (nie stylizacja dymków czatu - to była pomyłka w naszej wcześniejszej
 * wersji). Selektory `.item[data-frame-mania-rarity="..."]` / `[data-item-type="t-..."]`
 * oraz `.tip-wrapper[...][data-item-type="..."]` są przepisane wprost z ich kodu (to
 * realne atrybuty gry). Same "style" (gradienty/cienie) są naszym własnym, oryginalnym
 * zestawem inspirowanym ich nazwami (Shadowbound, Crystal Veil, ...), nie kopią 1:1 -
 * a kolor każdej rzadkości jest u nas w pełni wybieralny paletą, więc nie trzeba
 * przełączać między 20 gotowymi zestawami kolorystycznymi jak tam.
 */
(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})({
  id: 'ramki-dymki',
  name: 'Ramki i dymki',
  description: 'Kolorowe ramki przedmiotów wg rzadkości + dopasowane dymki, w wybranym stylu.',
  version: '2.0.0',
  updateCheckUrl: 'https://raw.githubusercontent.com/Harkryn/Harkdonz/main/ramki-dymki.user.js',
  defaultEnabled: false,
  defaultSettings: {
    ramkiWlaczone: true,
    ramkaUnique: true,
    ramkaHeroic: true,
    ramkaUpgraded: true,
    ramkaLegendary: true,
    stylRamki: 'klasyczna',
    kolorUnique: '#927019',
    kolorHeroic: '#1d6f9c',
    kolorUpgraded: '#087a32',
    kolorLegendary: '#e842a2',
    dymkiWlaczone: true,
  },
  settingsSchema: [
    { key: 'ramkiWlaczone', type: 'boolean', label: 'Włącz ramki przedmiotów' },
    {
      key: 'stylRamki',
      type: 'select',
      label: 'Styl ramki',
      options: [
        { value: 'klasyczna', label: 'Klasyczna poświata' },
        { value: 'cien', label: 'Cień (Shadowbound)' },
        { value: 'krysztal', label: 'Kryształ (Crystal Veil)' },
        { value: 'czysta-linia', label: 'Czysta linia' },
        { value: 'zar', label: 'Żar (Emberglass)' },
        { value: 'otchlan', label: 'Otchłań (Abyssal Forge)' },
        { value: 'pryzmat', label: 'Pryzmat (Prismheart)' },
        { value: 'korona', label: 'Korona (Royal Crest)' },
      ],
    },
    { key: 'ramkaUnique', type: 'boolean', label: 'Rzadkość: unikat' },
    { key: 'kolorUnique', type: 'color', label: 'Kolor - unikat', default: '#927019' },
    { key: 'ramkaHeroic', type: 'boolean', label: 'Rzadkość: heroiczny' },
    { key: 'kolorHeroic', type: 'color', label: 'Kolor - heroiczny', default: '#1d6f9c' },
    { key: 'ramkaUpgraded', type: 'boolean', label: 'Rzadkość: ulepszony' },
    { key: 'kolorUpgraded', type: 'color', label: 'Kolor - ulepszony', default: '#087a32' },
    { key: 'ramkaLegendary', type: 'boolean', label: 'Rzadkość: legendarny' },
    { key: 'kolorLegendary', type: 'color', label: 'Kolor - legendarny', default: '#e842a2' },
    { key: 'dymkiWlaczone', type: 'boolean', label: 'Stylizuj też dymki (tooltipy) przedmiotów' },
  ],

  RARITIES: [
    { enabledKey: 'ramkaUnique', colorKey: 'kolorUnique', rarity: 'unique', fallback: 't-uniupg' },
    { enabledKey: 'ramkaHeroic', colorKey: 'kolorHeroic', rarity: 'heroic', fallback: 't-her' },
    { enabledKey: 'ramkaUpgraded', colorKey: 'kolorUpgraded', rarity: 'upgraded', fallback: 't-upgraded' },
    { enabledKey: 'ramkaLegendary', colorKey: 'kolorLegendary', rarity: 'legendary', fallback: 't-leg' },
  ],

  FRAME_STYLES: {
    klasyczna: (p) => `
      outline: 1px solid ${p.c} !important; outline-offset: -1px !important; border-radius: 2px !important;
      background: none !important;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.18), inset 0 0 5px ${p.glow}, 0 0 6px ${p.glow} !important;
    `,
    cien: (p) => `
      outline: 1px solid ${p.dark} !important; outline-offset: -1px !important; border-radius: 2px !important;
      background: linear-gradient(135deg, rgba(0,0,0,.4), transparent 45%) !important;
      box-shadow: inset 0 0 0 1px ${p.c}, inset 0 0 0 2px rgba(0,0,0,.8), inset 0 0 7px ${p.glow}, 0 0 3px rgba(0,0,0,.9), 0 0 7px ${p.glow} !important;
    `,
    krysztal: (p) => `
      outline: 1px solid ${p.bright} !important; outline-offset: -1px !important; border-radius: 1px !important;
      background: linear-gradient(135deg, rgba(255,255,255,.16), transparent 45%) !important;
      box-shadow: inset 0 0 0 1px ${p.c}, inset 0 0 4px rgba(255,255,255,.3), inset 0 0 8px ${p.glow}, 0 0 3px ${p.bright}, 0 0 7px ${p.glow} !important;
    `,
    'czysta-linia': (p) => `
      outline: 1px solid ${p.c} !important; outline-offset: -1px !important; border-radius: 1px !important;
      background: none !important;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), 0 0 3px ${p.glowSoft} !important;
    `,
    zar: (p) => `
      outline: 1px solid ${p.c} !important; outline-offset: -1px !important; border-radius: 0 !important;
      background: linear-gradient(180deg, ${p.c}, ${p.dark}) !important;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.16), inset 0 0 6px ${p.glow}, 0 0 5px ${p.glow} !important;
    `,
    otchlan: (p) => `
      outline: 1px solid ${p.dark} !important; outline-offset: -1px !important; border-radius: 2px !important;
      background: linear-gradient(135deg, rgba(0,0,0,.45), transparent 40%), linear-gradient(315deg, rgba(0,0,0,.5), transparent 42%) !important;
      box-shadow: inset 0 0 0 1px ${p.c}, inset 0 0 0 2px rgba(0,0,0,.8), inset 0 0 9px ${p.glow}, 0 0 3px rgba(0,0,0,.9), 0 0 7px ${p.glow} !important;
    `,
    pryzmat: (p) => `
      outline: 1px solid ${p.bright} !important; outline-offset: -1px !important; border-radius: 1px !important;
      background: linear-gradient(145deg, ${p.bright}, ${p.c} 45%, ${p.dark}) !important;
      box-shadow: inset 0 0 0 1px ${p.c}, inset 0 0 5px rgba(255,255,255,.35), inset 0 0 9px ${p.glow}, 0 0 3px ${p.bright}, 0 0 7px ${p.glow} !important;
    `,
    korona: (p) => `
      outline: 1px solid ${p.bright} !important; outline-offset: -1px !important; border-radius: 2px !important;
      background: linear-gradient(90deg, transparent 0 12%, rgba(255,255,255,.12) 13% 16%, transparent 17% 83%, rgba(255,255,255,.12) 84% 87%, transparent 88%), linear-gradient(180deg, rgba(255,255,255,.1), transparent 30%, rgba(0,0,0,.22)) !important;
      box-shadow: inset 0 0 0 1px ${p.c}, inset 0 0 0 3px rgba(20,14,6,.6), inset 0 0 8px ${p.glow}, 0 0 4px ${p.glow} !important;
    `,
  },

  TIP_STYLES: {
    klasyczna: (p) => `outline: 1px solid ${p.c} !important; box-shadow: 0 0 6px ${p.glow}, 0 0 22px ${p.glowSoft}, inset 0 0 0 1px ${p.dark} !important;`,
    cien: (p) => `outline: 1px solid ${p.dark} !important; box-shadow: 0 0 0 1px ${p.c}, 0 0 5px ${p.glow}, 0 0 24px ${p.glowSoft} !important;`,
    krysztal: (p) => `outline: 1px solid ${p.bright} !important; box-shadow: 0 0 4px ${p.bright}, 0 0 9px ${p.glow}, 0 0 26px ${p.glowSoft} !important;`,
    'czysta-linia': (p) => `outline: 1px solid ${p.c} !important; box-shadow: 0 0 3px ${p.glowSoft}, 0 0 20px ${p.glowSoft} !important;`,
    zar: (p) => `outline: 1px solid ${p.c} !important; box-shadow: 0 0 5px ${p.glow}, 0 0 22px ${p.glowSoft}, inset 0 0 0 1px ${p.dark} !important;`,
    otchlan: (p) => `outline: 1px solid ${p.dark} !important; box-shadow: 0 0 0 1px ${p.c}, 0 0 4px ${p.bright}, 0 0 24px ${p.glowSoft}, inset 0 0 6px rgba(0,0,0,.35) !important;`,
    pryzmat: (p) => `outline: 1px solid ${p.bright} !important; box-shadow: 0 0 4px ${p.bright}, 0 0 8px ${p.glow}, 0 0 26px ${p.glowSoft} !important;`,
    korona: (p) => `outline: 1px solid ${p.bright} !important; box-shadow: 0 0 0 1px ${p.dark}, 0 0 7px ${p.glow}, 0 0 24px ${p.glowSoft} !important;`,
  },

  styleEl: null,

  safeHex(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  },

  hexToRgb(hex) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 212, g: 175, b: 55 };
  },

  shade(hex, percent) {
    const { r, g, b } = this.hexToRgb(hex);
    const t = percent < 0 ? 0 : 255;
    const p = Math.min(1, Math.abs(percent));
    const mix = (c) => Math.round((t - c) * p + c);
    return '#' + [mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
  },

  rgba(hex, alpha) {
    const { r, g, b } = this.hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  },

  palette(hex) {
    return {
      c: hex,
      bright: this.shade(hex, 0.4),
      dark: this.shade(hex, -0.72),
      glow: this.rgba(hex, 0.55),
      glowSoft: this.rgba(hex, 0.28),
    };
  },

  buildCSS(settings) {
    if (!settings.ramkiWlaczone) return '';
    const style = this.FRAME_STYLES[settings.stylRamki] ? settings.stylRamki : 'klasyczna';
    const frameFn = this.FRAME_STYLES[style];
    const tipFn = this.TIP_STYLES[style];
    const rules = [];

    this.RARITIES.forEach((r) => {
      if (!settings[r.enabledKey]) return;
      const p = this.palette(this.safeHex(settings[r.colorKey], '#d4af37'));
      const itemSel = `.item[data-frame-mania-rarity="${r.rarity}"]:not(.bag), .item[data-item-type="${r.fallback}"]:not(.bag)`;
      rules.push(`${itemSel} { ${frameFn(p)} }`);
      if (settings.dymkiWlaczone) {
        const tipSel = `.tip-wrapper.normal-tip[data-item-type="${r.fallback}"], .tip-wrapper.cmp-tip[data-item-type="${r.fallback}"]`;
        rules.push(`${tipSel} { ${tipFn(p)} }`);
      }
    });

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
