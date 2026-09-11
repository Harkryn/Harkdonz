// ==UserScript==
// @name         Margonem Addon Loader
// @namespace    margonem-addon-loader
// @version      1.0.0
// @description  Minimalistyczny, ciemny panel do zarządzania dodatkami Margonem. Sam w sobie nic nie robi - jest bazą, do której podpinają się przyszłe dodatki.
// @author       aderian359
// @match        *://*.margonem.pl/*
// @match        *://*.margonem.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/TWOJ-LOGIN/TWOJE-REPO/main/margonem-addon-loader.user.js
// @downloadURL  https://raw.githubusercontent.com/TWOJ-LOGIN/TWOJE-REPO/main/margonem-addon-loader.user.js
// ==/UserScript==

/**
 * Publiczne API dla przyszłych dodatków:
 *
 *   window.MAL.registerAddon({
 *     id: 'unikalny-identyfikator',       // wymagane, unikalne
 *     name: 'Nazwa dodatku',              // wymagane
 *     description: 'Krótki opis',         // opcjonalne
 *     version: '1.0.0',                   // opcjonalne
 *     defaultEnabled: true,               // opcjonalne, domyślnie true
 *     defaultSettings: { przyklad: true },// opcjonalne, wartości domyślne ustawień
 *     settingsSchema: [                   // opcjonalne, generuje formularz w panelu
 *       { key: 'przyklad', type: 'boolean', label: 'Włącz coś' },
 *       { key: 'tekst',    type: 'text',    label: 'Jakiś tekst', placeholder: '...' },
 *       { key: 'liczba',   type: 'number',  label: 'Jakaś liczba', min: 0, max: 100 },
 *       { key: 'wybor',    type: 'select',  label: 'Wybór', options: [{ value: 'a', label: 'A' }] },
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

  const CHEVRON_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const CSS = `
    #mal-root, #mal-root * { box-sizing: border-box; }
    #mal-root {
      position: fixed; z-index: 999999; bottom: 18px; right: 18px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #e4e4e7;
    }
    #mal-toggle-btn {
      width: 46px; height: 46px; border-radius: 50%;
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
    #mal-panel {
      position: absolute; bottom: 56px; right: 0; width: 320px; max-height: 70vh;
      background: #17181c; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5); overflow: hidden;
      display: flex; flex-direction: column;
      opacity: 0; transform: translateY(8px) scale(.98); pointer-events: none;
      transition: opacity .16s ease, transform .16s ease;
    }
    #mal-panel.mal-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .mal-panel-header {
      display: flex; align-items: center; gap: 8px; padding: 12px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
    }
    .mal-panel-title { font-size: 13px; font-weight: 600; letter-spacing: .2px; }
    .mal-panel-count { font-size: 11px; color: #8b8d98; background: #1f2025; border-radius: 999px; padding: 2px 8px; }
    .mal-close-btn {
      margin-left: auto; background: none; border: none; color: #8b8d98; cursor: pointer;
      font-size: 16px; line-height: 1; padding: 2px 6px; border-radius: 6px;
    }
    .mal-close-btn:hover { color: #e4e4e7; background: rgba(255,255,255,0.06); }
    .mal-panel-body { overflow-y: auto; padding: 8px; flex: 1; }
    .mal-panel-body::-webkit-scrollbar { width: 8px; }
    .mal-panel-body::-webkit-scrollbar-thumb { background: #2a2b31; border-radius: 8px; }
    .mal-panel-footer {
      padding: 8px 14px; font-size: 10px; color: #5c5e66; border-top: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    .mal-empty { padding: 24px 12px; text-align: center; color: #6b6d76; font-size: 12px; line-height: 1.5; }
    .mal-addon {
      background: #1c1d21; border: 1px solid rgba(255,255,255,0.05); border-radius: 10px;
      margin-bottom: 8px; overflow: hidden;
    }
    .mal-addon-row { display: flex; align-items: center; gap: 8px; padding: 10px 10px; }
    .mal-expand-btn {
      background: none; border: none; color: #8b8d98; cursor: pointer; padding: 2px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: transform .15s ease, color .15s ease;
    }
    .mal-expand-btn:hover { color: #e4e4e7; }
    .mal-expand-btn.mal-expanded { transform: rotate(90deg); }
    .mal-addon-info { flex: 1; min-width: 0; }
    .mal-addon-name { font-size: 12.5px; font-weight: 600; display: flex; align-items: baseline; gap: 6px; }
    .mal-addon-version { font-size: 10px; color: #5c5e66; font-weight: 400; }
    .mal-addon-desc { font-size: 11px; color: #8b8d98; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
    .mal-addon-settings {
      border-top: 1px solid rgba(255,255,255,0.05); padding: 10px; display: flex; flex-direction: column; gap: 10px;
    }
    .mal-addon-settings.mal-hidden, #mal-panel.mal-hidden-init { display: none; }
    .mal-field { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; }
    .mal-field-boolean { flex-direction: row; align-items: center; justify-content: space-between; }
    .mal-field-label { color: #c8c9d0; }
    .mal-input, .mal-select {
      background: #101114; border: 1px solid rgba(255,255,255,0.08); color: #e4e4e7;
      border-radius: 6px; padding: 6px 8px; font-size: 12px; outline: none;
      transition: border-color .15s ease;
    }
    .mal-input:focus, .mal-select:focus { border-color: #6d4fe0; }
  `;

  const state = {
    addons: new Map(),
    listEl: null,
    countEl: null,
    emptyEl: null,
  };

  function renderField(record, field) {
    const value = record.settings[field.key];
    const wrap = el('label', { class: 'mal-field' + (field.type === 'boolean' ? ' mal-field-boolean' : '') });
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
  }

  function updateCount() {
    if (!state.countEl) return;
    const total = state.addons.size;
    const enabled = Array.from(state.addons.values()).filter((r) => r.enabled).length;
    state.countEl.textContent = enabled + '/' + total;
  }

  function buildAddonCard(record) {
    const hasSettings = Array.isArray(record.config.settingsSchema) && record.config.settingsSchema.length > 0;

    const enabledSwitchInput = el('input', { type: 'checkbox' });
    enabledSwitchInput.checked = record.enabled;
    enabledSwitchInput.addEventListener('change', () => toggleAddon(record, enabledSwitchInput.checked));
    const enabledSwitch = el('label', { class: 'mal-switch' }, [
      enabledSwitchInput,
      el('span', { class: 'mal-switch-track' }),
    ]);

    const info = el('div', { class: 'mal-addon-info' }, [
      el('div', { class: 'mal-addon-name' }, [
        record.config.name || record.id,
        record.config.version ? el('span', { class: 'mal-addon-version' }, ['v' + record.config.version]) : null,
      ]),
      record.config.description ? el('div', { class: 'mal-addon-desc', title: record.config.description }, [record.config.description]) : null,
    ]);

    const settingsPanel = el('div', { class: 'mal-addon-settings mal-hidden' });
    let expandBtn = null;
    if (hasSettings) {
      record.config.settingsSchema.forEach((field) => settingsPanel.appendChild(renderField(record, field)));
      expandBtn = el('button', { class: 'mal-expand-btn', html: CHEVRON_SVG, title: 'Ustawienia' });
      expandBtn.addEventListener('click', () => {
        const isHidden = settingsPanel.classList.contains('mal-hidden');
        settingsPanel.classList.toggle('mal-hidden', !isHidden);
        expandBtn.classList.toggle('mal-expanded', isHidden);
      });
    }

    const row = el('div', { class: 'mal-addon-row' }, [expandBtn, info, enabledSwitch]);
    const card = el('div', { class: 'mal-addon' }, [row, hasSettings ? settingsPanel : null]);
    return card;
  }

  function appendAddon(record) {
    if (state.emptyEl) {
      state.emptyEl.remove();
      state.emptyEl = null;
    }
    state.listEl.appendChild(buildAddonCard(record));
    updateCount();
  }

  function ensureUI() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const toggleBtn = el('button', { id: 'mal-toggle-btn', html: ICON_SVG, title: 'Dodatki Margonem' });
    const panel = el('div', { id: 'mal-panel' });
    const countEl = el('span', { class: 'mal-panel-count' }, ['0/0']);
    const header = el('div', { class: 'mal-panel-header' }, [
      el('span', { class: 'mal-panel-title' }, ['Dodatki']),
      countEl,
      el('button', { class: 'mal-close-btn', html: '&times;', onClick: () => panel.classList.remove('mal-open') }),
    ]);
    const listEl = el('div', { class: 'mal-panel-body' });
    const emptyEl = el('div', { class: 'mal-empty' }, [
      'Brak zainstalowanych dodatków. Gdy dodasz skrypt kolejnego dodatku, pojawi się tutaj automatycznie.',
    ]);
    listEl.appendChild(emptyEl);
    const footer = el('div', { class: 'mal-panel-footer' }, ['Margonem Addon Loader v1.0.0']);

    panel.appendChild(header);
    panel.appendChild(listEl);
    panel.appendChild(footer);

    toggleBtn.addEventListener('click', () => panel.classList.toggle('mal-open'));

    const root = el('div', { id: 'mal-root' }, [toggleBtn, panel]);
    document.body.appendChild(root);

    state.listEl = listEl;
    state.countEl = countEl;
    state.emptyEl = emptyEl;
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
