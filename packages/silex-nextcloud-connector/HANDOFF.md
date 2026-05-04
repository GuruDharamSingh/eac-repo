# Silex EAC Blocks Integration — Handoff

**Status**: Active Silex client-config path wired. General EAC blocks and the workshop template registry are registered from `/silex.js`; workshop data/CSS are served by connector asset routes.

## What works (verified via curl)

| URL | Status | Purpose |
|---|---|---|
| `http://127.0.0.1:6805/silex.js` | 200 | Silex client config (loaded via `SILEX_CLIENT_CONFIG`) |
| `http://127.0.0.1:6805/eac-blocks.css` | 200, 16912 bytes, `text/css` | Editor canvas stylesheet |
| `http://127.0.0.1:6805/eac-workshop-template.json` | 200 | Workshop manifest plus section HTML/CSS |
| `http://127.0.0.1:6805/eac-workshop-template.css` | 200 | Workshop tokens plus section CSS |
| `http://127.0.0.1:6805/eac-silex-blocks.js` | not mounted | Old monkey-patch endpoint; keep out of the active path |

Server logs show clean startup with no errors:
```
> Serving client side config /silex/extensions/silex-nextcloud-connector/src/client-config.js at silex.js
> [silex-nextcloud-connector] registered Nextcloud storage and hosting connectors
> [silex-nextcloud-connector] token redemption and EAC editor assets middleware installed (after session)
```

## Architecture (idiomatic Silex extension)

No DOM monkey-patching, no HTML interception, no polling.

### 1. CSS route — server-side
[`src/editorAssetsMiddleware.js`](src/editorAssetsMiddleware.js)
- Exports `registerEditorAssets(app)` which calls `app.get('/eac-blocks.css', handler)`.
- Handler reads `eac-blocks.css` from disk and serves it with `text/css; charset=utf-8`, `Cache-Control: public, max-age=60`.
- The same middleware also serves `/eac-workshop-template.json` and `/eac-workshop-template.css` from the canonical template tree.
- Wired in [`index.js`](index.js) inside the `silex:startup:start` event handler.
- **Critical**: route layer is hoisted in `app._router.stack` to position `cookieSession + 2` (NOT 0). Position 0 puts it before `expressInit`, which decorates `res` with `.set()`/`.status()`/`.send()` — placing it there causes `TypeError: res.set is not a function` and crashes the server. This bug was hit and fixed.

### 2. Client config — browser-side
[`src/client-config.js`](src/client-config.js) is loaded via the env var `SILEX_CLIENT_CONFIG` and served at `/silex.js`. Silex's runtime dynamic-`import()`s it and calls its default export with the `Config` instance.

Two phases:

- **`silex:grapesjs:start`** (BEFORE GrapesJS init):
  - Adds `/eac-blocks.css` and `/eac-workshop-template.css` to `grapesJsConfig.canvas.styles` so the editor iframe loads them on first paint.
  - Pushes a `eacTypesPlugin` function into `grapesJsConfig.plugins`. GrapesJS runs each plugin function during init, BEFORE parsing the saved page HTML — this is required so component types like `eac-two-col`, `eac-hero`, `eac-faq-item` exist when GrapesJS encounters those nodes (otherwise it logs "Component type not found").
  - Registers workshop section component types from the loaded workshop registry so saved `data-gjs-type="eac-ws-*"` sections parse with traits.
- **`silex:grapesjs:end`** (AFTER init):
  - Adds blocks to `editor.BlockManager` in 5 categories.
  - Idempotent re-call of `installTypesOnEditor` as a safety net.

### 3. Categories registered
- **EAC Layout** — Section, Hero, Two/Three Column, Feature Split, Stack, CTA Band, Footer
- **EAC Content** — Heading, Kicker, Paragraph, Buttons, Image, Divider, Quote, Stats, FAQ, Team Card/Grid, Gallery, Video, Logo Wall, Schedule, Pricing
- **EAC Templates** — Workshop, Artist Profile, Collective Hub
- **EAC Workshop Template** — Workshop page plus individual workshop section blocks from `src/templates/workshop/manifest.json`
- **Arts Live Slots** — Feed, Workshops, RSVP, Poll, Live, Resources (`<eac-embed>` polymorphic type)

## Files of interest

| File | Role |
|---|---|
| [`packages/silex-nextcloud-connector/index.js`](index.js) | Silex v3 plugin entry. Registers storage/hosting connectors, token redemption middleware, and the `/eac-blocks.css` route. Hoists layers in the express stack. |
| [`packages/silex-nextcloud-connector/src/client-config.js`](src/client-config.js) | The browser-side plugin. Default export wires `:start` (canvas.styles + plugins) and `:end` (BlockManager). |
| [`packages/silex-nextcloud-connector/src/editorAssetsMiddleware.js`](src/editorAssetsMiddleware.js) | `app.get('/eac-blocks.css', ...)`, `/eac-workshop-template.json`, and `/eac-workshop-template.css` route handlers. |
| [`packages/silex-nextcloud-connector/src/workshopTemplateRegistry.js`](src/workshopTemplateRegistry.js) | Reads the workshop manifest, section HTML/CSS, and shared tokens from disk. |
| [`packages/silex-nextcloud-connector/src/eac-blocks.css`](src/eac-blocks.css) | All EAC tokens (`--eac-bg`, type/spacing scale) + class rules consumed by both the editor canvas AND the public site (via `silex-layout.tsx`). |
| [`packages/silex-nextcloud-connector/src/templates/workshop/manifest.json`](src/templates/workshop/manifest.json) | Workshop section order, optionality, traits, CMS fields, and Silex labels. |
| [`docker-compose.yml`](../../docker-compose.yml) | Sets `SILEX_SERVER_CONFIG` and `SILEX_CLIENT_CONFIG` env vars; bind-mounts `./packages/silex-nextcloud-connector` to `/silex/extensions/silex-nextcloud-connector` (ro). |

## Runtime checks

After changing connector assets, restart Silex and verify:

- Network: `/silex.js`, `/eac-blocks.css`, `/eac-workshop-template.json`, `/eac-workshop-template.css` return 200.
- Console: `[eac-client-config] plugin entry executed`, `[eac-client-config] installed`, and `[eac-client-config] workshop template installed` appear.
- Blocks panel: `EAC Workshop Template` category contains `Workshop page` and individual section blocks.

## History (for context)

1. **Started with**: a `/eac-silex-blocks.js` endpoint that monkey-patched the editor DOM and listened for `canvas:frame:load`. Fragile and non-idiomatic.
2. **Refactored to**: the env-var-driven client config (`SILEX_CLIENT_CONFIG=/silex/extensions/silex-nextcloud-connector/src/client-config.js`) plus Express route for the CSS.
3. **Hit bug**: the CSS route layer was hoisted to position 0 in `app._router.stack`, ahead of `expressInit`, causing every CSS request to crash the Node process with `TypeError: res.set is not a function`. Fixed by hoisting to `cookieSession + 2`.
4. **Hit warning**: `Component type 'eac-two-col' not found` (and friends). Caused by registering types in `:end` (after GrapesJS already parsed the page HTML). Fixed by registering types via the `grapesJsConfig.plugins` array during `:start` instead.
5. **Current state**: All HTTP endpoints clean, no server errors, but UI not showing blocks. Awaiting browser DevTools output to diagnose client-side plugin execution.
