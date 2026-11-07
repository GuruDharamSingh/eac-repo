# Para Theater's real blocks in an isolated browser

2026-11-04. Mounts the editor on `apps/sunjay`'s own `canvasConfig` and `canvasContract`, the `/try` seed and hand-written rows, with no network. Use it to open a data block (feed cards, next gathering, forum) in the popup without a signed-in session on the live site.

Not covered: rows from the database, the server's save action, a published render.

Setup: copy these files into `$W` and `$W/h` (`build.*`, `run.sh` in `$W`; the rest in `$W/h`), put the site's CSS chunks in `$W/h/site.css` (public, from the `/try` page), link `playwright-core` at `$W/h/node_modules`, then:

    W=<scratch> sg docker -c "bash $W/run.sh feed.cjs"

Drivers: `feed.cjs` (clicks, shapes and order on the feed cards), `look.cjs` (each block opened in the popup), `picture.cjs` (Picture left and right, added 2026-11-05). The first hand-written thread has no cover, so a card without a picture is always in the run.

Home page (added 2026-11-05): save the signed-out `/` as `$W/h/home/visitor.html`, its stylesheets joined as `$W/h/home/site.css`, its `/api/media` pictures in `$W/h/home/media/`. `home.cjs` writes the markers, opens the editor and saves to `home/saved.json` and `home/parts.json`. `build-ssr.cjs` and `home-ssr.tsx` draw that with the real config and `<Render>` (run with `NODE_PATH=/app/node_modules/.pnpm/node_modules`; jsdom stays out of the bundle). `home-compare.cjs` compares words and every element's box with the coded page at 1440px and 390px. Bundle `home.ts` with `ENTRY` and `OUT` set for `build.cjs`.
