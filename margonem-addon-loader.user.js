// ==UserScript==
// @name         Margonem Addon Loader
// @namespace    margonem-addon-loader
// @version      1.4.0
// @description  Minimalistyczny, ciemny panel do zarządzania dodatkami Margonem. Sam w sobie nic nie robi - jest bazą, do której podpinają się przyszłe dodatki.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Harkryn/Harkdonz/main/margonem-addon-loader.user.js
// @downloadURL  https://raw.githubusercontent.com/Harkryn/Harkdonz/main/margonem-addon-loader.user.js
// ==/UserScript==

/**
 * Publiczne API dla przyszłych dodatków:
 *
 *   window.MAL.registerAddon({
 *     id: 'unikalny-identyfikator',       // wymagane, unikalne
 *     name: 'Nazwa dodatku',              // wymagane
 *     description: 'Krótki opis',         // opcjonalne
 *     version: '1.0.0',                   // opcjonalne
 *     updateCheckUrl: 'https://raw.githubusercontent.com/.../plik.user.js', // opcjonalne - pozwala
 *                                          // przyciskowi "Sprawdź aktualizacje" w loaderze porównać
 *                                          // @version z tego pliku z zainstalowaną wersją
 *     defaultEnabled: true,               // opcjonalne, domyślnie true
 *     defaultSettings: { przyklad: true },// opcjonalne, wartości domyślne ustawień
 *     settingsSchema: [                   // opcjonalne, generuje formularz w oknie dodatku
 *       { key: 'przyklad', type: 'boolean', label: 'Włącz coś' },
 *       { key: 'tekst',    type: 'text',    label: 'Jakiś tekst', placeholder: '...' },
 *       { key: 'liczba',   type: 'number',  label: 'Jakaś liczba', min: 0, max: 100 },
 *       { key: 'wybor',    type: 'select',  label: 'Wybór', options: [{ value: 'a', label: 'A' }] },
 *       { key: 'kolor',    type: 'color',   label: 'Kolor', default: '#7c5cff' }, // natywny picker koloru (paleta)
 *       { key: 'akcja',    type: 'button',  label: 'Testuj', onClick(settings) { ... } }, // "this" wewnątrz onClick to config dodatku
 *     ],
 *     onEnable(settings) {},              // wywoływane po włączeniu dodatku
 *     onDisable() {},                     // wywoływane po wyłączeniu dodatku
 *     onSettingsChange(settings, key) {}, // wywoływane przy zmianie ustawienia (gdy dodatek jest włączony)
 *   });
 *
 * Jeśli dodatek zarejestruje się zanim loader zdąży się załadować, kolejkuje się
 * automatycznie w window.__MAL_PENDING__ i zostaje podłączony, gdy loader wystartuje.
 * Zobacz plik example-addon.user.js jako gotowy szablon.
 */
