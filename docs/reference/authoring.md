# Authoring surfaces and CMS

Covers how content and pages are authored across the network: the Puck page
editor (`@elkdonis/page-builder` over `@elkdonis/blocks`), the Silex visual
editor and its Nextcloud connector, the render pipeline for published Silex
pages (`@elkdonis/silex-render`), the template binding engine
(`@elkdonis/cms-bindings`), the ArtDirect dossier template, the pens library,
`@elkdonis/live-editor`, and the arts-collective wizard and workshop CMS.
Last verified: 2026-09-23 (code read, container image and env inspected,
schema and row counts queried, `validate:template` run in `eac-arts-network`;
no browser session, no Silex publish round-trip).

## Direction

The working direction (from `docs/archive/HEADLESS_CMS_DIRECTION.md`,
2026-09-07) is "one thread, many authoring surfaces, optionally one template".
Three axes are kept separate:

| Axis | Values | Where it lives |
|---|---|---|
| What it is | post, event, meeting, workshop, questionnaire, product | `threads.kind` (data, no CHECK) / `questionnaires.kind` |
| How it is authored | quick popup, full form, guided wizard, blog editor, in-place live edit, page editor | `@elkdonis/cms-ui/compose`, `cms-ui/wizard`, `live-editor`, Puck, Silex |
| How it is presented | default React page, Silex template, Puck page | `manifest.json` bindings, `organizations.layout_mode`, `site_config` / `user_pages` |

A new authoring surface should reuse an existing `kind` rather than add one.
The CMS form and the wizard are the same field list (`WizardFieldSpec`,
`field-registry.ts`) with different pacing. Media fields are always a picker
over org or personal storage, not a URL box: a pasted URL goes dead and lives
outside the org's storage (settled 2026-09-07).

