// ==UserScript==
// @name         MAL - Notyfikator legend
// @namespace    margonem-addon-loader
// @version      1.0.0
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
  version: '1.0.0',
  defaultEnabled: false,
  defaultSettings: {
    dzwiek: true,
    glosnosc: 70,
    toast: true,
    powiadomienieSystemowe: false,
  },
  settingsSchema: [
    { key: 'dzwiek', type: 'boolean', label: 'Dźwięk przy legendzie' },
    { key: 'glosnosc', type: 'number', label: 'Głośność (0-100)', min: 0, max: 100 },
    { key: 'toast', type: 'boolean', label: 'Powiadomienie w grze (toast)' },
    { key: 'powiadomienieSystemowe', type: 'boolean', label: 'Powiadomienie systemowe przeglądarki' },
  ],

  LEGEND_SELECTOR: '[data-frame-mania-rarity="legendary"], [data-item-type="t-leg"]',
  seen: null,
  observer: null,
  audioCtx: null,

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

  showToast(text) {
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
    setTimeout(() => {
      toast.classList.remove('mal-nl-show');
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  },

  playChime(volumePercent) {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, volumePercent / 100)) * 0.35;
      gain.connect(ctx.destination);
      [880, 1318.5, 1760].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0, now + i * 0.12);
        noteGain.gain.linearRampToValueAtTime(1, now + i * 0.12 + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
        osc.connect(noteGain).connect(gain);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.55);
      });
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
    const name = this.extractItemName(el);
    if (settings.toast) this.showToast('Legendarny przedmiot: ' + name);
    if (settings.dzwiek) this.playChime(settings.glosnosc);
    if (settings.powiadomienieSystemowe && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Legendarny przedmiot!', { body: name });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  },

  scanNode(node, settings) {
    if (!(node instanceof Element)) return;
    if (node.matches && node.matches(this.LEGEND_SELECTOR)) this.handleLegendaryElement(node, settings);
    node.querySelectorAll && node.querySelectorAll(this.LEGEND_SELECTOR).forEach((el) => this.handleLegendaryElement(el, settings));
  },

  onEnable(settings) {
    this.seen = new WeakSet();
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => this.scanNode(node, this.currentSettings || settings));
      }
    });
    this.currentSettings = settings;
    this.observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll(this.LEGEND_SELECTOR).forEach((el) => this.seen.add(el));
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
