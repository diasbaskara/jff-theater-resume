// ==UserScript==
// @name         JFF Theater — Resume (desktop, legacy)
// @namespace    https://github.com/diasbaskara
// @version      1.0.0
// @description  Legacy keyboard-only build from before the touch UI. Superseded by
//               jff-resume-ios.user.js (same resume engine, plus on-screen controls) — kept for reference.
// @author       Hermes Agent (for Dias)
// @license      MIT
// @match        https://*.jff.jpf.go.jp/movie/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * WHY: the JFF Theater player (Wowza/"YmwPlayer") keeps no progress and restarts
 * from 00:00 whenever the page is reloaded, the connection drops, or the tab is
 * closed. This script stores the position in localStorage keyed by film URL and
 * seeks back to it once the player is ready. No media is copied anywhere.
 *
 * KEYS:  ← / →  ±10s      Shift+← / →  ±60s      Space  play-pause
 *        F  fullscreen     P  picture-in-picture  M  mute
 *        0  restart film   T  copy current timestamp
 */

(function () {
  'use strict';

  const KEY = 'jff:resume:' + location.pathname.replace(/\/+$/, '');
  const MIN_SAVE = 15;    // don't bother saving the first seconds
  const TAIL = 90;        // forget the position this close to the end
  const SAVE_EVERY = 5000;

  const log = (...a) => console.log('[jff-resume]', ...a);

  // ---------- storage ----------
  const store = {
    get() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw);
        return typeof v.t === 'number' && v.t > MIN_SAVE ? v : null;
      } catch (e) { return null; }
    },
    set(t, d) {
      try { localStorage.setItem(KEY, JSON.stringify({ t, d, at: Date.now() })); } catch (e) {}
    },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  };

  const fmt = (s) => {
    if (!isFinite(s)) return '--:--';
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    return (h ? h + ':' + p(m) : String(m)) + ':' + p(sec);
  };

  // ---------- tiny toast ----------
  let toastEl = null, toastTimer = null;
  function toast(msg, ms = 4000) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      Object.assign(toastEl.style, {
        position: 'fixed', left: '50%', bottom: '12%', transform: 'translateX(-50%)',
        zIndex: 2147483647, background: 'rgba(0,0,0,.82)', color: '#fff',
        font: '600 14px/1.4 system-ui,sans-serif', padding: '10px 16px',
        borderRadius: '8px', pointerEvents: 'none', maxWidth: '80vw',
        textAlign: 'center', boxShadow: '0 4px 18px rgba(0,0,0,.35)'
      });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (toastEl) toastEl.style.display = 'none'; }, ms);
  }

  // ---------- one attachment per <video> ----------
  const attached = new WeakSet();
  let lastSave = 0;
  let active = null;

  function attach(v) {
    if (attached.has(v)) return;
    attached.add(v);
    active = v;
    log('video element found');

    let resumed = false;

    const tryResume = () => {
      if (resumed || !isFinite(v.duration) || v.duration <= 0) return;
      resumed = true;
      const saved = store.get();
      if (!saved) { log('no saved position'); return; }
      if (saved.t >= v.duration - TAIL) { store.clear(); log('saved position was at the end — cleared'); return; }
      v.currentTime = saved.t;
      toast('Resumed at ' + fmt(saved.t) + ' — press 0 to restart from the beginning');
    };

    v.addEventListener('loadedmetadata', tryResume);
    v.addEventListener('durationchange', tryResume);
    v.addEventListener('canplay', tryResume);

    // give the site's player a moment, then try anyway (some DRM paths fire late)
    const kick = setInterval(() => {
      if (resumed) { clearInterval(kick); return; }
      tryResume();
    }, 1200);
    setTimeout(() => clearInterval(kick), 60000);

    v.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastSave < SAVE_EVERY) return;
      lastSave = now;
      if (v.currentTime > MIN_SAVE && isFinite(v.duration) && v.currentTime < v.duration - TAIL) {
        store.set(v.currentTime, v.duration);
      }
    });

    v.addEventListener('ended', () => { store.clear(); log('ended — position cleared'); });
    window.addEventListener('beforeunload', () => {
      if (v.currentTime > MIN_SAVE && !v.ended) store.set(v.currentTime, v.duration);
    });
    v.addEventListener('pause', () => {
      if (v.currentTime > MIN_SAVE && !v.ended) store.set(v.currentTime, v.duration);
    });
  }

  // ---------- keep watching for the player element (it is created/replaced by the site) ----------
  function sweep() {
    const vids = document.querySelectorAll('video');
    for (const v of vids) attach(v);
  }
  sweep();
  const mo = new MutationObserver(sweep);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(sweep, 2000);

  // ---------- keyboard shortcuts ----------
  function isTyping(e) {
    const el = e.target;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
  }

  document.addEventListener('keydown', (e) => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const v = active && document.contains(active) ? active : document.querySelector('video');
    if (!v) return;
    const jump = (d) => {
      e.preventDefault();
      v.currentTime = Math.min(Math.max(0, v.currentTime + d), (v.duration || 0) - 0.5);
      store.set(v.currentTime, v.duration);
      toast((d > 0 ? '+' : '') + d + 's  →  ' + fmt(v.currentTime) + ' / ' + fmt(v.duration), 1500);
    };
    switch (e.key) {
      case 'ArrowRight': return e.shiftKey ? jump(60) : jump(10);
      case 'ArrowLeft':  return e.shiftKey ? jump(-60) : jump(-10);
      case 'f': case 'F':
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen(); else (v.requestFullscreen ? v.requestFullscreen() : 0);
        return;
      case 'p': case 'P':
        e.preventDefault();
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled && v.requestPictureInPicture) {
          v.requestPictureInPicture().catch(() => toast('Picture-in-picture blocked for this stream'));
        } else {
          toast('Picture-in-picture not available in this browser');
        }
        return;
      case 'm': case 'M':
        e.preventDefault(); v.muted = !v.muted; toast(v.muted ? 'Muted' : 'Unmuted', 1200); return;
      case '0':
        e.preventDefault(); v.currentTime = 0; store.clear(); toast('Restarted from the beginning', 2000); return;
      case 't': case 'T':
        e.preventDefault();
        if (navigator.clipboard) navigator.clipboard.writeText(fmt(v.currentTime)).catch(() => {});
        toast('Timestamp ' + fmt(v.currentTime) + ' copied', 2000);
        return;
      default: return;
    }
  }, true);

  log('ready for', location.pathname);
})();
