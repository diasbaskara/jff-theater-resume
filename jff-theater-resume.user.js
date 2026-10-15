// ==UserScript==
// @name         JFF Theater — Explore, Resume + Playback Controls
// @namespace    https://github.com/diasbaskara
// @version      1.2.1
// @description  Netflix-style browse page for the JFF Theater catalogue (Continue watching, Available now, Ending soon, search), plus resume and touch playback controls on the film pages. Reads the site's own public catalogue API; collects nothing, downloads no media, circumvents no DRM.
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
  const log = (...a) => console.log('[jff-resume]', ...a);

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
    show: stroked('<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>')
  };

  // ---------------------------------------------------------------- stylesheet
  function injectStyle() {
    if (document.getElementById('jff-style')) return;
    const st = document.createElement('style');
    st.id = 'jff-style';
    st.textContent = `
#jff-bar, #jff-badge {
  position: fixed !important;
  left: 8px !important;
  bottom: calc(10px + env(safe-area-inset-bottom, 0px)) !important;
  z-index: 2147483647 !important;
  display: flex !important; align-items: center !important; gap: 0 !important;
  padding: 4px 6px !important; box-sizing: border-box !important;
  border-radius: 999px !important; border: 0 !important;
  background: rgba(14,14,16,.76) !important;
  -webkit-backdrop-filter: blur(10px) !important; backdrop-filter: blur(10px) !important;
  box-shadow: 0 3px 14px rgba(0,0,0,.35) !important;
  font: 600 12px/1 -apple-system, system-ui, sans-serif !important;
  -webkit-user-select: none !important; user-select: none !important;
  max-width: calc(100vw - 16px) !important;
}
#jff-badge { padding: 4px !important; }
#jff-bar button, #jff-badge button, #jff-time {
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
#jff-bar button, #jff-badge button {
  width: 40px !important; height: 40px !important; flex: 0 0 auto !important;
  display: flex !important; flex-direction: column !important;
  align-items: center !important; justify-content: center !important; gap: 1px !important;
}
#jff-badge button { width: 36px !important; height: 36px !important; }
#jff-bar button svg, #jff-badge button svg {
  width: 19px !important; height: 19px !important;
  min-width: 19px !important; max-width: 19px !important;
  min-height: 19px !important; max-height: 19px !important;
  display: block !important; flex: 0 0 auto !important;
  fill: none !important; stroke: currentColor !important;
  stroke-width: 2 !important; stroke-linecap: round !important; stroke-linejoin: round !important;
  pointer-events: none !important;
}
#jff-bar button svg.jff-solid, #jff-badge button svg.jff-solid,
#jff-bar button svg.jff-solid *, #jff-badge button svg.jff-solid * {
  fill: currentColor !important; stroke: none !important;
}
#jff-bar .jff-num {
  font: 700 8.5px/1 -apple-system, system-ui, sans-serif !important;
  letter-spacing: 0 !important; opacity: .92 !important;
  display: block !important; pointer-events: none !important;
}
#jff-time {
  height: 40px !important; min-width: 62px !important; padding: 0 8px !important;
  font: 600 12px/1 -apple-system, system-ui, sans-serif !important;
  display: flex !important; align-items: center !important; justify-content: center !important;
}
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

    bar.appendChild(timeChip);
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

  // ============================================================== Explore page
  // Replaces the site's /movie/ catalogue listing with a Netflix-style browse view, built from the
  // site's own public catalogue endpoint (/jff-api/contents). Availability mirrors the site's own
  // rule: a YouTube-backed item is always available; otherwise the viewer's country must appear in
  // the item's whiteLists and "now" must fall inside streamStart..streamEnd. Nothing is collected,
  // no media is fetched — this only re-presents public catalogue metadata the site already serves.

  const isListingPage = /^\/movie\/?$/.test(location.pathname);
  const CATALOGUE_API = '/jff-api/contents';
  const CACHE_KEY = 'jff:explore:index:v2';
  const COUNTRY_KEY = 'jff:explore:country';
  const CLASSIC_KEY = 'jff:explore:classic';
  const CACHE_TTL = 6 * 60 * 60 * 1000;
  const DAY = 86400000;

  const EX_ICON = {
    search: stroked('<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>'),
    refresh: stroked('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>' +
                     '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
    clock: stroked('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>')
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const norm = (p) => String(p || '').replace(/\/+$/, '');
  const DAYS = (ms) => Math.max(0, Math.ceil(ms / DAY));
  const relDay = (ms) => (ms < 0 ? 'ended' : ms < DAY ? 'today' : DAYS(ms) + 'd');

  // ---------------------------------------------------------------- data
  const TZ_COUNTRY = {
    'Asia/Jakarta': 'id', 'Asia/Pontianak': 'id', 'Asia/Makassar': 'id', 'Asia/Jayapura': 'id',
    'Asia/Tokyo': 'jp', 'Asia/Bangkok': 'th', 'Asia/Manila': 'ph', 'Asia/Kuala_Lumpur': 'my',
    'Asia/Singapore': 'sg', 'Asia/Ho_Chi_Minh': 'vn', 'Asia/Yangon': 'mm', 'Asia/Phnom_Penh': 'kh',
    'Asia/Vientiane': 'la', 'Asia/Kolkata': 'in', 'Australia/Sydney': 'au', 'Pacific/Auckland': 'nz'
  };

  function guessCountry() {
    try {
      const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
      if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
    } catch (e) {}
    try {
      const region = (navigator.language || '').split('-')[1];
      if (region) return region.toLowerCase();
    } catch (e) {}
    return '';
  }

  function storedCountry() { try { const v = localStorage.getItem(COUNTRY_KEY); return v === null ? null : v; } catch (e) { return null; } }

  function trimEntry(e) {
    const jp = e.contentsTitle || '';
    let en = e.contentsTitleEn || '';
    if (!en || en.toLowerCase() === 'title') en = '';
    const caps = [];
    for (let i = 1; i <= 20; i++) { const v = e['captionLange' + i]; if (v) caps.push(String(v).toLowerCase()); }
    const wl = e.whiteLists || [];
    const flagged = wl.find((w) => w.ratingFlag && w.message);
    return {
      code: e.contentsCode, path: norm(e.detailUrl), link: e.detailUrl || (norm(e.detailUrl) + '/'),
      title: en || jp, jp: en ? jp : '',
      img: e.poster || e.thumbnail || '', start: e.streamStart || '', end: e.streamEnd || '',
      yt: e.youtubeLink || '', caps, countries: wl.map((w) => String(w.country).toLowerCase()),
      rating: flagged ? String(flagged.message) : ''
    };
  }

  // The site only knows the viewer's country once they are signed in, so mirror that first and
  // fall back to a timezone/locale guess for signed-out browsing.
  async function sessionCountry() {
    try {
      const r = await fetch('/jff-api/auth/me', { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!r.ok) return '';
      const j = await r.json();
      const d = (j && j.data) || j || {};
      const c = d.currentCountry || d.country || d.currentCountryCode || '';
      return c ? String(c).toLowerCase() : '';
    } catch (e) { return ''; }
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      return v && Array.isArray(v.items) ? v : null;
    } catch (e) { return null; }
  }

  function writeCache(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
      return true;
    } catch (e) { log('cache write failed', e); return false; }
  }

  async function fetchCatalogue(force) {
    const cached = readCache();
    if (!force && cached && Date.now() - cached.at < CACHE_TTL) {
      log('catalogue from cache', cached.items.length);
      return { items: cached.items, at: cached.at, cached: true };
    }
    const r = await fetch(CATALOGUE_API, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('catalogue HTTP ' + r.status);
    const j = await r.json();
    const rows = Array.isArray(j) ? j : (j.data || []);
    const items = rows.map(trimEntry).filter((x) => x.title && x.path);
    writeCache(items);
    log('catalogue fetched', items.length);
    return { items, at: Date.now(), cached: false };
  }

  function viewable(it, country, now) {
    if (it.yt) return true;
    if (!country) return true;                             // "all regions" mode
    if (it.countries.length && !it.countries.includes(country)) return false;
    if (!it.start || !it.end) return false;
    return !(now < Date.parse(it.start) || now > Date.parse(it.end));
  }

  async function viewingHistory() {
    const all = await loadAll();
    const out = {};
    for (const [k, v] of Object.entries(all || {})) {
      const p = norm(k);
      if (p.startsWith('/movie/') && v && typeof v.t === 'number' && v.t > MIN_SAVE) out[p] = v;
    }
    return out;
  }

  // ---------------------------------------------------------------- styling
  function injectExploreStyle() {
    if (document.getElementById('jff-x-style')) return;
    const st = document.createElement('style');
    st.id = 'jff-x-style';
    st.textContent = `
#jff-x-root {
  box-sizing: border-box !important; max-width: 1400px !important; margin: 18px auto !important;
  padding: 18px 16px 26px !important; border-radius: 16px !important;
  background: #0b0b0f !important; color: #f5f5f5 !important;
  font: 400 15px/1.45 -apple-system, "Segoe UI", Roboto, "Noto Sans JP", system-ui, sans-serif !important;
  box-shadow: 0 10px 34px rgba(0,0,0,.28) !important;
}
#jff-x-root * { box-sizing: border-box !important; }
#jff-x-root .jff-x-head { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 10px 14px !important; margin: 0 0 14px !important; }
#jff-x-root .jff-x-h1 { font: 700 20px/1.1 inherit !important; margin: 0 !important; color: #fff !important; letter-spacing: -.2px !important; }
#jff-x-root .jff-x-h1 small { display: block !important; font: 400 12px/1.4 inherit !important; color: #a9a9b4 !important; letter-spacing: 0 !important; }
#jff-x-root .jff-x-tools { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 8px !important; margin-left: auto !important; }
#jff-x-root .jff-x-field {
  -webkit-appearance: none !important; appearance: none !important;
  display: flex !important; align-items: center !important; gap: 7px !important;
  padding: 0 11px !important; height: 38px !important; border-radius: 999px !important;
  background: #1b1b22 !important; border: 1px solid #2c2c37 !important; color: #fff !important;
  font: 500 14px/1 inherit !important; letter-spacing: 0 !important;
}
#jff-x-root .jff-x-field svg { width: 17px !important; height: 17px !important; min-width: 17px !important; max-width: 17px !important;
  min-height: 17px !important; max-height: 17px !important; display: block !important; fill: none !important;
  stroke: #9d9dab !important; stroke-width: 2 !important; stroke-linecap: round !important; stroke-linejoin: round !important; }
