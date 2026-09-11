// ==UserScript==
// @name         MAL - Notyfikator legend
// @namespace    margonem-addon-loader
// @version      3.1.1
// @description  Neonowe ramki okna łupu/mapy, podświetlenie itemu i napis przy legendarnym przedmiocie - port sprawdzonego, działającego skryptu użytkownika pod nasz loader.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js
// ==/UserScript==

/**
 * Ten dodatek to bezpośredni port działającego, samodzielnego userscriptu
 * "Margonem - Legendary Notyfikator v3.4" pod nasz loader - ta sama logika wykrywania
 * (MutationObserver + requestAnimationFrame, selektory .loot-wnd / data-item-type="t-leg"
 * / #GAME_CANVAS) i te same efekty wizualne (3 tryby neonu, shader mapy, pulsujący zoom,
 * podświetlenie itemu, napis). Zmieniło się tylko to, JAK włącza się/wyłącza (przez nasz
 * loader zamiast działać zawsze) i GDZIE są ustawienia (nasz panel zamiast własnego
 * okienka z przyciskiem-zębatką).
 */
(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})({
  id: 'notyfikator-legend',
  name: 'Notyfikator legend',
  description: 'Neonowe ramki okna łupu/mapy, podświetlenie itemu i napis przy legendarnym przedmiocie.',
  version: '3.1.1',
  updateCheckUrl: 'https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js',
  defaultEnabled: false,
  defaultSettings: {
    lootGlow: true,
    mapGlow: true,
    itemGlow: true,
    legendaryText: true,
    animationSpeed: 100,
    neonMode: 'classic',
    mapShader: 'none',
    mapZoom: true,
    intensity: 100,
    neonColor1: '#ff36d1',
    neonColor2: '#ff007a',
    legendaryTextValue: '✦ LEGENDARY DROP ✦',
  },
  settingsSchema: [
    { key: 'lootGlow', type: 'boolean', label: 'Ramka okna łupu' },
    { key: 'mapGlow', type: 'boolean', label: 'Ramka mapy' },
    { key: 'itemGlow', type: 'boolean', label: 'Podświetlenie itemu' },
    { key: 'legendaryText', type: 'boolean', label: 'Napis na środku ekranu' },
    { key: 'legendaryTextValue', type: 'text', label: 'Treść napisu', placeholder: '✦ LEGENDARY DROP ✦' },
    {
      key: 'neonMode',
      type: 'select',
      label: 'Tryb neonu',
      options: [
        { value: 'classic', label: 'Statyczny kolor' },
        { value: 'rainbow', label: 'Tęcza-neon' },
        { value: 'chase', label: 'Goniące się kolory' },
      ],
    },
    { key: 'neonColor1', type: 'color', label: 'Kolor główny', default: '#ff36d1' },
    { key: 'neonColor2', type: 'color', label: 'Kolor dodatkowy', default: '#ff007a' },
    { key: 'intensity', type: 'number', label: 'Intensywność neonu (10-200)', min: 10, max: 200 },
    { key: 'animationSpeed', type: 'number', label: 'Prędkość animacji (25-300)', min: 25, max: 300 },
    {
      key: 'mapShader',
      type: 'select',
      label: 'Shader mapy',
      options: [
        { value: 'none', label: 'Brak' },
        { value: 'cinematic', label: 'Cinematic' },
        { value: 'glow', label: 'Glow' },
        { value: 'cold', label: 'Cold' },
        { value: 'warm', label: 'Warm' },
        { value: 'dream', label: 'Dream' },
        { value: 'dark', label: 'Dark' },
      ],
    },
    { key: 'mapZoom', type: 'boolean', label: 'Pulsacyjne przybliżenie mapy' },
  ],

  EFFECT_DURATION: 60000,
  MAP_CANVAS_SELECTOR: '#GAME_CANVAS',
  LEGEND_SELECTOR: '[data-item-type="t-leg"],[data-frame-mania-rarity="legendary"]',

  styleEl: null,
  observer: null,
  running: false,
  checkScheduled: false,
  lootOverlay: null,
  mapOverlay: null,
  textOverlay: null,
  activeLootWindow: null,
  cleanupTimer: null,
  currentSettings: null,

  ensureStyles() {
    if (this.styleEl) return;
    this.styleEl = document.createElement('style');
    this.styleEl.id = 'mal-nl-style';
    this.styleEl.textContent = `
      @property --leg-chase-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }

      .leg-neon-loot, .leg-neon-map {
        position: fixed !important; pointer-events: none !important; box-sizing: border-box !important;
        background: transparent !important; --leg-glow: 1; --leg-color-1: #ff36d1; --leg-color-2: #ff007a;
        --leg-speed: 1; --leg-chase-angle: 0deg; overflow: visible !important;
      }

      .leg-mode-classic {
        border: 2px solid var(--leg-color-1) !important; background: transparent !important;
        box-shadow:
          0 0 calc(1px * var(--leg-glow)) var(--leg-color-1),
          0 0 calc(4px * var(--leg-glow)) var(--leg-color-1),
          0 0 calc(9px * var(--leg-glow)) var(--leg-color-2),
          0 0 calc(18px * var(--leg-glow)) var(--leg-color-2),
          0 0 calc(30px * var(--leg-glow)) rgba(255,0,122,.20);
      }

      .leg-mode-rainbow {
        border: 2px solid transparent !important; background: transparent !important;
        border-image: conic-gradient(#ff0000,#ff7a00,#ffff00,#00ff66,#00ffff,#0088ff,#7a00ff,#ff00ff,#ff0000) 1;
        box-shadow:
          0 0 calc(2px * var(--leg-glow)) rgba(255,255,255,.45),
          0 0 calc(6px * var(--leg-glow)) rgba(255,0,255,.45),
          0 0 calc(12px * var(--leg-glow)) rgba(0,255,255,.35);
        animation: leg-rainbow-flow calc(6s / var(--leg-speed)) linear infinite;
      }
      @keyframes leg-rainbow-flow { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }

      .leg-mode-chase {
        border: 0 !important; background: transparent !important;
        box-shadow:
          0 0 calc(1px * var(--leg-glow)) var(--leg-color-1),
          0 0 calc(4px * var(--leg-glow)) var(--leg-color-1),
          0 0 calc(9px * var(--leg-glow)) var(--leg-color-2),
          0 0 calc(18px * var(--leg-glow)) var(--leg-color-2),
          0 0 calc(28px * var(--leg-glow)) color-mix(in srgb, var(--leg-color-1) 35%, var(--leg-color-2));
      }
      .leg-mode-chase::before {
        content: ""; position: absolute; inset: 0; box-sizing: border-box; border: 3px solid transparent; border-radius: inherit;
        background:
          linear-gradient(transparent, transparent) padding-box,
          conic-gradient(from var(--leg-chase-angle),
            var(--leg-color-1) 0deg,
            color-mix(in srgb, var(--leg-color-1) 85%, var(--leg-color-2)) 30deg,
            color-mix(in srgb, var(--leg-color-1) 65%, var(--leg-color-2)) 60deg,
            color-mix(in srgb, var(--leg-color-1) 45%, var(--leg-color-2)) 90deg,
            color-mix(in srgb, var(--leg-color-1) 25%, var(--leg-color-2)) 120deg,
            var(--leg-color-2) 150deg,
            color-mix(in srgb, var(--leg-color-2) 75%, var(--leg-color-1)) 180deg,
            color-mix(in srgb, var(--leg-color-2) 55%, var(--leg-color-1)) 210deg,
            color-mix(in srgb, var(--leg-color-2) 35%, var(--leg-color-1)) 240deg,
            color-mix(in srgb, var(--leg-color-2) 15%, var(--leg-color-1)) 270deg,
            var(--leg-color-1) 300deg,
            color-mix(in srgb, var(--leg-color-1) 90%, var(--leg-color-2)) 330deg,
            var(--leg-color-1) 360deg) border-box;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; z-index: 10;
        animation: leg-chase-flow calc(3s / var(--leg-speed)) linear infinite;
      }
      .leg-mode-chase::after {
        content: ""; position: absolute; inset: 0; box-sizing: border-box; border: 4px solid transparent; border-radius: inherit;
        background:
          linear-gradient(transparent, transparent) padding-box,
          conic-gradient(from var(--leg-chase-angle),
            var(--leg-color-1) 0deg,
            color-mix(in srgb, var(--leg-color-1) 75%, var(--leg-color-2)) 35deg,
            color-mix(in srgb, var(--leg-color-1) 50%, var(--leg-color-2)) 75deg,
            color-mix(in srgb, var(--leg-color-1) 25%, var(--leg-color-2)) 115deg,
            var(--leg-color-2) 150deg,
            color-mix(in srgb, var(--leg-color-2) 70%, var(--leg-color-1)) 190deg,
            color-mix(in srgb, var(--leg-color-2) 45%, var(--leg-color-1)) 230deg,
            color-mix(in srgb, var(--leg-color-2) 20%, var(--leg-color-1)) 265deg,
            var(--leg-color-1) 305deg,
            color-mix(in srgb, var(--leg-color-1) 70%, var(--leg-color-2)) 340deg,
            var(--leg-color-1) 360deg) border-box;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; z-index: 9;
        filter: blur(calc(6px * var(--leg-glow))); opacity: .90;
        animation: leg-chase-flow calc(3s / var(--leg-speed)) linear infinite;
      }
      @keyframes leg-chase-flow { from { --leg-chase-angle: 0deg; } to { --leg-chase-angle: 360deg; } }

      .leg-neon-item {
        --leg-color-1: #ff36d1; --leg-color-2: #ff007a; --leg-speed: 1;
        animation: leg-item-pulse calc(.65s / var(--leg-speed)) ease-in-out infinite alternate !important;
        filter:
          drop-shadow(0 0 3px #fff) drop-shadow(0 0 6px var(--leg-color-1))
          drop-shadow(0 0 10px var(--leg-color-2)) drop-shadow(0 0 16px var(--leg-color-1)) !important;
      }
      @keyframes leg-item-pulse { from { transform: scale(1); } to { transform: scale(1.06); } }

      .leg-neon-text {
        position: fixed !important; left: 50% !important; top: 8% !important; transform: translateX(-50%) !important;
        pointer-events: none !important; color: #fff !important;
        font-family: Arial, sans-serif !important; font-size: 32px !important; font-weight: 900 !important;
        letter-spacing: 5px !important; white-space: nowrap !important;
        --leg-color-1: #ff36d1; --leg-color-2: #ff007a; --leg-speed: 1;
        text-shadow: 0 0 4px #fff, 0 0 8px var(--leg-color-1), 0 0 16px var(--leg-color-2), 0 0 28px var(--leg-color-1), 0 0 40px var(--leg-color-2);
        animation: leg-text-in .35s ease-out, leg-text-pulse calc(.8s / var(--leg-speed)) ease-in-out infinite alternate;
      }
      @keyframes leg-text-in { from { opacity: 0; transform: translateX(-50%) scale(.5); } to { opacity: 1; transform: translateX(-50%) scale(1); } }
      @keyframes leg-text-pulse { from { filter: brightness(.9); } to { filter: brightness(1.15); } }

      #GAME_CANVAS.leg-shader-cinematic { filter: contrast(1.08) saturate(1.12) brightness(1.02); }
      #GAME_CANVAS.leg-shader-glow { filter: brightness(1.08) saturate(1.18) contrast(1.04) drop-shadow(0 0 4px rgba(255,80,220,.20)); }
      #GAME_CANVAS.leg-shader-cold { filter: saturate(.95) hue-rotate(12deg) brightness(1.02); }
      #GAME_CANVAS.leg-shader-warm { filter: saturate(1.15) hue-rotate(-10deg) brightness(1.03); }
      #GAME_CANVAS.leg-shader-dream { filter: brightness(1.08) saturate(1.12) contrast(.96) blur(.25px); }
      #GAME_CANVAS.leg-shader-dark { filter: brightness(.82) contrast(1.16) saturate(1.05); }

      #GAME_CANVAS.leg-map-zoom { transform-origin: center center; animation: leg-map-zoom-pulse calc(2.4s / var(--leg-speed)) ease-in-out infinite; }
      @keyframes leg-map-zoom-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
    `;
    document.head.appendChild(this.styleEl);
  },

  getVisibleLootWindows() {
    return Array.from(document.querySelectorAll('.loot-wnd')).filter((element) => {
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return computed.display !== 'none' && computed.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
  },

  isLegendaryWindow(windowElement) {
    if (!windowElement) return false;
    return !!windowElement.querySelector(this.LEGEND_SELECTOR);
  },

  findLegendaryWindow() {
    return this.getVisibleLootWindows().find((w) => this.isLegendaryWindow(w)) || null;
  },

  getGameCanvas() {
    return document.querySelector(this.MAP_CANVAS_SELECTOR);
  },

  applyMapShader(settings) {
    const canvas = this.getGameCanvas();
    if (!canvas) return;
    canvas.classList.remove('leg-shader-cinematic', 'leg-shader-glow', 'leg-shader-cold', 'leg-shader-warm', 'leg-shader-dream', 'leg-shader-dark', 'leg-map-zoom');
    if (settings.mapShader !== 'none') canvas.classList.add('leg-shader-' + settings.mapShader);
    if (settings.mapZoom) canvas.classList.add('leg-map-zoom');
  },

  positionMapOverlay() {
    if (!this.mapOverlay) return;
    const canvas = this.getGameCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.mapOverlay.style.left = rect.left - 4 + 'px';
    this.mapOverlay.style.top = rect.top - 4 + 'px';
    this.mapOverlay.style.width = rect.width + 8 + 'px';
    this.mapOverlay.style.height = rect.height + 8 + 'px';
    // Tuż POD mapą (nie nad nią) - brzegi ramki i tak wystają poza canvas, więc są
    // widoczne, a dymki (wyżej w warstwach niż zwykłe elementy gry) zostają na wierzchu.
    const canvasZ = parseInt(getComputedStyle(canvas).zIndex, 10);
    this.mapOverlay.style.zIndex = String(Math.max(0, (Number.isFinite(canvasZ) ? canvasZ : 1) - 1));
  },

  positionLootOverlay() {
    if (!this.lootOverlay || !this.activeLootWindow || !this.activeLootWindow.isConnected) return;
    const rect = this.activeLootWindow.getBoundingClientRect();
    this.lootOverlay.style.left = rect.left - 5 + 'px';
    this.lootOverlay.style.top = rect.top - 5 + 'px';
    this.lootOverlay.style.width = rect.width + 10 + 'px';
    this.lootOverlay.style.height = rect.height + 10 + 'px';
    // Tuż POD oknem łupu (nie nad nim) - brzegi ramki i tak wystają poza okno, więc są
    // widoczne, a dymki (wyżej w warstwach niż zwykłe okna) zostają na wierzchu.
    const windowZ = parseInt(getComputedStyle(this.activeLootWindow).zIndex, 10);
    this.lootOverlay.style.zIndex = String(Math.max(0, (Number.isFinite(windowZ) ? windowZ : 1) - 1));
  },

  applyNeonMode(settings) {
    [this.lootOverlay, this.mapOverlay].forEach((overlay) => {
      if (!overlay) return;
      overlay.classList.remove('leg-mode-classic', 'leg-mode-rainbow', 'leg-mode-chase');
      overlay.classList.add(settings.neonMode === 'rainbow' ? 'leg-mode-rainbow' : settings.neonMode === 'chase' ? 'leg-mode-chase' : 'leg-mode-classic');
    });
  },

  applyIntensity(settings) {
    const glow = Math.max(0.03, Math.min(2, Number(settings.intensity || 100) / 100));
    if (this.lootOverlay) this.lootOverlay.style.setProperty('--leg-glow', glow);
    if (this.mapOverlay) this.mapOverlay.style.setProperty('--leg-glow', glow);
  },

  applyAnimationSpeed(settings) {
    const speed = Math.max(25, Math.min(300, Number(settings.animationSpeed || 100))) / 100;
    [this.lootOverlay, this.mapOverlay, this.textOverlay].forEach((el) => el && el.style.setProperty('--leg-speed', speed));
    if (this.activeLootWindow) {
      this.activeLootWindow.querySelectorAll('.leg-neon-item').forEach((item) => item.style.setProperty('--leg-speed', speed));
    }
  },

  applyColors(settings) {
    const color1 = settings.neonColor1 || '#ff36d1';
    const color2 = settings.neonColor2 || '#ff007a';
    [this.lootOverlay, this.mapOverlay, this.textOverlay].forEach((el) => {
      if (!el) return;
      el.style.setProperty('--leg-color-1', color1);
      el.style.setProperty('--leg-color-2', color2);
    });
    if (this.activeLootWindow) {
      this.activeLootWindow.querySelectorAll('.leg-neon-item').forEach((item) => {
        item.style.setProperty('--leg-color-1', color1);
        item.style.setProperty('--leg-color-2', color2);
      });
    }
  },

  createEffects(windowElement, settings) {
    if (this.activeLootWindow === windowElement) {
      this.applyIntensity(settings);
      this.applyAnimationSpeed(settings);
      this.applyColors(settings);
      this.applyNeonMode(settings);
      this.applyMapShader(settings);
      this.positionLootOverlay();
      this.positionMapOverlay();
      return;
    }

    this.removeEffects();
    this.activeLootWindow = windowElement;

    if (settings.lootGlow) {
      this.lootOverlay = document.createElement('div');
      this.lootOverlay.className = 'leg-neon-loot';
      document.body.appendChild(this.lootOverlay);
    }
    if (settings.mapGlow) {
      this.mapOverlay = document.createElement('div');
      this.mapOverlay.className = 'leg-neon-map';
      document.body.appendChild(this.mapOverlay);
    }
    if (settings.legendaryText) {
      this.textOverlay = document.createElement('div');
      this.textOverlay.className = 'leg-neon-text';
      this.textOverlay.textContent = settings.legendaryTextValue || '✦ LEGENDARY DROP ✦';
      // Bardzo skromny, stały z-index - napis ma być widoczny na tle mapy, ale dymki
      // (tooltipy przedmiotów) mają zawsze pokazywać się nad nim, nie pod nim.
      this.textOverlay.style.zIndex = '3';
      document.body.appendChild(this.textOverlay);
    }
    if (settings.itemGlow) {
      const item = windowElement.querySelector(this.LEGEND_SELECTOR);
      if (item) item.classList.add('leg-neon-item');
    }

    this.applyIntensity(settings);
    this.applyAnimationSpeed(settings);
    this.applyColors(settings);
    this.applyNeonMode(settings);
    this.applyMapShader(settings);
    this.positionLootOverlay();
    this.positionMapOverlay();

    clearTimeout(this.cleanupTimer);
    this.cleanupTimer = setTimeout(() => this.removeEffects(), this.EFFECT_DURATION);
  },

  removeEffects() {
    clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;

    if (this.activeLootWindow) {
      this.activeLootWindow.querySelectorAll('.leg-neon-item').forEach((item) => {
        item.classList.remove('leg-neon-item');
        item.style.removeProperty('--leg-color-1');
        item.style.removeProperty('--leg-color-2');
        item.style.removeProperty('--leg-speed');
      });
    }
    if (this.lootOverlay) {
      this.lootOverlay.remove();
      this.lootOverlay = null;
    }
    if (this.mapOverlay) {
      this.mapOverlay.remove();
      this.mapOverlay = null;
    }
    if (this.textOverlay) {
      this.textOverlay.remove();
      this.textOverlay = null;
    }
    const canvas = this.getGameCanvas();
    if (canvas) canvas.classList.remove('leg-shader-cinematic', 'leg-shader-glow', 'leg-shader-cold', 'leg-shader-warm', 'leg-shader-dream', 'leg-shader-dark', 'leg-map-zoom');
    this.activeLootWindow = null;
  },

  checkLoot() {
    const settings = this.currentSettings;
    const legendaryWindow = this.findLegendaryWindow();
    if (legendaryWindow) this.createEffects(legendaryWindow, settings);
    else if (this.activeLootWindow) this.removeEffects();
  },

  scheduleCheck() {
    if (this.checkScheduled) return;
    this.checkScheduled = true;
    requestAnimationFrame(() => {
      this.checkScheduled = false;
      this.checkLoot();
    });
  },

  animationLoop() {
    if (!this.running) return;
    if (this.activeLootWindow) {
      if (!this.activeLootWindow.isConnected || !this.isLegendaryWindow(this.activeLootWindow)) {
        this.removeEffects();
      } else {
        this.positionLootOverlay();
        this.positionMapOverlay();
      }
    }
    requestAnimationFrame(() => this.animationLoop());
  },

  onEnable(settings) {
    this.ensureStyles();
    this.currentSettings = settings;
    this.running = true;
    this.checkScheduled = false;

    this.observer = new MutationObserver(() => this.scheduleCheck());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-item-type', 'data-frame-mania-rarity', 'class'],
    });

    this.animationLoop();
    this.scheduleCheck();
  },

  onDisable() {
    this.running = false;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.removeEffects();
  },

  onSettingsChange(settings, key) {
    this.currentSettings = settings;
    if (['lootGlow', 'mapGlow', 'itemGlow', 'legendaryText'].includes(key)) {
      this.removeEffects();
      this.scheduleCheck();
      return;
    }
    if (key === 'neonMode') {
      this.applyNeonMode(settings);
      this.applyAnimationSpeed(settings);
      this.applyIntensity(settings);
      return;
    }
    if (key === 'mapShader' || key === 'mapZoom') {
      if (this.activeLootWindow) this.applyMapShader(settings);
      return;
    }
    if (key === 'animationSpeed') {
      this.applyAnimationSpeed(settings);
      return;
    }
    if (key === 'intensity') {
      this.applyIntensity(settings);
      return;
    }
    if (key === 'legendaryTextValue') {
      if (this.textOverlay) this.textOverlay.textContent = settings.legendaryTextValue;
      return;
    }
    if (key === 'neonColor1' || key === 'neonColor2') {
      this.applyColors(settings);
    }
  },
});
