// ==UserScript==
// @name         Harkdonz - Notyfikator legend
// @namespace    margonem-addon-loader
// @version      4.0.0
// @description  Wierny port silnika glow/dźwięk z oryginalnego dodatku "Shacal Customizer" (modules/glow.js) pod nasz loader: 4 style (klasyczny neon, retro 80s, wewnętrzna aura, energy-canvas), 3 niezależne warstwy kolor/siła/szerokość, podświetlenie itemu, glow mapy, tłumienie natywnego glow gry.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js
// ==/UserScript==

/**
 * Wierny port modules/glow.js z oryginalnego Shacal Customizera (nie nasza wcześniejsza,
 * uproszczona reinterpretacja). Zachowana matematyka cieni/poświat, logika wykrywania okna
 * łupu (dropMode: 'normal' = zwykłe przedmioty bez legendarnych, 'legendary' = tylko
 * legendarne - dokładnie jak w oryginale, łącznie z tym, że domyślny tryb "normal" pomija
 * okna z legendarnym przedmiotem), tłumienie natywnego różowego glow gry (::after/::before),
 * glow mapy jako sibling .game-layer (nie prosty overlay na #GAME_CANVAS), podświetlenie
 * pojedynczego itemu (tylko w stylu retro 80s, tak jak w oryginale), tryb "energy" rysowany
 * na canvasie.
 *
 * Jedyna świadoma zmiana: oryginalny katalog 30 gotowych dźwięków mp3 był hostowany na
 * starym koncie (shacal97.github.io) - nie mamy do niego praw ani dostępu, więc zamiast
 * tego dźwięki są generowane na żywo przez Web Audio (zero zależności od cudzego hostingu)
 * + można wkleić własny URL pliku dźwiękowego.
 */