Division of labour between the two visual editors (user decision 2026-09-15):
Silex/GrapesJS for static pages and templates; Puck for pages inside the
React apps. One block catalogue is meant to serve both (`BlockDef.silexRoot`,
the pens' `react` pointer); the Silex side of that bridge is not built.

On mixed sites, **Silex renders content and the React app owns the chrome**
(nav, auth, search, dialogs): `SilexSite` takes `omitSections` to drop a
template's own nav (`packages/silex-render/src/silex-site.tsx:121`).

## Current state

### Where each surface is live (2026-09-23)

| Surface | Host apps | Notes |
|---|---|---|
| Puck, org pages | `apps/danamccool` (3018, org `danamccool`), `apps/innergathering` (3015, `inner_group`) | `site_config` key `puck:<path>`; 27 rows for danamccool, 3 for inner_group |
| Puck, per-person store panels | editor `apps/art-auction/src/app/panel/[orgSlug]`; rendered on `apps/ifac/src/app/artists/[slug]/page.tsx:104` | `user_pages` (migration 157); 3 IFAC rows |
| `@elkdonis/blocks` without Puck | amrit-canada, sunjay (`section-banner`, `cycle-badge` on `[feed]` pages) | `fourthwayBookreaders` lists the dependency but imports nothing (verified by grep) |
| Silex over the page | `apps/hidden-enneagram` (3012), the one org with `layout_mode='silex'` | "Edit page" opens Silex on the current page |
| Silex as org layout | arts-collective `/sites/[slug]` when `layout_mode='silex'` (`apps/arts-collective/src/app/sites/[slug]/page.tsx:25`) | 17 orgs `default`, 1 `silex` |
| Binding engine | arts-collective workshop pages, ArtDirect dossier, hidden-enneagram `/hub` | see coverage table below |
| live-editor | arts-collective, ifac, artdirect | field popovers + CSS-var panel |
| Guided wizard | arts-collective `/hub/workshops/[orgSlug]/guided` | `/new` (WorkshopForm) stays as the advanced path |

### Puck: `@elkdonis/page-builder` + `@elkdonis/blocks`

- Package: `@puckeditor/core@0.23.0` everywhere (page-builder, art-auction,
  danamccool, ifac, innergathering). `@measured/puck` is the deprecated name
  (renamed in 0.21); do not add it.
- `@elkdonis/page-builder` entries: `.` is client-safe (`buildPuckConfig`,
  `buildEditorConfig`, `PuckEditor`, `ImageField`, `SizeField`, `ColorField`,
  `CanvasDrag`, `validatePage`, `isValidSlug`, `isValidPagePath`,
  `isValidUserPageKey`); `./server` holds the stores (`loadPage`, `savePage`,
  `listPages`, `loadUserPage`, `loadPublishedUserPage`, `saveUserPage`,
  `listUserPages`), which import `@elkdonis/db`.
- Org page store: `site_config(org_id, key, value)`, key `puck:<slug>`
  (`packages/page-builder/src/store.ts:27`), capped at 512 KB
  (`store.ts:75`), written with `db.json()`. No migration; `org_id` is half the
  primary key.
- Person page store: `user_pages(user_id, org_id, key, data, status,
  reviewed_by, reviewed_at)` (migration 157, applied). Key `store:N`. Status
  uses the thread vocabulary `draft/pending/published/archived`; an org opts in
  with `organizations.member_store_panels` (default false; IFAC set true in
  migration 158). Rendered with `STORE_PANEL_BLOCKS`
  (`packages/blocks/src/index.ts:141`, 12 blocks).
- Validation: `validatePage` (`packages/page-builder/src/validate.ts:61`) is
  shallow and non-throwing (root object, content array, nested slot arrays,
  missing/duplicate ids, unknown types). `loadPage` validates on read and
  returns `null`, so a malformed row is a 404, not a 500. Verified 2026-09-15
  per memory: four malformed shapes that returned 500 now return 404.
- Published render: import `Render` and `resolveAllData` from
  `@puckeditor/core/rsc` and call `resolveAllData` before `<Render>`
  (`apps/danamccool/src/app/[[...path]]/page.tsx:6,87`,
  `apps/innergathering/src/app/p/[slug]/page.tsx:9,60`). `<Render>` applies no
  defaults and runs no resolvers.
- Resolvers are injected per environment: the editor config fetches
  `/api/blocks/thread-feed` (browser, no DB); the server config calls
  `loadThreadFeed` directly. The route ignores any `orgId` parameter and uses
  the deployment's own org (`apps/danamccool/src/app/api/blocks/thread-feed/route.ts:25`).
  `resolveData` marks every key it owns `readOnly`
  (`packages/page-builder/src/config.tsx:326-337`).
- Interactive blocks: the adapter strips the `puck` context before rendering
  a block with `def.interactive` (`config.tsx:353-355`).
- Editor: `metadata={{orgId, slug}}` is the channel to blocks and resolvers;
  `key={slug}` forces a remount (Puck reads `data` once); `beforeunload`
  guards unsaved work (`packages/page-builder/src/editor.tsx:102`).
- `blocks.css` is imported app-wide (`apps/innergathering/src/app/layout.tsx:8`,
  `apps/danamccool/src/app/layout.tsx:9`, `apps/ifac/src/app/layout.tsx:5`,
  art-auction / amrit-canada / sunjay `globals.css`): Puck copies parent
  `<style>`/`<link>` into its iframe, and Next scopes route CSS to its route.
- danamccool: `app/[[...path]]` serves Puck pages at real URLs (home is slug
  `home`, depth ≤ 3); static routes win by Next specificity. `site_config`
  keys `nav:main`, `theme:palette`. Site-local blocks in
  `apps/danamccool/src/blocks/`, registered in both client and server configs.
  Tailwind with preflight; site CSS in `layer(base)` after a declared
  `@layer theme, base, components, utilities;`.

### Block library rules (`packages/blocks`)

- A block is `defineBlock({ def, Component, sample? })`. `def.props` is a
  `PropDef[]`; `PropsOf<typeof props>` derives the component's types, and the
  same array drives Puck fields (`toPuckFields`), Silex traits
  (`toSilexTraits`) and attribute parsing (`propsFromAttributes`).
  `@elkdonis/blocks` imports nothing from Puck.
- `SHARED_BLOCKS` (`packages/blocks/src/index.ts:83`) has 27 blocks.
  Categories are a closed union `layout | headers | content | listings |
  actions` (`packages/blocks/src/types.ts:106`).
- `createCatalogue` throws on: a prop named `id`, `puck`, `editMode` or
  `children` (`packages/blocks/src/registry.ts:78`); a duplicate block id; a
  `dataDriven` block without `sample()`.
- A block id is persisted in saved page JSON. `<Render>` returns null for an
  unknown type without logging, so renaming an id orphans stored pages.
- `styling` is `"tokens" | "tailwind"` (`types.ts:279`). The smoke test fails
  if any shared block is not `tokens` (`packages/blocks/scripts/smoke.mts:592`).
  Tailwind-styled blocks exist only site-locally (six in
  `apps/danamccool/src/blocks/`).
- Data-driven blocks ship as a pair: presentational half in `src/blocks/*`,
  fetching half in `src/server/*` behind the `./server` entry, so rendering a
  block never pulls `@elkdonis/db` into a client bundle.
- Interactive blocks (`types.ts:297`) keep the declaration in a server-safe
  file and the component in a separate `"use client"` file
  (`contact-form.tsx` + `contact-form.client.tsx`). A `"use client"` block
  file makes `def.props` undefined on the server and breaks every page that
  imports the catalogue.
- Prop kinds `slot` and `rows` do not survive an HTML attribute and are
  skipped by `propsFromAttributes`/`toSilexTraits`. A slot arrives as a
  ReactNode (hand-written page) or a render function (Puck); blocks draw it
  with `<Region of={...} className=...>` from `src/slot.tsx`, which uses
  `createElement`. Slot `allow`/`disallow` live on `PropDef.allow` (the field),
  not on the region (Puck 0.23). `minEmptyHeight` defaults to 128 in Puck; only
  raise it.
- Number `min/max/step` are clamped by `coerceProps`. `inlineEditable`
  widens a prop to `string | ReactNode` (off for `prose.body`,
  `text-image.body`); `prose` renders text nodes, never HTML.
- `kind: "image"` renders the media picker over `/api/media/library` (org,
  editor-gated) and `/api/media/library/mine` (session user only).
- `manipulate` (`types.ts:321`) names the props an editor may drive by drag;
  `CanvasDrag` in page-builder implements it. Inside the canvas, take
  `document` from an anchor's `ownerDocument`, not the global: Puck renders the
  preview in an iframe.
- `silexRoot` (`types.ts:341`) is declared; nothing walks it yet.

### Template intake (third-party sections)

- Licence gate before any conversion: MIT, Apache-2.0, CC0 or CC-BY only.
  Blocks are redistributed to every org, so personal-use, per-page-attribution
  or no-redistribution terms disqualify a source.
- Preline is MIT plus the "Preline UI Fair Use License": page-builder use is
  permitted only with user-facing attribution. danamccool carries it at
  `/credits`, linked from `apps/danamccool/src/components/site-footer.tsx:18`;
  removing the link while the Preline-derived `opening` block remains breaks
  the licence. FlyonUI bundles Preline and inherits the rider.
- Verified licences (2026-09-17): HyperUI, TailGrids, daisyUI are MIT.
  `silexlabs/silex-templates` has no licence file.
- Intake criteria: server-renderable with no JS (a client block cannot hold
  slots), plain markup, redistributable licence, no CSS-in-JS runtime (MUI
  rejected: every component is `'use client'`). Harvested markup assumes
  Tailwind preflight; without it, neutralise UA defaults per element.

### Silex editor

- Version: **Silex 3.9.0**, verified 2026-09-23 in `eac-silex` (image
  `guru-eac-silex` built 2026-09-15; `/silex/package.json`). Built from
  `packages/silex/Dockerfile`: `FROM silexlabs/silex-platform:3.9.0` plus
  `eac-deploy-config.js` over `/silex/server/deploy/.silex.js`. The Docker Hub
  name `silexlabs/silex` is deprecated and frozen at 3.7.0.
- Compose service `silex` (`docker-compose.yml:1572`): port 6805, networks
  `eac-network` + `nextcloud-network`; connector bind-mounted read-only at
  `/silex/extensions/silex-nextcloud-connector`;
  `packages/silex-render/src/components.data.json` mounted as
  `/silex/extensions/eac-components.json`. Requires `SILEX_SESSION_SECRET` and
  `SILEX_BRIDGE_SECRET` in `.env`. Public URL: `SILEX_URL` resolves to
  `https://edit.arts-collective.com` in the running container.
- Silex reads `SILEX_CLIENT_CONFIG` and `SILEX_SERVER_CONFIG` at boot.
  Editing the bind-mounted `client-config.js` has no effect until
  `docker restart eac-silex`; `.env` changes need `--force-recreate`.
- Auth bridge: an app mints a one-time token (`@elkdonis/silex-render`
  `tokens.ts`, Redis); the connector redeems it at
  `${ARTS_INTERNAL_URL}/api/silex/auth`, authenticating with
  `SILEX_BRIDGE_SECRET` (`packages/silex-nextcloud-connector/src/auth.js:42`,
  `apps/arts-collective/src/app/api/silex/auth/route.ts:42`). Any app can mint;
  only arts-collective redeems. Editor URLs come from `editor-url.ts`
  (`resolveSilexEditorUrl`, `buildSilexEditorUrl`).
- Storage (`src/NextcloudStorage.js`) keeps `website.json`, `meta.json`,
  pages and assets under `<nextcloudFolderPath>/silex/project/`. Hosting
  (`src/NextcloudHosting.js:144`) implements `publish()` and writes to the
  published path. The connector README's "publishing not implemented" line is
  stale.
- Editor assets are served by `src/editorAssetsMiddleware.js:326-343`:
  `/eac-*-template.{json,css}` per template, `/eac-components.json`,
  `/eac-pens.{json,css}`, `/eac-vendor/` (index) and `/eac-vendor/:id`.
- Editor plugins are installed into `/silex/eac-vendor` (own npm tree; the
  base `/silex/node_modules` is pnpm-managed). `VENDOR_PLUGINS` in
  `client-config.js` turns on only `grapesjs-tabs`; `?plugins=a,-b` toggles per
  session (`client-config.js:1026`). Newsletter/MJML presets are marked
  destructive; `grapesjs-project-manager` fails against the Nextcloud storage.
  There is no Silex Labs newsletter product.
- Live slots: `<eac-embed data-eac-component=...>` is the permanent wire
  format for React islands. The catalogue is `components.data.json`, read by
  the renderer and by the editor's block panel. `componentToEmbedMarker`
  (`packages/silex-render/src/components.ts:87`) has no caller.

### Silex 3.9 upgrade phases

Phase numbers here are the upgrade brief's scheme (0 image, 1 data sources,
2 CSS variables, 3 MCP); other documents reuse the same numbers for unrelated
plans.

