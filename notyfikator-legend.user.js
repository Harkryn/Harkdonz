// ==UserScript==
// @name         MAL - Notyfikator legend
// @namespace    margonem-addon-loader
// @version      1.1.0
// @description  Powiadamia dźwiękiem/toastem/powiadomieniem systemowym o wypadnięciu legendarnego przedmiotu.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/notyfikator-legend.user.js
// ==/UserScript==

(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})({
  id: 'notyfikator-legend',
  name: 'Notyfikator legend',
  description: 'Dźwięk, toast i powiadomienie systemowe przy wypadnięciu legendarnego przedmiotu.',
  version: '1.1.0',
  defaultEnabled: false,
  defaultSettings: {
    dzwiek: true,
    wariantDzwieku: 'dzwoneczek',
    glosnosc: 70,
    trybWykrywania: 'tylko-legendarne',
    limitOdstepuSekundy: 2,
    toast: true,
    czasWyswietlaniaToastSekundy: 5,
    powiadomienieSystemowe: false,
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
    { key: 'czasWyswietlaniaToastSekundy', type: 'number', label: 'Czas wyświetlania toastu (s)', min: 1, max: 30 },
    { key: 'powiadomienieSystemowe', type: 'boolean', label: 'Powiadomienie systemowe przeglądarki' },
  ],

  LEGEND_SELECTOR: '[data-frame-mania-rarity="legendary"], [data-item-type="t-leg"]',
  // Uwaga: brak potwierdzonego, uniwersalnego selektora "dowolnego przedmiotu" w oknie
  // łupu - to najlepsze przybliżenie. Jeśli tryb "wszystkie przedmioty" nic nie łapie,
  // trzeba będzie dopasować selektor do konkretnego serwera.
  ALL_ITEMS_SELECTOR: '.loot-window .items-wrapper .item, [class*="loot-window"] [class*="item"]',

  seen: null,
  observer: null,
  audioCtx: null,
  lastNotifyTime: 0,
  currentSettings: null,

  activeSelector(settings) {
    return settings.trybWykrywania === 'wszystkie-przedmioty' ? this.ALL_ITEMS_SELECTOR : this.LEGEND_SELECTOR;
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
        background: linear-gradient(135deg, #2a1f0a, #1a1408);
        border: 1px solid #d4af37; color: #ffe9a8; font: 600 13px/1.4 -apple-system, Segoe UI, sans-serif;
        padding: 10px 18px; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.5), 0 0 18px rgba(212,175,55,.35);
        opacity: 0; transform: translateY(-8px); transition: opacity .25s ease, transform .25s ease;
      }
      .mal-nl-toast.mal-nl-show { opacity: 1; transform: translateY(0); }
    `;
    document.head.appendChild(style);
  },

  showToast(text, durationSeconds) {
    this.ensureStyles();
    let wrap = document.getElementById('mal-nl-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'mal-nl-toast-wrap';
      document.body.appendChild(wrap);
    }
    const toast = document.createElement('div');
    toast.className = 'mal-nl-toast';
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

    if (settings.toast) this.showToast(label, settings.czasWyswietlaniaToastSekundy);
    if (settings.dzwiek) this.playChime(settings.glosnosc, settings.wariantDzwieku);
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
