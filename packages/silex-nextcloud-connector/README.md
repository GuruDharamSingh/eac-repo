# @elkdonis/silex-nextcloud-connector

Silex v3 storage connector that persists each artist's website to their own
Nextcloud folder, authenticated by the arts-collective one-time token bridge.

## How it loads

Mounted into the Silex container and pointed at by `SILEX_SERVER_CONFIG`:

```yaml
silex:
  image: silexlabs/silex:latest
  environment:
    SILEX_SERVER_CONFIG: /silex/extensions/silex-nextcloud-connector/index.js
    SILEX_CLIENT_CONFIG: /silex/extensions/silex-nextcloud-connector/src/client-config.js
    ARTS_INTERNAL_URL: http://arts-collective:3007
  volumes:
    - ./packages/silex-nextcloud-connector:/silex/extensions/silex-nextcloud-connector:ro
```

No npm install inside the container — Node 18+ `fetch` and `Buffer` are enough.

## Auth flow

1. Owner clicks "Open editor" in the arts-collective hub.
2. Arts-collective mints a one-time token, redirects to
   `http://localhost:6805/?slug=<slug>&t=<token>`.
3. This connector's middleware sees `?t=`, calls
   `${ARTS_INTERNAL_URL}/api/silex/auth?token=<token>` once, stashes the
   per-user Nextcloud credentials in the Silex express session, and 302s to
   the clean URL (token never lingers in history).
4. Silex calls `isLoggedIn(session)` → true.
5. All subsequent storage calls use the per-user creds via WebDAV.

## File layout per artist

Inside `<nextcloudFolderPath>/silex/project/`:

- `website.json` — Silex website data
- `meta.json` — website meta (name, imageUrl, settings)
- `pages/*.json` — split page files (when Silex serializes that way)
- `assets/*` — uploaded assets

Publishing (hosting connector) writes to `<nextcloudFolderPath>/silex/published/`
— **not implemented yet**.

## Scope

- One website per session (keyed by org slug). Multi-website / admin role
  multi-org support is intentionally deferred.
- Storage connector only. Hosting (publish) connector to follow.

## EAC editor blocks

Silex loads `src/client-config.js` through `SILEX_CLIENT_CONFIG` and serves it at
`/silex.js`. That browser-side plugin registers the general EAC layout/content
blocks and fetches the connector-hosted workshop template registry.

Server-side asset routes:

- `/eac-blocks.css` — general EAC editor block styles
- `/eac-workshop-template.json` — workshop manifest plus section HTML/CSS
- `/eac-workshop-template.css` — shared workshop tokens plus section CSS

Workshop template source lives under:

```text
src/templates/workshop/
  manifest.json          section order, optionality, traits, and CMS fields
  html/eac-ws-*.html     canonical section markup
  css/eac-ws-*.css       canonical section styles
  cms/workshop.schema.md human-readable CMS contract, not a migration
src/templates/tokens/eac-tokens.css
```

At editor startup, `src/client-config.js` loads the workshop registry, registers
workshop component types/traits before GrapesJS parses saved HTML, and adds the
blocks to the `EAC Workshop Template` category as both a full `Workshop page`
block and individual reusable section blocks.

The older preview route in `apps/arts-collective` is only a development viewing
mechanism. Production/editor registration should treat this connector template
tree as the source of truth.