| Phase | Status 2026-09-23 | Evidence |
|---|---|---|
| 0: 3.9 image + Express-5 connector | Done | Running container is 3.9.0; browser smoke 2026-09-06 (97 blocks) per memory. Save/Publish round-trip to Nextcloud on 3.9 not recorded as verified. |
| 1: data sources | Upstream approach rejected 2026-09-05; replaced by `@elkdonis/cms-bindings/engine` (shipped) | Upstream data source is GraphQL in, 11ty publish-time out; bindings would be frozen per site. Silex's built-in CMS stays enabled but unused. |
| 2: CSS Variables plugin | Not started | No CSS-variables plugin in connector or client config (grep) |
| 3: MCP / AI | Not started | The npm package ships no MCP server; plan is an own `website.json` scaffolder |

### Silex over the page (hidden-enneagram)

- `POST /api/silex/token {page?}` (owner/guide), `/edit` gate route,
  `EditPageButton` (`data-silex-edit="<page>"`), `SiteNav({silexPage})`.
  Connector `openRequestedPage` honours `?page=` (`client-config.js:1222`).
- The route slug equals the Silex page `id` (`index`, `introduction`,
  `type-1`), not a slug derived from the page name. Published filenames follow
  the id.
- At `grapesjs:end` the page list is still a placeholder; selection waits
  for the real page (cap 20 s). `body.silex-loading` is not a load signal.
