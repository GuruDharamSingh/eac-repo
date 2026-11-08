# Forms render harness

Renders the publication forms (`packages/studio/src/forms`: shell, fields, preview, theme)
with no server and no database, on soft tissue's sample data (`forms/kinds/*/sample.ts`), through
the real `FormShell` and the bone's `useFormState`. Save actions are stubs that echo a record
(`forms/harness/host.tsx`); the steps before a screenshot (a save, a Publish press) are replayed as
state events (`forms/harness/pages.ts`). `next/*` is stubbed (`stubs/`). Same set-up as
`scripts/channel-harness`.

Pages (the canvas ids of `docs/open/publishing-forms-handoff/Publishing Forms.dc.html`):
- pass 1: 1a, 2a, 2b, 1b, 1h, 1i, 1j, 1l, 1m, 1n, plus `blank` (a fresh gathering; the readiness
  line must read "Four things left before it can go out.").
- pass 2: 1c (a new series with the planner; soft tissue's gathering kind and
  `GATHERING_SERIES_SAMPLE`), 1f (artwork), `service` (an offering), the phones 1o, 1p and
  `service-m`, and `1c-page`, `1f-page`, `service-page` (the preview on Page). Artwork and
  Offering draw on harness fixtures (`forms/harness/fixtures.tsx`) until soft tissue's
  `kinds/artwork` and `kinds/service` land. 1d/1e (planner alternates) are pass 4.

Each is built in three looks:

- `<id>`: Broadsheet (`[data-form-theme="broadsheet"]`, `broadsheet.css`)
- `<id>-plain`: no theme and no site hooks, so every `--frm-*` falls back to the cms-ui surface defaults
- `<id>-dark`: a dark site's `site_themes` vars at `:root` (surface hooks plus `@elkdonis/gradients`
  `deriveRoleRamps`), the forms reading them through the fallback chain

Widths: 1320 (desktop, as designed), 900 (1i), 390 (1l, 1m, 1n, 1o, 1p, service-m). The Post
pages pass the Studio essay Canvas as the focus `blocks` slot, as the Studio host will.

Hosts compile the forms with their own, non-strict tsconfig (arts-collective). To check the forms
the way they do: `tsc --noEmit -p ../../scripts/forms-harness/tsconfig.nonstrict.json` from
`packages/studio` (in the admin container, as the studio check runs).

```bash
H=$PWD/scripts/forms-harness   # run from the repo root
mkdir -p $H/out $H/png
# 1. bundle (esbuild from the repo's node_modules, in a throwaway node container)
sg docker -c "docker run --rm --user 3003:3003 -v $PWD:/repo:ro -v $H:/h -w /h node:22-alpine node /h/build.mjs"
# 2. a Chrome to drive (pick your own name)
sg docker -c "docker run -d --name shot-forms --network guru-eac_eac-network --shm-size=512m -v $H/out:/out:ro --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --allow-file-access-from-files --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank"
IP=$(sg docker -c "docker inspect -f '{{range \$k,\$v := .NetworkSettings.Networks}}{{\$v.IPAddress}}{{end}}' shot-forms")
# 3. screenshots (all pages, or a comma list such as 1a,1h-plain,1b-dark)
sg docker -c "docker run --rm --network guru-eac_eac-network -v $H/png:/out -v $H/shot.mjs:/s/shot.mjs:ro node:24-alpine node /s/shot.mjs $IP"
sg docker -c "docker rm -f shot-forms"
```

`shot.mjs` lays each page out at its full height before the capture, so the phone's sticky bars
sit where they do at the end of the scroll, and prints each page's `scrollWidth` (no sideways
scroll), its readiness line and any console errors.

`out/` and `png/` are build output; do not commit them. When soft tissue changes a kind or its
samples, the pages follow (they import them); when a canvas id is added, add it to `pages.ts`,
`build.mjs` and `shot.mjs`.
