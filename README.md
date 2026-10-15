# JFF Theater — Resume + Playback Controls

A userscript that gives the [JFF Theater](https://jff.jpf.go.jp/) film player something it has never
had: it remembers where you were.

JFF Theater streams Japanese films for free (registration required) through a Wowza-based player that
keeps no progress and no resume feature. Reload the page, lose Wi-Fi, or have Safari discard the tab,
and a 119-minute film starts again at 00:00. This script stores the playback position per film and
seeks back to it.

![Control bar](preview-controls.png)

It is a **streaming convenience**, not a downloader: no media is fetched, copied, saved or decrypted —
only a time offset is stored. Public performance and redistribution of the films remain subject to the
Japan Foundation's terms and to copyright law.

## Features

- **Explore page** — on the catalogue page (`/movie/`) the site's plain listing is replaced with a
  Netflix-style browse view built from the site's own public catalogue JSON: rows for *Continue
  watching*, *Available now*, *Ending soon*, *With Indonesian subtitles*, *Free on YouTube* and
  *Coming soon*, plus search (English or 日本語), filter chips, a region selector, poster cards with
  age rating and days-left badges, and a **Classic view** toggle. See below.
- **Resume** — saves your position every few seconds and after a pause, then jumps back to it when the
  page reloads. A time chip shows where you are; tap it to jump to the last watched point.
- **On-screen controls** (touch-friendly): −15s, play/pause, +15s, picture-in-picture, fullscreen,
  and a hide button that leaves a small badge behind.
- **Keyboard shortcuts** (desktop): `←`/`→` ±10s, `Shift`+arrows ±60s, `Space`, `F`, `P`, `M`, `0`
  (restart), `T` (copy timestamp).
- **Screen wake lock** while playing, so the display does not dim mid-film.
- **Storage**: `GM.setValue` when the manager provides it, `localStorage` otherwise. One entry per
  film path, capped at the 60 most recent.

## Explore page

![Explore page](preview-explore-desktop.png)

The catalogue endpoint (`/jff-api/contents`, ~7 MB of JSON for 274 titles) is fetched once, trimmed to
the fields the UI needs and cached in `localStorage` for six hours (~3 KB), so browsing costs one
request every six hours.

Availability mirrors the site's own rule exactly, read from its front-end: a YouTube-backed entry is
always watchable; otherwise the viewer's country must appear in the entry's `whiteLists` **and** now
must fall inside `streamStart`…`streamEnd`. The country comes from `/jff-api/auth/me` when signed in
(the site only knows it then), falling back to a timezone/locale guess, and can be overridden — or set
to *All regions* — from the header.

Continue watching is joined from the same locally stored positions the resume feature writes, so a
half-watched film shows its progress bar and `42:10 / 1:59:00` right in the row.

Nothing is scraped beyond that one public endpoint, and no media is fetched: every card links to the
site's normal film page, so login and DRM playback are untouched. *Classic view* restores the original
listing at any time, and a failed fetch reports the error while keeping the last cached rows visible.

## Install

**iOS / iPadOS — Userscripts app (Safari)**

1. Install [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) (free, open source) and open it once.
2. Settings → Safari → Extensions → enable **Userscripts**, allow for **All Websites**.
3. Save `jff-theater-resume.user.js` into the Userscripts folder (Files app), or open a `.user.js` URL in
   Safari and install from the extension popup.
4. Open a film on JFF Theater and press play — the control bar appears bottom-left.

**Desktop — Tampermonkey / Violentmonkey / Safari**

Install the same file; the bar and keyboard shortcuts both work.

## Limitations

- The resume seek was verified against a stubbed player, **not** against the production DRM stream —
  the site's player is behind a login. If the seek does not land, check the console for `[jff-resume]`
  lines.
- Picture-in-picture is blocked by some DRM playback paths; the button reports when it fails.
- The player element is located by `document.querySelectorAll('video')`. If JFF rewrites its player,
  this needs updating.

## Development

`stub.html`, `stub-ios.html`, `stub-hostile.html` and `stub-explore.html` are harness pages used to
exercise the script's logic in a real browser (stubbed media element, Safari-only APIs, a mocked
catalogue API, and a copy of JFF's own CSS rules that used to distort the icons). `movie/index.html`
is the explore harness served at the `/movie/` path so the page-detection branch can be tested.
`rangeserver.py` is a small Range-capable static server, because Chrome's media loader stalls on
`python3 -m http.server`. `legacy/` holds the earlier keyboard-only build, kept for reference only.

## Licence

MIT — see `LICENSE`.

Icon path data from [Lucide](https://lucide.dev), used under the ISC Licence,
Copyright (c) Lucide Contributors.
