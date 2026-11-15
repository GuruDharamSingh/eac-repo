# Studio Create + piece summary harness

Renders Studio's Create screen (`packages/studio/src/create/CreateKind.tsx`, canvas A) and the piece
summary (`packages/studio/src/summary/PieceSummary.tsx`, canvas C) on hand-written sample data, in the
Studio's own stylesheets (`studio.css`, `create.css`, `summary.css`). No server: Create's `load` returns the
sample, `StudioFrameApi` is a stub, the summary gets its view directly. The top bar is a bare
`.studio-top`, not StudioShell.

Pages: create (an org), create-dark, create-personal (empty states), create-loading, summary,
summary-dark, summary-bare (no pictures, no facts), sheet and sheet-bare (layout "sheet" in a site's frame
with an `actions` slot). `entry-gate.tsx` builds gate, gate-draft and gate-stuck: the summary gate in front
of the real meeting form (`packages/studio/src/forms/focus.tsx`) with stub actions; shots gate-edit and
gate-edit-list click Edit. `shot.mjs` also takes 390-wide shots and one with the Make into menu open. The
summary lives in `packages/content/src/summary/` (moved 2026-11-14).

```bash
H=$PWD/scripts/studio-harness/create-summary   # from the repo root
sudo -n docker run --rm --user 3003:3003 -v $PWD:/repo:ro -v $H:/h -w /h node:22-alpine node /h/build.mjs
sudo -n docker run -d --name shot-<you> --network guru-eac_eac-network --shm-size=512m -v $H/out:/out:ro \
  --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --allow-file-access-from-files --remote-debugging-address=0.0.0.0 \
  --remote-debugging-port=9222 --remote-allow-origins='*' about:blank
IP=$(sudo -n docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$v.IPAddress}}{{end}}' shot-<you>)
mkdir -p $H/png && chmod 777 $H/png
sudo -n docker run --rm --network guru-eac_eac-network -v $H/png:/png -v $H/shot.mjs:/s/shot.mjs:ro node:24-alpine node /s/shot.mjs $IP [create,summary-menu]
sudo -n docker rm -f shot-<you>
```

When `StudioCreateData` or `PieceSummaryView` changes, update the samples in `entry.tsx`.
`out/` and `png/` are build output (ignored by the `.gitignore` here).
