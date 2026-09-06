# `packages/silex` — self-hosted Silex editor image

Build inputs for the EAC Silex 3.9 editor container (`docker-compose.yml` service
`silex`, `http://localhost:6805`).

## Why a custom image

Two facts:

1. **`silexlabs/silex` on Docker Hub is a deprecated name.** It was built by
   Docker Hub Autobuild and stopped at 3.7.0 (2026‑06‑16). Silex 3.8+ replaced
   Autobuild with a tag‑triggered workflow that publishes only
   **`silexlabs/silex-platform`** — the current canonical image (behind
   v3.silex.me and the CapRover app). `silex-platform:latest` = 3.9.0.
2. **`silex-platform` bundles the full SaaS**: a dashboard whose `/` route
   302‑redirects before the editor loads, an onboarding backend, FTP connectors.
   Silex loads that from `server/deploy/.silex.js`, a path hardcoded in
   `server/config.js` (not env‑configurable), so we bake our own minimal version
   over it.

`Dockerfile` = `FROM silexlabs/silex-platform:<ARG SILEX_VERSION>` + `COPY` the
override. Bump `SILEX_VERSION` and rebuild to move. (A leaner `FROM node:24` +
`npm i @silexlabs/silex` alternative is noted in the Dockerfile — ~370MB vs ~1.5GB.)

## Why `eac-deploy-config.js`

Silex loads a deploy config from a path hardcoded in its `server/config.js`
(`configFilePath`, **not** env-configurable), right after the `SILEX_SERVER_CONFIG`
user config. The packaged default is "the full SaaS": a multi‑site dashboard whose
`/` route 302‑redirects before the editor can render, an onboarding email backend,
and FTP/GitLab connectors from env vars.

The Dockerfile bakes `eac-deploy-config.js` over that file. Ours registers **only**
the static editor client (`StaticPlugin`). Storage + hosting connectors come from
`SILEX_SERVER_CONFIG` (`packages/silex-nextcloud-connector`), which loads first —
our deploy config must not touch connectors or it would wipe them.

## Runtime wiring (compose)

| env | points at |
|---|---|
| `SILEX_SERVER_CONFIG` | `…/silex-nextcloud-connector/index.js` — Nextcloud storage/hosting + one-time token bridge |
| `SILEX_CLIENT_CONFIG` | `…/silex-nextcloud-connector/src/client-config.js` — editor blocks/templates |
| `ARTS_INTERNAL_URL` | arts-collective origin the connector redeems `/?t=` tokens against |

The connector package is **bind-mounted** (`:ro`), so it iterates without an image
rebuild. Only a `SILEX_VERSION` bump or a change to `eac-deploy-config.js` needs
`docker compose build silex`.

## Boot order (Silex 3.9 / Express 5)

```
create(app)                     cors?, compression, body-parser, cookie-parser, cookie-session
addRoutes(app)                  GET /silex.js  → SILEX_CLIENT_CONFIG
loadConfigFiles()
  ├─ loadUserConfig()           SILEX_SERVER_CONFIG  → connector: setStorage/HostingConnectors + on(STARTUP_START)
  └─ loadSilexConfig()          eac-deploy-config.js → StaticPlugin: on(STARTUP_START)
app.use('/api', …)
start(app)                      emit STARTUP_START {app}  →  listen
                                  ├─ connector handler runs first  → app.use(tokenRedeem), GET /eac-*
                                  └─ StaticPlugin handler runs next → app.use('/', dist/client)
```

Listener registration order (connector before StaticPlugin) is what puts our
middleware ahead of the editor's static router — no `app._router` surgery, which
matters because Express 5 removed `app._router`.

## Smoke test

```bash
docker compose build silex && docker compose up -d silex
curl -s localhost:6805/                       # 200, editor shell
curl -s localhost:6805/silex.js | grep -o 'EAC Templates'   # our client config
curl -s localhost:6805/eac-blocks.css -o /dev/null -w '%{http_code}\n'
curl -s 'localhost:6805/?t=fake' | grep -o 'Editor session expired'  # token MW intercepts
curl -s 'localhost:6805/api/connector/?type=STORAGE' | grep -o nextcloud-storage
```