(function () {
  'use strict';

  const STORAGE_PREFIX = 'mal:';

  function log(msg) {
    console.log('[MAL] ' + msg);
  }
  function warn(msg) {
    console.warn('[MAL] ' + msg);
  }
  function safeCall(fn, ctx, ...args) {
    if (typeof fn !== 'function') return;
    try {
      fn.apply(ctx, args);
    } catch (err) {
      console.error('[MAL] Błąd w dodatku "' + (ctx && ctx.id) + '":', err);
    }
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      warn('Nie udało się zapisać ustawień (' + key + '): ' + err.message);
    }
  }

  function loadSettings(id, defaults) {
    const stored = readJSON(STORAGE_PREFIX + id + ':settings', {});
    return Object.assign({}, defaults || {}, stored);
  }
  function saveSettings(id, settings) {
    writeJSON(STORAGE_PREFIX + id + ':settings', settings);
  }
  function loadEnabled(id, defaultEnabled) {
    const key = STORAGE_PREFIX + id + ':enabled';
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultEnabled !== false;
    return raw === 'true';
  }
  function saveEnabled(id, value) {
    localStorage.setItem(STORAGE_PREFIX + id + ':enabled', String(value));
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    (children || []).forEach((c) => {
      if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  const ICON_SVG =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M14.7 6.3a2 2 0 1 0-3.4-1.4V6.3H7.5a1 1 0 0 0-1 1v3.8H4.9a2 2 0 1 0 0 4H6.5V19a1 1 0 0 0 1 1h3.8v-1.6a2 2 0 1 1 4 0V20H19a1 1 0 0 0 1-1v-3.8h1.6a2 2 0 1 0 0-4H20V7.3a1 1 0 0 0-1-1h-4.3V6.3Z" ' +
    'stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

  const CSS = `
    #mal-root, #mal-root *, #mal-backdrop, #mal-backdrop * { box-sizing: border-box; }
    #mal-root {
      position: fixed; z-index: 999999; bottom: 18px; right: 18px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #e4e4e7;
    }
    #mal-toggle-btn {
      position: relative; width: 46px; height: 46px; border-radius: 50%;
      background: #1c1d21; border: 1px solid rgba(255,255,255,0.08);
      color: #a78bfa; cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      transition: transform .15s ease, background .15s ease, color .15s ease;
    }
    #mal-toggle-btn:hover { background: #24252b; color: #c4b5fd; transform: translateY(-1px); }
    #mal-toggle-btn .mal-badge {
      position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 4px;
      border-radius: 8px; background: #7c5cff; color: #fff; font-size: 10px; line-height: 16px;
      text-align: center; font-weight: 600;
    }
    #mal-backdrop {
      position: fixed; inset: 0; z-index: 999998;
      background: rgba(8,8,12,.6);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; transition: opacity .18s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #e4e4e7;
    }
    #mal-backdrop.mal-open { opacity: 1; pointer-events: auto; }
    #mal-modal {
      width: min(760px, 94vw); height: min(78vh, 620px);
      background: #17181c; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0,0,0,.55);
      display: flex; flex-direction: column; overflow: hidden;
      transform: translateY(14px) scale(.97); transition: transform .18s ease;
    }
    #mal-backdrop.mal-open #mal-modal { transform: translateY(0) scale(1); }
    .mal-modal-header {
      display: flex; align-items: center; gap: 10px; padding: 14px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
      cursor: move; user-select: none; -webkit-user-select: none;
    }
    .mal-modal-title { font-size: 14px; font-weight: 600; letter-spacing: .2px; }
    .mal-modal-count { font-size: 11px; color: #8b8d98; background: #1f2025; border-radius: 999px; padding: 3px 9px; }
    .mal-close-btn {
      margin-left: auto; background: none; border: none; color: #8b8d98; cursor: pointer;
      font-size: 18px; line-height: 1; padding: 4px 8px; border-radius: 6px;
    }
    .mal-close-btn:hover { color: #e4e4e7; background: rgba(255,255,255,0.06); }
    .mal-modal-body { flex: 1; display: flex; min-height: 0; }
    .mal-tabs { width: 210px; flex-shrink: 0; overflow-y: auto; border-right: 1px solid rgba(255,255,255,0.06); padding: 8px; }
    .mal-tabs::-webkit-scrollbar, .mal-content::-webkit-scrollbar { width: 8px; }
    .mal-tabs::-webkit-scrollbar-thumb, .mal-content::-webkit-scrollbar-thumb { background: #2a2b31; border-radius: 8px; }
    .mal-tab {
      display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 8px;
      cursor: pointer; margin-bottom: 2px; transition: background .12s ease;
    }
    .mal-tab:hover { background: #1f2025; }
    .mal-tab.mal-active { background: #24252b; }
    .mal-tab-name {
      flex: 1; min-width: 0; font-size: 12px; font-weight: 500; opacity: .8;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .mal-tab.mal-active .mal-tab-name { opacity: 1; }
    .mal-tab-dot { width: 6px; height: 6px; border-radius: 50%; background: #3a3b42; flex-shrink: 0; }
    .mal-tab-dot.mal-on { background: #6d4fe0; box-shadow: 0 0 6px rgba(109,79,224,.7); }
    .mal-content { flex: 1; overflow-y: auto; padding: 20px 22px; }
    .mal-content-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .mal-content-title { font-size: 16px; font-weight: 700; display: flex; align-items: baseline; gap: 8px; }
    .mal-content-version { font-size: 11px; color: #5c5e66; font-weight: 400; }
    .mal-content-desc { font-size: 12.5px; color: #9a9ca6; margin-top: 4px; line-height: 1.5; }
    .mal-content-switch { margin-left: auto; flex-shrink: 0; }
    .mal-fields { display: flex; flex-direction: column; gap: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); }
    .mal-field { display: flex; flex-direction: column; gap: 5px; font-size: 12px; }
    .mal-field-boolean { flex-direction: row; align-items: center; justify-content: space-between; }
    .mal-field-label { color: #c8c9d0; }
    .mal-input, .mal-select {
      background: #101114; border: 1px solid rgba(255,255,255,0.08); color: #e4e4e7;
      border-radius: 7px; padding: 7px 9px; font-size: 12.5px; outline: none;
      transition: border-color .15s ease;
    }
    .mal-input:focus, .mal-select:focus { border-color: #6d4fe0; }
    .mal-btn {
      align-self: flex-start; background: #26232f; border: 1px solid rgba(109,79,224,.4); color: #cbb9ff;
      padding: 7px 14px; border-radius: 7px; font-size: 12px; cursor: pointer; transition: background .15s ease;
    }
    .mal-btn:hover { background: #312c40; }
    .mal-btn:disabled { opacity: .55; cursor: default; }
    .mal-header-btn {
      background: #1f2025; border: 1px solid rgba(255,255,255,0.08); color: #c8c9d0;
      padding: 6px 12px; border-radius: 7px; font-size: 11.5px; cursor: pointer; transition: background .15s ease;
      white-space: nowrap;
    }
    .mal-header-btn:hover { background: #262730; }
    .mal-header-btn:disabled { opacity: .55; cursor: default; }
    .mal-tab-update { color: #f5a524; font-size: 9px; margin-left: auto; flex-shrink: 0; }
    .mal-update-notice {
      background: rgba(245,165,36,.1); border: 1px solid rgba(245,165,36,.4); border-radius: 10px;
      padding: 10px 12px; margin-bottom: 14px; font-size: 12px; color: #ffcf8a;
      display: flex; flex-direction: column; gap: 8px; align-items: flex-start;
    }
    .mal-color {
      width: 40px; height: 26px; padding: 2px; border-radius: 7px; flex-shrink: 0;
      background: #101114; border: 1px solid rgba(255,255,255,0.08); cursor: pointer;
    }
    .mal-color::-webkit-color-swatch-wrapper { padding: 0; }
    .mal-color::-webkit-color-swatch { border: none; border-radius: 4px; }
    .mal-empty { padding: 40px 20px; text-align: center; color: #6b6d76; font-size: 12.5px; line-height: 1.6; }
    .mal-modal-footer {
      padding: 8px 18px; font-size: 10px; color: #5c5e66; border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
    }
    .mal-switch { position: relative; width: 34px; height: 20px; flex-shrink: 0; display: inline-block; }
    .mal-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
    .mal-switch-track {
      position: absolute; inset: 0; background: #2a2b31; border-radius: 999px; cursor: pointer;
      transition: background .15s ease;
    }
    .mal-switch-track::before {
      content: ''; position: absolute; width: 16px; height: 16px; left: 2px; top: 2px;
      background: #cfcfd6; border-radius: 50%; transition: transform .15s ease, background .15s ease;
    }
    .mal-switch input:checked + .mal-switch-track { background: #6d4fe0; }
    .mal-switch input:checked + .mal-switch-track::before { transform: translateX(14px); background: #fff; }
    .mal-switch.small { width: 28px; height: 16px; }
    .mal-switch.small .mal-switch-track::before { width: 12px; height: 12px; left: 2px; top: 2px; }
    .mal-switch.small input:checked + .mal-switch-track::before { transform: translateX(12px); }
  `;

  const state = {
    addons: new Map(),
    activeId: null,
    tabsEl: null,
    contentEl: null,
    countEl: null,
    badgeEl: null,
    backdrop: null,
  };

  function renderField(record, field) {
    if (field.type === 'button') {
      const btn = el('button', { class: 'mal-btn', type: 'button' }, [field.label || 'Wykonaj']);
      btn.addEventListener('click', () => safeCall(field.onClick, record.config, record.settings));
      return el('div', { class: 'mal-field' }, [btn]);
    }

    const value = record.settings[field.key];
    const isRowLayout = field.type === 'boolean' || field.type === 'color';
    const wrap = el('label', { class: 'mal-field' + (isRowLayout ? ' mal-field-boolean' : '') });
    wrap.appendChild(el('span', { class: 'mal-field-label' }, [field.label || field.key]));

    let input;
    if (field.type === 'boolean') {
      const track = el('span', { class: 'mal-switch-track' });
      input = el('input', { type: 'checkbox' });
      input.checked = !!value;
      const box = el('span', { class: 'mal-switch small' }, [input, track]);
      input.addEventListener('change', () => handleFieldChange(record, field.key, input.checked));
      wrap.appendChild(box);
    } else if (field.type === 'select') {
      input = el('select', { class: 'mal-select' });
      (field.options || []).forEach((opt) => {
        const o = el('option', { value: opt.value }, [opt.label]);
        if (opt.value === value) o.selected = true;
        input.appendChild(o);
      });
      input.addEventListener('change', () => handleFieldChange(record, field.key, input.value));
      wrap.appendChild(input);
    } else if (field.type === 'color') {
      input = el('input', { type: 'color', class: 'mal-color' });
      input.value = /^#[0-9a-f]{6}$/i.test(value || '') ? value : field.default || '#7c5cff';
      input.addEventListener('input', () => handleFieldChange(record, field.key, input.value));
      wrap.appendChild(input);
    } else {
      const type = field.type === 'number' ? 'number' : 'text';
      const attrs = { class: 'mal-input', type: type, value: value == null ? '' : value };
      if (field.placeholder) attrs.placeholder = field.placeholder;
      if (field.min != null) attrs.min = field.min;
      if (field.max != null) attrs.max = field.max;
      input = el('input', attrs);
      input.addEventListener('change', () => {
        const v = type === 'number' ? Number(input.value) : input.value;
        handleFieldChange(record, field.key, v);
      });
      wrap.appendChild(input);
    }
    return wrap;
  }

  function handleFieldChange(record, key, value) {
    record.settings[key] = value;
    saveSettings(record.id, record.settings);
    if (record.enabled) {
      safeCall(record.config.onSettingsChange, record.config, record.settings, key);
    }
  }

  function toggleAddon(record, enabled) {
    record.enabled = enabled;
    saveEnabled(record.id, enabled);
    if (enabled) {
      safeCall(record.config.onEnable, record.config, record.settings);
    } else {
      safeCall(record.config.onDisable, record.config);
    }
    updateCount();
    renderTabs();
  }

  function updateCount() {
    const total = state.addons.size;
    const enabled = Array.from(state.addons.values()).filter((r) => r.enabled).length;
    if (state.countEl) state.countEl.textContent = enabled + '/' + total;
    if (state.badgeEl) {
      state.badgeEl.textContent = String(enabled);
      state.badgeEl.style.display = enabled > 0 ? 'flex' : 'none';
    }
  }

  function renderTabs() {
    state.tabsEl.textContent = '';
    state.addons.forEach((record) => {
      const dot = el('span', { class: 'mal-tab-dot' + (record.enabled ? ' mal-on' : '') });
      const name = el('span', { class: 'mal-tab-name' }, [record.config.name || record.id]);
      const children = [dot, name];
      if (record.updateAvailable) {
        children.push(el('span', { class: 'mal-tab-update', title: 'Dostępna aktualizacja' }, ['●']));
      }
      const tab = el('div', { class: 'mal-tab' + (record.id === state.activeId ? ' mal-active' : '') }, children);
      tab.addEventListener('click', () => selectTab(record.id));
      state.tabsEl.appendChild(tab);
    });
  }

  // Tampermonkey nie daje userscriptom API do wymuszenia własnej aktualizacji - to co
  // możemy zrobić, to porównać zainstalowaną wersję z tą opublikowaną pod
  // updateCheckUrl (zwykły fetch, bo raw.githubusercontent.com ma CORS: *) i podać
  // gotowy link, którego otwarcie Tampermonkey sam rozpozna jako propozycję update'u.
  function isNewerVersion(remote, local) {
    const r = String(remote || '0').split('.').map((n) => parseInt(n, 10) || 0);
    const l = String(local || '0').split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
      const rv = r[i] || 0;
      const lv = l[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  }

  async function checkAddonUpdate(record) {
    const url = record.config.updateCheckUrl;
    if (!url) return;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const match = /@version\s+([^\s]+)/.exec(text);
      if (!match) return;
      record.latestVersion = match[1];
      record.updateAvailable = isNewerVersion(match[1], record.config.version);
      record.checkError = false;
    } catch (err) {
      record.checkError = true;
      warn('Nie udało się sprawdzić aktualizacji dla "' + record.id + '": ' + err.message);
    }
  }

  async function checkAllUpdates(button) {
    const checkable = Array.from(state.addons.values()).filter((r) => r.config.updateCheckUrl);
    if (!checkable.length) {
      button.textContent = 'Żaden dodatek nie obsługuje sprawdzania';
      setTimeout(() => (button.textContent = 'Sprawdź aktualizacje'), 3000);
      return;
    }
    button.disabled = true;
    button.textContent = 'Sprawdzanie…';
    await Promise.all(checkable.map(checkAddonUpdate));
    button.disabled = false;
    const updates = checkable.filter((r) => r.updateAvailable).length;
    button.textContent = updates > 0 ? 'Dostępne aktualizacje: ' + updates : 'Wszystko aktualne';
    setTimeout(() => (button.textContent = 'Sprawdź aktualizacje'), 4000);
    renderTabs();
    if (state.activeId) renderContent(state.addons.get(state.activeId) || null);
  }

  function renderContent(record) {
    state.contentEl.textContent = '';
    if (!record) {
      state.contentEl.appendChild(
        el('div', { class: 'mal-empty' }, [
          'Brak zainstalowanych dodatków. Gdy dodasz skrypt kolejnego dodatku, pojawi się tutaj automatycznie.',
        ])
      );
      return;
    }

    const enabledInput = el('input', { type: 'checkbox' });
    enabledInput.checked = record.enabled;
    enabledInput.addEventListener('change', () => toggleAddon(record, enabledInput.checked));
    const enabledSwitch = el('label', { class: 'mal-switch mal-content-switch' }, [
      enabledInput,
      el('span', { class: 'mal-switch-track' }),
    ]);

    const header = el('div', { class: 'mal-content-header' }, [
      el('div', {}, [
        el('div', { class: 'mal-content-title' }, [
          record.config.name || record.id,
          record.config.version ? el('span', { class: 'mal-content-version' }, ['v' + record.config.version]) : null,
        ]),
        record.config.description ? el('div', { class: 'mal-content-desc' }, [record.config.description]) : null,
      ]),
      enabledSwitch,
    ]);
    state.contentEl.appendChild(header);

    if (record.updateAvailable) {
      const openBtn = el('button', { class: 'mal-btn', type: 'button' }, ['Otwórz link aktualizacji']);
      openBtn.addEventListener('click', () => window.open(record.config.updateCheckUrl, '_blank', 'noopener'));
      state.contentEl.appendChild(
        el('div', { class: 'mal-update-notice' }, [
          el('div', {}, ['Dostępna nowa wersja: v' + record.latestVersion + ' (masz v' + (record.config.version || '?') + ')']),
          openBtn,
        ])
      );
    }

    const schema = Array.isArray(record.config.settingsSchema) ? record.config.settingsSchema : [];
    if (schema.length) {
      const fields = el('div', { class: 'mal-fields' });
      schema.forEach((field) => fields.appendChild(renderField(record, field)));
      state.contentEl.appendChild(fields);
    }
  }

  function selectTab(id) {
    state.activeId = id;
    renderTabs();
    renderContent(state.addons.get(id) || null);
  }

  function appendAddon(record) {
    if (!state.activeId) state.activeId = record.id;
    renderTabs();
    if (state.activeId === record.id) renderContent(record);
    updateCount();
  }

  // Pozwala przeciągać `moveEl` łapiąc za `handleEl`. Pozycja jest zapamiętywana w
  // localStorage pod `storageKey` i odtwarzana przy kolejnym starcie. Zwraca obiekt
  // z `wasDragged()`, żeby odróżnić kliknięcie (otwórz) od przeciągnięcia (nie otwieraj).
  function makeDraggable(handleEl, moveEl, storageKey, opts) {
    opts = opts || {};
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    function clampToViewport(left, top) {
      const rect = moveEl.getBoundingClientRect();
      const maxLeft = Math.max(4, window.innerWidth - rect.width - 4);
      const maxTop = Math.max(4, window.innerHeight - rect.height - 4);
      return { left: Math.min(Math.max(4, left), maxLeft), top: Math.min(Math.max(4, top), maxTop) };
    }

    function pinToFixed(left, top) {
      moveEl.style.position = 'fixed';
      moveEl.style.margin = '0';
      if (opts.clearBottomRight) {
        moveEl.style.right = 'auto';
        moveEl.style.bottom = 'auto';
      }
      moveEl.style.left = left + 'px';
      moveEl.style.top = top + 'px';
    }

    const saved = readJSON(storageKey, null);
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      // getBoundingClientRect() wymusza natychmiastowy layout, więc nie trzeba czekać
      // na requestAnimationFrame - odczyt jest wiarygodny od razu.
      const clamped = clampToViewport(saved.left, saved.top);
      pinToFixed(clamped.left, clamped.top);
    }

    handleEl.style.touchAction = 'none';
    handleEl.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (opts.ignoreSelector && e.target.closest(opts.ignoreSelector)) return;
      dragging = true;
      moved = false;
      const rect = moveEl.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      handleEl.setPointerCapture(e.pointerId);
    });
    handleEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 4) moved = true;
      if (!moved) return;
      const clamped = clampToViewport(startLeft + dx, startTop + dy);
      pinToFixed(clamped.left, clamped.top);
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try {
        handleEl.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* pointer capture already released */
      }
      if (moved) {
        const rect = moveEl.getBoundingClientRect();
        writeJSON(storageKey, { left: rect.left, top: rect.top });
      }
    };
    handleEl.addEventListener('pointerup', endDrag);
    handleEl.addEventListener('pointercancel', endDrag);

    return { wasDragged: () => moved };
  }

  function ensureUI() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const badgeEl = el('span', { class: 'mal-badge' }, ['0']);
    badgeEl.style.display = 'none';
    const toggleBtn = el('button', { id: 'mal-toggle-btn', html: ICON_SVG, title: 'Dodatki Margonem' });
    toggleBtn.appendChild(badgeEl);

    const countEl = el('span', { class: 'mal-modal-count' }, ['0/0']);
    const backdrop = el('div', { id: 'mal-backdrop' });
    const closeModal = () => backdrop.classList.remove('mal-open');
    const updateBtn = el('button', { class: 'mal-header-btn', type: 'button' }, ['Sprawdź aktualizacje']);
    updateBtn.addEventListener('click', () => checkAllUpdates(updateBtn));
    const header = el('div', { class: 'mal-modal-header' }, [
      el('span', { class: 'mal-modal-title' }, ['Dodatki Margonem']),
      countEl,
      updateBtn,
      el('button', { class: 'mal-close-btn', html: '&times;', onClick: closeModal }),
    ]);
    const tabsEl = el('div', { class: 'mal-tabs' });
    const contentEl = el('div', { class: 'mal-content' });
    const body = el('div', { class: 'mal-modal-body' }, [tabsEl, contentEl]);
    const footer = el('div', { class: 'mal-modal-footer' }, ['Margonem Addon Loader v1.4.0']);
    const modal = el('div', { id: 'mal-modal' }, [header, body, footer]);

    backdrop.appendChild(modal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    const root = el('div', { id: 'mal-root' }, [toggleBtn]);
    document.body.appendChild(root);
    document.body.appendChild(backdrop);

    const buttonDrag = makeDraggable(toggleBtn, root, STORAGE_PREFIX + 'ui:button-pos', { clearBottomRight: true });
    toggleBtn.addEventListener('click', (e) => {
      if (buttonDrag.wasDragged()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      backdrop.classList.toggle('mal-open');
    });
    makeDraggable(header, modal, STORAGE_PREFIX + 'ui:modal-pos', { ignoreSelector: '.mal-close-btn, .mal-header-btn' });

    state.tabsEl = tabsEl;
    state.contentEl = contentEl;
    state.countEl = countEl;
    state.badgeEl = badgeEl;
    state.backdrop = backdrop;

    renderContent(null);
  }

  function registerAddon(config) {
    if (!config || !config.id) {
      warn('registerAddon: brak wymaganego pola "id" — dodatek pominięty.');
      return;
    }
    if (state.addons.has(config.id)) {
      warn('registerAddon: dodatek o id "' + config.id + '" jest już zarejestrowany — pominięto.');
      return;
    }
    const settings = loadSettings(config.id, config.defaultSettings);
    const enabled = loadEnabled(config.id, config.defaultEnabled);
    const record = { id: config.id, config, settings, enabled };
    state.addons.set(config.id, record);

    appendAddon(record);
    if (enabled) {
      safeCall(config.onEnable, config, settings);
    }
    log('Zarejestrowano dodatek "' + (config.name || config.id) + '" (włączony: ' + enabled + ').');
  }

  function init() {
    ensureUI();
    const pending = window.__MAL_PENDING__;
    window.MAL = { registerAddon };
    if (Array.isArray(pending)) {
      pending.forEach(registerAddon);
      pending.length = 0;
    }
    log('Loader gotowy.');
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
})();
