# Silex 3.9 Upgrade + Capability Adoption — Execution Brief

Date: 2026-09-05
Status: **Phase 0 DONE & verified** (2026-09-05). Phases 1–3 not started. This brief
captures the research + the Phase 0 implementation so a following session can continue.

## Phase 0 result (done)

Silex **3.9.0** runs in a custom image with the Nextcloud connector, verified at the HTTP
layer. What shipped:

- `packages/silex/Dockerfile` — `FROM silexlabs/silex-platform:${SILEX_VERSION:-3.9.0}` + a
  COPY of the deploy-config override. **Correction (2026-09-06):** `silexlabs/silex` on Docker
  Hub is a *deprecated Autobuild name* frozen at 3.7.0 (last push 2026-06-16) — Silex 3.8+
  replaced Autobuild with `.github/workflows/docker.yml`, which publishes only
  **`silexlabs/silex-platform`**. That image IS current (`:latest` = 3.9.0, `:canary` = 3.10)
  — it's what v3.silex.me and the CapRover app run. So "3.9 is npm-only" was wrong; there is a
  maintained image, just under the other name. We still layer our own override because
  silex-platform bundles the SaaS dashboard (see next bullet). Image ~1.5 GB (it ships the
  full monorepo tree); a `FROM node:24` + `npm i @silexlabs/silex` alt is ~370 MB — noted in
  the Dockerfile, connector wiring identical. Both verified booting with the connector.
- `packages/silex/eac-deploy-config.js` — baked over `@silexlabs/silex/server/deploy/.silex.js`
  at build time. Silex's `configFilePath` is hardcoded (not env-configurable) and the packaged
  default is "the full SaaS" — a multi-site dashboard whose `/` route 302-redirects before the
  editor loads, plus onboarding + FTP connectors. Ours registers **only** `StaticPlugin` (the
  editor client). It must NOT touch connectors (upstream `initConnectors()` does
  `setStorageConnectors([])` first, which would wipe ours).
- `packages/silex-nextcloud-connector/index.js` — rewritten for 3.9 / Express 5. **The
  `app._router.stack` hoisting is deleted, not worked around.** In 3.9 the editor's static
  router registers on `ServerEvent.STARTUP_START`; `loadUserConfig` (SILEX_SERVER_CONFIG) runs
  before `loadSilexConfig` (deploy config), and component-emitter fires listeners in
  registration order — so our STARTUP_START handler runs first and `app.use(tokenRedeem)` +
  the `/eac-*` routes land ahead of the static router with zero stack surgery. `ServerEvent`
  value is the literal `"startup-start"` with a `require("@silexlabs/silex").events` primary.
- `packages/silex-nextcloud-connector/src/{auth,editorAssetsMiddleware,NextcloudStorage,NextcloudHosting,webdav}.js`
  — **no changes needed**. The 3.9 connector API contract (`readWebsite`/`updateWebsite`/
  `writeAssets`/`readAsset`/`publish(session,id,files,jobManager)` where
  `jobManager = {startJob,jobSuccess,jobError}`, `ConnectorType.STORAGE === "STORAGE"`) matches
  what the connector already implements. `auth.js` Express 5: `req.query` + the `new URL(...)`
  fallback both work, `res.redirect(302, path)` still supported.
- Deleted dead code: `src/editorBlocksMiddleware.js`, `src/editor-blocks.js` (old
  script-injection approach, superseded by `client-config.js`), `packages/silex-canary/`.
- `docker-compose.yml` `silex` service → `build: packages/silex/Dockerfile`; dropped the
  stale `SILEX_DATA_PATH`/`SILEX_HOSTING_PATH`/`SILEX_DEFAULT_WEBSITE_ID` env + `silex_data`
  volume (unused with Nextcloud connectors); added `SILEX_SESSION_SECRET` + `ARTS_INTERNAL_URL`.

Verified (container smoke): `GET /` → editor shell + `js/main.*.js`; `GET /silex.js` → our
client config; `/eac-blocks.css` + `/eac-*-template.json` → 200; `GET /?t=fake` → 401
"Editor session expired" (token MW intercepts before static `/`); `/api/connector/?type=STORAGE`
→ our `nextcloud-storage`; built client bundle still emits `silex:grapesjs:start/end` +
`silex:startup:end` (so `client-config.js` block wiring stays valid).

**Browser smoke: PASSED (2026-09-06).** Driven headlessly over CDP (chromium in a container on
`eac-network`, since the TrueNAS host lacks the GUI libs). Against the real `silex` service:

