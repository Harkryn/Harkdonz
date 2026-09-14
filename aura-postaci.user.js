// ==UserScript==
// @name         Harkdonz - Aura postaci
// @namespace    margonem-addon-loader
// @version      2.0.0
// @description  Rozbudowana, konfigurowalna aura wokół postaci: poświata, halo, cykl RGB, ślad i lokalne profile - przepisane z god-mode.js Shacal Customizer.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/aura-postaci.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/aura-postaci.user.js
// ==/UserScript==

/**
 * Odpowiednik god-mode.js: tam to złożony silnik z warstwami koloru, halo, śladu,
 * stylami neon/pentagram i synchronizacją profili w ich chmurze. U nas: ten sam zakres
 * ustawień (poświata + halo + ślad + cykl RGB + dyskoteka + lokalne profile), własna,
 * prostsza implementacja na canvasie zamiast ich silnika. Synchronizacja w chmurze
 * celowo pominięta - wymagałaby ich prywatnego backendu. Profile są lokalne
 * (localStorage), więc działają identycznie z punktu widzenia gracza na tym komputerze.
 *
 * Margonem może renderować postać na canvasie gry, więc nie da się jej podświetlić
 * czystym CSS. Efekty są rysowane na osobnym, przezroczystym canvasie na wierzchu,
 * pozycjonowane względem elementu wskazanego selektorem CSS z ustawień (np. dymek
 * z nickiem nad postacią). Jeśli selektor nic nie znajdzie, nic się nie rysuje - trzeba
 * podejrzeć w narzędziach deweloperskich przeglądarki właściwy element.
 */
