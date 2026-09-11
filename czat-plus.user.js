// ==UserScript==
// @name         MAL - Czat plus
// @namespace    margonem-addon-loader
// @version      1.1.0
// @description  Znaczniki czasu, klikalne linki i podświetlanie wzmianek na czacie.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/czat-plus.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/czat-plus.user.js
// ==/UserScript==

(function register(config) {
  if (window.MAL) window.MAL.registerAddon(config);
  else (window.__MAL_PENDING__ = window.__MAL_PENDING__ || []).push(config);
})({
  id: 'czat-plus',
  name: 'Czat plus',
  description: 'Znaczniki czasu, klikalne odnośniki, emotki i podświetlanie wzmianek Twojego nicku.',
  version: '1.1.0',
  updateCheckUrl: 'https://raw.githubusercontent.com/Harkryn/Harkdonz/main/czat-plus.user.js',
  defaultEnabled: false,
  defaultSettings: {
    znacznikCzasu: true,
    klikalneLinki: true,
    emotkiWlaczone: true,
    podswietlanieWzmianek: true,
    mojNick: '',
    dzwiekWzmianki: true,
  },
  settingsSchema: [
    { key: 'znacznikCzasu', type: 'boolean', label: 'Dodawaj znacznik czasu do wiadomości' },
    { key: 'klikalneLinki', type: 'boolean', label: 'Zamieniaj linki na klikalne' },
    { key: 'emotkiWlaczone', type: 'boolean', label: 'Zamieniaj :emotki: na emoji' },
    { key: 'podswietlanieWzmianek', type: 'boolean', label: 'Podświetlaj wzmianki Twojego nicku' },
    { key: 'mojNick', type: 'text', label: 'Twój nick (do wzmianek)', placeholder: 'Twoja postać' },
    { key: 'dzwiekWzmianki', type: 'boolean', label: 'Dźwięk przy wzmiance' },
  ],

  CHAT_ROOT_SELECTOR: '[class*="chat"], [class*="Chat"], [id*="chat"], [id*="Chat"]',
  URL_RE: /\bhttps?:\/\/[^\s<>"']+/gi,
  EMOTICON_TOKEN_RE: /:([a-z0-9_]+):/gi,
  // Odpowiednik katalogu emotek z czat.js Shacala - tam to obrazki z ich CDN, których nie
  // mamy prawa używać, więc zamiast tego stawiamy na uniwersalne unicode emoji (zero
  // zewnętrznych zasobów, zero problemów z prawami).
  EMOTICONS: {
    usmiech: '😊',
    smiech: '😂',
    oko: '😉',
    serce: '❤️',
    zlosc: '😠',
    placz: '😭',
    super: '😎',
    ok: '👌',
    gora: '👍',
    dol: '👎',
    ogien: '🔥',
    gwiazda: '⭐',
    puchar: '🏆',
    miecz: '⚔️',
    tarcza: '🛡️',
    czaszka: '💀',
    gg: '🎮',
    hej: '👋',
    pa: '🖐️',
    myslenie: '🤔',
    clap: '👏',
    impreza: '🎉',
    legenda: '✨',
    zloto: '💰',
    boss: '👹',
  },
  observer: null,
  processed: null,
  audioCtx: null,
  currentSettings: null,

  playPing() {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch (err) {
      console.error('[MAL:czat-plus] Nie udało się odtworzyć dźwięku:', err);
    }
  },

  // [data-mal-czp-injected] wyklucza elementy, ktore sam dodatek wstawia (znacznik czasu,
  // zamienione linki) - bez tego wlasny MutationObserver lapalby je jako "nowa wiadomosc"
  // i w kolko dopisywal kolejne znaczniki (petla, ktora potrafi zawiesic karte).
  EXCLUDE_SELECTOR: '#mal-root, script, style, textarea, input, select, option, [contenteditable="true"], [data-mal-czp-injected]',

  isChatRoot(el) {
    return el instanceof Element && el.matches(this.CHAT_ROOT_SELECTOR) && !el.closest(this.EXCLUDE_SELECTOR);
  },

  isWithinChatRoot(el) {
    if (!(el instanceof Element) || !el.isConnected) return false;
    if (el.closest(this.EXCLUDE_SELECTOR)) return false;
    return !!el.closest(this.CHAT_ROOT_SELECTOR);
  },

  processIfNew(lineEl, settings) {
    if (!(lineEl instanceof Element) || this.processed.has(lineEl)) return;
    if (!lineEl.textContent || !lineEl.textContent.trim()) return;
    this.processed.add(lineEl);
    this.processLine(lineEl, settings);
  },

  // Panel czatu = kontener, każda wiadomość = jego bezpośrednie dziecko dodawane w czasie.
  // Dla treści obecnej już w chwili włączenia dodatku trzeba przejść po dzieciach ręcznie,
  // bo MutationObserver widzi tylko zmiany zachodzące od teraz.
  scanExisting(settings) {
    document.querySelectorAll(this.CHAT_ROOT_SELECTOR).forEach((root) => {
      if (root.closest(this.EXCLUDE_SELECTOR)) return;
      Array.from(root.children).forEach((child) => this.processIfNew(child, settings));
    });
  },

  // Dla nowo dodanych węzłów: jeśli węzeł trafił do wnętrza panelu czatu, to on sam jest
  // nową wiadomością. Jeśli to cały panel czatu pojawił się dopiero teraz, przetwarzamy
  // jego dotychczasowe dzieci tak samo jak przy starcie.
  handleAddedNode(node, settings) {
    if (!(node instanceof Element)) return;
    if (this.isWithinChatRoot(node)) this.processIfNew(node, settings);
    if (this.isChatRoot(node)) Array.from(node.children).forEach((child) => this.processIfNew(child, settings));
  },

  linkifyTextNode(textNode) {
    const text = textNode.nodeValue || '';
    this.URL_RE.lastIndex = 0;
    if (!this.URL_RE.test(text)) return;
    this.URL_RE.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    while ((match = this.URL_RE.exec(text))) {
      if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      const a = document.createElement('a');
      a.href = match[0];
      a.textContent = match[0];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.color = '#7cc4ff';
      a.setAttribute('data-mal-czp-injected', '1');
      fragment.appendChild(a);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    textNode.replaceWith(fragment);
  },

  renderEmoticonsInTextNode(textNode) {
    const text = textNode.nodeValue || '';
    if (!text.includes(':')) return;
    this.EMOTICON_TOKEN_RE.lastIndex = 0;
    let match;
    let found = false;
    let lastIndex = 0;
    const fragment = document.createDocumentFragment();
    while ((match = this.EMOTICON_TOKEN_RE.exec(text))) {
      const emoji = this.EMOTICONS[match[1].toLowerCase()];
      if (!emoji) continue;
      found = true;
      if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      const span = document.createElement('span');
      span.textContent = emoji;
      span.title = match[0];
      span.style.cssText = 'font-size:1.15em;line-height:1;';
      span.setAttribute('data-mal-czp-injected', '1');
      fragment.appendChild(span);
      lastIndex = match.index + match[0].length;
    }
    if (!found) return;
    if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    textNode.replaceWith(fragment);
  },

  prependTimestamp(lineEl) {
    if (lineEl.dataset.malTimestamped) return;
    lineEl.dataset.malTimestamped = '1';
    const time = new Date();
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const span = document.createElement('span');
    span.textContent = `[${hh}:${mm}] `;
    span.style.cssText = 'color:#7a7d8a;font-size:.85em;';
    span.setAttribute('data-mal-czp-injected', '1');
    lineEl.prepend(span);
  },

  highlightMention(lineEl, settings) {
    const nick = (settings.mojNick || '').trim();
    if (!nick) return;
    const text = lineEl.textContent || '';
    if (!text.toLowerCase().includes(nick.toLowerCase())) return;
    if (lineEl.dataset.malMentionHandled) return;
    lineEl.dataset.malMentionHandled = '1';
    lineEl.style.cssText += 'background:rgba(124,92,255,.18);border-radius:6px;padding:2px 4px;';
    if (settings.dzwiekWzmianki) this.playPing();
  },

  textNodesContaining(root, needle) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.nodeValue && node.nodeValue.includes(needle) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    return nodes;
  },

  processLine(lineEl, settings) {
    if (settings.znacznikCzasu) this.prependTimestamp(lineEl);
    if (settings.klikalneLinki) {
      this.textNodesContaining(lineEl, 'http').forEach((n) => this.linkifyTextNode(n));
    }
    if (settings.emotkiWlaczone) {
      this.textNodesContaining(lineEl, ':').forEach((n) => this.renderEmoticonsInTextNode(n));
    }
    if (settings.podswietlanieWzmianek) this.highlightMention(lineEl, settings);
  },

  onEnable(settings) {
    this.processed = new WeakSet();
    this.currentSettings = settings;
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => this.handleAddedNode(node, this.currentSettings));
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.scanExisting(settings);
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
