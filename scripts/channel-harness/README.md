# Channel render harness

Renders the real Channel components (`apps/arts-collective/src/components/channel/*`) on a
hand-written sample model, with no server and no database: the server actions,
`@/lib/actions/run` and `next/*` are stubbed (`stubs/`). Use it to see a layout
change before a rebuild. It cannot catch server-only problems (a constant
imported from a `"use client"` file into a server page 500'd `/channel/outlets`
on 2026-11-07); use a dev preview for those (`docs/reference/testing.md`).

Pages (`?` the `__PAGE__` value): home, matrix, queue, month, board, newpost,
newpost-pick, newpost-confirm, newpost-posted, piece, plan, library, lightbox,
quick, adjust, outlets, outlets-live, routines, katie (an org with nothing
connected), empty, dark, home-phone.

```bash
H=$PWD/scripts/channel-harness   # run from the repo root
mkdir -p $H/out $H/png
# 1. bundle (esbuild from the repo's node_modules, in a throwaway node container)
sg docker -c "docker run --rm --user 3003:3003 -v $PWD:/repo:ro -v $H:/h -w /h node:22-alpine node /h/build.mjs"
# 2. a Chrome to drive (pick your own name)
sg docker -c "docker run -d --name shot-channel --network guru-eac_eac-network --shm-size=512m -v $H/out:/out:ro --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --allow-file-access-from-files --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank"
IP=$(sg docker -c "docker inspect -f '{{range \$k,\$v := .NetworkSettings.Networks}}{{\$v.IPAddress}}{{end}}' shot-channel")
# 3. screenshots (all pages, or a comma list such as home,adjust)
sg docker -c "docker run --rm --network guru-eac_eac-network -v $H/png:/out -v $H/shot.mjs:/s/shot.mjs:ro node:24-alpine node /s/shot.mjs $IP home,adjust"
sg docker -c "docker rm -f shot-channel"
```

`out/` and `png/` are build output; do not commit them. When the model type
(`apps/arts-collective/src/lib/channel/model.ts`) changes, update the sample model in `entry.tsx`;
when an action is added to `apps/arts-collective/src/lib/channel/actions.ts`, add a stub.
