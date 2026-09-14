function harkdonzBootstrap(window, privilegedRequest) {
  const document = window.document;
  'use strict';
  if (window.top !== window.self || !/(^|\.)margonem\.(pl|com)$/.test(window.location.hostname) || window.HarkdonzRuntime) return;
  const base = new URL('https://raw.githubusercontent.com/Harkryn/Harkdonz/main/');
  const runtime = window.HarkdonzRuntime = {
    version: '1.0.0', state: 'loading',
    request: privilegedRequest || window.__harkdonzRequest,
  };
  delete window.__harkdonzRequest;

  runtime.showUpdateNotice = function (version) {
    if (document.getElementById('harkdonz-update-notice') || runtime.updateNoticeShown === version) return;
    runtime.updateNoticeShown = version;
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id = 'harkdonz-update-notice';
    dialog.setAttribute('aria-labelledby', 'harkdonz-update-title');
    dialog.style.cssText = 'position:fixed;inset:0;margin:auto;width:360px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:26px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:linear-gradient(165deg,#1a1b20,#131317);color:#e8e8ed;box-shadow:0 0 26px rgba(109,79,224,.25),0 20px 60px rgba(0,0,0,.55);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;text-align:center;';
    const brand = document.createElement('div');
    brand.textContent = 'HARKDONZ';
    brand.style.cssText = 'font-size:11px;font-weight:800;letter-spacing:3px;background:linear-gradient(90deg,#6d4fe0,#ff7ad9);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:16px';
    const title = document.createElement('h2');
    title.id = 'harkdonz-update-title';
    title.textContent = 'Dostępna aktualizacja';
    title.style.cssText = 'font:700 21px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;margin:0 0 12px;color:#fff';
    const description = document.createElement('p');
    description.textContent = 'Wersja ' + version + ' jest gotowa do instalacji.';
    description.style.cssText = 'margin:0 0 22px;color:#9a9ca6';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:10px;justify-content:center';
    const update = document.createElement('a');
    update.textContent = 'Aktualizuj';
    update.href = 'https://raw.githubusercontent.com/Harkryn/Harkdonz/main/install.user.js';
    update.target = '_blank';
    update.rel = 'noopener noreferrer';
    update.style.cssText = 'display:block;flex:1;padding:11px 12px;border-radius:9px;border:1px solid #6d4fe0;background:linear-gradient(135deg,#6d4fe0,#4a35a0);color:#fff;font:700 13px/18px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;text-decoration:none;cursor:pointer;';
    actions.append(update);
    dialog.append(brand, title, description, actions);
    dialog.addEventListener('close', () => { dialog.remove(); if (previousFocus && previousFocus.isConnected) previousFocus.focus(); }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    update.focus();
  };

  function loadScript(file, version) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.charset = 'utf-8';
      const url = new URL(file, base);
      url.searchParams.set('v', version);
      script.src = url.href;
      const timeout = setTimeout(() => { script.remove(); reject(Error('Przekroczony czas: ' + file)); }, 20000);
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => { clearTimeout(timeout); script.remove(); reject(Error('Nie pobrano: ' + file)); };
      document.head.append(script);
    });
  }

  (async () => {
    let manifest;
    try {
      const response = await fetch(new URL('manifest.json', base), { cache: 'no-cache', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error('Manifest: HTTP ' + response.status);
      manifest = await response.json();
    } catch (error) {
      if (typeof runtime.request !== 'function') throw error;
      manifest = await new Promise((resolve, reject) => runtime.request({
        method: 'GET',
        url: new URL('manifest.json?v=' + runtime.version, base).href,
        timeout: 20000,
        onload: (r) => { try { if (r.status !== 200) throw Error('Manifest: HTTP ' + r.status); resolve(JSON.parse(r.responseText)); } catch (e) { reject(e); } },
        onerror: () => reject(Error('Nie udało się pobrać manifestu.')),
        ontimeout: () => reject(Error('Przekroczono czas pobierania manifestu.')),
      }));
    }
    if (!Array.isArray(manifest.scripts)) throw Error('Nieprawidłowy manifest.');
    if (manifest.version !== runtime.version) {
      if (/^\d+\.\d+\.\d+$/.test(manifest.version)) runtime.showUpdateNotice(manifest.version);
      throw Error('Niezgodna wersja panelu. Zaktualizuj instalator.');
    }
    if (manifest.scripts.some((file) => !/^[a-z0-9-]+\.user\.js$/.test(file))) throw Error('Nieprawidłowa lista dodatków.');
    for (const file of manifest.scripts) await loadScript(file, manifest.version);
    runtime.state = 'ready';
    window.__harkdonzLoading = false;
  })().catch((error) => {
    runtime.state = 'error';
    window.__harkdonzLoading = false;
    runtime.error = String(error.message || error);
    console.error('[Harkdonz]', error);
  });
}
// Kompatybilność ze starszymi instalatorami, które wstrzykiwały bootstrap.js jako zwykły <script>.
if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src && document.currentScript.src.startsWith('https://raw.githubusercontent.com/Harkryn/Harkdonz/main/bootstrap.js')) {
  harkdonzBootstrap(window, window.__harkdonzRequest);
}