- hidden-enneagram runs production mode; source edits need a rebuild.
- `/hub` renders the connector's `hub` template through bind → sanitise →
  embed swap; no Silex page has been published for it, so the template files
  are the page.

### Render pipeline (`@elkdonis/silex-render`)

`SilexSite` (`packages/silex-render/src/silex-site.tsx`): fetch published HTML
from Nextcloud → `rewriteAssetUrls` → `removeSections(omitSections)` →
`applyManifestBindings` → `sanitizeSilexHtml` → `renderSilexHtmlWithEmbeds`.
Binding happens before sanitising (`:113-139`) so bound values, including
authored `threads.body`, pass through DOMPurify. The sanitiser
(`packages/utils/src/sanitize-silex.ts:108`) forbids `script`, `meta`, `base`,
`object`, `embed`, `applet`, inline handlers and `javascript:` URLs, and keeps
`eac-*` custom elements (`:121`). No published Silex page can carry script.

### Template binding engine (`@elkdonis/cms-bindings`)

- Entries: `.`, `./engine`, `./workshop`, `./dossier`, `./node` (filesystem
  loading, kept separate so the main entry stays browser-safe).
- `manifest.json` per template declares `cmsFields`, `traits` and
  `bindings`. Binding kinds: `text html attr style class show list`; options
  `from`, `format`, `join`, `template`, `fallback`, `omitWhenEmpty`
  (`packages/cms-bindings/src/engine/types.ts:77`). A trait may carry an array
  of bindings. Domain logic lives in named formatters and context builders
  (`toWorkshopContext`, `toDossierContext`), not in the manifest.