#jff-x-root input.jff-x-field { width: min(280px, 62vw) !important; min-width: 150px !important; }
#jff-x-root input.jff-x-field::placeholder { color: #7c7c8a !important; }
#jff-x-root select.jff-x-field { padding-right: 11px !important; cursor: pointer !important; max-width: 46vw !important; }
#jff-x-root button.jff-x-field { cursor: pointer !important; }
#jff-x-root button.jff-x-field:active { transform: scale(.97) !important; }
#jff-x-root .jff-x-chips { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; margin: 0 0 16px !important; }
#jff-x-root .jff-x-chip {
  -webkit-appearance: none !important; appearance: none !important; cursor: pointer !important;
  height: 32px !important; padding: 0 13px !important; border-radius: 999px !important;
  background: #17171d !important; border: 1px solid #2c2c37 !important; color: #d7d7e0 !important;
  font: 600 13px/1 inherit !important; letter-spacing: 0 !important; white-space: nowrap !important;
}
#jff-x-root .jff-x-chip[aria-pressed="true"] { background: #fff !important; border-color: #fff !important; color: #111 !important; }
#jff-x-root .jff-x-row { margin: 0 0 22px !important; }
#jff-x-root .jff-x-rowhead { display: flex !important; align-items: baseline !important; gap: 10px !important; margin: 0 0 9px !important; }
#jff-x-root .jff-x-rowhead h2 { font: 700 16px/1.2 inherit !important; margin: 0 !important; color: #fff !important; }
#jff-x-root .jff-x-rowhead span { font: 400 12px/1.2 inherit !important; color: #8f8f9c !important; }
#jff-x-root .jff-x-strip {
  display: flex !important; gap: 12px !important; overflow-x: auto !important; overflow-y: hidden !important;
  padding: 2px 2px 10px !important; scroll-snap-type: x proximity !important;
  -webkit-overflow-scrolling: touch !important; scrollbar-width: thin !important;
}
#jff-x-root .jff-x-strip::-webkit-scrollbar { height: 6px !important; }
#jff-x-root .jff-x-strip::-webkit-scrollbar-thumb { background: #35353f !important; border-radius: 3px !important; }
#jff-x-root .jff-x-grid { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(136px, 1fr)) !important; gap: 14px !important; }
#jff-x-root .jff-x-card { display: block !important; text-decoration: none !important; color: inherit !important;
  width: 136px !important; flex: 0 0 136px !important; scroll-snap-align: start !important; }
