# Hub cards render harness

Renders the real Members card and the real Site Builder card (`packages/hub/src/members`: Face, Popup, Detail) on the design's
sample data (`docs/open/hub-cards-handoff/source/MemberHub.dc.html`), with no server and no
database. `host.act` resolves `{ ok: true }` after 600 ms and logs; `host.refresh` logs.
Use it to see a layout change before a rebuild. It cannot catch server-only problems.

Pages (the `__PAGE__` value, one HTML each in `out/`): card, card-small, card-solo, card-guide,
popup, popup-guide, popup-demote, popup-nomatch, people, people-guide, people-expanded,
confirm-remove, confirm-demote, arrivals, arrivals-guide, arrivals-empty, visitors, visitors-30d,
visitors-90d, permissions, permissions-guide, small-org, small-org-guide, solo, card-plain and
people-plain (no Industry theme, a sample org palette through `--sf-*` / `--eac-hub-*`), and
popup-phone / people-phone (390 wide). Pages that show a state (expanded row, confirm dialog,
inline demote) drive the real controls from `members.tsx` after mount.

```bash
H=$PWD/scripts/hub-cards-harness   # from the repo root
mkdir -p $H/out $H/png
# 1. bundle
sudo -n docker run --rm --user 3003:3003 -v $PWD:/repo:ro -v $H:/h -w /h node:22-alpine node /h/build.mjs
# 2. a Chrome to drive
sudo -n docker run -d --name shot-hubcards --network guru-eac_eac-network --shm-size=512m -v $H/out:/out:ro --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --allow-file-access-from-files --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank
IP=$(sudo -n docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$v.IPAddress}}{{end}}' shot-hubcards)
# 3. screenshots (all pages, or a comma list such as popup,people)
sudo -n docker run --rm --network guru-eac_eac-network -v $H/png:/out -v $H/shot.mjs:/s/shot.mjs:ro node:24-alpine node /s/shot.mjs $IP popup,people
sudo -n docker rm -f shot-hubcards
```

`out/` and `png/` are build output (git-ignored). When `members/model.ts` changes, update the sample
data in `members.tsx`; the stub `act` accepts any action id.

## Site Builder pages

`site-builder.tsx` renders `packages/hub/src/site-builder` (Face, Popup, Detail) on the design's sample data
(`docs/open/hub-cards-handoff/source/SiteBuilderCard.dc.html` seed(): IFAC with 20 pages, mixed kinds, a nested page, two shared
layouts and two colour exceptions; Book Readers with the two template pages whose Home slots are README 1i). Thumbnails are small
generated SVGs for pages that have a shape and `null` (the placeholder) for the rest. The host stub has `puckEditHref`,
`themeEditorHref`, an `uploadImage` that resolves after 400 ms, and logs `act` / `navigate` / `refresh`.

Pages (each `sb-*` HTML in `out/`, bundle `out/site-builder.js`): sb-card (1a), sb-card-bookreaders (1b), sb-card-noeditor (host
without an editor), sb-popup (1d), sb-popup-template (1e, Book Readers Home expanded), sb-popup-nonotes (`can.notes` and
`can.savedTemplates` false), sb-pages-grid (1f), sb-pages-list (1g), sb-pages-expanded-editor (1h), sb-pages-expanded-template,
sb-pages-nonotes, sb-bookreaders (1i), sb-new-page (1j), sb-new-nested (1o), sb-save-template (1p), sb-theme (1k), sb-profile (1m),
sb-profile-nokinds (`can.kinds` false), sb-pages-plain (org palette, no Industry), sb-popup-phone and sb-pages-phone (390 wide).
Pages that show a state drive the real controls from `site-builder.tsx` after mount. The build and shot steps above cover all pages
of both cards; `shot.mjs <ip> sb-card,sb-theme` limits it.