- Parser: `node-html-parser` (round-trip byte-identical). Bindings are scoped
  per section: `applyManifestBindings` finds a section by
  `[data-gjs-type="<id>"]` or `.<id>`, not by `data-section`.
- Engine behaviour: an empty value leaves the placeholder text unless
  `omitWhenEmpty` is set (`engine/apply.ts:194`); a `list` container must have
  exactly one element child as its row template; a `class` binding can only add
  a class on a truthy value; `show` with an array `from` means "any non-empty".
- Gate: `validate:template` runs inside `cms-bindings`' `check-types`, so
  `pnpm check-types` fails on binding drift.
- Coverage, from `validate:template` run 2026-09-23:

| Template | Bindings | Result |
|---|---|---|
| workshop | 38 / 10 sections | 0 errors |
| dossier-classified | 50 / 14 sections | 0 errors |
| article | 15 / 4 sections | 0 errors |
| hub | 10 / 4 sections | **3 errors: script exits 1** |
| brochure | not migrated | 42 hooks render placeholder text |
| portfolio | not migrated | 27 hooks |
| enneagram | not migrated | 7 hooks |

  The hub errors are bindings `lede`, `toolsNote`, `resourcesNote` with
  neither `from` nor `fallback`. They and ten bindings in `article/manifest.json`
  use the key `hideWhenEmpty`, which the engine does not define; it is ignored.
- `SilexSite` always binds against the workshop manifest
  (`silex-site.tsx:131-133`, `loadTemplateManifest("workshop")`) using the
  org's most recent public workshop (`packages/silex-render/src/queries.ts:145`,
  `LIMIT 1` at `:211`). There is no `template_id` column on `organizations` or
  `workshop_pages` (verified via `information_schema`).