```
hasEditor: true          grapesjs 0.23 initialised
blockCount: 97
categories: Basics, Media, Elements, forms, Eleventy,
            Arts Live Slots, EAC Layout, EAC Content, EAC Templates,
            EAC Workshop Template, EAC Dossier Template, EAC Enneagram Template
console:    [eac-client-config] plugin entry executed
            … workshop/dossier/enneagram css seeded + template installed
            [eac-client-config] installed
page errors: none
```

So `DomComponents.addType`, `BlockManager.add` and `Css.addRules` all work on grapesjs 0.23 —
the one real unknown from the version jump. A control run without `SILEX_SERVER_CONFIG` gave
52 blocks and only the 3 hardcoded categories (the `/eac-*` routes 404), confirming the
connector's asset middleware is what supplies the other 45 template blocks.

Note `document.body` stays `silex-loading` without a redeemed token — that's the login overlay;
GrapesJS and every block are fully initialised underneath. An early `--dump-dom` read of that
as "stalled" and was misleading; the CDP probe is the accurate signal.

**Still not covered**: a Save/Publish round-trip to Nextcloud. That needs a real one-time token
(a signed-in owner opening the editor from arts-collective `/hub`), so it's a human-at-a-browser
step, not something the headless probe can synthesise.

## New facts learned in Phase 0 (feed into Phases 1 & 3)

- **CMS / data sources are built into `@silexlabs/silex` 3.9** — no plugin to install. The
  client bundle carries `DataSourceManager` + `cmsConfig`; configure via `config.cmsConfig = {…}`
  in the client config. Publication runs an **eleventy/11ty** data pass (`editor/grapesjs/cms/`,
  `eleventy.ts`, `silex:publish:data`). Phase 1's "which plugin" question is moot — it's
  "how do we configure the built-in CMS + point it at an EAC GraphQL schema + decide
  publish-time vs request-time resolution".
- **No MCP server in the npm package** (`grep mcp` → nothing; README's `localhost:6807/mcp` is
  the **desktop** app). Confirms Phase 3 for self-hosted server Silex = build our own
  (deterministic `website.json` scaffolder), not "enable Silex's MCP".
- `publish()` hands the hosting connector fully-resolved file contents (`{path, content}`),
  so by default data is resolved at **publish time** (client-side / 11ty). Request-time
  resolution (Phase 1 recommendation) means configuring the CMS to emit expressions and
  resolving them in `silex-render` — still an open design decision.

---

## Phase 1 — decision reversed, and what shipped (2026-09-05)

**Decision 1b reversed: no GraphQL endpoint.** Reading the data-source internals
(`editor/grapesjs/cms/`, `@silexlabs/grapesjs-data-source`) showed the cost is wrong for us:
bindings are stored as structured token arrays (`{type, fieldId, dataSourceId, typeIds, kind}`)
**inside each site's `website.json`**, and resolved through an 11ty pass at publish time. So
we would (a) maintain a GraphQL schema over our own Postgres purely for editor introspection,
(b) freeze bindings per-site so a template fix never reaches existing sites, (c) fight the
11ty pipeline for live data, (d) couple to plugin internals that aren't a public contract —
all to buy "owners visually rebind arbitrary fields", which decision **1d** explicitly ruled out.

**Adjusted hybrid boundary** (user approved the hybrid concept; this moves the seam):
- **Our engine** binds EAC data (Postgres) into templates at request time.
- **`<eac-embed>`** React islands stay for live/interactive (RSVP, feed, counts, forms).
- **Silex's native data-source stays enabled but unused** — free capability if an org ever
  wants a genuine external API (WordPress/Strapi).

### What shipped: `@elkdonis/cms-bindings/engine`

The manifest already declared *what data* (`cmsFields`) and *what hooks* (`traits`); the edge
between them lived as 388 lines of regex in `workshop/render.ts` that had to be hand-synced
with both. Now the manifest declares the edge too, and one engine reads it for every template.

- `src/engine/types.ts` — binding kinds: `text` `html` `attr` `style` `class` `show` `list`;
  `from` (dotted paths), `format` (named), `join`, `template`, `fallback`, `omitWhenEmpty`.
  A trait may carry an **array** of bindings (one `<img>` needs both `src` and `alt`).
- `src/engine/path.ts` — prototype-safe dotted-path resolver.
- `src/engine/formatters.ts` — named registry (date/time/price/level/format/registrationCta/
  startsIn/spots/sessionCount…/cssUrl/first). **Manifest declares wiring; formatters hold
  domain logic** — that's what keeps a homegrown expression language out of the JSON.
- `src/engine/apply.ts` — parses with `node-html-parser` (round-trip byte-identical, incl.
  `<style>` and `<eac-embed>`). Bindings are **scoped per section** via the
  `data-gjs-type="<id>"` every template root carries — necessary because `ctaLabel` exists in
  the workshop nav, hero *and* register block meaning three different things.
