# Direct-edit test bench

Two rigs that last across stones. Written 2026-11-04. Both use the official image
`mcr.microsoft.com/playwright:v1.60.0-noble` (Chromium 148, Firefox 150, WebKit 26.4) and `playwright-core@1.60.0` from
`~/eac-backups/direct-edit/bench-vendor/node_modules`. To restore that folder:
`docker run --rm -u 3003 -v ~/eac-backups/direct-edit/bench-vendor:/v -w /v -e HOME=/tmp node:24-alpine npm i --prefix /v playwright-core@1.60.0`.

Docker may need `sg docker -c "..."`; the scripts already use it. Containers are named `bench-*`, capped at 4 GB, run one at
a time as uid 3003, and remove themselves.

## Rig 1: harness drivers in other browsers and on touch screens

    bench/run-browsers.sh <page-folder> <outdir>
    bench/results.py <outdir> --fails

- `<page-folder>` is the folder `harness/hb.sh` builds (`$S/h3`): the test page and the driver `.cjs` files side by side.
  It is copied into each container (`--network none`); nothing is written back. The stone 1 page and its drivers are kept in
  `~/eac-backups/direct-edit/bench-stone1-page.tgz`.
- `DRIVERS="walk3.cjs drive14.cjs"` picks drivers; the default is `walk.cjs walk2.cjs drive13.cjs` and the layout probe.
  `PROFILES="webkit-touch-390"` picks browsers from `profiles.cjs`; `chromium-desktop` is the control.
- Drivers run unchanged. `pw-shim.cjs` is preloaded and answers their `connectOverCDP` with the profile's browser.
- On a touch profile a click is a real tap and a right click is a long press. Chromium's long press and finger drags are real
  (CDP touch events). Playwright has no long press or drag for WebKit: the shim dispatches the events and writes
  `TRACE SYNTHETIC`; those steps show what follows, not that a finger can do it. The results table counts them.
- `SOFT=1` (default): a failed action writes `ACTION-FAIL` with a screenshot (`shots/<driver>/action-fail-*.png`) and the
  driver carries on, so one blocked step does not hide the rest. Later checks can fail as a consequence; read in order.
  `SOFT=0` gives the driver's own stop-at-first-error behaviour.
- A driver that assumes a desktop shows up as `TRACE CLAMP` (a point off the screen) in its log.

## Rig 2: live before/after comparison

    bench/live-snapshot.sh <host> <outdir> [--like <earlier-snapshot>]
    bench/live-compare.py <before> <after> --report <file> --diff-dir <dir>

- Signed out and GET only. The curl crawl is one request at a time through the edge
  (`curl -k --resolve <host>:30022:127.0.0.1 https://<host>:30022/...`), limit 80 pages. Rules for what is not followed:
  `live_links.py`; what was skipped and why: `<outdir>/skipped.tsv`.
- A forum thread page (`/t/<id>`) is not followed: `ThreadPage` runs `UPDATE threads SET view_count` on every GET
  (`packages/forum-ui/src/pages.tsx:656`, `packages/services/src/forum.ts:718`).
- Browsers reach the edge through a forwarder in the container (`shots.cjs` header): they load `https://<host>/` as a visitor
  does. They refuse anything but GET and HEAD, `navigator.sendBeacon` (the analytics beacon writes to the database), router
  prefetches, logout paths and every other host. The refusals per page are in `shots/<browser>/<width>/<key>.json`.
- The word `monitor` in the user agent keeps Firefox and WebKit out of the arrival redirect through arts-collective.com
  (`packages/auth-server/src/sso-proxy.ts`); headless Chromium is already out of it. So sign-in on arrival is not covered here.
- Pass `--like <before>` on the after run, so every page of the before run is visited whatever the links now say.
- `live-compare.py` exit status: 0 no difference, 1 differences, 2 usage. Its `NORMALISE` and `DATES` tables list what it
  ignores. Scripts are not compared as markup (a rebuild renumbers the flight payload) but are counted for the markers, and the
  markers are also counted in the static files each page names, so editor code reaching a signed-out page is reported.
- `--keep-dates` turns off date normalising; a date a page really changed is otherwise not reported.
- A page with fewer than 2 runs of evidence is not a baseline: to see what moves by itself on a host, take two snapshots and
  compare them before trusting a difference.

2026-11-04: Rig 1 (the browser rig) has never been run; only `live-snapshot.sh` and `live-compare.py` have.