const Addon = {
  id: 'notyfikator-legend',
  name: 'Notyfikator legend',
  description: 'Poświaty, dźwięki i animacje przy zdobyczy łupu - wierny port oryginalnego dodatku (4 style, 3 warstwy kolorów, glow mapy, podświetlenie itemu).',
  version: '4.0.0',
  updateCheckUrl: 'https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js',
  defaultEnabled: false,
  defaultSettings: {
    dropMode: 'normal',
    glowStyle: 1,
    color1: '#63f59a', glow1: 3, opacity1: 4, width1: 2,
    color2: '#d8b800', glow2: 3, opacity2: 4, width2: 3,
    color3: '#e12b77', glow3: 2, opacity3: 3, width3: 4,
    pulse: 3,
    effect: 1,
    lootSoundEnabled: true,
    soundPreset: 'chime',
    customSoundUrl: '',
    volume: 3,
  },
  settingsSchema: [
    {
      key: 'dropMode', type: 'select', label: 'Które okna łupu dostają efekt',
      options: [
        { value: 'normal', label: 'Zwykłe przedmioty (bez legendarnych)' },
        { value: 'legendary', label: 'Tylko legendarne przedmioty' },
      ],
    },
    {
      key: 'glowStyle', type: 'select', label: 'Styl poświaty',
      options: [
        { value: '1', label: 'Klasyczny neon' },
        { value: '2', label: 'Retro 80s (+ podświetlenie itemu)' },
        { value: '3', label: 'Wewnętrzna aura' },
        { value: '4', label: 'Energy (animowany canvas)' },
      ],
    },
    { key: 'color1', type: 'color', label: 'Kolor warstwy 1', default: '#63f59a' },
    { key: 'glow1', type: 'number', label: 'Siła warstwy 1 (0-5)', min: 0, max: 5 },
    { key: 'opacity1', type: 'number', label: 'Krycie warstwy 1 (0-5)', min: 0, max: 5 },
    { key: 'width1', type: 'number', label: 'Szerokość warstwy 1 (0-5, przy aurze do 15)', min: 0, max: 15 },
    { key: 'color2', type: 'color', label: 'Kolor warstwy 2', default: '#d8b800' },
    { key: 'glow2', type: 'number', label: 'Siła warstwy 2 (0-5)', min: 0, max: 5 },
    { key: 'opacity2', type: 'number', label: 'Krycie warstwy 2 (0-5)', min: 0, max: 5 },
    { key: 'width2', type: 'number', label: 'Szerokość warstwy 2 (0-5)', min: 0, max: 5 },
    { key: 'color3', type: 'color', label: 'Kolor warstwy 3', default: '#e12b77' },
    { key: 'glow3', type: 'number', label: 'Siła warstwy 3 (0-5)', min: 0, max: 5 },
    { key: 'opacity3', type: 'number', label: 'Krycie warstwy 3 (0-5)', min: 0, max: 5 },
    { key: 'width3', type: 'number', label: 'Szerokość warstwy 3 (0-5)', min: 0, max: 5 },
    { key: 'pulse', type: 'number', label: 'Tętnienie (0-5, 0 = statyczne)', min: 0, max: 5 },
    {
      key: 'effect', type: 'select', label: 'Animacja',
      options: [
        { value: '0', label: 'Brak' },
        { value: '1', label: 'Pulsowanie' },
        { value: '2', label: 'Migotanie' },
        { value: '3', label: 'Płynąca zmiana kolorów' },
      ],
    },
    { key: 'lootSoundEnabled', type: 'boolean', label: 'Dźwięk przy nowym przedmiocie' },
    {
      key: 'soundPreset', type: 'select', label: 'Dźwięk',
      options: [
        { value: 'none', label: 'Brak' },
        { value: 'chime', label: 'Dzwonek' },
        { value: 'fanfare', label: 'Fanfara' },
        { value: 'crystal', label: 'Kryształ' },
        { value: 'electronic', label: 'Elektroniczny' },
        { value: 'soft', label: 'Cichy ton' },
        { value: 'custom', label: 'Własny plik (URL poniżej)' },
      ],
    },
    { key: 'customSoundUrl', type: 'text', label: 'URL własnego dźwięku (gdy wybrany "Własny plik")', placeholder: 'https://.../dzwiek.mp3' },
    { key: 'volume', type: 'number', label: 'Głośność (0-5)', min: 0, max: 5 },
    { key: 'testSound', type: 'button', label: 'Testuj dźwięk', onClick() { this.playTestSound(); } },
    { key: 'testWindow', type: 'button', label: 'Testuj efekt (pokaż okno próbne)', onClick() { this.toggleTestWindow(); } },
  ],

  // --- Stałe (jak w oryginale) ---
  DROP_MODE_LEGENDARY: 'legendary',
  STYLE_CLASSIC: 1,
  STYLE_NEON_80S: 2,
  STYLE_INNER_AURA: 3,
  STYLE_ENERGY: 4,
  EFFECT_MOVING_COLORS: 3,
  INNER_AURA_MAP_WIDTH_MAX: 15,
  MAP_GLOW_INSET: 8,
  GLOW_Z_CEILING: 999998,

  settings: null,
  running: false,

  // --- Matematyka poświaty (1:1 z oryginałem) ---
  clampLevel(value) {
    return Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  },
  clampInnerAuraMapWidth(value) {
    return Math.max(0, Math.min(this.INNER_AURA_MAP_WIDTH_MAX, Number(value) || 0));
  },
  internalLevel(value) {
    return this.clampLevel(value) * 2;
  },
  opacityLevel(value) {
    const level = this.internalLevel(value);
    if (level === 0) return 0;
    const table = [0.00, 0.06, 0.10, 0.16, 0.24, 0.34, 0.47, 0.62, 0.77, 0.90, 1.00];
    return table[level];
  },
  spatialLevel(value) {
    const level = this.internalLevel(value);
    const table = [0.00, 0.35, 0.55, 0.80, 1.10, 1.50, 2.00, 2.65, 3.45, 4.40, 5.50];
    return table[level];
  },
  innerAuraMapSpatialLevel(value) {
    const width = this.clampInnerAuraMapWidth(value);
    if (width <= 5) return this.spatialLevel(width);
    return this.spatialLevel(5) + (width - 5) * 2.20;
  },
  hexToRgba(hex, alpha) {
    let value = String(hex || '').replace('#', '').trim();
    if (value.length === 3) value = value.split('').map((ch) => ch + ch).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(value)) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  },

  buildNeonShadow(multiplier = 1, colorOverride = null) {
    const s = this.settings;
    const colors = Array.isArray(colorOverride) ? colorOverride : [s.color1, s.color2, s.color3];
    const levels = [this.clampLevel(s.glow1), this.clampLevel(s.glow2), this.clampLevel(s.glow3)];
    const opacities = [this.opacityLevel(s.opacity1), this.opacityLevel(s.opacity2), this.opacityLevel(s.opacity3)];
    const widths = [this.clampLevel(s.width1), this.clampLevel(s.width2), this.clampLevel(s.width3)];
    const shadows = [];
    const boosts = [0.60, 0.60, 0.65];
    const boostRanges = [0.70, 0.70, 0.75];
    for (let i = 0; i < 3; i++) {
      if (levels[i] <= 0 || opacities[i] <= 0 || widths[i] <= 0) continue;
      const l = this.internalLevel(levels[i]);
      const ls = this.spatialLevel(levels[i]);
      const ws = this.spatialLevel(widths[i]);
      const c = colors[i];
      const strengthBoost = boosts[i] + (ls / 5.5) * boostRanges[i];
      const o = Math.min(1, opacities[i] * strengthBoost);
      if (i === 0) {
        shadows.push(`0 0 ${Math.round((2 + ls * 2) * multiplier)}px 0 ${this.hexToRgba(c, Math.min(1, o * 1.15))}`);
        shadows.push(`0 0 ${Math.round((8 + ws * 5) * multiplier)}px ${Math.round((2 + ws * 3) * multiplier)}px ${this.hexToRgba(c, Math.min(1, o * 1.00))}`);
        shadows.push(`0 0 ${Math.round((15 + ws * 7) * multiplier)}px ${Math.round((5 + ws * 5) * multiplier)}px ${this.hexToRgba(c, Math.min(1, o * 0.72))}`);
      } else if (i === 1) {
        shadows.push(`0 0 ${Math.round((13 + ws * 7) * multiplier)}px ${Math.round((12 + ws * 10) * multiplier)}px ${this.hexToRgba(c, Math.min(1, o * 1.00))}`);
        shadows.push(`0 0 ${Math.round((22 + ws * 10) * multiplier)}px ${Math.round((18 + ws * 15) * multiplier)}px ${this.hexToRgba(c, Math.min(1, o * 0.76))}`);
        shadows.push(`0 0 ${Math.round((32 + ws * 12) * multiplier)}px ${Math.round((24 + ws * 19) * multiplier)}px ${this.hexToRgba(c, Math.min(1, o * 0.52))}`);
      } else {
        shadows.push(`0 0 ${Math.round((16 + ws * 8) * multiplier)}px ${Math.round((30 + ws * 21) * multiplier)}px ${this.hexToRgba(c, Math.min(1, o * 1.00))}`);
        shadows.push(`0 0 ${Math.round((28 + ws * 11) * multiplier)}px ${Math.round((42 + ws * 27) * multiplier)}px ${this.hexToRgba(c, Math.min(1, o * 0.82))}`);
        shadows.push(`0 0 ${Math.round((42 + ws * 15) * multiplier)}px ${Math.round((55 + ws * 34) * multiplier)}px ${this.hexToRgba(c, Math.min(1, o * 0.58))}`);
      }
    }
    return shadows.length ? shadows.join(', ') : 'none';
  },

  getInnerAuraParams(multiplier = 1, allowExtendedMapWidth = false) {
    const s = this.settings;
    const level = this.internalLevel(this.clampLevel(s.glow1));
    const rawWidth = allowExtendedMapWidth ? this.clampInnerAuraMapWidth(s.width1) : this.clampLevel(s.width1);
    const width = allowExtendedMapWidth ? this.innerAuraMapSpatialLevel(rawWidth) : this.spatialLevel(rawWidth);
    const opacity = this.opacityLevel(s.opacity1);
    const color = s.color1;
    if (this.clampLevel(s.glow1) <= 0 || rawWidth <= 0 || opacity <= 0) return null;
    const strength = Math.min(1, opacity * (0.78 + level * 0.03));
    const tightBlur = Math.max(3, Math.round((4 + level * 0.55 + width * 0.75) * multiplier));
    const mediumBlur = Math.max(12, Math.round((18 + level * 1.15 + width * 2.4) * multiplier));
    const softBlur = Math.max(24, Math.round((38 + level * 1.65 + width * 4.6) * multiplier));
    const tightSpread = Math.min(2.5, (0.15 + width * 0.16) * multiplier);
    const mediumSpread = Math.min(9, (1.0 + width * 0.52) * multiplier);
    const softSpread = Math.min(15, (1.5 + width * 0.78) * multiplier);
    return { color, strength, tightBlur, mediumBlur, softBlur, tightSpread, mediumSpread, softSpread };
  },
  buildInnerAuraLootShadow(multiplier = 1) {
    const aura = this.getInnerAuraParams(multiplier);
    if (!aura) return 'none';
    return [
      `0 0 ${aura.tightBlur}px ${aura.tightSpread.toFixed(1)}px ${this.hexToRgba(aura.color, Math.min(1, aura.strength * 0.95))}`,
      `0 0 ${aura.mediumBlur}px ${aura.mediumSpread.toFixed(1)}px ${this.hexToRgba(aura.color, Math.min(0.72, aura.strength * 0.55))}`,
      `0 0 ${aura.softBlur}px ${aura.softSpread.toFixed(1)}px ${this.hexToRgba(aura.color, Math.min(0.34, aura.strength * 0.24))}`,
    ].join(', ');
  },
  buildInnerAuraMapShadow(multiplier = 1) {
    const aura = this.getInnerAuraParams(multiplier, true);
    if (!aura) return 'none';
    return [
      `inset 0 0 ${aura.tightBlur}px ${aura.tightSpread.toFixed(1)}px ${this.hexToRgba(aura.color, Math.min(1, aura.strength * 0.90))}`,
      `inset 0 0 ${aura.mediumBlur}px ${aura.mediumSpread.toFixed(1)}px ${this.hexToRgba(aura.color, Math.min(0.66, aura.strength * 0.50))}`,
      `inset 0 0 ${aura.softBlur}px ${aura.softSpread.toFixed(1)}px ${this.hexToRgba(aura.color, Math.min(0.30, aura.strength * 0.20))}`,
    ].join(', ');
  },

  buildRetroNeonShadow(multiplier = 1, colorOverride = null) {
    const s = this.settings;
    const colors = Array.isArray(colorOverride) ? colorOverride : [s.color1, s.color2, s.color3];
    const levels = [this.clampLevel(s.glow1), this.clampLevel(s.glow2), this.clampLevel(s.glow3)];
    const opacities = [this.opacityLevel(s.opacity1), this.opacityLevel(s.opacity2), this.opacityLevel(s.opacity3)];
    const widths = [this.clampLevel(s.width1), this.clampLevel(s.width2), this.clampLevel(s.width3)];
    const shadows = [];
    shadows.push(`0 0 ${Math.max(2, Math.round(3 * multiplier))}px 0 rgba(255,255,255,0.98)`);
    shadows.push(`inset 0 0 ${Math.max(2, Math.round(3 * multiplier))}px 0 rgba(255,255,255,0.98)`);
    for (let index = 0; index < 3; index++) {
      const level = this.internalLevel(levels[index]);
      const width = this.spatialLevel(widths[index]);
      const opacity = opacities[index];
      if (levels[index] <= 0 || opacity <= 0 || widths[index] <= 0) continue;
      const color = colors[index];
      const strength = Math.min(1, opacity * (0.72 + level * 0.035));
      const layerScale = 1 + index * 0.42;
      const tightBlur = (5 + level * 0.55 + width * 1.05) * layerScale * multiplier;
      const mediumBlur = (11 + level * 0.75 + width * 2.0) * layerScale * multiplier;
      const softBlur = (20 + level * 0.95 + width * 3.3) * layerScale * multiplier;
      const tightSpread = Math.min(3.5, (0.4 + width * 0.28) * layerScale * multiplier);
      const mediumSpread = Math.min(5.5, (0.8 + width * 0.40) * layerScale * multiplier);
      const softSpread = Math.min(7.5, (1.2 + width * 0.55) * layerScale * multiplier);
      const tightAlpha = Math.min(1, strength * 0.95);
      const mediumAlpha = Math.min(0.72, strength * 0.56);
      const softAlpha = Math.min(0.32, strength * 0.22);
      shadows.push(`0 0 ${Math.round(tightBlur)}px ${tightSpread.toFixed(1)}px ${this.hexToRgba(color, tightAlpha)}`);
      shadows.push(`0 0 ${Math.round(mediumBlur)}px ${mediumSpread.toFixed(1)}px ${this.hexToRgba(color, mediumAlpha)}`);
      shadows.push(`0 0 ${Math.round(softBlur)}px ${softSpread.toFixed(1)}px ${this.hexToRgba(color, softAlpha)}`);
      shadows.push(`inset 0 0 ${Math.round(tightBlur)}px ${tightSpread.toFixed(1)}px ${this.hexToRgba(color, tightAlpha)}`);
      shadows.push(`inset 0 0 ${Math.round(mediumBlur)}px ${mediumSpread.toFixed(1)}px ${this.hexToRgba(color, mediumAlpha)}`);
      shadows.push(`inset 0 0 ${Math.round(softBlur)}px ${softSpread.toFixed(1)}px ${this.hexToRgba(color, softAlpha)}`);
    }
    return shadows.length ? shadows.join(', ') : 'none';
  },
  buildRetroNeonItemShadow(colorOverride = null) {
    const s = this.settings;
    const colors = Array.isArray(colorOverride) ? colorOverride : [s.color1, s.color2, s.color3];
    const levels = [this.clampLevel(s.glow1), this.clampLevel(s.glow2), this.clampLevel(s.glow3)];
    const opacities = [this.opacityLevel(s.opacity1), this.opacityLevel(s.opacity2), this.opacityLevel(s.opacity3)];
    const widths = [this.clampLevel(s.width1), this.clampLevel(s.width2), this.clampLevel(s.width3)];
    const shadows = ['0 0 2px 0 rgba(255,255,255,0.92)'];
    for (let index = 0; index < 3; index++) {
      if (levels[index] <= 0 || opacities[index] <= 0 || widths[index] <= 0) continue;
      const level = this.internalLevel(levels[index]);
      const width = this.spatialLevel(widths[index]);
      const color = colors[index];
      const strength = Math.min(1, opacities[index] * (0.68 + level * 0.025));
      const layerScale = 1 + index * 0.18;
      const tightBlur = (3 + level * 0.28 + width * 0.45) * layerScale;
      const mediumBlur = (6 + level * 0.38 + width * 0.85) * layerScale;
      const softBlur = (10 + level * 0.48 + width * 1.25) * layerScale;
      const tightSpread = Math.min(1.8, 0.2 + width * 0.12);
      const mediumSpread = Math.min(2.6, 0.4 + width * 0.18);
      const softSpread = Math.min(3.4, 0.7 + width * 0.24);
      shadows.push(`0 0 ${Math.round(tightBlur)}px ${tightSpread.toFixed(1)}px ${this.hexToRgba(color, Math.min(0.82, strength * 0.72))}`);
      shadows.push(`0 0 ${Math.round(mediumBlur)}px ${mediumSpread.toFixed(1)}px ${this.hexToRgba(color, Math.min(0.46, strength * 0.34))}`);
      shadows.push(`0 0 ${Math.round(softBlur)}px ${softSpread.toFixed(1)}px ${this.hexToRgba(color, Math.min(0.20, strength * 0.14))}`);
    }
    return shadows.join(', ');
  },

  getMainNeonColor() {
    const s = this.settings;
    if (this.clampLevel(s.glow1) > 0 && this.opacityLevel(s.opacity1) > 0 && this.clampLevel(s.width1) > 0) return s.color1;
    if (this.clampLevel(s.glow2) > 0 && this.opacityLevel(s.opacity2) > 0 && this.clampLevel(s.width2) > 0) return s.color2;
    if (this.clampLevel(s.glow3) > 0 && this.opacityLevel(s.opacity3) > 0 && this.clampLevel(s.width3) > 0) return s.color3;
    return 'transparent';
  },
  hasAnyGlowLayer() {
    const s = this.settings;
    return (
      (this.clampLevel(s.glow1) > 0 && this.opacityLevel(s.opacity1) > 0 && this.clampLevel(s.width1) > 0) ||
      (this.clampLevel(s.glow2) > 0 && this.opacityLevel(s.opacity2) > 0 && this.clampLevel(s.width2) > 0) ||
      (this.clampLevel(s.glow3) > 0 && this.opacityLevel(s.opacity3) > 0 && this.clampLevel(s.width3) > 0)
    );
  },
  hasGlowForCurrentStyle() {
    if (Number(this.settings.glowStyle) === this.STYLE_INNER_AURA) {
      return this.clampLevel(this.settings.glow1) > 0 && this.opacityLevel(this.settings.opacity1) > 0 && this.clampInnerAuraMapWidth(this.settings.width1) > 0;
    }
    return this.hasAnyGlowLayer();
  },
  getPulseConfig() {
    const level = this.clampLevel(this.settings.pulse);
    if (level === 0) return { enabled: false, duration: 0 };
    return { enabled: true, duration: { 1: 2.8, 2: 2.1, 3: 1.5, 4: 1.0, 5: 0.65 }[level] };
  },
  getGlowSettingsSignature() {
    const s = this.settings;
    return JSON.stringify({
      dropMode: s.dropMode, glowStyle: s.glowStyle, color1: s.color1, color2: s.color2, color3: s.color3,
      glow1: s.glow1, glow2: s.glow2, glow3: s.glow3, opacity1: s.opacity1, opacity2: s.opacity2, opacity3: s.opacity3,
      width1: s.width1, width2: s.width2, width3: s.width3, effect: s.effect, pulse: s.pulse,
    });
  },

  // --- Detekcja okna łupu (dokładnie jak w oryginale - w trybie "normal" pomija okna z legendą) ---
  isTargetLootWindow(windowElement) {
    if (!windowElement) return false;
    const hasAnyItem = !!windowElement.querySelector('.loot-window .items-wrapper .item, .item');
    const hasLegendaryItem = !!windowElement.querySelector('[data-frame-mania-rarity="legendary"], [data-item-type="t-leg"]');
    if (this.settings.dropMode === this.DROP_MODE_LEGENDARY) return hasLegendaryItem;
    return hasAnyItem && !hasLegendaryItem;
  },
  isElementVisible(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) return false;
    }
    return true;
  },
  getActiveGlowLootWindows() {
    return Array.from(document.querySelectorAll('.loot-wnd')).filter(
      (w) => this.isElementVisible(w) && this.isTargetLootWindow(w) && this.hasGlowForCurrentStyle()
    );
  },

  // --- Dźwięk (WŁASNY system - Web Audio generowane presety zamiast cudzego hostingu mp3) ---
  audioCtx: null,
  soundedItems: null,
  activeLootSounds: null,
  ensureAudioCtx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    return this.audioCtx;
  },
  playPresetTone(presetId, volumeLevel) {
    const volumeTable = [0.00, 0.18, 0.32, 0.50, 0.72, 1.00];
    const masterGain = volumeTable[Math.max(0, Math.min(5, Math.round(Number(volumeLevel) || 0)))];
    if (masterGain <= 0) return;
    const ctx = this.ensureAudioCtx();
    const now = ctx.currentTime;
    const notes = {
      chime: { wave: 'sine', freqs: [880, 1318.5], gap: 0.09, decay: 0.5 },
      fanfare: { wave: 'triangle', freqs: [523.25, 659.25, 783.99], gap: 0.11, decay: 0.45 },
      crystal: { wave: 'sine', freqs: [1046.5, 1318.5, 1568, 2093], gap: 0.06, decay: 0.35 },
      electronic: { wave: 'square', freqs: [440, 880], gap: 0.07, decay: 0.12 },
      soft: { wave: 'sine', freqs: [660], gap: 0, decay: 0.9 },
    }[presetId];
    if (!notes) return;
    notes.freqs.forEach((freq, i) => {
      const start = now + i * notes.gap;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = notes.wave;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(masterGain * 0.35, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + notes.decay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + notes.decay + 0.05);
    });
  },
  playCustomUrlSound(url, volumeLevel) {
    if (!url) return null;
    const volumeTable = [0.00, 0.18, 0.32, 0.50, 0.72, 1.00];
    try {
      const audio = new Audio(url);
      audio.volume = volumeTable[Math.max(0, Math.min(5, Math.round(Number(volumeLevel) || 0)))];
      audio.play().catch(() => {});
      return audio;
    } catch (_) {
      return null;
    }
  },
  playLegendSound(soundPreset = this.settings.soundPreset, volume = this.settings.volume) {
    if (!soundPreset || soundPreset === 'none') return;
    if (soundPreset === 'custom') return this.playCustomUrlSound(this.settings.customSoundUrl, volume);
    this.playPresetTone(soundPreset, volume);
    return null;
  },
  playTestSound() {
    this.playLegendSound(this.settings.soundPreset, this.settings.volume);
  },
  getSoundEffectItems(windowElement) {
    if (!windowElement || windowElement.classList.contains('mal-nl-test-window')) return [];
    if (this.settings.dropMode === this.DROP_MODE_LEGENDARY) {
      return Array.from(windowElement.querySelectorAll('[data-frame-mania-rarity="legendary"], [data-item-type="t-leg"]'));
    }
    const hasLegendaryItem = !!windowElement.querySelector('[data-frame-mania-rarity="legendary"], [data-item-type="t-leg"]');
    if (hasLegendaryItem) return [];
    return Array.from(windowElement.querySelectorAll('.loot-window .items-wrapper .item'));
  },
  playLegendSoundForNewItems(windowElement) {
    if (!windowElement || windowElement.classList.contains('mal-nl-test-window')) return;
    const items = this.getSoundEffectItems(windowElement);
    items.forEach((item) => {
      if (this.soundedItems.has(item)) return;
      this.soundedItems.add(item);
      if (!this.settings.lootSoundEnabled) return;
      this.playLegendSound();
    });
  },

  // --- Overlaye: okno łupu ---
  glowOverlayMap: null,
  itemGlowOverlayMap: null,
  ensureGlowOverlay(windowElement) {
    let overlay = this.glowOverlayMap.get(windowElement);
    if (overlay && document.body.contains(overlay)) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'mal-nl-glow-overlay';
    document.body.appendChild(overlay);
    this.glowOverlayMap.set(windowElement, overlay);
    return overlay;
  },
  removeGlowOverlay(windowElement) {
    const overlay = this.glowOverlayMap.get(windowElement);
    if (overlay) overlay.remove();
    this.glowOverlayMap.delete(windowElement);
    this.removeItemGlowOverlays(windowElement);
  },
  positionGlowOverlay(windowElement, overlay) {
    const rect = windowElement.getBoundingClientRect();
    const style = Number(this.settings.glowStyle) || this.STYLE_CLASSIC;
    const useLootFrameInset = style === this.STYLE_CLASSIC || style === this.STYLE_INNER_AURA;
    const insetX = useLootFrameInset ? 8 : 0;
    const insetY = useLootFrameInset ? 4 : 0;
    overlay.style.left = `${rect.left + insetX}px`;
    overlay.style.top = `${rect.top + insetY}px`;
    overlay.style.width = `${Math.max(0, rect.width - insetX * 2)}px`;
    overlay.style.height = `${Math.max(0, rect.height - insetY * 2)}px`;
    const computedZ = Number.parseInt(getComputedStyle(windowElement).zIndex, 10);
    const inlineZ = Number.parseInt(windowElement.style.zIndex, 10);
    const lootZ = Number.isFinite(computedZ) ? computedZ : Number.isFinite(inlineZ) ? inlineZ : 1;
    overlay.style.zIndex = String(Math.min(lootZ - 1, this.GLOW_Z_CEILING));
  },
  removeItemGlowOverlays(windowElement) {
    const overlays = this.itemGlowOverlayMap.get(windowElement);
    if (overlays) overlays.forEach((o) => o.remove());
    this.itemGlowOverlayMap.delete(windowElement);
  },
  ensureItemGlowOverlays(windowElement) {
    if (Number(this.settings.glowStyle) !== this.STYLE_NEON_80S) {
      this.removeItemGlowOverlays(windowElement);
      return;
    }
    const wrappers = Array.from(windowElement.querySelectorAll('.loot-window .items-wrapper > .loot-item-wrapper')).filter(
      (w) => w.querySelector('.item[data-item-type="t-leg"], .item[data-frame-mania-rarity="legendary"]')
    );
    if (!wrappers.length) {
      this.removeItemGlowOverlays(windowElement);
      return;
    }
    let overlays = this.itemGlowOverlayMap.get(windowElement);
    if (!overlays) {
      overlays = [];
      this.itemGlowOverlayMap.set(windowElement, overlays);
    }
    while (overlays.length > wrappers.length) overlays.pop().remove();
    while (overlays.length < wrappers.length) {
      const overlay = document.createElement('div');
      overlay.className = 'mal-nl-item-frame';
      document.body.appendChild(overlay);
      overlays.push(overlay);
    }
    const windowZ = Number.parseInt(getComputedStyle(windowElement).zIndex, 10);
    const isTestWindow = windowElement.classList.contains('mal-nl-test-window');
    const requestedItemZ = Number.isFinite(windowZ) ? (isTestWindow ? windowZ + 1 : windowZ - 1) : 0;
    const itemZ = Math.min(requestedItemZ, this.GLOW_Z_CEILING);
    const itemShadow = this.buildRetroNeonItemShadow();
    wrappers.forEach((wrapper, index) => {
      const overlay = overlays[index];
      const rect = wrapper.getBoundingClientRect();
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.zIndex = String(itemZ);
      if (overlay.style.boxShadow !== itemShadow) overlay.style.boxShadow = itemShadow;
      overlay.style.display = 'block';
    });
  },

  // --- Overlay mapy (sibling .game-layer, nie prosty overlay na canvasie) ---
  mapGlowOverlay: null,
  cachedMapBounds: null,
  cachedMapBoundsAt: 0,
  findMapBoundsElement() {
    const now = performance.now();
    const cached = this.cachedMapBounds;
    if (cached && cached.isConnected && now - this.cachedMapBoundsAt < 250) {
      const r = cached.getBoundingClientRect();
      if (r.width >= 300 && r.height >= 200 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight) return cached;
    }
    const remember = (el) => { this.cachedMapBounds = el; this.cachedMapBoundsAt = now; return el; };
    const isEffect = (el) => !!el.closest('.mal-nl-glow-overlay, .mal-nl-map-frame, .mal-nl-energy-canvas');
    const selectors = ['.map-wrapper', '.map-layer', '.game-window', '[class*="map-wrapper"]', '[class*="map-layer"]'];
    const candidates = [];
    selectors.forEach((selector, priority) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (isEffect(element)) return;
        const rect = element.getBoundingClientRect();
        if (rect.width >= 300 && rect.height >= 200 && rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight) {
          candidates.push({ element, rect, priority });
        }
      });
    });
    if (candidates.length) {
      candidates.sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : b.rect.width * b.rect.height - a.rect.width * a.rect.height));
      return remember(candidates[0].element);
    }
    const canvases = Array.from(document.querySelectorAll('canvas'))
      .filter((el) => !isEffect(el))
      .map((el) => ({ element: el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width >= 300 && rect.height >= 200 && rect.right > 0 && rect.bottom > 0)
      .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);
    return canvases.length ? remember(canvases[0].element) : null;
  },
  getMapGlowGameLayer(mapElement) {
    return mapElement instanceof Element ? mapElement.closest('.game-layer') || null : null;
  },
  getMapGlowHost(mapElement) {
    const gameLayer = this.getMapGlowGameLayer(mapElement);
    return gameLayer?.parentElement || mapElement?.parentElement || null;
  },
  ensureMapGlowOverlay(mapElement) {
    const gameLayer = this.getMapGlowGameLayer(mapElement);
    const host = this.getMapGlowHost(mapElement);
    if (!host) return null;
    if (this.mapGlowOverlay && (this.mapGlowOverlay.contains(host) || this.mapGlowOverlay.contains(mapElement))) return null;
    if (!this.mapGlowOverlay) {
      this.mapGlowOverlay = document.createElement('div');
      this.mapGlowOverlay.className = 'mal-nl-map-frame';
    }
    const referenceNode = gameLayer && gameLayer.parentElement === host ? gameLayer.nextSibling : null;
    const isInCorrectPlace = this.mapGlowOverlay.parentElement === host && (gameLayer ? this.mapGlowOverlay.previousSibling === gameLayer : true);
    if (!isInCorrectPlace) {
      if (gameLayer) host.insertBefore(this.mapGlowOverlay, referenceNode);
      else host.appendChild(this.mapGlowOverlay);
    }
    return this.mapGlowOverlay;
  },
  ensureMapNeonCoreLines(overlay) {
    if (!(overlay instanceof Element)) return [];
    overlay.querySelectorAll('.mal-nl-map-core:not(.mal-nl-map-core-ring)').forEach((n) => n.remove());
    let ring = overlay.querySelector('.mal-nl-map-core-ring');
    if (!ring) {
      ring = document.createElement('div');
      ring.className = 'mal-nl-map-core mal-nl-map-core-ring';
      overlay.appendChild(ring);
    }
    return [ring];
  },
  setMapNeonCoreVisible(overlay, visible) {
    this.ensureMapNeonCoreLines(overlay).forEach((line) => { line.style.display = visible ? 'block' : 'none'; });
  },
  removeMapGlowOverlay() {
    if (this.mapGlowOverlay) {
      this.mapGlowOverlay.getAnimations().forEach((a) => a.cancel());
      this.mapGlowOverlay.remove();
    }
    this.mapGlowOverlay = null;
  },
  positionMapGlowOverlay(overlay, mapElement, style) {
    if (!(overlay instanceof Element) || !(mapElement instanceof Element)) return;
    const mapRect = mapElement.getBoundingClientRect();
    const containingBlock = overlay.offsetParent instanceof Element ? overlay.offsetParent : overlay.parentElement;
    const hostRect = containingBlock ? containingBlock.getBoundingClientRect() : { left: 0, top: 0 };
    const scrollLeft = containingBlock ? containingBlock.scrollLeft : 0;
    const scrollTop = containingBlock ? containingBlock.scrollTop : 0;
    const requestedInset = style === this.STYLE_ENERGY ? 12 : style === this.STYLE_NEON_80S ? this.MAP_GLOW_INSET : 0;
    const inset = Math.min(requestedInset, Math.max(0, Math.min(mapRect.width, mapRect.height) / 4));
    overlay.style.left = `${mapRect.left - hostRect.left + scrollLeft + inset}px`;
    overlay.style.top = `${mapRect.top - hostRect.top + scrollTop + inset}px`;
    overlay.style.width = `${Math.max(0, mapRect.width - inset * 2)}px`;
    overlay.style.height = `${Math.max(0, mapRect.height - inset * 2)}px`;
    overlay.style.zIndex = 'auto';
  },

  // --- Animacje (pulsowanie / migotanie / płynąca zmiana kolorów) ---
  buildAnimationFrames(baseShadow, peakShadow, softShadow, movingA, movingB, movingC, effect, pulseDuration) {
    if (effect === 1) return { frames: [{ boxShadow: baseShadow, opacity: 1 }, { boxShadow: peakShadow, opacity: 0.94 }], opts: { duration: (pulseDuration * 1000) / 2, iterations: Infinity, direction: 'alternate', easing: 'cubic-bezier(0.42, 0, 0.58, 1)' } };
    if (effect === 2) return { frames: [{ boxShadow: baseShadow, opacity: 0.94 }, { boxShadow: softShadow, opacity: 1, offset: 0.17 }, { boxShadow: baseShadow, opacity: 0.90, offset: 0.31 }, { boxShadow: peakShadow, opacity: 0.98, offset: 0.48 }, { boxShadow: softShadow, opacity: 0.92, offset: 0.67 }, { boxShadow: peakShadow, opacity: 1, offset: 0.82 }, { boxShadow: baseShadow, opacity: 0.94 }], opts: { duration: pulseDuration * 1000 * 1.35, iterations: Infinity, easing: 'ease-in-out' } };
    if (effect === 3) return { frames: [{ boxShadow: movingA, opacity: 1, offset: 0 }, { boxShadow: movingB, opacity: 1, offset: 0.333333 }, { boxShadow: movingC, opacity: 1, offset: 0.666667 }, { boxShadow: movingA, opacity: 1, offset: 1 }], opts: { duration: pulseDuration * 1000 * 2.25, iterations: Infinity, easing: 'linear' } };
    return null;
  },
  applyMapGlowAnimation(overlay) {
    const signature = 'map:' + this.getGlowSettingsSignature();
    if (overlay.dataset.malGlowCache === signature) return;
    overlay.dataset.malGlowCache = signature;
    const pulse = this.getPulseConfig();
    const effect = Math.max(0, Math.min(3, Number(this.settings.effect) || 0));
    const pulseMultiplier = { 0: 1, 1: 1.08, 2: 1.16, 3: 1.26, 4: 1.38, 5: 1.52 }[this.clampLevel(this.settings.pulse)];
    const s = this.settings;
    const baseShadow = this.buildRetroNeonShadow(1);
    const peakShadow = this.buildRetroNeonShadow(pulseMultiplier);
    const softShadow = this.buildRetroNeonShadow(1 + (pulseMultiplier - 1) * 0.45);
    const movingA = this.buildRetroNeonShadow(1, [s.color1, s.color2, s.color3]);
    const movingB = this.buildRetroNeonShadow(1, [s.color2, s.color3, s.color1]);
    const movingC = this.buildRetroNeonShadow(1, [s.color3, s.color1, s.color2]);
    overlay.getAnimations().forEach((a) => a.cancel());
    overlay.style.boxShadow = baseShadow;
    overlay.style.opacity = '1';
    if (!pulse.enabled || effect === 0) return;
    const anim = this.buildAnimationFrames(baseShadow, peakShadow, softShadow, movingA, movingB, movingC, effect, pulse.duration);
    if (anim) overlay.animate(anim.frames, anim.opts);
  },
  applyInnerAuraMapAnimation(overlay) {
    const signature = 'inner:' + this.getGlowSettingsSignature();
    if (overlay.dataset.malGlowCache === signature) return;
    overlay.dataset.malGlowCache = signature;
    const pulse = this.getPulseConfig();
    const effect = Math.max(0, Math.min(2, Number(this.settings.effect) || 0));
    const pulseMultiplier = { 0: 1, 1: 1.08, 2: 1.16, 3: 1.26, 4: 1.38, 5: 1.52 }[this.clampLevel(this.settings.pulse)];
    const baseShadow = this.buildInnerAuraMapShadow(1);
    const peakShadow = this.buildInnerAuraMapShadow(pulseMultiplier);
    const softShadow = this.buildInnerAuraMapShadow(1 + (pulseMultiplier - 1) * 0.45);
    overlay.getAnimations().forEach((a) => a.cancel());
    overlay.style.boxShadow = baseShadow;
    overlay.style.opacity = '1';
    if (!pulse.enabled || effect === 0) return;
    if (effect === 1) {
      overlay.animate([{ boxShadow: baseShadow, opacity: 1 }, { boxShadow: peakShadow, opacity: 0.94 }], { duration: (pulse.duration * 1000) / 2, iterations: Infinity, direction: 'alternate', easing: 'cubic-bezier(0.42, 0, 0.58, 1)' });
    } else if (effect === 2) {
      overlay.animate([{ boxShadow: baseShadow, opacity: 0.94 }, { boxShadow: softShadow, opacity: 1, offset: 0.17 }, { boxShadow: baseShadow, opacity: 0.90, offset: 0.36 }, { boxShadow: peakShadow, opacity: 1, offset: 0.58 }, { boxShadow: softShadow, opacity: 0.93, offset: 0.79 }, { boxShadow: baseShadow, opacity: 0.97 }], { duration: pulse.duration * 1000, iterations: Infinity, easing: 'ease-in-out' });
    }
  },

  // --- Tryb "energy": animowany canvas ---
  energyFrames: null,
  clearEnergyFrame(overlay) {
    const frame = overlay.querySelector('.mal-nl-energy-canvas');
    if (frame) {
      frame.remove();
      delete overlay.dataset.malAnimationSig;
      delete overlay.dataset.malGlowCache;
    }
    this.energyFrames.delete(overlay);
  },
  drawEnergyFrame(overlay) {
    if (document.hidden) return;
    const now = performance.now();
    let entry = this.energyFrames.get(overlay);
    if (!entry) {
      overlay.getAnimations().forEach((a) => a.cancel());
      overlay.style.boxShadow = 'none';
      overlay.style.border = '0';
      overlay.style.outline = 'none';
      overlay.style.opacity = '1';
      overlay.style.transform = 'none';
      const canvas = document.createElement('canvas');
      canvas.className = 'mal-nl-energy-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;left:-32px;top:-32px;pointer-events:none;max-width:none;';
      overlay.appendChild(canvas);
      entry = { canvas, g: canvas.getContext('2d'), last: 0, time: 0, signature: '' };
      this.energyFrames.set(overlay, entry);
    }
    if (!entry.g || now - entry.last < 33) return;
    const s = this.settings;
    const layers = [1, 2, 3]
      .map((i) => ({ color: s['color' + i], width: this.clampLevel(s['width' + i]), glow: this.clampLevel(s['glow' + i]), opacity: this.opacityLevel(s['opacity' + i]) }))
      .filter((l) => l.width > 0 && l.glow > 0 && l.opacity > 0);
    const w = Math.max(0, parseFloat(overlay.style.width) || 0);
    const h = Math.max(0, parseFloat(overlay.style.height) || 0);
    const d = Math.min(window.devicePixelRatio || 1, 2);
    const effect = Number(s.effect);
    const moving = this.clampLevel(s.pulse) > 0;
    const signature = JSON.stringify([w, h, d, layers, effect, s.pulse]);
    const dt = entry.last ? Math.min((now - entry.last) / 1000, 0.05) : 0;
    entry.last = now;
    if (!moving && entry.signature === signature) return;
    entry.signature = signature;
    if (moving) entry.time += dt * (0.35 + this.clampLevel(s.pulse) * 0.22);
    const canvas = entry.canvas;
    const g = entry.g;
    const pad = 32;
    const cw = Math.ceil((w + pad * 2) * d);
    const ch = Math.ceil((h + pad * 2) * d);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = w + pad * 2 + 'px';
      canvas.style.height = h + pad * 2 + 'px';
    }
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, w + pad * 2, h + pad * 2);
    if (!layers.length || !w || !h) return;
    const t = entry.time;
    const perimeter = 2 * (w + h);
    const count = Math.ceil(perimeter / 4);
    const gradient = g.createLinearGradient(pad, pad, pad + w, pad + h);
    layers.forEach((l, i) => gradient.addColorStop(layers.length === 1 ? 0 : i / (layers.length - 1), layers[(i + (effect === 3 ? Math.floor(t * 0.4) : 0)) % layers.length].color));
    const width = layers.reduce((sum, l) => sum + l.width, 0) / layers.length;
    const glow = (layers.reduce((sum, l) => sum + l.glow, 0) / layers.length) * 3;
    const opacity = layers.reduce((sum, l) => sum + l.opacity, 0) / layers.length;
    const pulse = effect === 1 ? 0.85 + 0.15 * Math.sin(t * 3) : effect === 2 ? 0.8 + 0.2 * Math.sin(t * 7) * Math.sin(t * 11) : 1;
    for (let layer = 2; layer >= 0; layer--) {
      g.beginPath();
      for (let i = 0; i <= count; i++) {
        const sPos = (i / count) * perimeter;
        let x, y, nx, ny, a, len;
        if (sPos < w) { a = sPos; len = w; x = a; y = 0; nx = 0; ny = -1; }
        else if (sPos < w + h) { a = sPos - w; len = h; x = w; y = a; nx = 1; ny = 0; }
        else if (sPos < 2 * w + h) { a = sPos - w - h; len = w; x = w - a; y = h; nx = 0; ny = 1; }
        else { a = sPos - 2 * w - h; len = h; x = 0; y = h - a; nx = -1; ny = 0; }
        const fade = Math.max(0, Math.min(1, a / 12, (len - a) / 12));
        const noise = (Math.sin(sPos * 0.113 + t * 3.7 + layer * 2) * 1.7 + Math.sin(sPos * 0.257 - t * 5.3 + layer) * 1.1 + Math.sin(sPos * 0.631 + t * 7.1) * 0.55) * fade;
        const ripple = noise * (layer ? 1.8 : 1) + Math.sin(t * 2 + sPos * 0.033) * fade;
        x += pad + nx * ripple;
        y += pad + ny * ripple;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.closePath();
      g.strokeStyle = gradient;
      g.lineWidth = width * (layer === 2 ? 3 : layer === 1 ? 1.5 : 0.8);
      g.globalAlpha = opacity * pulse * (layer === 2 ? 0.16 : layer === 1 ? 0.6 : 1);
      g.shadowColor = layers[layer % layers.length].color;
      g.shadowBlur = glow * (layer === 2 ? 1.6 : 1);
      g.stroke();
      if (layer === 0) {
        g.shadowBlur = 0;
        g.globalAlpha = opacity * 0.65 * pulse;
        g.strokeStyle = '#d6fff6';
        g.lineWidth = 0.6;
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    g.shadowBlur = 0;
  },

  // --- Orkiestracja ---
  syncMapGlowOverlay() {
    const style = Number(this.settings.glowStyle) || this.STYLE_CLASSIC;
    if (![this.STYLE_NEON_80S, this.STYLE_INNER_AURA, this.STYLE_ENERGY].includes(style) || !this.hasGlowForCurrentStyle()) {
      this.removeMapGlowOverlay();
      return;
    }
    if (!this.getActiveGlowLootWindows().length) { this.removeMapGlowOverlay(); return; }
    const mapElement = this.findMapBoundsElement();
    if (!mapElement) { this.removeMapGlowOverlay(); return; }
    const overlay = this.ensureMapGlowOverlay(mapElement);
    if (!overlay) { this.removeMapGlowOverlay(); return; }
    this.positionMapGlowOverlay(overlay, mapElement, style);
    const styleSignature = String(style);
    if (overlay.dataset.malMapStyle !== styleSignature) {
      overlay.getAnimations().forEach((a) => a.cancel());
      delete overlay.dataset.malAnimationSig;
      delete overlay.dataset.malGlowCache;
      overlay.dataset.malMapStyle = styleSignature;
    }
    if (style === this.STYLE_ENERGY) {
      this.setMapNeonCoreVisible(overlay, false);
      this.drawEnergyFrame(overlay);
      return;
    }
    this.clearEnergyFrame(overlay);
    if (style === this.STYLE_INNER_AURA) {
      overlay.style.border = '0 solid transparent';
      this.setMapNeonCoreVisible(overlay, false);
      this.applyInnerAuraMapAnimation(overlay);
    } else {
      overlay.style.border = '0 solid transparent';
      this.setMapNeonCoreVisible(overlay, true);
      this.applyMapGlowAnimation(overlay);
    }
  },
  applyGlowToWindow(windowElement) {
    const targetLoot = this.isElementVisible(windowElement) && this.isTargetLootWindow(windowElement);
    if (targetLoot) this.playLegendSoundForNewItems(windowElement);
    windowElement.classList.toggle('mal-nl-suppress-native', targetLoot);
    if (!targetLoot || !this.hasGlowForCurrentStyle()) {
      this.removeGlowOverlay(windowElement);
      return;
    }
    const overlay = this.ensureGlowOverlay(windowElement);
    this.positionGlowOverlay(windowElement, overlay);
    this.requestGlowOverlayFrame();
    const pulse = this.getPulseConfig();
    const effect = Math.max(0, Math.min(3, Number(this.settings.effect) || 0));
    const style = Number(this.settings.glowStyle) || this.STYLE_CLASSIC;
    if (style === this.STYLE_ENERGY) {
      this.removeItemGlowOverlays(windowElement);
      this.drawEnergyFrame(overlay);
      return;
    }
    this.clearEnergyFrame(overlay);
    overlay.style.outline = 'none';
    const shadowBuilder = style === this.STYLE_NEON_80S ? this.buildRetroNeonShadow.bind(this) : style === this.STYLE_INNER_AURA ? this.buildInnerAuraLootShadow.bind(this) : this.buildNeonShadow.bind(this);
    const baseShadow = shadowBuilder(1);
    if (style === this.STYLE_INNER_AURA) this.removeItemGlowOverlays(windowElement);
    else this.ensureItemGlowOverlays(windowElement);
    const pulseMultiplier = { 0: 1, 1: 1.08, 2: 1.16, 3: 1.26, 4: 1.38, 5: 1.52 }[this.clampLevel(this.settings.pulse)];
    const peakShadow = shadowBuilder(pulseMultiplier);
    const softShadow = shadowBuilder(1 + (pulseMultiplier - 1) * 0.45);
    const s = this.settings;
    const movingA = style === this.STYLE_INNER_AURA ? shadowBuilder(1) : shadowBuilder(1, [s.color1, s.color2, s.color3]);
    const movingB = style === this.STYLE_INNER_AURA ? shadowBuilder(1) : shadowBuilder(1, [s.color2, s.color3, s.color1]);
    const movingC = style === this.STYLE_INNER_AURA ? shadowBuilder(1) : shadowBuilder(1, [s.color3, s.color1, s.color2]);
    const mainColor = this.getMainNeonColor();
    if (style === this.STYLE_NEON_80S) overlay.style.border = '2px solid rgba(255,255,255,0.98)';
    else if (style === this.STYLE_INNER_AURA) overlay.style.border = '0 solid transparent';
    else overlay.style.border = mainColor === 'transparent' ? '0 solid transparent' : `2px solid ${this.hexToRgba(mainColor, 0.98)}`;
    const animationSignature = JSON.stringify({ style, colors: [s.color1, s.color2, s.color3], effect, enabled: pulse.enabled, duration: pulse.duration, baseShadow, peakShadow, softShadow, movingA, movingB, movingC });
    if (overlay.dataset.malAnimationSig !== animationSignature) {
      overlay.getAnimations().forEach((a) => a.cancel());
      overlay.dataset.malAnimationSig = animationSignature;
      overlay.style.boxShadow = baseShadow;
      overlay.style.opacity = '1';
      overlay.style.transform = 'scale(1)';
      overlay.style.transformOrigin = 'center';
      if (pulse.enabled && effect !== 0) {
        const anim = this.buildAnimationFrames(baseShadow, peakShadow, softShadow, movingA, movingB, movingC, effect, pulse.duration);
        if (anim) overlay.animate(anim.frames, anim.opts);
      }
    }
    if (style !== this.STYLE_INNER_AURA) this.syncItemGlowAnimations(windowElement);
  },
  syncItemGlowAnimations(windowElement) {
    const itemOverlays = this.itemGlowOverlayMap.get(windowElement) || [];
    const effect = Math.max(0, Math.min(3, Number(this.settings.effect) || 0));
    const pulse = this.getPulseConfig();
    const s = this.settings;
    const baseShadow = this.buildRetroNeonItemShadow();
    const shadowA = this.buildRetroNeonItemShadow([s.color1, s.color2, s.color3]);
    const shadowB = this.buildRetroNeonItemShadow([s.color2, s.color3, s.color1]);
    const shadowC = this.buildRetroNeonItemShadow([s.color3, s.color1, s.color2]);
    const signature = JSON.stringify({ style: this.settings.glowStyle, colors: [s.color1, s.color2, s.color3], effect, enabled: pulse.enabled, duration: pulse.duration, baseShadow, shadowA, shadowB, shadowC });
    itemOverlays.forEach((itemOverlay) => {
      if (itemOverlay.dataset.malAnimationSig === signature) return;
      itemOverlay.getAnimations().forEach((a) => a.cancel());
      itemOverlay.dataset.malAnimationSig = signature;
      itemOverlay.style.boxShadow = baseShadow;
      itemOverlay.style.opacity = '1';
      if (Number(this.settings.glowStyle) !== this.STYLE_NEON_80S || !pulse.enabled || effect === 0) return;
      const anim = this.buildAnimationFrames(baseShadow, baseShadow, baseShadow, shadowA, shadowB, shadowC, effect, pulse.duration);
      if (anim) itemOverlay.animate(anim.frames, anim.opts);
    });
  },
  requestGlowOverlayFrame() {
    if (this.glowOverlayFrameRequested) return;
    this.glowOverlayFrameRequested = true;
    this.glowOverlayTimer = setTimeout(() => this.syncAllGlowOverlays(), 33);
  },
  syncAllGlowOverlays() {
    clearTimeout(this.glowOverlayTimer);
    this.glowOverlayTimer = null;
    this.glowOverlayFrameRequested = false;
    for (const [windowElement, overlay] of this.glowOverlayMap.entries()) {
      if (!windowElement.isConnected || !document.body.contains(windowElement) || !this.isElementVisible(windowElement) || !this.isTargetLootWindow(windowElement) || !this.hasGlowForCurrentStyle()) {
        overlay.remove();
        this.glowOverlayMap.delete(windowElement);
        this.removeItemGlowOverlays(windowElement);
        continue;
      }
      this.positionGlowOverlay(windowElement, overlay);
      if (Number(this.settings.glowStyle) === this.STYLE_ENERGY) this.drawEnergyFrame(overlay);
      if (Number(this.settings.glowStyle) === this.STYLE_INNER_AURA) this.removeItemGlowOverlays(windowElement);
      else this.ensureItemGlowOverlays(windowElement);
    }
    this.syncMapGlowOverlay();
    if (this.glowOverlayMap.size > 0 || this.itemGlowOverlayMap.size > 0 || this.mapGlowOverlay) this.requestGlowOverlayFrame();
  },
  updateLootWindows() {
    document.querySelectorAll('.loot-wnd').forEach((w) => this.applyGlowToWindow(w));
    this.syncMapGlowOverlay();
  },

  // --- Okno testowe (podgląd efektu bez czekania na prawdziwy drop) ---
  toggleTestWindow() {
    const existing = document.querySelector('.mal-nl-test-window');
    if (existing) {
      this.removeGlowOverlay(existing);
      existing.remove();
      this.syncMapGlowOverlay();
      return;
    }
    const test = document.createElement('div');
    test.className = 'mal-nl-test-window loot-wnd mal-nl-suppress-native';
    test.innerHTML = '<div style="width:280px;padding:14px;font:13px sans-serif;color:#fff;background:#1a1a1a;border-radius:6px;">Okno próbne (legendarny przedmiot)<div class="item" data-frame-mania-rarity="legendary" data-item-type="t-leg" style="margin-top:8px;width:40px;height:40px;background:#333;border-radius:4px;"></div></div>';
    test.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:999997;';
    document.body.appendChild(test);
    requestAnimationFrame(() => { this.applyGlowToWindow(test); this.syncAllGlowOverlays(); });
  },

  // --- CSS (tłumienie natywnego glow gry + klasy overlayów) ---
  ensureStyles() {
    if (this.styleEl) return;
    this.styleEl = document.createElement('style');
    this.styleEl.id = 'mal-nl-style';
    this.styleEl.textContent = `
      .loot-wnd.mal-nl-suppress-native::after {
        content: none !important; box-shadow: none !important; opacity: 0 !important;
        background: none !important; filter: none !important; border: 0 !important; outline: 0 !important;
      }
      .loot-wnd.mal-nl-suppress-native .item[data-frame-mania-rarity="legendary"]::before,
      .loot-wnd.mal-nl-suppress-native .item[data-item-type="t-leg"]::before {
        content: none !important; box-shadow: none !important; opacity: 0 !important; background: none !important; filter: none !important;
      }
      .loot-wnd.mal-nl-suppress-native { box-shadow: none !important; filter: none !important; }
      .mal-nl-glow-overlay {
        position: fixed; pointer-events: none; box-sizing: border-box; border-radius: 3px;
        transform-origin: center center; opacity: 1; background: transparent; border-image-repeat: stretch;
      }
      .mal-nl-map-frame {
        position: absolute; pointer-events: none; box-sizing: border-box; border: 0 solid transparent;
        border-radius: 0; background: transparent; transform-origin: center center; z-index: auto;
      }
      .mal-nl-map-core {
        position: absolute; display: none; pointer-events: none; inset: -3px 0 -2px -1px; box-sizing: border-box;
        border: 2px solid rgba(255,255,255,.98); border-radius: 2px; background: transparent;
        box-shadow: 0 0 2px rgba(255,255,255,.95), 0 0 4px rgba(255,255,255,.58), inset 0 0 2px rgba(255,255,255,.5);
      }
      .mal-nl-item-frame {
        position: fixed; pointer-events: none; box-sizing: border-box;
        border: 1px solid rgba(255,255,255,0.98); border-radius: 1px; background: transparent;
      }
    `;
    document.head.appendChild(this.styleEl);
  },

  // --- Cykl życia dodatku (MAL) ---
  observer: null,
  checkScheduled: false,
  scheduleCheck() {
    if (this.checkScheduled) return;
    this.checkScheduled = true;
    requestAnimationFrame(() => {
      this.checkScheduled = false;
      this.updateLootWindows();
    });
  },
  onEnable(settings) {
    this.settings = settings;
    this.soundedItems = new WeakSet();
    this.activeLootSounds = new Set();
    this.glowOverlayMap = new Map();
    this.itemGlowOverlayMap = new Map();
    this.energyFrames = new WeakMap();
    this.mapGlowOverlay = null;
    this.glowOverlayFrameRequested = false;
    this.running = true;
    this.ensureStyles();
    this.observer = new MutationObserver(() => this.scheduleCheck());
    this.observer.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['data-item-type', 'data-frame-mania-rarity', 'class'],
    });
    this.scheduleCheck();
  },
  onDisable() {
    this.running = false;
    if (this.observer) { this.observer.disconnect(); this.observer = null; }
    clearTimeout(this.glowOverlayTimer);
    document.querySelectorAll('.loot-wnd').forEach((w) => { this.removeGlowOverlay(w); w.classList.remove('mal-nl-suppress-native'); });
    this.removeMapGlowOverlay();
    document.querySelector('.mal-nl-test-window')?.remove();
  },
  onSettingsChange(settings) {
    this.settings = settings;
    this.scheduleCheck();
  },
};

(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})(Addon);