### ArtDirect dossier template

`dossier-classified` is the Silex template behind ArtDirect profiles, fully on
the engine since v0.3 (2026-09-16). Display logic is in `packages/cms-bindings/src/dossier/context.ts`.
`visibleDossierSections(data)` feeds both the server render and
`removeSections` on a published page. Section opt-in is `users.profile_sections`
with keys `DOSSIER_SECTION_KEYS` (`packages/cms-bindings/src/dossier/field-registry.ts:68`:
dispatches, movements, galleries, store, workHistory). Layout switch is
`users.profile_layout`. Owner editing is
`apps/artdirect/src/components/oad/DossierSidebar.tsx`, generated from
`dossierFieldGroups`. `isMoneyLink` (`apps/artdirect/src/lib/oad.ts:110`)
splits social links into addresses vs buy/support. Preview without writing
flags: `apps/artdirect/scripts/preview-dossier.mts <slug> <out> --demo
--inline-images`, run inside the container with the pnpm-store `tsx` CLI.

### Pens library

CSS-only effects as Silex blocks with React twins. Source:
`packages/silex-nextcloud-connector/src/pens/<id>/{manifest.json,pen.html,pen.css}`
(fold-card, feed-list, spotlight-grid, moon-phase), served at `/eac-pens.json`
and `/eac-pens.css`; pen CSS is seeded into a project on first drop. React
twins: `@elkdonis/cms-ui/pens` exports `FoldCard`, `FeedList`/`FeedItem`,
`MoonPhase`. A pen must work without script because the sanitiser removes it;
state is checkbox + `:has()` or `<details>`, and only the React twin adds
script (FLIP). Contrast: a raw org accent fails 4.5:1 as text or behind light
text (EAC default `#b85c3a` measured 4.28:1 / 4.21:1). Pens derive
`--eac-pen-accent-deep` = `color-mix(accent 80%, #12100e)`
(`pens/fold-card/pen.css:35`); blocks use `--blk-accent-ink`
(`packages/blocks/src/blocks.css:72`). Consumers: arts-collective
(`SkySection`, `MoonSurface`), hidden-enneagram (feed listing), elastrocal.

### live-editor

`@elkdonis/live-editor`: `LiveEditor`, `EditOverlay`, `StyleOverlay`,
`FieldPopover`, `CssPanel`, preview-var helpers; `./theme` exports
`ThemeStyle`. Driven by a `FieldDef[]` and optional CSS-var defs, with injected
save callbacks. Used by arts-collective (`WorkshopLiveEditor`, appearance),
ifac (artist pages, `?edit=1`) and artdirect. The 2026-09-13 plan is for it to
grow into a client-side partner of Silex (trait picker, hydrated canvas); not
started.

### arts-collective wizard and workshop CMS

The 2026-07-30 audit is largely resolved: the onboarding and business wizards
are adapters over the shared `@elkdonis/cms-ui` provider
(`apps/arts-collective/src/components/wizard/WizardProvider.tsx`), which fixed
the draft-loss, stale-cache, silent-save-failure and conditional-hook bugs.
`saveWorkshopAction` now calls `upsertWorkshopOffering`
(`apps/arts-collective/src/lib/cms/actions.ts:688`). The workshop template is
rendered through the engine (`apps/arts-collective/src/lib/cms/workshop-render.ts`).
The guided wizard route exists. `scripts/check-workshop-fields.mjs` compares
the field registry with the save schema.

Still true on 2026-09-23: no `template_id`; `/sites/[slug]/[contentSlug]`
does not check `layout_mode`; `theme_overrides` is not read in
`packages/silex-render/src/queries.ts`; the Silex org home binds the org's
latest workshop regardless of URL.

## Rules and constraints

Reasons for each are given in Current state above.

