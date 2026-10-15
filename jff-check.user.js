// ==UserScript==
// @name         JFF — injection check (diagnostic)
// @namespace    https://github.com/diasbaskara
// @version      1.0.1
// @description  Diagnostic only: draws a banner on JFF pages proving that your userscript manager injected something, and reports which manager it is, its version, the page path and how many video elements exist. Install this first when a script "does not seem to run"; delete it once the real script works.
// @author       Hermes Agent (for Dias)
// @license      MIT
// @match        https://*.jff.jpf.go.jp/*
// @run-at       document-start
// ==/UserScript==

/*
 * WHY THIS EXISTS
 * The iOS "Userscripts" app (and other managers) only learn about a script after their popup has
 * loaded the scripts directory. So a newly added .user.js can sit on disk doing nothing even though
 * everything is "installed". This file answers one question in two seconds: is anything being
 * injected into the page at all?
 *
 * It touches nothing, stores nothing, and removes itself from the page after 25 seconds.
 */

(function () {
  'use strict';

  const APP = 'JFF injection check';
  const VERSION = '1.0.1';

  function managerName() {
    try {
      const g = (typeof GM !== 'undefined' && GM && GM.info) || (typeof GM_info !== 'undefined' && GM_info);
      if (g && g.scriptHandler) return g.scriptHandler + ' ' + (g.version || '');
      if (typeof GM_setValue === 'function' || typeof GM_setValue !== 'undefined') return 'legacy GM_* API present';
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) return 'extension context, GM.info not exposed';
      return 'none exposed (likely page context)';
    } catch (e) { return 'error reading GM.info'; }
  }

  function storage() {
    try {
      if (typeof GM !== 'undefined' && GM && typeof GM.setValue === 'function') return 'GM.setValue ✓';
    } catch (e) {}
    try {
      localStorage.setItem('jff:check:probe', '1');
      localStorage.removeItem('jff:check:probe');
      return 'localStorage ✓';
    } catch (e) { return 'no storage available'; }
  }

  function draw() {
    if (!document.body) { setTimeout(draw, 200); return; }
    if (document.getElementById('jff-check')) return;

    const box = document.createElement('div');
    box.id = 'jff-check';
    box.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'top:0', 'left:50%', 'transform:translateX(-50%)',
      'max-width:94vw', 'margin:0', 'padding:10px 14px', 'border-radius:0 0 12px 12px',
      'background:#0b0b0f', 'color:#fff', 'font:600 12px/1.5 -apple-system,system-ui,sans-serif',
      'box-shadow:0 6px 20px rgba(0,0,0,.4)', 'text-align:left', 'cursor:pointer'
    ].join(';');

    const row = (k, v) => '<div><span style="color:#8f8f9c;font-weight:400">' + k + ':</span> ' + v + '</div>';
    let info = '';
    try {
      const g = (typeof GM !== 'undefined' && GM && GM.info) || (typeof GM_info !== 'undefined' && GM_info);
      if (g && g.script) info = row('this script', '“' + (g.script.name || '') + '” v' + (g.script.version || '')) +
        row('matches', (g.script.matches || []).join(', '));
    } catch (e) {}

    box.innerHTML =
      '<div style="color:#fff;font-weight:700;margin-bottom:4px">✓ ' + APP + ' v' + VERSION +
      ' — a manager injected code into this page</div>' +
      row('manager', managerName()) +
      row('storage', storage()) +
      row('page', location.pathname) +
      info +
      row('video elements', '<b id="jff-check-v">0</b> (tap to dismiss)');

    box.addEventListener('click', () => box.remove());
    document.body.appendChild(box);

    const tick = () => {
      const v = document.getElementById('jff-check-v');
      if (v) v.textContent = String(document.querySelectorAll('video').length);
      else clearInterval(iv);
    };
    const iv = setInterval(tick, 1000);
    tick();
    setTimeout(() => { clearInterval(iv); box.remove(); }, 25000);

    console.log('[' + APP + ']', managerName(), '| storage:', storage(), '| page:', location.pathname);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', draw);
  else draw();
})();