#jff-x-root .jff-x-grid .jff-x-card { width: auto !important; flex: none !important; }
#jff-x-root .jff-x-card:active .jff-x-poster { transform: scale(.975) !important; }
#jff-x-root .jff-x-poster { position: relative !important; border-radius: 10px !important; overflow: hidden !important;
  background: #191921 !important; aspect-ratio: 2 / 3 !important; transition: transform .16s ease !important; }
#jff-x-root .jff-x-poster img { display: block !important; width: 100% !important; height: 100% !important; object-fit: cover !important; }
#jff-x-root .jff-x-fallback { position: absolute !important; inset: 0 !important; display: flex !important; align-items: center !important;
  justify-content: center !important; text-align: center !important; padding: 10px !important; color: #6f6f7d !important;
  font: 600 12px/1.35 inherit !important; }
#jff-x-root .jff-x-badges { position: absolute !important; left: 6px !important; bottom: 6px !important; display: flex !important; gap: 4px !important; flex-wrap: wrap !important; }
#jff-x-root .jff-x-badge { background: rgba(0,0,0,.72) !important; color: #fff !important; border-radius: 5px !important;
  padding: 3px 6px !important; font: 700 10px/1 inherit !important; letter-spacing: .2px !important;
  -webkit-backdrop-filter: blur(4px) !important; backdrop-filter: blur(4px) !important; }
