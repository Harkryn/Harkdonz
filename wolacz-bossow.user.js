// ==UserScript==
// @name         MAL - Wołacz bossów
// @namespace    margonem-addon-loader
// @version      1.0.1
// @description  Wykrywa Herosów, Kolosów i Tytanów na mapie i powiadamia (toast/dźwięk/kopiowanie do schowka).
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/wolacz-bossow.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/wolacz-bossow.user.js
// ==/UserScript==

(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})({
  id: 'wolacz-bossow',
  name: 'Wołacz bossów',
  description: 'Powiadamia o Herosach, Kolosach i Tytanach widocznych na mapie.',
  version: '1.0.1',
  updateCheckUrl: 'https://raw.githubusercontent.com/Harkryn/Harkdonz/main/wolacz-bossow.user.js',
  defaultEnabled: false,
  defaultSettings: {
    heros: true,
    kolos: true,
    tytan: true,
    dzwiek: true,
    toast: true,
    kopiujDoSchowka: false,
    szablon: 'Uwaga! {TYP} {NAZWA} na mapie {MAPA} ({KOORDY})',
  },
  settingsSchema: [
    { key: 'heros', type: 'boolean', label: 'Powiadamiaj o Herosach' },
    { key: 'kolos', type: 'boolean', label: 'Powiadamiaj o Kolosach' },
    { key: 'tytan', type: 'boolean', label: 'Powiadamiaj o Tytanach' },
    { key: 'dzwiek', type: 'boolean', label: 'Dźwięk przy wykryciu' },
    { key: 'toast', type: 'boolean', label: 'Powiadomienie w grze (toast)' },
    { key: 'kopiujDoSchowka', type: 'boolean', label: 'Kopiuj wiadomość do schowka' },
    { key: 'szablon', type: 'text', label: 'Szablon wiadomości', placeholder: '{TYP} {NAZWA} {MAPA} {KOORDY}' },
  ],

  seenKeys: null,
  observer: null,
  audioCtx: null,
  currentSettings: null,

  ensureStyles() {
    if (document.getElementById('mal-wb-style')) return;
    const style = document.createElement('style');
    style.id = 'mal-wb-style';
    style.textContent = `
      #mal-wb-toast-wrap {
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        z-index: 999998; display: flex; flex-direction: column; gap: 8px; align-items: center;
        pointer-events: none;
      }
      .mal-wb-toast {
        background: linear-gradient(135deg, #1b0f26, #120a1a);
        border: 1px solid #a855f7; color: #eadcfb; font: 600 13px/1.4 -apple-system, Segoe UI, sans-serif;
        padding: 10px 18px; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.5), 0 0 18px rgba(168,85,247,.35);
        opacity: 0; transform: translateY(-8px); transition: opacity .25s ease, transform .25s ease;
      }
      .mal-wb-toast.mal-wb-show { opacity: 1; transform: translateY(0); }
    `;
    document.head.appendChild(style);
  },

  showToast(text) {
    this.ensureStyles();
    let wrap = document.getElementById('mal-wb-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'mal-wb-toast-wrap';
      document.body.appendChild(wrap);
    }
    const toast = document.createElement('div');
    toast.className = 'mal-wb-toast';
    toast.textContent = '⚔ ' + text;
    wrap.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('mal-wb-show'));
    setTimeout(() => {
      toast.classList.remove('mal-wb-show');
      setTimeout(() => toast.remove(), 300);
    }, 5500);
  },

  playChime() {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.15);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (err) {
      console.error('[MAL:wolacz-bossow] Nie udało się odtworzyć dźwięku:', err);
    }
  },

  readNotice(el) {
    const image = el.querySelector('img[data-tip-type="t_npc"]') || (el.matches('img[data-tip-type="t_npc"]') ? el : null);
    if (!image) return null;
    let path = '';
    try {
      path = new URL(image.getAttribute('src') || '', location.href).pathname;
    } catch {
      return null;
    }
    let type = null;
    if (/\/npc\/her\//i.test(path)) type = 'Heros';
    else if (/\/npc\/kol\//i.test(path)) type = 'Kolos';
    else if (/\/npc\/tyt\//i.test(path)) type = 'Tytan';
    if (!type) return null;

    const container = el.closest('*') || el;
    const nameNode = container.querySelector('.name-label') || document.querySelector('.name-label');
    const mapNode = container.querySelector('.map-label') || document.querySelector('.map-label');
    const name = (nameNode?.textContent || '').replace(/\s+/g, ' ').trim();
    const mapText = (mapNode?.textContent || '').replace(/\s+/g, ' ').trim();
    const match = mapText.match(/^(.*?)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*$/);
    if (!name || !match || !match[1].trim()) return null;

    return {
      type,
      name,
      map: match[1].trim(),
      coords: match[2] + ',' + match[3],
      key: [type, name, match[1].trim(), match[2], match[3]].join('|'),
    };
  },

  handleNotice(notice, settings) {
    const flagByType = { Heros: 'heros', Kolos: 'kolos', Tytan: 'tytan' };
    if (!settings[flagByType[notice.type]]) return;
    if (this.seenKeys.has(notice.key)) return;
    this.seenKeys.add(notice.key);
    setTimeout(() => this.seenKeys.delete(notice.key), 5 * 60 * 1000);

    const message = String(settings.szablon || '')
      .replace(/\{TYP\}/g, notice.type)
      .replace(/\{NAZWA\}/g, notice.name)
      .replace(/\{MAPA\}/g, notice.map)
      .replace(/\{KOORDY\}/g, notice.coords);

    if (settings.toast) this.showToast(message);
    if (settings.dzwiek) this.playChime();
    if (settings.kopiujDoSchowka && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message).catch(() => {});
    }
  },

  scanNode(node, settings) {
    if (!(node instanceof Element)) return;
    const candidates = [];
    if (node.matches && node.matches('img[data-tip-type="t_npc"]')) candidates.push(node);
    node.querySelectorAll && node.querySelectorAll('img[data-tip-type="t_npc"]').forEach((el) => candidates.push(el));
    candidates.forEach((el) => {
      const notice = this.readNotice(el);
      if (notice) this.handleNotice(notice, settings);
    });
  },

  onEnable(settings) {
    this.seenKeys = new Set();
    this.currentSettings = settings;
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => this.scanNode(node, this.currentSettings));
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
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
