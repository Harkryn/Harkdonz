// ==UserScript==
// @name         MAL - Auto-relogger
// @namespace    margonem-addon-loader
// @version      1.0.0
// @description  Automatycznie klika przycisk wznowienia sesji po rozłączeniu. Nie przechowuje ani nie wpisuje hasła.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/auto-relogger.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/auto-relogger.user.js
// ==/UserScript==

/**
 * Ten dodatek NIE loguje się od nowa danymi konta - nie zna i nigdzie nie zapisuje hasła.
 * Działa wyłącznie wtedy, gdy gra sama pokazuje przycisk/link do wznowienia istniejącej
 * sesji (np. "Połącz ponownie", "Wznów sesję") po zerwaniu połączenia - taki przycisk
 * wykrywa po widocznym tekście (odporne na zmiany klas/ID) i klika go automatycznie.
 */
(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})({
  id: 'auto-relogger',
  name: 'Auto-relogger',
  description: 'Klika przycisk wznowienia sesji po rozłączeniu. Nie obsługuje haseł.',
  version: '1.0.0',
  defaultEnabled: false,
  defaultSettings: {
    opoznienieSekundy: 3,
    wzorzecTekstu: 'połącz ponownie|zaloguj ponownie|wznów sesję|wznów połączenie|reconnect',
    dzwiekPrzyProbie: true,
  },
  settingsSchema: [
    { key: 'opoznienieSekundy', type: 'number', label: 'Opóźnienie przed kliknięciem (s)', min: 0, max: 30 },
    { key: 'wzorzecTekstu', type: 'text', label: 'Wzorzec tekstu przycisku (regex, "|" = lub)', placeholder: 'połącz ponownie|reconnect' },
    { key: 'dzwiekPrzyProbie', type: 'boolean', label: 'Dźwięk przy automatycznym kliknięciu' },
  ],

  observer: null,
  currentSettings: null,
  pendingTimeout: null,
  attemptTimestamps: null,
  audioCtx: null,
  MAX_ATTEMPTS_PER_MINUTE: 3,

  playBeep() {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 500;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.27);
    } catch (err) {
      console.error('[MAL:auto-relogger] Nie udało się odtworzyć dźwięku:', err);
    }
  },

  isVisible(el) {
    if (!el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  },

  buildRegex(settings) {
    try {
      return new RegExp(settings.wzorzecTekstu, 'i');
    } catch {
      return /połącz ponownie|zaloguj ponownie|wznów sesję/i;
    }
  },

  findReconnectButton(settings) {
    const regex = this.buildRegex(settings);
    const candidates = document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]');
    for (const el of candidates) {
      const text = (el.value || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text && regex.test(text) && this.isVisible(el)) return el;
    }
    return null;
  },

  tooManyRecentAttempts() {
    const now = Date.now();
    this.attemptTimestamps = this.attemptTimestamps.filter((t) => now - t < 60000);
    return this.attemptTimestamps.length >= this.MAX_ATTEMPTS_PER_MINUTE;
  },

  scheduleClick(button, settings) {
    if (this.pendingTimeout) return;
    const delayMs = Math.max(0, Number(settings.opoznienieSekundy) || 0) * 1000;
    this.pendingTimeout = setTimeout(() => {
      this.pendingTimeout = null;
      if (!button.isConnected || !this.isVisible(button)) return;
      if (this.tooManyRecentAttempts()) {
        console.warn('[MAL:auto-relogger] Za dużo prób w ciągu minuty - wstrzymuję automatyczne klikanie.');
        return;
      }
      this.attemptTimestamps.push(Date.now());
      if (settings.dzwiekPrzyProbie) this.playBeep();
      button.click();
    }, delayMs);
  },

  scan(settings) {
    if (this.pendingTimeout) return;
    const button = this.findReconnectButton(settings);
    if (button) this.scheduleClick(button, settings);
  },

  onEnable(settings) {
    this.currentSettings = settings;
    this.attemptTimestamps = [];
    // Debounce: mutacji na stronie moze byc bardzo duzo (czat, animacje), a szukanie
    // przycisku wznowienia sesji przeszukuje caly dokument - nie robimy tego przy KAZDEJ
    // pojedynczej mutacji, tylko najwyzej raz na pol sekundy ciszy.
    this.observer = new MutationObserver(() => {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => this.scan(this.currentSettings), 500);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.scan(settings);
  },

  onDisable() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    clearTimeout(this.debounceTimeout);
  },

  onSettingsChange(settings) {
    this.currentSettings = settings;
  },
});