#jff-x-root .jff-x-badge.jff-x-warn { background: rgba(214,60,60,.9) !important; }
#jff-x-root .jff-x-progress { position: absolute !important; left: 0 !important; right: 0 !important; bottom: 0 !important; height: 4px !important; background: rgba(255,255,255,.22) !important; }
#jff-x-root .jff-x-progress i { display: block !important; height: 100% !important; background: #e50914 !important; }
#jff-x-root .jff-x-ct { margin: 7px 0 0 !important; font: 600 13px/1.3 inherit !important; color: #f2f2f6 !important;
  display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; }
#jff-x-root .jff-x-cs { margin: 2px 0 0 !important; font: 400 11.5px/1.3 inherit !important; color: #8d8d9b !important;
  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
#jff-x-root .jff-x-meta { margin: 3px 0 0 !important; font: 500 11px/1.3 inherit !important; color: #6f6f7d !important; }
#jff-x-root .jff-x-note { color: #9a9aa8 !important; font: 400 13px/1.5 inherit !important; margin: 4px 0 14px !important; }
#jff-x-root .jff-x-empty { padding: 26px 4px !important; color: #9a9aa8 !important; }
#jff-x-root .jff-x-status { margin-top: 6px !important; color: #77778a !important; font: 400 12px/1.5 inherit !important; }
#jff-x-root .jff-x-status b { color: #b9b9c6 !important; font-weight: 600 !important; }
@media (max-width: 560px) {
  #jff-x-root { border-radius: 0 !important; margin: 0 !important; padding: 14px 12px 22px !important; }
  #jff-x-root .jff-x-card { width: 118px !important; flex: 0 0 118px !important; }
  #jff-x-root .jff-x-grid { grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)) !important; gap: 11px !important; }
  #jff-x-root .jff-x-h1 { font-size: 17px !important; }
}
`;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---------------------------------------------------------------- markup
  function cardHTML(it, country, now, hist) {
    const histPos = hist && it.path ? hist[it.path] : null;
    const badges = [];
    if (it.rating) badges.push('<span class="jff-x-badge">' + esc(it.rating) + '</span>');
    if (it.caps.includes('id')) badges.push('<span class="jff-x-badge">ID subs</span>');
    if (it.yt) badges.push('<span class="jff-x-badge">YouTube</span>');
    if (!it.yt) {
      const started = it.start ? Date.parse(it.start) : null;
      const ended = it.end ? Date.parse(it.end) : null;
      if (ended !== null && now > ended) {
        badges.push('<span class="jff-x-badge jff-x-warn">ended</span>');
      } else if (started !== null && now < started) {
        badges.push('<span class="jff-x-badge">from ' + esc(it.start.slice(0, 10)) + '</span>');
      } else if (ended !== null && ended - now <= 21 * DAY) {
        badges.push('<span class="jff-x-badge jff-x-warn">' + relDay(ended - now) + ' left</span>');
      }
    }
    if (country && !it.yt && it.countries.length && !it.countries.includes(country)) {
      badges.push('<span class="jff-x-badge jff-x-warn">other region</span>');
    }
    const poster = it.img
      ? '<img src="' + esc(it.img) + '" alt="" loading="lazy" decoding="async" data-title="' + esc(it.title) + '">'
      : '<div class="jff-x-fallback">' + esc(it.title) + '</div>';
    let bar = '';
    if (histPos && histPos.d) {
      const pct = Math.max(2, Math.min(100, Math.round((histPos.t / histPos.d) * 100)));
      bar = '<div class="jff-x-progress"><i style="width:' + pct + '%"></i></div>';
    }
    const meta = histPos
      ? '<div class="jff-x-meta">' + esc(fmt(histPos.t)) + ' / ' + esc(fmt(histPos.d)) + '</div>'
      : '';
    const href = it.link || it.path || '#';
    return '<a class="jff-x-card" href="' + esc(href) + '" title="' + esc((it.title || '') + (it.jp ? ' — ' + it.jp : '')) + '">' +
      '<div class="jff-x-poster">' + poster +
        (badges.length ? '<div class="jff-x-badges">' + badges.join('') + '</div>' : '') + bar +
      '</div>' +
      '<div class="jff-x-ct">' + esc(it.title) + '</div>' +
      (it.jp ? '<div class="jff-x-cs">' + esc(it.jp) + '</div>' : '') + meta +
    '</a>';
  }

  function rowHTML(title, items, country, now, hist, count) {
    if (!items.length) return '';
    return '<section class="jff-x-row">' +
      '<div class="jff-x-rowhead"><h2>' + esc(title) + '</h2><span>' + (count || items.length) + ' films</span></div>' +
      '<div class="jff-x-strip">' + items.map((it) => cardHTML(it, country, now, hist)).join('') + '</div>' +
    '</section>';
  }

  // ---------------------------------------------------------------- app
  async function initExplore() {
    if (!isListingPage) return;
    if (document.getElementById('jff-x-root')) return;

    const state = { items: [], at: 0, country: storedCountry(), q: '', filter: 'all', hist: {}, loading: true, error: '' };

    const root = document.createElement('div');
    root.id = 'jff-x-root';
    root.innerHTML =
      '<div class="jff-x-head">' +
        '<h1 class="jff-x-h1">Explore JFF Theater<small>Free Japanese films — resume where you left off</small></h1>' +
        '<div class="jff-x-tools">' +
          '<label class="jff-x-field">' + EX_ICON.search +
            '<input class="jff-x-field" id="jff-x-q" type="search" placeholder="Search films (English or 日本語)" autocomplete="off"></label>' +
          '<select class="jff-x-field" id="jff-x-country" title="Availability country"></select>' +
          '<button class="jff-x-field" id="jff-x-refresh" type="button" title="Refresh catalogue">' + EX_ICON.refresh + '</button>' +
          '<button class="jff-x-field" id="jff-x-classic" type="button">Classic view</button>' +
        '</div>' +
      '</div>' +
      '<div class="jff-x-chips" id="jff-x-chips"></div>' +
      '<div id="jff-x-body"><div class="jff-x-empty">Loading the catalogue…</div></div>' +
      '<div class="jff-x-status" id="jff-x-status"></div>';

    injectExploreStyle();
    mountExplore(root);
    if (localStorage.getItem(CLASSIC_KEY) === '1') { setClassic(true); return; }

    const body = root.querySelector('#jff-x-body');
    const statusEl = root.querySelector('#jff-x-status');
    const qEl = root.querySelector('#jff-x-q');
    const countryEl = root.querySelector('#jff-x-country');
    const chipsEl = root.querySelector('#jff-x-chips');

    const FILTERS = [
      ['all', 'All'],
      ['now', 'Available now'],
      ['soon', 'Ending soon'],
      ['id', 'Indonesian subtitles'],
      ['yt', 'Free on YouTube'],
      ['upcoming', 'Coming soon'],
      ['progress', 'Started watching']
    ];

    function paintChips() {
      chipsEl.innerHTML = FILTERS.map(([k, label]) => {
        const n = k === 'all' ? state.items.length : countFor(k);
        return '<button class="jff-x-chip" type="button" data-filter="' + k + '" aria-pressed="' +
          (state.filter === k) + '">' + esc(label) + (n ? ' · ' + n : '') + '</button>';
      }).join('');
    }

    function paintCountry() {
      const codes = new Set();
      for (const it of state.items) for (const c of it.countries) codes.add(c);
      const list = [...codes].sort();
      const cur = state.country || '';
      countryEl.innerHTML = '<option value="">All regions</option>' +
        list.map((c) => '<option value="' + c + '"' + (c === cur ? ' selected' : '') + '>' + c.toUpperCase() + '</option>').join('');
    }

    function viewableItems() {
      const now = Date.now();
      return state.items.filter((it) => viewable(it, state.country, now));
    }

    function countFor(kind) {
      const now = Date.now();
      const live = viewableItems();
      switch (kind) {
        case 'now': return live.filter((it) => it.yt || (it.start && it.end && now >= Date.parse(it.start) && now <= Date.parse(it.end))).length;
        case 'soon': return live.filter((it) => it.end && Date.parse(it.end) - now <= 21 * DAY && Date.parse(it.end) >= now).length;
        case 'id': return live.filter((it) => it.caps.includes('id')).length;
        case 'yt': return state.items.filter((it) => it.yt).length;
        case 'upcoming': return state.items.filter((it) => it.start && now < Date.parse(it.start)).length;
        case 'progress': return Object.keys(state.hist).length;
        default: return state.items.length;
      }
    }

    function applyFilter(list, kind) {
      const now = Date.now();
      switch (kind) {
        case 'now': return list.filter((it) => it.yt || (it.start && it.end && now >= Date.parse(it.start) && now <= Date.parse(it.end)));
        case 'soon': return list.filter((it) => it.end && Date.parse(it.end) >= now && Date.parse(it.end) - now <= 21 * DAY)
          .sort((a, b) => Date.parse(a.end) - Date.parse(b.end));
        case 'id': return list.filter((it) => it.caps.includes('id'));
        case 'yt': return list.filter((it) => it.yt);
        case 'upcoming': return list.filter((it) => it.start && now < Date.parse(it.start))
          .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
        case 'progress': {
          const order = Object.entries(state.hist).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).map(([p]) => p);
          return order.map((p) => list.find((it) => it.path === p)).filter(Boolean);
        }
        default: return list;
      }
    }

    function search(list) {
      const q = state.q.trim().toLowerCase();
      if (!q) return list;
      return list.filter((it) => (it.title + ' ' + it.jp + ' ' + it.path).toLowerCase().includes(q));
    }

    function render() {
      const now = Date.now();
      const live = viewableItems();
      // A search looks across the whole catalogue (so you can still find a film that has ended or
      // is region-locked elsewhere); a chip filter narrows the watchable set.
      const flat = search(applyFilter(state.q.trim() ? state.items : (state.filter === 'all' ? live : viewableItems()), state.filter));

      paintChips();

      if (state.q.trim() || state.filter !== 'all') {
        body.innerHTML = flat.length
          ? '<section class="jff-x-row"><div class="jff-x-rowhead"><h2>' +
            (state.q.trim() ? 'Results' : (FILTERS.find((f) => f[0] === state.filter) || [, 'Results'])[1]) +
            '</h2><span>' + flat.length + ' films</span></div><div class="jff-x-grid">' +
            flat.map((it) => cardHTML(it, state.country, now, state.hist)).join('') + '</div></section>'
          : '<div class="jff-x-empty">Nothing matches. Try another title, or set the region filter to “All regions”.</div>';
      } else {
        const started = applyFilter(live, 'progress');
        const nowRow = live.filter((it) => it.yt || (it.start && it.end && now >= Date.parse(it.start) && now <= Date.parse(it.end)))
          .sort((a, b) => Date.parse(b.start || 0) - Date.parse(a.start || 0)).slice(0, 30);
        const soonRow = live.filter((it) => it.end && Date.parse(it.end) >= now && Date.parse(it.end) - now <= 21 * DAY)
          .sort((a, b) => Date.parse(a.end) - Date.parse(b.end));
        const idRow = live.filter((it) => it.caps.includes('id')).slice(0, 30);
        const ytRow = state.items.filter((it) => it.yt).slice(0, 30);
        const upRow = state.items.filter((it) => it.start && now < Date.parse(it.start))
          .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).slice(0, 30);

        body.innerHTML =
          (state.loading ? '<div class="jff-x-empty">Loading…</div>' : '') +
          rowHTML('Continue watching', started.slice(0, 24), state.country, now, state.hist) +
          rowHTML('Available now', nowRow, state.country, now, state.hist, countFor('now')) +
          rowHTML('Ending soon', soonRow, state.country, now, state.hist, countFor('soon')) +
          rowHTML('With Indonesian subtitles', idRow, state.country, now, state.hist, countFor('id')) +
          rowHTML('Free on YouTube', ytRow, state.country, now, state.hist, countFor('yt')) +
          rowHTML('Coming soon', upRow, state.country, now, state.hist, countFor('upcoming')) +
          (live.length ? '' : '<div class="jff-x-empty">No film is available for the selected region right now. Switch the region filter to “All regions” to browse everything.</div>');
      }

      const age = state.at ? Math.round((Date.now() - state.at) / 60000) : null;
      statusEl.innerHTML = state.error
        ? 'Catalogue could not be loaded: ' + esc(state.error) + ' — retry with the refresh button.'
        : '<b>' + state.items.length + '</b> titles in the catalogue · <b>' + countFor('now') + '</b> available now' +
          (state.country ? ' for region <b>' + esc(state.country.toUpperCase()) + '</b>' : ' (all regions shown)') +
          (age === null ? '' : ' · updated ' + (age < 1 ? 'just now' : age + ' min ago')) +
          ' · positions stored locally by this script: <b>' + Object.keys(state.hist).length + '</b>';
    }

    function setClassic(on) {
      try { localStorage.setItem(CLASSIC_KEY, on ? '1' : '0'); } catch (e) {}
      root.style.setProperty('display', on ? 'none' : 'block', 'important');
      const app = document.getElementById('movieApp');
      if (app) app.style.setProperty('display', on ? '' : 'none', 'important');
      const btn = root.querySelector('#jff-x-classic');
      if (btn) btn.textContent = on ? 'Explore view' : 'Classic view';
      if (btn) btn.onclick = () => setClassic(!on);
    }

    root.addEventListener('click', (e) => {
      const chip = e.target.closest && e.target.closest('.jff-x-chip');
      if (!chip) return;
      state.filter = chip.getAttribute('data-filter') || 'all';
      render();
    });
    // a poster that fails to load falls back to the title tile instead of a broken image
    root.addEventListener('error', (e) => {
      const img = e.target;
      if (!img || img.tagName !== 'IMG' || !img.closest('.jff-x-poster')) return;
      const holder = img.parentNode;
      const label = img.getAttribute('data-title') || '';
      img.remove();
      if (holder && !holder.querySelector('.jff-x-fallback')) {
        const fb = document.createElement('div');
        fb.className = 'jff-x-fallback';
        fb.textContent = label;
        holder.insertBefore(fb, holder.firstChild);
      }
    }, true);
    qEl.addEventListener('input', () => { state.q = qEl.value; render(); });
    countryEl.addEventListener('change', () => {
      state.country = countryEl.value;
      try { localStorage.setItem(COUNTRY_KEY, state.country); } catch (e) {}
      render();
    });
    root.querySelector('#jff-x-refresh').addEventListener('click', async () => {
      state.error = '';
      body.innerHTML = '<div class="jff-x-empty">Refreshing the catalogue…</div>';
      try {
        const res = await fetchCatalogue(true);
        state.items = res.items; state.at = res.at;
        paintCountry(); render();
      } catch (err) {
        state.error = err.message || String(err);
        render();
      }
    });

    // load
    (async () => {
      state.hist = await viewingHistory();
      const cached = readCache();
      if (cached) { state.items = cached.items; state.at = cached.at; state.loading = false; paintCountry(); render(); }
      if (state.country === null) {
        const detected = (await sessionCountry()) || guessCountry();
        state.country = detected || '';
        if (detected) { try { localStorage.setItem(COUNTRY_KEY, detected); } catch (e) {} }
      }
      try {
        const res = await fetchCatalogue(false);
        state.items = res.items; state.at = res.at; state.loading = false;
        paintCountry(); render();
      } catch (err) {
        state.loading = false;
        state.error = err.message || String(err);
        render();
      }
    })();

    setClassic(false);
  }

  function mountExplore(root) {
    const host = document.getElementById('movieApp');
    if (host && host.parentNode) {
      host.parentNode.insertBefore(root, host);
      host.style.setProperty('display', 'none', 'important');
      return;
    }
    // the Vue app may mount late — keep looking
    let tries = 0;
    const t = setInterval(() => {
      const el = document.getElementById('movieApp');
      if (el && el.parentNode) {
        clearInterval(t);
        el.parentNode.insertBefore(root, el);
        el.style.setProperty('display', 'none', 'important');
      } else if (++tries > 40) {
        clearInterval(t);
        document.body.appendChild(root);
      }
    }, 250);
  }

  if (isListingPage) initExplore().catch((e) => log('explore failed', e));

  log('ready — ' + (hasGM ? 'GM storage' : 'localStorage') + (isListingPage ? ' · explore page' : ' · player'));
})();
