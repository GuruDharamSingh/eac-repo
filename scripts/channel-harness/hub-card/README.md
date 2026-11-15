# Channel hub-card harness

Renders the Channel hub card (`packages/channel/src/hub/*`) on a hand-written sample model (`sample.ts`, copied from
`../katie/entry.tsx`), in sunjay's palette, inside the REAL `@elkdonis/cms-ui/surface` provider: a SurfaceCard face
opens the custom surface, so the quick form's `<dialog>` nests in the surface's `<dialog>` as on the hub. No server,
no database: the Channel door is stubbed (`stubs/channel-door.ts`), `next/*` use the parent harness's stubs.

Pages: face (the hub tiles), panel (pop-up, Board), panel-week, panel-piece (a piece's summary open),
panel-cell (a square's quick form open; `window.__nest` records open / focus / on top), panel-cell-closed (the form
closed again; records that the surface is still open and holds focus). `shot.mjs` takes 1280 and 390 shots.

```bash
H=$PWD/scripts/channel-harness/hub-card   # from the repo root
mkdir -p $H/out $H/png && chmod 777 $H/png
sudo -n docker run --rm --user 3003:3003 -v $PWD:/repo:ro -v $H:/h -w /h node:22-alpine node /h/build.mjs
sudo -n docker run -d --name shot-<you> --network guru-eac_eac-network --shm-size=512m -v $H/out:/out:ro \
  --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu \
  --disable-dev-shm-usage --allow-file-access-from-files --remote-debugging-address=0.0.0.0 \
  --remote-debugging-port=9222 --remote-allow-origins='*' about:blank
IP=$(sudo -n docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$v.IPAddress}}{{end}}' shot-<you>)
sudo -n docker run --rm --network guru-eac_eac-network -v $H/png:/png -v $H/shot.mjs:/s/shot.mjs:ro node:24-alpine node /s/shot.mjs $IP [panel,panel-piece-phone]
sudo -n docker rm -f shot-<you>
```

When `ChannelModel` changes, update `sample.ts`. `out/` and `png/` are build output (gitignored).