- Use `@puckeditor/core`, not the deprecated `@measured/puck`.
- Never rename a block id: saved JSON references it; unknown types render nothing.
- Keep shared blocks `styling: "tokens"`; Tailwind blocks belong in the app.
- Keep `sample()` out of `defaultProps`: Puck persists defaults verbatim.
- Run `resolveAllData` (from `@puckeditor/core/rsc`) before `<Render>`.
- Keep `@elkdonis/db` behind `./server` entries.
- Take the org from the deployment in block API routes, not the request: a
  request parameter turns the route into a cross-tenant reader.
- Check the licence before harvesting a template; Preline needs attribution.
- Bind before sanitising; give each section root its id; use `omitWhenEmpty`.
- No script in pens or Silex blocks; measure accent contrast.
- Restart `eac-silex` after editing `client-config.js`.
- Do not adopt Silex's upstream data source or load destructive email plugins
  over a website project.

## Open items

- `validate:template` exits 1 on the hub template (3 errors), so
  `pnpm --filter @elkdonis/cms-bindings check-types` fails as of 2026-09-23.
  Fix: give `lede`, `toolsNote`, `resourcesNote` a `from` or `fallback`, and
  replace `hideWhenEmpty` with `omitWhenEmpty` in `hub` and `article`
  manifests.
- `spotlight-grid/manifest.json` names a React twin
  `@elkdonis/cms-ui/pens SpotlightGrid` that `cms-ui/pens` does not export.
- Template choice: add `template_id` so `SilexSite` stops hardcoding the
  workshop manifest; migrate brochure, portfolio, enneagram manifests.
- Silex 3.9: Save/Publish round-trip to Nextcloud needs a human session to
  verify (**unknown** whether done since 2026-09-06). Phases 2 and 3 not
  started. `componentToEmbedMarker` has no caller. Trait picker and hydrated
  canvas (Silex-over-the-page steps 2 and 3) not started. `silexRoot` is not
  walked.
- hidden-enneagram `SILEX_PAGES` lists `centers` and `contact`, reported
  2026-09-13 as absent from the published folder; `services.html` is shadowed
  by the React `/services` route (**assumed** still true; Nextcloud folder not
  listed).
- Two workshop session models: `threads.sessions` JSONB (arts-collective) vs
  `workshop_sessions` table.
- Tailwind apps other than danamccool do not `@source` `packages/blocks/src`.
- `apps/danamccool/src/app/puck-harness-tmp/` is a temporary harness created
  2026-09-23 by another session, marked "delete me"; it is publicly routable
  while it exists.
- Puck ships no data version; run `migrate()` as a batch step on upgrade, not
  on load, and keep a sidecar version.
- `packages/silex-nextcloud-connector/README.md` still says publishing is not
  implemented.

## Sources

Supersedes, for current state:
- `docs/archive/HEADLESS_CMS_DIRECTION.md`
- `docs/archive/SILEX_ALTERNATIVES_2026-09-06.md`
- `docs/archive/SILEX_AUTHORING_REVIEW_2026-09-05.md`
- `docs/archive/SILEX_NEXTCLOUD_CRITICAL_REVIEW_2026-09-06.md`
- `docs/archive/SILEX_SESSION_HANDOFF.md` (2026-04, Silex 3.7 era)
- `docs/archive/silex-publishing-pipeline.md` (names the old `silexlabs/silex` image)
- `docs/archive/WORKSHOP_BINDING_BRIEF.md`, `docs/archive/WORKSHOP_BINDING_PROMPT.md` (2026-04, pre-engine)
- Memory: `project_blocks_library`, `project_template_binding_engine`,
  `project_dossier_template_v2`, `project_pens_library`,
  `project_silex_39_upgrade`, `project_silex_editor_plugins`,
  `project_silex_over_the_page`, `arts_collective_cms_state`

Still open, not superseded: `docs/open/BLOCK_LIBRARY_BRIEF_2026-09-14.md`
("Puck later if ever" was overtaken 2026-09-15) and
`docs/open/SILEX_3.9_UPGRADE_BRIEF.md` (its header "Phases 1–3 not started"
contradicts its own Phase 1 section).
