// ==UserScript==
// @name         MAL - Notyfikator legend
// @namespace    margonem-addon-loader
// @version      2.0.1
// @description  Dźwięk, toast i wielowarstwowe, konfigurowalne neonowe obramowanie okna łupu/mapy przy legendarnym przedmiocie - przepisane z zestawu Shacal Customizer pod nasz loader.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js
// ==/UserScript==

/**
 * Ustawienia "obramowania" (kolorX/jasnoscX/przezroczystoscX/szerokoscX, stylObramowania,
 * efektObramowania, intensywnoscObramowania) to przeniesienie realnego zestawu opcji
 * z dodatku "glow" w Shacal Customizer (color1-3/glow1-3/opacity1-3/width1-3/glowStyle/
 * effect/pulse) - ten sam zakres kontroli, własna (prostsza, bez canvasu) implementacja
 * wizualna oparta o CSS box-shadow + Web Animations API zamiast ich silnika canvas.
 */
(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})({
  id: 'notyfikator-legend',
  name: 'Notyfikator legend',
  description: 'Dźwięk, toast i wielowarstwowe neonowe obramowanie okna łupu/mapy przy legendarnym przedmiocie.',
  version: '2.0.1',
  updateCheckUrl: 'https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js',
  defaultEnabled: false,
  defaultSettings: {
    dzwiek: true,
    wariantDzwieku: 'dzwoneczek',
    glosnosc: 70,
    trybWykrywania: 'tylko-legendarne',
    limitOdstepuSekundy: 2,
    toast: true,
    kolorToastu: '#d4af37',
    czasWyswietlaniaToastSekundy: 5,
    powiadomienieSystemowe: false,

    obramowanieOknaLupu: true,
    obramowanieMapy: false,
    stylObramowania: 'klasyczny',
    efektObramowania: 'puls',
    intensywnoscObramowania: 3,
    czasObramowaniaSekundy: 4,

    kolor1: '#d4af37',
    jasnosc1: 3,
    przezroczystosc1: 4,
    szerokosc1: 1,

    kolor2: '#ffd700',
    jasnosc2: 2,
    przezroczystosc2: 3,
    szerokosc2: 2,

    kolor3: '#ff8c00',
    jasnosc3: 1,
    przezroczystosc3: 2,
    szerokosc3: 3,
  },
  settingsSchema: [
    { key: 'dzwiek', type: 'boolean', label: 'Dźwięk przy powiadomieniu' },
    {
      key: 'wariantDzwieku',
      type: 'select',
      label: 'Wariant dźwięku',
      options: [
        { value: 'dzwoneczek', label: 'Dzwoneczek' },
        { value: 'fanfary', label: 'Fanfary' },
        { value: 'gong', label: 'Gong' },
        { value: 'arpeggio', label: 'Arpeggio' },
        { value: 'puls', label: 'Puls' },
      ],
    },
    { key: 'glosnosc', type: 'number', label: 'Głośność (0-100)', min: 0, max: 100 },
    {
      key: 'testDzwieku',
      type: 'button',
      label: 'Testuj dźwięk',
      onClick(settings) {
        this.playChime(settings.glosnosc, settings.wariantDzwieku);
      },
    },
    {
      key: 'trybWykrywania',
      type: 'select',
      label: 'Tryb wykrywania',
      options: [
        { value: 'tylko-legendarne', label: 'Tylko legendarne' },
        { value: 'wszystkie-przedmioty', label: 'Wszystkie przedmioty w oknie łupu' },
      ],
    },
    { key: 'limitOdstepuSekundy', type: 'number', label: 'Minimalny odstęp między powiadomieniami (s)', min: 0, max: 60 },
    { key: 'toast', type: 'boolean', label: 'Powiadomienie w grze (toast)' },
    { key: 'kolorToastu', type: 'color', label: 'Kolor toastu', default: '#d4af37' },
    { key: 'czasWyswietlaniaToastSekundy', type: 'number', label: 'Czas wyświetlania toastu (s)', min: 1, max: 30 },
    { key: 'powiadomienieSystemowe', type: 'boolean', label: 'Powiadomienie systemowe przeglądarki' },

    { key: 'obramowanieOknaLupu', type: 'boolean', label: 'Podświetlaj okno łupu' },
    { key: 'obramowanieMapy', type: 'boolean', label: 'Podświetlaj mapę' },
    {
      key: 'stylObramowania',
      type: 'select',
      label: 'Styl obramowania',
      options: [
        { value: 'klasyczny', label: 'Klasyczny (poświata na zewnątrz)' },
        { value: 'wewnetrzna-aura', label: 'Wewnętrzna aura' },
        { value: 'linia-energii', label: 'Linia energii' },
        { value: 'neon-80s', label: 'Neon 80s (podwójny)' },
      ],
    },
    {
      key: 'efektObramowania',
      type: 'select',
      label: 'Animacja',
      options: [
        { value: 'brak', label: 'Brak (statyczne)' },
        { value: 'puls', label: 'Puls' },
        { value: 'migotanie', label: 'Migotanie' },
        { value: 'zmiana-kolorow', label: 'Zmiana kolorów (1→2→3)' },
      ],
    },
    { key: 'intensywnoscObramowania', type: 'number', label: 'Intensywność pulsu (0-5)', min: 0, max: 5 },
    { key: 'czasObramowaniaSekundy', type: 'number', label: 'Czas trwania obramowania (s)', min: 1, max: 30 },
    {
      key: 'testObramowania',
      type: 'button',
      label: 'Testuj obramowanie okna łupu',
      onClick(settings) {
        const target = document.querySelector(this.LOOT_WINDOW_SELECTOR) || document.body;
        this.applyTimedGlow(target, settings);
      },
    },
    {
      key: 'testObramowaniaMapy',
      type: 'button',
      label: 'Testuj obramowanie mapy',
      onClick(settings) {
        const target = this.findMapElement() || document.body;
        this.applyTimedGlow(target, settings);
      },
    },

    { key: 'kolor1', type: 'color', label: 'Warstwa 1 - kolor', default: '#d4af37' },
    { key: 'jasnosc1', type: 'number', label: 'Warstwa 1 - jasność (0-5)', min: 0, max: 5 },
    { key: 'przezroczystosc1', type: 'number', label: 'Warstwa 1 - przezroczystość (0-5)', min: 0, max: 5 },
    { key: 'szerokosc1', type: 'number', label: 'Warstwa 1 - szerokość (0-5)', min: 0, max: 5 },

    { key: 'kolor2', type: 'color', label: 'Warstwa 2 - kolor', default: '#ffd700' },
    { key: 'jasnosc2', type: 'number', label: 'Warstwa 2 - jasność (0-5)', min: 0, max: 5 },
    { key: 'przezroczystosc2', type: 'number', label: 'Warstwa 2 - przezroczystość (0-5)', min: 0, max: 5 },
    { key: 'szerokosc2', type: 'number', label: 'Warstwa 2 - szerokość (0-5)', min: 0, max: 5 },

    { key: 'kolor3', type: 'color', label: 'Warstwa 3 - kolor', default: '#ff8c00' },
    { key: 'jasnosc3', type: 'number', label: 'Warstwa 3 - jasność (0-5)', min: 0, max: 5 },
    { key: 'przezroczystosc3', type: 'number', label: 'Warstwa 3 - przezroczystość (0-5)', min: 0, max: 5 },
    { key: 'szerokosc3', type: 'number', label: 'Warstwa 3 - szerokość (0-5)', min: 0, max: 5 },
  ],

  LEGEND_SELECTOR: '[data-frame-mania-rarity="legendary"], [data-item-type="t-leg"]',
  // Uwaga: brak potwierdzonego, uniwersalnego selektora "dowolnego przedmiotu" w oknie
  // łupu - to najlepsze przybliżenie. Jeśli tryb "wszystkie przedmioty" nic nie łapie,
  // trzeba będzie dopasować selektor do konkretnego serwera.
  ALL_ITEMS_SELECTOR: '.loot-window .items-wrapper .item, [class*="loot-window"] [class*="item"]',
  LOOT_WINDOW_SELECTOR: '.loot-wnd, .loot-window, [class*="loot-wnd"], [class*="loot-window"]',
  MAP_SELECTORS: ['.map-wrapper', '.map-layer', '.game-window', '[class*="map-wrapper"]', '[class*="map-layer"]'],

  seen: null,
  observer: null,
  audioCtx: null,
  lastNotifyTime: 0,
  currentSettings: null,

  activeSelector(settings) {
    return settings.trybWykrywania === 'wszystkie-przedmioty' ? this.ALL_ITEMS_SELECTOR : this.LEGEND_SELECTOR;
  },

  safeHex(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  },

  clamp05(v) {
    return Math.max(0, Math.min(5, Number(v) || 0));
  },

  hexToRgba(hex, alpha) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return `rgba(212,175,55,${alpha})`;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
  },

  isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  findMapElement() {
    for (const selector of this.MAP_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && this.isVisible(el)) return el;
    }
    const canvases = Array.from(document.querySelectorAll('canvas'))
      .map((c) => ({ c, rect: c.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width >= 200 && rect.height >= 150)
      .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);
    return canvases.length ? canvases[0].c : null;
  },

  ensureStyles() {
    if (document.getElementById('mal-nl-style')) return;
    const style = document.createElement('style');
    style.id = 'mal-nl-style';
    style.textContent = `
      #mal-nl-toast-wrap {
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        z-index: 999998; display: flex; flex-direction: column; gap: 8px; align-items: center;
        pointer-events: none;
      }
      .mal-nl-toast {
        background: linear-gradient(135deg, #201a10, #14100a);
        border: 1px solid var(--mal-nl-toast-color, #d4af37); color: #ffe9a8;
        font: 600 13px/1.4 -apple-system, Segoe UI, sans-serif;
        padding: 10px 18px; border-radius: 10px;
        box-shadow: 0 6px 24px rgba(0,0,0,.5), 0 0 18px var(--mal-nl-toast-glow, rgba(212,175,55,.35));
        opacity: 0; transform: translateY(-8px); transition: opacity .25s ease, transform .25s ease;
      }
      .mal-nl-toast.mal-nl-show { opacity: 1; transform: translateY(0); }
    `;
    document.head.appendChild(style);
  },

  showToast(text, durationSeconds, color) {
    this.ensureStyles();
    let wrap = document.getElementById('mal-nl-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'mal-nl-toast-wrap';
      document.body.appendChild(wrap);
    }
    const hex = this.safeHex(color, '#d4af37');
    const toast = document.createElement('div');
    toast.className = 'mal-nl-toast';
    toast.style.setProperty('--mal-nl-toast-color', hex);
    toast.style.setProperty('--mal-nl-toast-glow', hex + '59');
    toast.textContent = '✨ ' + text;
    wrap.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('mal-nl-show'));
    const durationMs = Math.max(1, Number(durationSeconds) || 5) * 1000;
    setTimeout(() => {
      toast.classList.remove('mal-nl-show');
      setTimeout(() => toast.remove(), 300);
    }, durationMs);
  },

  playChime(volumePercent, variant) {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.value = Math.max(0, Math.min(1, (Number(volumePercent) || 0) / 100)) * 0.4;
      masterGain.connect(ctx.destination);

      const note = (freq, start, dur, type) => {
        const osc = ctx.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(1, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain).connect(masterGain);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      };

      switch (variant) {
        case 'fanfary':
          note(523.25, 0, 0.25);
          note(659.25, 0.12, 0.25);
          note(783.99, 0.24, 0.5, 'triangle');
          break;
        case 'gong':
          note(196, 0, 1.4);
          note(98, 0, 1.6);
          break;
        case 'arpeggio':
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => note(freq, i * 0.08, 0.3));
          break;
        case 'puls':
          note(440, 0, 0.15, 'square');
          note(440, 0.2, 0.15, 'square');
          note(440, 0.4, 0.25, 'square');
          break;
        case 'dzwoneczek':
        default:
          [880, 1318.5, 1760].forEach((freq, i) => note(freq, i * 0.12, 0.5));
      }
    } catch (err) {
      console.error('[MAL:notyfikator-legend] Nie udało się odtworzyć dźwięku:', err);
    }
  },

  buildShadow(settings) {
    const layers = [1, 2, 3]
      .map((i) => ({
        color: this.safeHex(settings['kolor' + i], '#d4af37'),
        glow: this.clamp05(settings['jasnosc' + i]),
        opacity: this.clamp05(settings['przezroczystosc' + i]) / 5,
        width: this.clamp05(settings['szerokosc' + i]),
      }))
      .filter((l) => l.glow > 0 && l.opacity > 0 && l.width > 0);
    if (!layers.length) return 'none';

    const style = settings.stylObramowania;
    const inset = style === 'wewnetrzna-aura' || style === 'neon-80s' ? 'inset ' : '';
    const layerShadow = (l) =>
      `${inset}0 0 ${Math.round(6 + l.glow * 4 + l.width * 3)}px ${(1 + l.width * 1.5).toFixed(1)}px ${this.hexToRgba(l.color, l.opacity)}`;

    const parts = layers.map(layerShadow);
    if (style === 'neon-80s') {
      parts.unshift('0 0 3px 0 rgba(255,255,255,.92)', 'inset 0 0 3px 0 rgba(255,255,255,.92)');
      layers.forEach((l) =>
        parts.push(`0 0 ${Math.round(6 + l.glow * 4 + l.width * 3)}px ${(1 + l.width * 1.5).toFixed(1)}px ${this.hexToRgba(l.color, l.opacity)}`)
      );
    } else if (style === 'linia-energii') {
      parts.unshift('0 0 3px 0 rgba(255,255,255,.92)');
    }
    return parts.join(', ');
  },

  rotateColorLayers(settings) {
    return Object.assign({}, settings, {
      kolor1: settings.kolor2,
      kolor2: settings.kolor3,
      kolor3: settings.kolor1,
      jasnosc1: settings.jasnosc2,
      jasnosc2: settings.jasnosc3,
      jasnosc3: settings.jasnosc1,
      przezroczystosc1: settings.przezroczystosc2,
      przezroczystosc2: settings.przezroczystosc3,
      przezroczystosc3: settings.przezroczystosc1,
      szerokosc1: settings.szerokosc2,
      szerokosc2: settings.szerokosc3,
      szerokosc3: settings.szerokosc1,
    });
  },

  applyGlowToElement(el, settings) {
    if (!el) return;
    el.getAnimations?.().forEach((a) => a.cancel());
    const shadow = this.buildShadow(settings);
    el.style.boxShadow = shadow;
    if (shadow === 'none' || settings.efektObramowania === 'brak') return;

    const level = this.clamp05(settings.intensywnoscObramowania);
    if (settings.efektObramowania === 'puls') {
      const duration = { 0: 2800, 1: 2800, 2: 2100, 3: 1500, 4: 1000, 5: 650 }[level];
      el.animate([{ boxShadow: shadow, opacity: 1 }, { boxShadow: shadow, opacity: 0.7 }], {
        duration,
        iterations: Infinity,
        direction: 'alternate',
        easing: 'ease-in-out',
      });
    } else if (settings.efektObramowania === 'migotanie') {
      el.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 0.7, offset: 0.17 },
          { opacity: 1, offset: 0.31 },
          { opacity: 0.8, offset: 0.5 },
          { opacity: 1, offset: 0.7 },
          { opacity: 0.85, offset: 0.85 },
          { opacity: 1, offset: 1 },
        ],
        { duration: 1800, iterations: Infinity, easing: 'ease-in-out' }
      );
    } else if (settings.efektObramowania === 'zmiana-kolorow') {
      const s2 = this.rotateColorLayers(settings);
      const s3 = this.rotateColorLayers(s2);
      el.animate(
        [{ boxShadow: shadow }, { boxShadow: this.buildShadow(s2) }, { boxShadow: this.buildShadow(s3) }, { boxShadow: shadow }],
        { duration: 2200, iterations: Infinity, easing: 'linear' }
      );
    }
  },

  applyTimedGlow(el, settings) {
    if (!el) return;
    this.ensureStyles();
    this.applyGlowToElement(el, settings);
    clearTimeout(el._malNlGlowTimeout);
    const durationMs = Math.max(1, Number(settings.czasObramowaniaSekundy) || 4) * 1000;
    el._malNlGlowTimeout = setTimeout(() => {
      el.getAnimations?.().forEach((a) => a.cancel());
      el.style.boxShadow = '';
    }, durationMs);
  },

  applyLootGlow(itemOrWindowEl, settings) {
    if (!settings.obramowanieOknaLupu || !itemOrWindowEl) return;
    const windowEl = itemOrWindowEl.matches?.(this.LOOT_WINDOW_SELECTOR)
      ? itemOrWindowEl
      : itemOrWindowEl.closest?.(this.LOOT_WINDOW_SELECTOR);
    if (!windowEl) return;
    this.applyTimedGlow(windowEl, settings);
  },

  applyMapGlow(settings) {
    if (!settings.obramowanieMapy) return;
    const mapEl = this.findMapElement();
    if (!mapEl) {
      console.warn('[MAL:notyfikator-legend] Nie znaleziono elementu mapy do podświetlenia.');
      return;
    }
    this.applyTimedGlow(mapEl, settings);
  },

  extractItemName(el) {
    const candidate =
      el.getAttribute('data-tip') ||
      el.getAttribute('title') ||
      el.getAttribute('alt') ||
      el.getAttribute('aria-label') ||
      (el.querySelector('img') && el.querySelector('img').getAttribute('alt')) ||
      el.closest('[title]')?.getAttribute('title') ||
      el.textContent;
    const cleaned = (candidate || '').replace(/\s+/g, ' ').trim();
    return cleaned || 'Nieznany przedmiot';
  },

  handleLegendaryElement(el, settings) {
    if (this.seen.has(el)) return;
    this.seen.add(el);

    const now = Date.now();
    const cooldownMs = Math.max(0, Number(settings.limitOdstepuSekundy) || 0) * 1000;
    if (this.lastNotifyTime && now - this.lastNotifyTime < cooldownMs) return;
    this.lastNotifyTime = now;

    const name = this.extractItemName(el);
    const label = settings.trybWykrywania === 'wszystkie-przedmioty' ? 'Nowy przedmiot: ' + name : 'Legendarny przedmiot: ' + name;

    if (settings.toast) this.showToast(label, settings.czasWyswietlaniaToastSekundy, settings.kolorToastu);
    if (settings.dzwiek) this.playChime(settings.glosnosc, settings.wariantDzwieku);
    this.applyLootGlow(el, settings);
    this.applyMapGlow(settings);
    if (settings.powiadomienieSystemowe && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Notyfikator legend', { body: label });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  },

  scanNode(node, settings) {
    if (!(node instanceof Element)) return;
    const selector = this.activeSelector(settings);
    if (node.matches && node.matches(selector)) this.handleLegendaryElement(node, settings);
    node.querySelectorAll && node.querySelectorAll(selector).forEach((el) => this.handleLegendaryElement(el, settings));
  },

  onEnable(settings) {
    this.seen = new WeakSet();
    this.currentSettings = settings;
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => this.scanNode(node, this.currentSettings));
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll(this.activeSelector(settings)).forEach((el) => this.seen.add(el));
  },

  onDisable() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  },

  onSettingsChange(settings) {
    this.currentSettings = settings;
  },
});
