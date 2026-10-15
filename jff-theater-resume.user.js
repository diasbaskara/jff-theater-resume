// ==UserScript==
// @name         JFF Theater — Resume + Playback Controls
// @namespace    https://github.com/diasbaskara
// @version      1.6.0
// @description  Remembers where you were on JFF Theater and jumps back there. On-screen touch controls add seeking, fullscreen, picture-in-picture and screen-wake to the site's player. Touches nothing else on the site — the catalogue page is left exactly as it is. Streaming only — no download, no DRM circumvention.
// @author       Hermes Agent (for Dias)
// @license      MIT
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'/%3E%3Cpath d='M3 3v5h5'/%3E%3C/svg%3E
// @match        https://*.jff.jpf.go.jp/movie/*
// @run-at       document-idle
// @grant        GM.setValue
// @grant        GM.getValue
// ==/UserScript==

/*
 * Built for the iOS/iPadOS "Userscripts" app (quoid/userscripts) in Safari, and it also
 * runs unchanged in desktop Safari, Tampermonkey or Violentmonkey.
 *
 * WHY: the JFF Theater player keeps no progress and restarts at 00:00 whenever the page
 * reloads or Safari discards the tab. This script stores the position and seeks back to it.
 * No media is fetched, copied or saved — only a time offset.
 *
 * STORAGE: GM.setValue when the manager provides it, otherwise localStorage.
 *
 * ICONS: path data from Lucide (https://lucide.dev) via the lucide-static package, v1.57.0 —
 *        ISC Licence, Copyright (c) Lucide Contributors. The host page ships a global
 *        `svg{width:100%;height:100%}` rule and button resets, so every property those rules could
 *        reach is pinned with !important in the stylesheet injected below.
 */