(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})({
  id: 'aura-postaci',
  name: 'Aura postaci',
  description: 'Poświata, halo, ślad, cykl RGB i lokalne profile - konfigurowalna aura wokół postaci.',
  version: '2.0.0',
  updateCheckUrl: 'https://raw.githubusercontent.com/Harkryn/Harkdonz/main/aura-postaci.user.js',
  defaultEnabled: false,
  defaultSettings: {
    selektor: '.hero .name-label, .hero-nick, [class*="hero"] [class*="name"]',

    auraWlaczona: true,
    kolor: '#23e4cf',
    rozmiar: 60,
    intensywnosc: 65,
    predkoscPulsu: 50,
    rgbCykl: false,
    predkoscRgb: 50,
    dyskotekaAura: false,

    haloWlaczone: false,
    kolorHalo: '#a855f7',
    rozmiarHalo: 100,
    intensywnoscHalo: 40,

    sladWlaczony: false,
    ksztaltSladu: 'kropka',
    kolorSladu: '#39e4ff',
    zyciowoscSladu: 3,
    rozmiarSladu: 1,
    intensywnoscSladu: 60,

    nazwaProfilu: '',
  },
  settingsSchema: [
    { key: 'selektor', type: 'text', label: 'Selektor CSS elementu postaci', placeholder: '.hero .name-label' },

    { key: 'auraWlaczona', type: 'boolean', label: 'Poświata (główna aura)' },
    { key: 'kolor', type: 'color', label: 'Kolor poświaty', default: '#23e4cf' },
    { key: 'rozmiar', type: 'number', label: 'Promień poświaty (px)', min: 10, max: 200 },
    { key: 'intensywnosc', type: 'number', label: 'Intensywność poświaty (0-100)', min: 0, max: 100 },
    { key: 'predkoscPulsu', type: 'number', label: 'Prędkość pulsu (0-100)', min: 0, max: 100 },
    { key: 'rgbCykl', type: 'boolean', label: 'Cykl RGB (kolor zmienia się sam)' },
    { key: 'predkoscRgb', type: 'number', label: 'Prędkość cyklu RGB (0-100)', min: 0, max: 100 },
    { key: 'dyskotekaAura', type: 'boolean', label: 'Tryb dyskoteka (skoki koloru)' },

    { key: 'haloWlaczone', type: 'boolean', label: 'Dodatkowe halo (druga warstwa)' },
    { key: 'kolorHalo', type: 'color', label: 'Kolor halo', default: '#a855f7' },
    { key: 'rozmiarHalo', type: 'number', label: 'Promień halo (px)', min: 10, max: 300 },
    { key: 'intensywnoscHalo', type: 'number', label: 'Intensywność halo (0-100)', min: 0, max: 100 },

    { key: 'sladWlaczony', type: 'boolean', label: 'Ślad za postacią' },
    {
      key: 'ksztaltSladu',
      type: 'select',
      label: 'Kształt śladu',
      options: [
        { value: 'kropka', label: 'Kropka' },
        { value: 'kwadrat', label: 'Kwadrat' },
        { value: 'romb', label: 'Romb' },
        { value: 'gwiazda', label: 'Gwiazda' },
        { value: 'plus', label: 'Plus' },
      ],
    },
    { key: 'kolorSladu', type: 'color', label: 'Kolor śladu', default: '#39e4ff' },
    { key: 'zyciowoscSladu', type: 'number', label: 'Czas zanikania śladu (s)', min: 1, max: 8 },
    { key: 'rozmiarSladu', type: 'number', label: 'Rozmiar śladu (0.5-2)', min: 0.5, max: 2 },
    { key: 'intensywnoscSladu', type: 'number', label: 'Intensywność śladu (0-100)', min: 0, max: 100 },

    { key: 'nazwaProfilu', type: 'text', label: 'Nazwa profilu (do zapisu/wczytania)', placeholder: 'np. Legenda' },
    {
      key: 'zapiszProfil',
      type: 'button',
      label: 'Zapisz profil',
      onClick(settings) {
        const name = (settings.nazwaProfilu || '').trim();
        if (!name) {
          alert('Podaj nazwę profilu w polu wyżej.');
          return;
        }
        const profiles = this.loadProfiles();
        const snapshot = {};
        this.PROFILE_FIELDS.forEach((key) => (snapshot[key] = settings[key]));
        profiles[name] = snapshot;
        this.saveProfiles(profiles);
        alert('Zapisano profil "' + name + '".');
      },
    },
    {
      key: 'wczytajProfil',
      type: 'button',
      label: 'Wczytaj profil',
      onClick(settings) {
        const name = (settings.nazwaProfilu || '').trim();
        const profiles = this.loadProfiles();
        const snapshot = profiles[name];
        if (!snapshot) {
          alert('Nie znaleziono profilu "' + name + '".');
          return;
        }
        Object.assign(settings, snapshot);
        try {
          localStorage.setItem('mal:aura-postaci:settings', JSON.stringify(settings));
        } catch (err) {
          console.error('[MAL:aura-postaci] Nie udało się zapisać wczytanych ustawień:', err);
        }
        this.currentSettings = settings;
        alert('Wczytano profil "' + name + '". Zamknij i otwórz ponownie tę zakładkę, żeby pola pokazały nowe wartości.');
      },
    },
    {
      key: 'usunProfil',
      type: 'button',
      label: 'Usuń profil',
      onClick(settings) {
        const name = (settings.nazwaProfilu || '').trim();
        const profiles = this.loadProfiles();
        if (!profiles[name]) {
          alert('Nie znaleziono profilu "' + name + '".');
          return;
        }
        delete profiles[name];
        this.saveProfiles(profiles);
        alert('Usunięto profil "' + name + '".');
      },
    },
    {
      key: 'listaProfili',
      type: 'button',
      label: 'Pokaż zapisane profile',
      onClick() {
        const names = Object.keys(this.loadProfiles());
        alert(names.length ? 'Zapisane profile:\n' + names.join('\n') : 'Brak zapisanych profili.');
      },
    },
  ],

  PROFILE_STORAGE_KEY: 'mal:aura-postaci:profiles',
  PROFILE_FIELDS: [
    'selektor',
    'auraWlaczona',
    'kolor',
    'rozmiar',
    'intensywnosc',
    'predkoscPulsu',
    'rgbCykl',
    'predkoscRgb',
    'dyskotekaAura',
    'haloWlaczone',
    'kolorHalo',
    'rozmiarHalo',
    'intensywnoscHalo',
    'sladWlaczony',
    'ksztaltSladu',
    'kolorSladu',
    'zyciowoscSladu',
    'rozmiarSladu',
    'intensywnoscSladu',
  ],

  canvas: null,
  ctx: null,
  rafId: null,
  startTime: 0,
  currentSettings: null,
  warnedMissing: false,
  trailMarks: null,
  lastTrailPos: null,

  loadProfiles() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.PROFILE_STORAGE_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  },
  saveProfiles(profiles) {
    try {
      localStorage.setItem(this.PROFILE_STORAGE_KEY, JSON.stringify(profiles));
    } catch (err) {
      console.error('[MAL:aura-postaci] Nie udało się zapisać profili:', err);
    }
  },

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

  hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  },

  discoRgb(channel, elapsed) {
    const step = Math.floor(elapsed / 0.32);
    const hue = (step * 137.508 + (channel === 'halo' ? 180 : 0)) % 360;
    return this.hslToRgb(hue, 75, 55);
  },

  resolveGlowColor(elapsed, settings) {
    if (settings.dyskotekaAura) return this.discoRgb('aura', elapsed);
    if (settings.rgbCykl) {
      const hue = elapsed * (0.15 + (settings.predkoscRgb / 100) * 1.6) * 60;
      return this.hslToRgb(hue, 75, 55);
    }
    return this.hexToRgb(settings.kolor);
  },

  drawRing(cx, cy, radius, rgb, alpha) {
    const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, radius));
    gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`);
    gradient.addColorStop(0.6, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha * 0.4})`);
    gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, Math.max(1, radius), 0, Math.PI * 2);
    this.ctx.fill();
  },

  drawTrailShape(x, y, shape, size, rgb, alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    ctx.beginPath();
    switch (shape) {
      case 'kwadrat':
        ctx.rect(x - size, y - size, size * 2, size * 2);
        break;
      case 'romb':
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        break;
      case 'plus': {
        const w = size * 0.4;
        ctx.rect(x - w, y - size, w * 2, size * 2);
        ctx.rect(x - size, y - w, size * 2, w * 2);
        break;
      }
      case 'gwiazda': {
        const spikes = 5;
        const outer = size;
        const inner = size * 0.45;
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outer : inner;
          const angle = (Math.PI / spikes) * i - Math.PI / 2;
          const px = x + Math.cos(angle) * r;
          const py = y + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'kropka':
      default:
        ctx.arc(x, y, size, 0, Math.PI * 2);
    }
    ctx.fill();
  },

  updateTrail(cx, cy, elapsed, settings) {
    if (!this.trailMarks) this.trailMarks = [];
    const last = this.lastTrailPos;
    if (!last || Math.hypot(cx - last.x, cy - last.y) > 14) {
      this.trailMarks.push({ x: cx, y: cy, born: elapsed });
      this.lastTrailPos = { x: cx, y: cy };
    }
    const life = Math.max(0.2, Number(settings.zyciowoscSladu) || 3);
    this.trailMarks = this.trailMarks.filter((m) => elapsed - m.born < life);
    const rgb = this.hexToRgb(settings.kolorSladu);
    const baseAlpha = Math.max(0, Math.min(1, settings.intensywnoscSladu / 100));
    const size = Math.max(1, 5 * (Number(settings.rozmiarSladu) || 1));
    this.trailMarks.forEach((m) => {
      const age = elapsed - m.born;
      const alpha = baseAlpha * Math.max(0, 1 - age / life);
      this.drawTrailShape(m.x, m.y, settings.ksztaltSladu, size, rgb, alpha);
    });
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

      if (settings.sladWlaczony) this.updateTrail(cx, cy, elapsed, settings);

      if (settings.haloWlaczone) {
        const haloAlpha = Math.max(0, Math.min(1, settings.intensywnoscHalo / 100));
        this.drawRing(cx, cy, Number(settings.rozmiarHalo) || 100, this.hexToRgb(settings.kolorHalo), haloAlpha);
      }

      if (settings.auraWlaczona) {
        const speed = 0.3 + (settings.predkoscPulsu / 100) * 2.2;
        const pulse = 0.75 + 0.25 * Math.sin(elapsed * speed * Math.PI);
        const radius = Math.max(4, settings.rozmiar * pulse);
        const rgb = this.resolveGlowColor(elapsed, settings);
        const alpha = Math.max(0, Math.min(1, settings.intensywnosc / 100));
        this.drawRing(cx, cy, radius, rgb, alpha);
      }
    }

    this.rafId = requestAnimationFrame((t) => this.draw(t));
  },

  onEnable(settings) {
    this.currentSettings = settings;
    this.startTime = 0;
    this.warnedMissing = false;
    this.trailMarks = [];
    this.lastTrailPos = null;
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
