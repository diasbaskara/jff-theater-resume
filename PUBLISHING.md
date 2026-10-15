# Publishing kit

Ready-to-use text for putting this script online. Nothing here has been published yet.

## Recommended route

**GitHub repository (source of truth) + Greasy Fork listing (discovery + auto-update).**

Greasy Fork is where userscript users look, and it hands users automatic updates for free — you never
add `@updateURL`/`@downloadURL` yourself, Greasy Fork injects them. GitHub holds the licence, README
and the test harness, which is the part that makes this credible: the icons and the resume logic were
verified against a harness that reproduces the site's own hostile CSS.

## Step 1 — GitHub

Repository name: `jff-theater-resume` · Visibility: public · Licence: MIT · Topics:
`userscript`, `jff`, `japan-foundation`, `safari`, `ios`, `tampermonkey`

Author with your GitHub noreply address (so no private email leaks into history):

```bash
cd ~/projects/jff-theater-resume
git init -b main
git add -A
git commit -m "JFF Theater resume + touch playback controls (v1.1.0)" \
  --author="Dias Baskara <25913324+diasbaskara@users.noreply.github.com>"
gh repo create jff-theater-resume --public --source=. --push \
  --description "Userscript: adds resume and touch playback controls to the JFF Theater player"
```

Repository description:

> Userscript that adds resume + touch playback controls to the JFF Theater player. Streaming only —
> no download, no DRM circumvention. Built for the iOS Userscripts app and desktop managers.

## Step 2 — Greasy Fork

Sign in at <https://greasyfork.org> (GitHub, Google or email), then **Post a new script** and paste
`jff-theater-resume.user.js`. Fields:

- **Name:** `JFF Theater — Resume + Playback Controls`
- **Description:** paste the block below
- **Language:** English
- **Applies to:** `https://*.jff.jpf.go.jp/movie/*` (Greasy Fork reads this from `@match`)
- **Additional info:** `https://github.com/diasbaskara/jff-theater-resume`
- **Licence:** MIT

### Description to paste

```markdown
JFF Theater's own player has no resume feature: reload the page, lose Wi-Fi, or let Safari discard the
tab, and a 119-minute film starts again at 00:00. This script remembers your position and jumps back
to it.


**Resume + playback controls** — remembers your position and jumps back to it, with a touch bar for
iOS/iPadOS Safari (−15s, play/pause, +15s, picture-in-picture, fullscreen) and keyboard shortcuts on
desktop. Screen wake lock keeps the display awake while playing.

**It is a streaming convenience, not a downloader.** No video is fetched, copied, saved or decrypted —
the script stores a timestamp in userscript storage (or `localStorage`) and seeks the player to it. Using the films remains subject to
the Japan Foundation's terms and to copyright law.

Note: the player element is found with `document.querySelectorAll('video')`, so it needs updating if
JFF changes its player.
```

## Step 3 — Checklist before posting

- [ ] Metadata complete: `@name`, `@namespace`, `@version`, `@description`, `@license`, `@match`
- [ ] Not obfuscated or minified (Greasy Fork rule)
- [ ] Inline third-party icon data credited with name, URL **and version** (Greasy Fork rule) — done:
      Lucide via lucide-static v1.57.0, ISC
- [ ] No `@match`/`@include` for sites the script does not act on
- [ ] No self-update logic in the script
- [ ] Description discloses exactly what it does
- [ ] Bump `@version` for every future release — that is what triggers user updates

## Optional extras

- Add `preview-controls.png` to the README as a screenshot.
- If Arabic/Hindi/Indonesian audiences matter, Greasy Fork lets you add translations to the listing.
- The harness files (`stub*.html`, `rangeserver.py`) are worth keeping public — they document how the
  script was verified.