(function () {
  'use strict';

  const STORE_KEY = 'jff:theater:positions';
  const PATH = location.pathname.replace(/\/+$/, '');
  const MIN_SAVE = 15;      // ignore the first seconds
  const TAIL = 90;          // forget the position this close to the end
  const SAVE_EVERY = 5000;

  const hasGM = typeof GM !== 'undefined' && GM && typeof GM.setValue === 'function';
  // Which userscript manager is running us — the iOS app exposes this through GM.info.
  const gmInfo = (() => {
    try {
      const g = (typeof GM !== 'undefined' && GM && GM.info) || (typeof GM_info !== 'undefined' && GM_info);
      if (!g) return '';
      return (g.scriptHandler || '?') + ' ' + (g.version || '');
    } catch (e) { return ''; }
  })();
  const log = (...a) => console.log('[jff-resume]', ...a);
  // Silent promise rejections are invisible on a phone; make them show up in the log.
  window.addEventListener('unhandledrejection', (e) => log('unhandled rejection', (e.reason && e.reason.message) || e.reason));

  // ---------------------------------------------------------------- storage
  // One JSON map for every film, so a single key covers the whole site.
  let cache = null;

  async function loadAll() {
    if (cache) return cache;
    try {
      if (hasGM) cache = (await GM.getValue(STORE_KEY, null)) || {};
      else cache = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
    } catch (e) { cache = {}; }
    return cache;
  }

  function persist() {
    const entries = Object.entries(cache || {})
      .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
      .slice(0, 60);                       // keep the list small
    cache = Object.fromEntries(entries);
    try {
      if (hasGM) GM.setValue(STORE_KEY, cache);
      else localStorage.setItem(STORE_KEY, JSON.stringify(cache));
    } catch (e) {}
  }

  async function savePos(t, d) { await loadAll(); cache[PATH] = { t, d, at: Date.now() }; persist(); }
  async function clearPos() { await loadAll(); delete cache[PATH]; persist(); }
  async function getPos() {
    const all = await loadAll();
    const v = all[PATH];
    return v && typeof v.t === 'number' && v.t > MIN_SAVE ? v : null;
  }

  // ---------------------------------------------------------------- helpers
  const fmt = (s) => {
    if (!isFinite(s)) return '--:--';
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    return (h ? h + ':' + p(m) : String(m)) + ':' + p(sec);
  };

  // Clean icon geometry — Lucide (lucide.dev, ISC). 24x24 viewBox, no SVG <text> nodes.
  const stroked = (inner) =>
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  const solid = (inner) =>
    '<svg class="jff-solid" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" ' +
    'fill="currentColor" stroke="none">' + inner + '</svg>';

  const ICON = {
    back: stroked('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    fwd: stroked('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'),
    play: solid('<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>'),
    pause: solid('<rect x="14" y="3" width="4.6" height="18" rx="1"/><rect x="5.4" y="3" width="4.6" height="18" rx="1"/>'),
    pip: stroked('<path d="M2 10h6V4"/><path d="m2 4 6 6"/><path d="M21 10V7a2 2 0 0 0-2-2h-7"/>' +
                 '<path d="M3 14v2a2 2 0 0 0 2 2h3"/><rect x="12" y="14" width="10" height="7" rx="1"/>'),
    full: stroked('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>' +
                  '<path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    hide: stroked('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    show: stroked('<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>'),
    clock: stroked('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>')
  };

  // ---------------------------------------------------------------- stylesheet
  function injectStyle() {
    if (document.getElementById('jff-style')) return;
    const st = document.createElement('style');
    st.id = 'jff-style';
    st.textContent = `
/* One floating "glass pill" family: the control bar, its collapsed badge and the resume hint share a
   single surface, and all three sit centred on the viewport (left:50% + translateX, so they line up
   exactly with each other and with the toast above them). */
#jff-bar, #jff-badge, #jff-pill {
  position: fixed !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
  z-index: 2147483647 !important;
  display: flex !important; align-items: center !important;
  box-sizing: border-box !important;
  border-radius: 999px !important;
  border: 1px solid rgba(255,255,255,.16) !important;
  background: rgba(14,14,16,.8) !important; color: #fff !important;
  -webkit-backdrop-filter: blur(12px) saturate(1.4) !important;
  backdrop-filter: blur(12px) saturate(1.4) !important;
  box-shadow: 0 6px 22px rgba(0,0,0,.45) !important;
  font: 600 13px/1 -apple-system, system-ui, sans-serif !important;
  -webkit-user-select: none !important; user-select: none !important;
  max-width: calc(100vw - 20px) !important;
}
#jff-bar { gap: 2px !important; padding: 5px 7px !important; }
#jff-badge {
  gap: 0 !important; padding: 0 !important;
  width: clamp(38px, 10.5vw, 44px) !important;
  height: clamp(38px, 10.5vw, 44px) !important;
  justify-content: center !important;
}
#jff-bar button, #jff-badge, #jff-badge button, #jff-time {
  -webkit-appearance: none !important; appearance: none !important;
  box-sizing: border-box !important; margin: 0 !important; padding: 0 !important;
  min-width: 0 !important; max-width: none !important;
  background: transparent !important; background-image: none !important;
  border: 0 !important; box-shadow: none !important; outline: none !important;
  color: #fff !important; border-radius: 999px !important;
  cursor: pointer !important; touch-action: manipulation !important;
  -webkit-tap-highlight-color: transparent !important;
  text-transform: none !important; letter-spacing: 0 !important; white-space: nowrap !important;
}
/* Buttons shrink on narrow phones so the centred bar always fits inside the viewport. */
#jff-bar button, #jff-badge button {
  width: clamp(34px, 9.6vw, 40px) !important;
  height: clamp(34px, 9.6vw, 40px) !important;
  flex: 0 0 auto !important;
  display: flex !important; flex-direction: column !important;
  align-items: center !important; justify-content: center !important; gap: 1px !important;
  transition: background-color .12s ease !important;
}
#jff-badge button { width: 36px !important; height: 36px !important; }
#jff-bar button.jff-primary { background: rgba(255,255,255,.16) !important; }
#jff-bar button.jff-primary:active { background: rgba(255,255,255,.32) !important; }
#jff-bar button:active, #jff-badge button:active, #jff-pill:active { background: rgba(255,255,255,.22) !important; }
@media (hover: hover) {
  #jff-bar button:hover:not(.jff-primary), #jff-badge button:hover { background: rgba(255,255,255,.12) !important; }
  #jff-bar button.jff-primary:hover { background: rgba(255,255,255,.26) !important; }
}
#jff-bar button svg, #jff-badge svg, #jff-badge button svg {
  width: clamp(17px, 5vw, 19px) !important; height: clamp(17px, 5vw, 19px) !important;
  min-width: clamp(17px, 5vw, 19px) !important; max-width: clamp(17px, 5vw, 19px) !important;
  min-height: clamp(17px, 5vw, 19px) !important; max-height: clamp(17px, 5vw, 19px) !important;
  display: block !important; flex: 0 0 auto !important;
  fill: none !important; stroke: currentColor !important;
  stroke-width: 2 !important; stroke-linecap: round !important; stroke-linejoin: round !important;
  pointer-events: none !important;
}
#jff-bar button svg.jff-solid, #jff-badge svg.jff-solid, #jff-badge button svg.jff-solid,
#jff-bar button svg.jff-solid *, #jff-badge svg.jff-solid *, #jff-badge button svg.jff-solid * {
  fill: currentColor !important; stroke: none !important;
}
#jff-bar .jff-num {
  font: 700 8.5px/1 -apple-system, system-ui, sans-serif !important;
  letter-spacing: 0 !important; opacity: .92 !important;
  display: block !important; pointer-events: none !important;
}
/* Time chip: its own padding and a hairline divider give it clear space on both sides rather than
   sitting flush against the transport buttons. The selector carries both ids because #jff-bar button
   (id + type) would otherwise outrank a bare #jff-time and force the chip back to button width. */
#jff-bar #jff-time {
  width: auto !important;
  height: clamp(34px, 9.6vw, 40px) !important;
  min-width: clamp(52px, 14vw, 64px) !important;
  padding: 0 10px !important;
  font: 600 13px/1 -apple-system, system-ui, sans-serif !important;
  font-variant-numeric: tabular-nums !important;
  display: flex !important; align-items: center !important; justify-content: center !important;
}
#jff-bar .jff-div {
  flex: 0 0 auto !important;
  width: 1px !important; height: 20px !important;
  margin: 0 4px !important;
  background: rgba(255,255,255,.16) !important;
  border-radius: 1px !important;
  pointer-events: none !important;
}
#jff-pill {
  gap: 7px !important; height: 40px !important; padding: 0 14px !important;
  cursor: pointer !important; touch-action: manipulation !important;
  -webkit-tap-highlight-color: transparent !important; white-space: nowrap !important;
  transition: background-color .12s ease !important;
}
#jff-pill svg {
  width: 17px !important; height: 17px !important; min-width: 17px !important; max-width: 17px !important;
  min-height: 17px !important; max-height: 17px !important; display: block !important; fill: none !important;
  stroke: currentColor !important; stroke-width: 2 !important; stroke-linecap: round !important; stroke-linejoin: round !important;
}
#jff-pill b { font-weight: 700 !important; }
#jff-toast {
  position: fixed !important; left: 50% !important;
  bottom: calc(96px + env(safe-area-inset-bottom, 0px)) !important;
  transform: translateX(-50%) !important; z-index: 2147483647 !important;
  background: rgba(0,0,0,.84) !important; color: #fff !important;
  -webkit-backdrop-filter: blur(8px) !important; backdrop-filter: blur(8px) !important;
  font: 600 14px/1.35 -apple-system, system-ui, sans-serif !important;
  padding: 10px 16px !important; border-radius: 10px !important;
  pointer-events: none !important; max-width: 86vw !important; text-align: center !important;
  display: none;
}
`;
    (document.head || document.documentElement).appendChild(st);
  }

  let toastEl = null, toastTimer = null;
  function toast(msg, ms = 3500) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'jff-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.setProperty('display', 'block', 'important');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.setProperty('display', 'none', 'important'); }, ms);
  }

  // ---------------------------------------------------------------- UI
  let bar = null, badge = null, timeChip = null, playBtn = null, savedPos = null;

  function btn(html, label, onTap) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = html;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      try { onTap(); } catch (e) { log(e); }
    });
    return b;
  }

  function buildBar() {
    if (bar || !document.body) return;
    const pill = document.getElementById('jff-pill');
    if (pill) pill.remove();          // the player exists now, so the pre-player hint is redundant
    injectStyle();

    bar = document.createElement('div');
    bar.id = 'jff-bar';

    timeChip = document.createElement('button');
    timeChip.id = 'jff-time';
    timeChip.type = 'button';
    timeChip.textContent = '0:00';
    timeChip.title = 'Jump to last watched position';
    timeChip.setAttribute('aria-label', 'Jump to last watched position');
    timeChip.addEventListener('click', async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const v = video();
      if (!v) return;
      const p = savedPos || await getPos();
      if (p && Math.abs(p.t - v.currentTime) > 5) {
        v.currentTime = p.t;
        toast('Jumped to last watched ' + fmt(p.t));
      } else {
        toast('Now at ' + fmt(v.currentTime) + ' / ' + fmt(v.duration));
      }
    });

    playBtn = btn(ICON.play, 'Play / pause', () => {
      const v = video(); if (!v) return;
      if (v.paused) v.play(); else v.pause();
      setTimeout(paint, 150);
    });
    playBtn.classList.add('jff-primary');   // the one filled control, so it reads as the main action

    bar.appendChild(timeChip);
    // hairline divider: gives the time its own space instead of butting against the transport buttons
    const divider = document.createElement('div');
    divider.className = 'jff-div';
    bar.appendChild(divider);
    bar.appendChild(btn(ICON.back + '<span class="jff-num">15</span>', 'Back 15 seconds', () => jump(-15)));
    bar.appendChild(playBtn);
    bar.appendChild(btn(ICON.fwd + '<span class="jff-num">15</span>', 'Forward 15 seconds', () => jump(15)));
    if ('pictureInPictureEnabled' in document || 'webkitSetPresentationMode' in HTMLVideoElement.prototype) {
      bar.appendChild(btn(ICON.pip, 'Picture in picture', togglePip));
    }
    bar.appendChild(btn(ICON.full, 'Fullscreen', goFullscreen));
    bar.appendChild(btn(ICON.hide, 'Hide controls', () => setCollapsed(true)));
    document.body.appendChild(bar);

    badge = btn(ICON.show, 'Show JFF controls', () => setCollapsed(false));
    badge.id = 'jff-badge';
    document.body.appendChild(badge);

    applyCollapsed();
  }

  function setCollapsed(hide) {
    try { localStorage.setItem('jff:bar:hidden', hide ? '1' : '0'); } catch (e) {}
    applyCollapsed();
  }
  function applyCollapsed() {
    let hidden = false;
    try { hidden = localStorage.getItem('jff:bar:hidden') === '1'; } catch (e) {}
    if (bar) bar.style.setProperty('display', hidden ? 'none' : 'flex', 'important');
    if (badge) badge.style.setProperty('display', hidden ? 'flex' : 'none', 'important');
  }

  function paint() {
    const v = video();
    if (!v || !timeChip) return;
    timeChip.textContent = fmt(v.currentTime);
    if (playBtn) playBtn.innerHTML = v.paused ? ICON.play : ICON.pause;
  }

  // ---------------------------------------------------------------- actions
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { /* unsupported — ignore */ }
  }

  function video() {
    const all = document.querySelectorAll('video');
    return all.length ? all[all.length - 1] : null;
  }
  let active = null;

  function jump(d) {
    const v = video(); if (!v) return;
    v.currentTime = Math.min(Math.max(0, v.currentTime + d), (v.duration || 0) - 0.5);
    savePos(v.currentTime, v.duration);
    toast((d > 0 ? '+' : '') + d + 's  →  ' + fmt(v.currentTime) + ' / ' + fmt(v.duration), 1600);
    paint();
  }

  function goFullscreen() {
    const v = video(); if (!v) return;
    if (v.webkitEnterFullscreen) { v.webkitEnterFullscreen(); return; }   // iPhone Safari
    const el = v.parentElement || v;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
  }

  function togglePip() {
    const v = video(); if (!v) return;
    try {
      if (typeof v.webkitSetPresentationMode === 'function') {          // Safari
        v.webkitSetPresentationMode(v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
        return;
      }
      if (document.pictureInPictureElement) document.exitPictureInPicture();
      else if (v.requestPictureInPicture) v.requestPictureInPicture().catch(() => toast('Picture-in-picture blocked for this stream'));
      else toast('Picture-in-picture not available here');
    } catch (e) {
      toast('Picture-in-picture not available here');
    }
  }

  // ---------------------------------------------------------------- engine
  const attached = new WeakSet();
  let lastSave = 0;
  let resumed = false;

  async function tryResume(v) {
    if (resumed || !isFinite(v.duration) || v.duration <= 0) return;
    resumed = true;
    const p = await getPos();
    savedPos = p;
    if (!p) { log('no saved position'); return; }
    if (p.t >= v.duration - TAIL) { clearPos(); return; }
    v.currentTime = p.t;
    toast('Resuming at ' + fmt(p.t) + ' — tap ▶ to play');
    paint();
  }

  function attach(v) {
    if (attached.has(v)) return;
    attached.add(v);
    active = v;
    resumed = false;
    log('player found');

    v.addEventListener('loadedmetadata', () => tryResume(v));
    v.addEventListener('durationchange', () => tryResume(v));
    v.addEventListener('canplay', () => tryResume(v));
    setTimeout(() => tryResume(v), 1200);
    setTimeout(() => tryResume(v), 3500);

    const saver = () => {
      if (v.currentTime > MIN_SAVE && isFinite(v.duration) && v.currentTime < v.duration - TAIL) {
        savePos(v.currentTime, v.duration);
      }
    };
    v.addEventListener('timeupdate', () => {
      paint();
      const now = Date.now();
      if (now - lastSave < SAVE_EVERY) return;
      lastSave = now;
      saver();
    });
    v.addEventListener('pause', () => { saver(); paint(); keepAwake(false); });
    v.addEventListener('play', () => { paint(); keepAwake(true); });
    v.addEventListener('ended', () => { clearPos(); keepAwake(false); });
    // iOS suspends tabs without firing beforeunload — these are the reliable hooks
    v.addEventListener('webkitendfullscreen', saver);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saver(); });
    window.addEventListener('pagehide', saver);
    window.addEventListener('beforeunload', saver);
    setInterval(() => { if (!v.paused) saver(); }, SAVE_EVERY);   // belt and braces

    buildBar();
    paint();
  }

  function sweep() {
    for (const v of document.querySelectorAll('video')) attach(v);
  }
  sweep();
  new MutationObserver(sweep).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(sweep, 2000);

  // A film page shows nothing at all until the player exists, which reads as "the script is not
  // running". Surface the saved position at once as a small pill; it disappears once the bar appears.
  async function resumePill() {
    if (document.getElementById('jff-pill') || document.getElementById('jff-bar')) return;
    try { if (localStorage.getItem('jff:bar:hidden') === '1') return; } catch (e) {}
    const p = await getPos().catch(() => null);
    if (!p) return;
    injectStyle();
    const el = document.createElement('div');
    el.id = 'jff-pill';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.title = 'Saved position for this film';
    el.innerHTML = ICON.clock + '<span>Resume <b>' + fmt(p.t) + '</b></span>';
    el.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const v = video();
      if (v && isFinite(v.duration) && v.duration > 0) { v.currentTime = p.t; toast('Jumped to ' + fmt(p.t)); }
      else toast('Player not ready — it will resume at ' + fmt(p.t) + ' automatically');
    });
    if (document.body) document.body.appendChild(el);
  }

  // Desktop / hardware-keyboard extras (harmless on iOS, where there is no keyboard)
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const v = video(); if (!v) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); jump(10); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(-10); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); goFullscreen(); }
    else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePip(); }
  }, true);

  resumePill().catch(() => {});
  log('ready — ' + (hasGM ? 'GM storage' : 'localStorage') + (gmInfo ? ' · manager: ' + gmInfo : ''));
})();