- `src/engine/validate.ts` — cross-checks manifest ↔ HTML hooks ↔ sample context.
- `src/node.ts` — filesystem template/manifest loading (separate entry so the main entry
  stays browser-safe).
- `src/workshop/context.ts` — `toWorkshopContext()`. `workshop.*` keeps snake_case column
  names so `cmsFields: ["threads.scheduled_at"]` and `from: "workshop.scheduled_at"` read as a pair.

**Workshop template:** 32 bindings across 7 sections in `manifest.json`. **0 errors.**

**`silex-render/silex-site.tsx` now binds before sanitizing.** The old order sanitized and
*then* injected, so everything a binding wrote (including `threads.body`, authored rich text)
bypassed DOMPurify entirely — a latent stored-XSS for anyone with workshop edit rights.

### Two real bugs the validator/e2e caught on first run

1. `eac-ws-facilitator` has `roleTitle` and `websiteUrl` hooks that **no column backs** and the
   old renderer never bound → every published page has been showing lorem placeholder text.
   Needs a call: add columns, or delete the hooks. (Currently 2 warnings.)
2. The facilitator portrait bound `src` but not `alt`, so every page described the photo as
   *"Photo of Dana Kuroda"* (the template's placeholder). Fixed via the array-binding form.

### Verification
`pnpm --filter @elkdonis/cms-bindings test:engine` → 24 pass (incl. escaping, injected-script
neutralisation, nested same-tag elements the regex could not do, list cloning, round-trip).
`… validate:template` → 32 bindings, 0 errors. `… type-check` → clean.

---

## The wizard / binding / template-bug pass (2026-09-06)

Three items from the authoring review, executed.

### 3 — the two facilitator hooks: bound, not deleted
`roleTitle` had backing data (`artist_profiles.role_title`, added by migration 073) — added
`facilitator_role` to `WorkshopPageData` + the `getOrgWorkshopForTemplate` query +
`toWorkshopContext`, and a manifest binding (`omitWhenEmpty`). `websiteUrl` had none (a
website lives in `users.social_links` JSONB, not a scalar) — **deleted the hook** from
`eac-ws-facilitator.html`. Validator now reports **0 warnings**.

### 2 — binding migration
- **`eac-ws-schedule` / `eac-ws-gallery` moved to `list` bindings.** The `<ol>` / `.grid` is
  the container (`data-trait`), its first child is the row/tile template the engine clones.
  Each section root also carries a `show` hook so the whole section drops when there's no data
  (gallery's is an OR over images-or-video — `show` now treats an array `from` as "any non-empty").
  **`buildScheduleHtml` / `buildGalleryHtml` deleted** — page design lives in the template file now.
- **`cms-bindings/src/workshop/render.ts` deleted** (the 388-line regex renderer +
  `renderWorkshopTemplate` + `applyWorkshopTraits` + the `set*Trait` helpers).
  `arts-collective/src/lib/cms/workshop-render.ts` rewritten onto `applyManifestBindings` +
  `@elkdonis/cms-bindings/node`. Its 3 callers (OfferingPage, /preview/workshop,
  /sites/[slug]/[contentSlug]) are unchanged — same function signature.
- **`dossier/render.ts` kept working** — it only used the 4 `set*Trait` regex helpers; those
  are inlined into it with a header pointing here. Dossier's own migration to a `bindings`
  map is the remaining piece.
- **CI:** `validate:template` now runs inside `cms-bindings`' `check-types` script, so
  `pnpm check-types` (the repo gate) fails on binding drift. Added a `test` turbo task +
  root `pnpm test` running the 24 engine tests + validation.
- Workshop template: **38 bindings, 10 sections, 0 errors, 0 warnings.**

Still open: port `dossier` / `enneagram` / `portfolio` manifests to `bindings` (they don't
break without it — `applyManifestBindings` is a no-op on a section with no bindings — they
just don't get DB values yet).

### 1 — the wizard, wired to a real renderer
`cms-ui/wizard` had the state machine (`WizardProvider`), nav and step indicator but **no way
to render a step's fields** — that missing piece is why it was never wired to a surface. Built:

- `packages/cms-ui/src/wizard/fields.tsx` — `WizardFieldControl`: one labelled control per
  input type (text/textarea/richtext/url/number/date/datetime/select/boolean/color/custom),
  plain HTML + `hsl(var(--token))`, zero component-library dependency.
- `packages/cms-ui/src/wizard/TemplateWizard.tsx` — the assembled shell: `WizardProvider` +
  `StepIndicator` (with per-step "required field still empty" flags) + the field list +
  bespoke `render` slot + `WizardNav`. Skeleton until hydrated. This is the **default**
  authoring surface — no canvas, no CSS.
- `packages/cms-bindings/src/workshop/wizard-ui.ts` — `toWizardUiSteps()` maps
  `buildWorkshopWizardSteps()` output onto the cms-ui shape (collapsing `image`/`gallery`/
  `media`/`compound` to `custom` fields carrying a `slot`); `wizardAnswersToColumns()` folds
  answers (keyed by trait) back to column values for the save handler.
- `packages/cms-ui` added to `arts-collective` deps + `transpilePackages` + a `@source`.
  (`@elkdonis/cms-bindings` was missing from `transpilePackages` too — fixed.)

Verified end to end (`scripts/wizard-smoke.mts`): the workshop manifest yields **13 steps**
(6 template + 7 platform) with every field mapped to a control and a `table.column` target.

**Remaining for #1** (a focused pass, ~half a day — the spine + glue are done and tested):
- A route — `apps/arts-collective/src/app/hub/workshops/[orgSlug]/guided/page.tsx` — that
  calls `buildWorkshopWizardSteps` → `toWizardUiSteps`, renders `<TemplateWizard>`, and wires
  `onSave` through `wizardAnswersToColumns` → `saveWorkshopAction`.
- `custom` slot renderers the route supplies: Nextcloud image picker, gallery editor,
  compound sub-fields (`eyebrowText` = discipline + series_label; `priceFull` = price +
  currency), session list. `platform:sessions` / `materials` / `talk` / `email` / `publish`
  stay bespoke components keyed on step id.
- Point new-org / "new workshop" at `/guided`; keep `WorkshopForm` reachable as the advanced
  path until the guided flow has parity.

---

_Original research (pre-Phase-0) follows._

## Goal (from the user)

Move the EAC Silex integration from its current pinned image to **Silex v3.9.0 stable**,
and adopt three upstream capabilities that landed 3.7.3 → 3.9.0, wired into the connector,
the templates, and `@elkdonis/silex-render` so **every Silex-backed org site** gains them:

1. **Data sources / CMS backend types** — priority, do first
2. **CSS Variables plugin** — theme-able templates + dark-mode foundation
3. **MCP / AI integration** — expose Silex editing to an AI agent

Recommended sequencing is **Phase 0 → 2 → 1 → 3** (see "Sequencing note" below) — the
user asked for 1 first; that's viable but 2 is the lower-risk warm-up and de-risks 1.

---

## Current state (what's in the repo)

Pipeline (see `docs/silex-publishing-pipeline.md` for the full picture):

```
Silex editor (:6805, silexlabs/silex:latest)
  + connector: packages/silex-nextcloud-connector  (SILEX_SERVER_CONFIG + SILEX_CLIENT_CONFIG, bind-mounted)
  → website.json + assets → owner's Nextcloud folder   (NextcloudStorage.js)
  → "Publish" → static .html/.css → Nextcloud/.../published + .eac-publish.json   (NextcloudHosting.js)
      ↓  (WebDAV download, server-side)
@elkdonis/silex-render  (packages/silex-render, consumed as source via transpilePackages)
  silex-site.tsx:  download → sanitizeSilexHtml → rewrite /css|/assets → applyWorkshopTraits → renderSilexHtmlWithEmbeds
      ↓
host app:  apps/arts-collective  (subdomain sites),  apps/hidden-enneagram  (:3012, dedicated),
           apps/artdirect  (dossier CSS route only)
```

Binding today is **two hand-rolled mechanisms**, both regex string-substitution:

- `data-trait="name"` / `data-href-trait` / `data-gjs-type` slots in template HTML →
  `applyWorkshopTraits()` in `packages/cms-bindings/src/workshop/render.ts` fills them from
  the org's primary published workshop row.
- `<eac-embed data-eac-component="…">` placeholders → `renderSilexHtmlWithEmbeds()` in
  `packages/silex-render/src/embeds.tsx` swaps each for a live React server component
  (org-feed, workshop-cards, rsvp, poll, live, resources, inquiry, login, media-upload,
  directory).

Templates: `packages/silex-nextcloud-connector/src/templates/{workshop,dossier-classified,enneagram,portfolio}/`
— each is `manifest.json` (sections[], pages[], cssOrder, tokens) + `html/eac-*.html` +
`css/eac-*.css` + `tokens/*.css`. Registered into GrapesJS by `src/client-config.js`;
served to the editor by `src/editorAssetsMiddleware.js` (`ASSET_ROUTES`).

The `tokens/*.css` files are **already CSS-custom-property files** (`--eac-*`, `--eac-ws-*`).
`workshop/tokens/eac-tokens.css` even says `--eac-ws-*` values are "merged in from
`workshop_pages.theme_overrides` on the server" — i.e. a per-org theming hook already
exists in intent, just not wired to a UI.

---

## Hard blockers discovered this session

### 1. `silexlabs/silex:latest` is frozen at 3.7.0 — but it's the wrong repo (corrected 2026-09-06)

`silexlabs/silex` on Docker Hub last pushed 2026-06-16 (3.7.0) because it was a **Docker Hub
Autobuild** image and Silex 3.8+ dropped Autobuild. The replacement — `.github/workflows/docker.yml`,
tag-triggered — publishes **`silexlabs/silex-platform`** instead: `:latest` = 3.9.0,
`:canary` = 3.10.0-canary, versioned tags per release. That's the image behind v3.silex.me and
the CapRover one-click app. So a current image exists; only the name changed.

`silex-platform` bundles the full SaaS (dashboard + onboarding + FTP connectors), so we still
build a thin layer over it with our deploy-config override. Two viable bases, both verified:
- **`FROM silexlabs/silex-platform:3.9.0`** + COPY override. Upstream's exact build, trivial
  Dockerfile, ~1.5 GB. **Current choice.**
- **`FROM node:24` + `npm i @silexlabs/silex@3.9.0`** + COPY override. ~370 MB, we assemble it.
- ~~release binary~~ — the 2026-04 session proved it won't load a Node `SILEX_SERVER_CONFIG`. Dead end.

### 2. Silex 3.9 runs on **Express 5** — the connector's middleware hoisting breaks

`@silexlabs/silex@3.9.0` depends on `express@5.2.1` (verified from the npm manifest; current
repo image is 3.7.0 → Express 4).

`packages/silex-nextcloud-connector/index.js` does:
```js
const router = app._router || app.router;      // app._router REMOVED in Express 5
stack = router.stack;                            // internal shape changed
hoistLayer(stack, c => c.route && c.route.path === routePath, ...)   // path-to-regexp v8, layer.route API changed
```
and `src/auth.js` / `src/editorBlocksMiddleware.js` parse `req.query` by hand off
`req.originalUrl` (a workaround from the 2026-04 session because `req.query` was unreliable
in the hoisted position — Express 5 makes `req.query` a getter, changing this again).

→ **The connector's "register middleware then splice it to the front of `app._router.stack`"
strategy must be redesigned for Express 5.** Options, cleanest first:
- Use the Silex plugin API's documented hook to add middleware *before* Silex's own routes
  rather than hoisting after the fact. Check whether `@silexlabs/silex-plugins` exposes a
  pre-route event in 3.9 (the connector already listens for `ServerEvent.STARTUP_START` via
  `require('/silex/dist/server/server/events')` — verify that path still exists in the npm
  layout, it may now be `@silexlabs/silex/dist/...`).
- If no pre-route hook: mount our own sub-router/`app.use` at STARTUP_START which in Express
  5 *does* run before later-registered routes as long as Silex registers its catch-all
  after plugin load. Needs testing — the 2026-04 notes say Silex registered `GET /` during
  `addRoutes()` *before* plugins load, which is why hoisting was needed at all.
- Worst case: front Silex with a tiny Express/Node reverse-proxy shim in the same container
  that owns `/`, `/api/silex/auth` redemption, and the `/eac-*` asset routes, proxying
  everything else to Silex. More moving parts but fully decoupled from Silex internals.

### 3. GrapesJS bumps from ~0.21 (Silex 3.7) to **0.23.2** (Silex 3.9)

Our custom `editor.DomComponents.addType(...)`, `editor.Css.addRules(...)`,
`editor.BlockManager.add(...)`, `editor.Panels.getButton(...)` calls in `client-config.js`
are all stable GrapesJS API and *probably* fine, but must be smoke-tested against 0.23.
`grapesjs-parser-postcss` is now a Silex dep — CSS parsing behaviour for our seeded template
CSS may differ.

---

## Sequencing note

| Phase | What | Risk | Why this order |
|---|---|---|---|
| **0** ✅ | Build 3.9 image; port connector to Express 5; re-verify blocks/templates/publish/render end-to-end | High | **DONE** (HTTP-layer verified; browser smoke pending). Nothing else can land until Silex 3.9 runs with our connector. |
| **2** | CSS Variables plugin | Low–med | Self-contained. Templates are already `--var` files. Gives a visible win and exercises the 3.9 plugin-wiring path before the hard one. |
| **1** | Data sources | High | The big architectural lift: needs a new GraphQL endpoint + a request-time expression resolver in `silex-render`. Wants Phase 0 rock-solid first. |
| **3** | MCP / AI | Unknown | Smallest immediate value, most upstream uncertainty (see Phase 3). Do last. |

The user's stated priority is **1 first**. If we honour that literally, Phase 0 still comes
first, then 1, then 2, then 3 — the only cost is doing the risky integration before the
low-risk warm-up. Flagging for the user to confirm.

---

## Phase 0 — Silex 3.9 + connector on Express 5 (prerequisite)

**Files**
- `packages/silex-canary/Dockerfile` → repurpose into the real image (`packages/silex/Dockerfile`?):
  Node 24 slim base, `npm i @silexlabs/silex@3.9.0`, keep `SILEX_*` env, `CMD silex`.
- `docker-compose.yml` `silex` service: `image: silexlabs/silex:latest` → `build: ./packages/silex`
  (or a pinned `ghcr.io` push). Keep the bind-mount of the connector + the `SILEX_*_CONFIG` env.
- `packages/silex-nextcloud-connector/index.js` — rewrite middleware install for Express 5.
- `packages/silex-nextcloud-connector/src/auth.js`, `src/editorBlocksMiddleware.js` — revisit
  the `req.originalUrl` query parsing now that Express 5 `req.query` semantics changed.
- `packages/silex-nextcloud-connector/src/{NextcloudStorage,NextcloudHosting}.js` — verify the
  connector base-class contract (`connectorType`, `publish(session, websiteId, files, jobCbs)`,
  `getUser`, `isLoggedIn`) is unchanged in 3.9's `@silexlabs/silex` connector API. Check the
  `require('/silex/dist/server/server/events')` path against the npm package layout.

**Verification checklist** (from `SILEX_SESSION_HANDOFF.md` "Next Best Steps", still valid)
- `curl -i http://127.0.0.1:6805/eac-blocks.css` → 200 text/css
- `curl http://127.0.0.1:6805/` contains the injected block script / editor HTML
- Launch from arts-collective `/hub` with a fresh token → connector redeems it *before* the
  editor HTML is served (previously-used tokens return 410).
- Editor loads all block categories: EAC Layout / Content / Templates, Workshop / Dossier /
  Enneagram, Arts Live Slots.
- Save writes `website.json` to Nextcloud; Publish writes `published/*.html` + `.eac-publish.json`.
- `pnpm --filter arts-collective exec tsc --noEmit`
- Public smoke: `curl -H 'Host: test.localhost:3007' http://127.0.0.1:3007/` — no raw
  `<eac-embed>` leak, embeds + template sections render.
- `apps/hidden-enneagram` (`hiddenenneagram.com` / :3012) renders `/` and `/[page]`.

---

## Phase 1 — Data sources (priority)

### What it actually is (upstream)

- Plugin: `@silexlabs/grapesjs-data-source`. **GraphQL only** ("supports only GraphQL for
  now"). Compatible backends via GraphQL: WPGraphQL, Strapi, Directus, Supabase, Drupal,
  generic GraphQL. Silex 3.7.0 added "backend types" (Strapi / Supabase / WordPress /
  Generic GraphQL) that just tune which schema fields show in the expression picker.
- In the editor: the owner picks a **data source**, then binds component properties
  (innerHTML, an attribute, visibility, a CSS class, a loop) to **expressions** built from
  schema tokens (`post.data.attributes.title`). "States" (public/private) are stored **on the
  component** in `website.json`.
- Published output: LiquidJS expressions in the HTML; Silex's data-driven publish resolves
  them with an **11ty build** ("publish to static output (11ty) with dynamic content resolved
  at build time", v3.5.1 notes). Silex bundles `@apollo/client` for the editor-side
  introspection/preview.

### EAC design decision — where do expressions resolve?

**Option A — request-time in `silex-render` (recommended, fits the current architecture).**
Published HTML keeps the LiquidJS expressions. `@elkdonis/silex-render` gains a Liquid render
pass that runs at request time with a per-org data context assembled from Postgres. Keeps the
"static skeleton + live data" model, no 11ty in the publish path, data is always fresh,
switching layout_mode back to default still works.
- New: `packages/silex-render/src/liquid.ts` — `renderLiquid(html, context)` using the
  `liquidjs` npm package, run **after** sanitize, **before** `renderSilexHtmlWithEmbeds`,
  with output re-sanitized.
- New: a data-context assembler — `buildOrgDataContext(org)` returning
  `{ workshops[], threads[], profiles[], feed[], org }` from `@elkdonis/services` /
  `packages/silex-render/src/queries.ts`. This is the same data the `<eac-embed>` components
  already fetch — consolidate.
- `applyWorkshopTraits` becomes a legacy path; new templates use Liquid expressions instead
  of `data-trait`. Keep both during migration.

**Option B — publish-time 11ty (Silex-native).** Rejected unless the user wants it: stale
data until re-publish, needs 11ty in `NextcloudHosting`, breaks the live-island model.

### The new building block: an org-scoped GraphQL endpoint

The plugin needs a GraphQL schema to introspect. Build a **read-only, org-scoped** endpoint:
- `apps/arts-collective/src/app/api/graphql/route.ts` — `graphql-yoga` (light) or Apollo.
  Schema hand-written over existing `@elkdonis/services` queries: `workshops`, `threads`,
  `feed`, `profiles`, `org`. **No mutations.**
- Org scoping + auth: the **silex token bridge** (`src/lib/silex-tokens.ts` +
  `/api/silex/auth`) pre-seeds the data-source connection (endpoint URL + org id + a
  short-lived read token) into the Silex session, so owners **never see or configure a URL**.
  Connector work in `src/auth.js` (store `graphqlUrl` / `graphqlToken` alongside the
  Nextcloud creds) and `src/client-config.js` (register the data source with `grapesjs-data-source`
  from those session values).
- Same endpoint powers the request-time resolver in Option A (or query `@elkdonis/services`
  directly server-side and skip GraphQL at render time — GraphQL is only needed for the
  *editor's* schema introspection).

### Files (Phase 1)
- `packages/silex-nextcloud-connector/src/client-config.js` — load `grapesjs-data-source`,
  register the EAC data source from session config, add a "Bind to data" affordance to our
  template section types.
- `packages/silex-nextcloud-connector/src/auth.js` + `apps/arts-collective/src/app/api/silex/auth/route.ts`
  + `src/lib/silex-tokens.ts` — carry GraphQL endpoint + read token through the bridge.
- `apps/arts-collective/src/app/api/graphql/route.ts` — NEW endpoint.
- `apps/arts-collective/src/app/api/silex/graphql/[slug]/route.ts` — NEW, org-scoped proxy
  the editor calls (CORS for the :6805 origin), or make `/api/graphql` accept the read token.
- `packages/silex-render/src/liquid.ts` — NEW request-time resolver.
- `packages/silex-render/src/silex-site.tsx` — insert the Liquid pass.
- `packages/silex-render/src/queries.ts` — `buildOrgDataContext`.
- `packages/utils/src/sanitize-silex.ts` — make sure `{{ … }}` / `{% … %}` survive
  sanitization pre-resolution (they're text nodes, should be fine) and that the post-resolve
  re-sanitize is applied.
- Templates: add Liquid-bound variants of `workshop` sections; new `docs` note.
- `apps/hidden-enneagram`, `apps/artdirect` — pick up the new render path via the shared package.

### Risks (Phase 1)
- GraphQL endpoint is real new surface area — schema design, auth, N+1, caching.
- LiquidJS + DOMPurify ordering: resolve → re-sanitize (a bound value could contain markup).
- `grapesjs-data-source` editor preview wants live introspection from the :6805 origin →
  CORS + the read token must be right or the editor shows an empty schema.
- Loops in Liquid producing large DOM — cap + paginate in the data context.

---

## Phase 2 — CSS Variables plugin

### What it is (upstream)
`@silexlabs/grapesjs-css-variables` — manage CSS custom properties from the Style Manager.
Options: `enableColors` / `enableSizes` / `enableTypography` (default true), `presets:
[{name,value,type}]`, `i18n`. Command `editor.runCommand('open-css-variables')`. Variables
"saved and restored with site data" (i.e. in `website.json`, emitted into `editor.getCss()`).
Silex 3.7.3 shipped it as the "foundation for theme-able templates and dark mode".

### EAC design
- **Editor**: load the plugin in `client-config.js`, seed `presets` from each template's
  `tokens/*.css` (parse `--eac-*` decls → presets) so owners open the editor with the
  template's design tokens already listed and editable.
- **Per-org overrides**: the plugin writes changed variable values into `website.json` →
  they land in the published stylesheet automatically. That already gives per-org theming
  with **no server work**. The pre-existing `workshop_pages.theme_overrides` idea can be
  retired or kept as an admin-side override — decide with the user.
- **Dark mode**: define a `:root` + `@media (prefers-color-scheme: dark)` (or
  `[data-theme]`) block in each `tokens/*.css` using the variables, so a template that only
  ever sets variable *values* gets dark mode for free. `sanitize-silex.ts` already keeps
  `<style>` and `@media`.
- **`silex-render`**: mostly nothing — variables are plain CSS. Just make sure the compound/
  embed CSS injected by `silex-site.tsx` (`COMPOUND_STYLES`) and `embeds.tsx` also reads
  from the same `--eac-*` variables so live islands match the owner's theme.

### Files (Phase 2)
- `packages/silex-nextcloud-connector/src/client-config.js` — load plugin, build presets.
- `packages/silex-nextcloud-connector/src/templates/*/tokens/*.css` — add light/dark blocks;
  normalise variable names across templates (`--eac-color-*`, `--eac-font-*`, `--eac-radius-*`).
- `packages/silex-nextcloud-connector/src/eac-blocks.css` + `packages/silex-render/src/silex-site.tsx`
  `COMPOUND_STYLES` + `packages/silex-render/src/embeds.tsx` — consume `--eac-*` vars.
- `packages/silex-nextcloud-connector/docs/workshop-template-css.md` — document the token set.

### Risks (Phase 2)
- Low. Main gotcha: our template CSS is currently **seeded into the editor** via
  `editor.Css.addRules(cssText)` with a de-dupe marker check; the variables plugin also
  reads/writes rules — make sure seeding still runs once and the plugin picks up seeded
  `:root` vars.

---

## Phase 3 — MCP / AI integration

### What it is (upstream) — **partly uncertain, verify before building**
- Silex 3.7.3: "Silex exposes editing capabilities through MCP so AI agents can interact
  with selectors, styles, and content. Available standalone (stdio) and embedded in the editor."
- 3.8.0: "Add the `grapesjs-ai-capabilities` plugin to discover MCP tools (silex-desktop)".
- 3.10-canary: "MCP tool names corrected and style targeting made reliable for AI agents".
- **Most MCP work so far is in `silex-desktop`** (the Tauri app), exposed over stdio. Whether
  self-hosted **server** Silex 3.9 exposes an MCP endpoint (HTTP/SSE) is **not confirmed** —
  check `@silexlabs/silex` 3.9 docs/source and `grapesjs-ai-capabilities`.

### EAC options (decide after verification)
- **If server Silex 3.9 has an HTTP MCP endpoint**: gate it behind the arts-collective token
  bridge (same session-scoping as the editor), expose it to an internal agent that can
  scaffold a site from an org's data ("build me a workshop page for thread X"). This realises
  the "AI-assisted generation is still conceptual" item in `SILEX_SESSION_HANDOFF.md`.
- **If it's stdio/desktop only**: skip the Silex MCP; instead give **our own** agent a small
  toolset that writes `website.json` directly via `NextcloudStorage` (compose template
  sections + Liquid bindings deterministically — the connector already has all the section
  HTML in the registry). Lower-magic, fully under our control, no dependency on Silex MCP
  stability.

### Files (Phase 3) — sketch only
- `packages/silex-nextcloud-connector/src/client-config.js` — load `grapesjs-ai-capabilities`
  if we go the editor-embedded route.
- `apps/arts-collective/src/app/api/silex/mcp/route.ts` — NEW gateway (if server MCP exists).
- `packages/silex-render` or a new `packages/silex-scaffold` — deterministic
  `website.json` generator from a template id + an org data context (the fallback path).

---

## Open decisions for the user

1. **Sequencing**: honour "1 first" literally (Phase 0 → 1 → 2 → 3), or take the lower-risk
   Phase 0 → 2 → 1 → 3? (Brief recommends the latter; cost of "1 first" is small.)
2. **Expression resolution** (Phase 1): request-time in `silex-render` (recommended, keeps
   live data + no 11ty) vs publish-time 11ty (Silex-native, stale data). 
3. **GraphQL endpoint** (Phase 1): OK to stand up a new read-only `/api/graphql` in
   arts-collective? Preferred lib — `graphql-yoga` (small) unless you want Apollo for parity
   with Silex's editor client.
4. **`workshop_pages.theme_overrides`** (Phase 2): retire it in favour of the CSS Variables
   plugin writing straight into `website.json`, or keep it as an admin override layer?
5. **Image hosting**: build the Silex image locally via compose `build:` (simplest) or push
   a pinned image to `ghcr.io` for prod parity?
6. **MCP scope** (Phase 3): pursue real Silex MCP if the server exposes it, or go straight to
   the deterministic `website.json` scaffolder under our control?

## Reference — upstream releases 3.7.0 → 3.9.0

- 3.7.0 (2026-01): templates + site duplication; CMS backend types (Strapi/Supabase/WP/GraphQL);
  modern CSS units (`dvh`/`dvw`/`cq*`).
- 3.7.3 (2026-05): **CSS Variables plugin**; **MCP integration**; selector/`:hover`/body-style fixes.
- 3.8.0 (2026-06): desktop auto-update; background-image in Decorations panel; modified-styles
  filter; `grapesjs-ai-capabilities`.
- 3.9.0 (2026-07): **data source panel rework**; `::selection` selector; hashed editor assets;
  **Node 24 / TypeScript 6 / Express 5**; Dockerfile moved to repo root; npm publish via OIDC.
- 3.10-canary (2026-07): git-versioned websites on every save; GitLab publish reliability;
  data-source expression fixes.
