// ==UserScript==
// @name         MAL - Aura postaci
// @namespace    margonem-addon-loader
// @version      1.0.0
// @description  Kosmetyczna, pulsująca aura wokół wskazanego elementu (np. nicku postaci).
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/aura-postaci.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/aura-postaci.user.js
// ==/UserScript==

/**
 * Uwaga: Margonem może renderować postać na canvasie, więc nie da się jej "podświetlić"
 * czystym CSS. Ten dodatek rysuje własną, niezależną poświatę na osobnym canvasie,
 * pozycjonowaną względem elementu wskazanego selektorem CSS z ustawień (np. dymek
 * z nickiem nad postacią). Jeśli selektor nic nie znajdzie, dodatek po prostu nic nie rysuje
 * - trzeba wtedy podejrzeć w narzędziach deweloperskich przeglądarki właściwy element i
 * wpisać jego selektor w ustawieniach.
 */
(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})({
  id: 'aura-postaci',
  name: 'Aura postaci',
  description: 'Pulsująca, kolorowa poświata wokół wybranego elementu (np. nicku postaci).',
  version: '1.0.0',
  defaultEnabled: false,
  defaultSettings: {
    selektor: '.hero .name-label, .hero-nick, [class*="hero"] [class*="name"]',
    kolor: '#23e4cf',
    rozmiar: 60,
    intensywnosc: 65,
    predkoscPulsu: 50,
  },
  settingsSchema: [
    { key: 'selektor', type: 'text', label: 'Selektor CSS elementu postaci', placeholder: '.hero .name-label' },
    { key: 'kolor', type: 'text', label: 'Kolor aury (hex)', placeholder: '#23e4cf' },
    { key: 'rozmiar', type: 'number', label: 'Promień (px)', min: 10, max: 200 },
    { key: 'intensywnosc', type: 'number', label: 'Intensywność (0-100)', min: 0, max: 100 },
    { key: 'predkoscPulsu', type: 'number', label: 'Prędkość pulsu (0-100)', min: 0, max: 100 },
  ],

  canvas: null,
  ctx: null,
  rafId: null,
  startTime: 0,
  currentSettings: null,
  warnedMissing: false,

  ensureCanvas() {
    if (this.canvas) return;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'mal-aura-canvas';
    this.canvas.style.cssText = 'position:fixed;inset:0;z-index:999997;pointer-events:none;width:100vw;height:100vh;';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
  },

  resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  hexToRgb(hex) {
    const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!match) return { r: 35, g: 228, b: 207 };
    return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
  },

  draw(timestamp) {
    if (!this.startTime) this.startTime = timestamp;
    const elapsed = (timestamp - this.startTime) / 1000;
    const settings = this.currentSettings;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const el = document.querySelector(settings.selektor);
    if (!el) {
      if (!this.warnedMissing) {
        console.warn('[MAL:aura-postaci] Nie znaleziono elementu dla selektora "' + settings.selektor + '". Popraw selektor w ustawieniach dodatku.');
        this.warnedMissing = true;
      }
    } else {
      this.warnedMissing = false;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const speed = 0.3 + (settings.predkoscPulsu / 100) * 2.2;
      const pulse = 0.75 + 0.25 * Math.sin(elapsed * speed * Math.PI);
      const radius = Math.max(4, settings.rozmiar * pulse);
      const { r, g, b } = this.hexToRgb(settings.kolor);
      const alpha = Math.max(0, Math.min(1, settings.intensywnosc / 100));

      const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      gradient.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.4})`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.rafId = requestAnimationFrame((t) => this.draw(t));
  },

  onEnable(settings) {
    this.currentSettings = settings;
    this.startTime = 0;
    this.warnedMissing = false;
    this.ensureCanvas();
    this.canvas.style.display = 'block';
    this.rafId = requestAnimationFrame((t) => this.draw(t));
  },

  onDisable() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.canvas) this.canvas.style.display = 'none';
  },

  onSettingsChange(settings) {
    this.currentSettings = settings;
    this.warnedMissing = false;
  },
});
