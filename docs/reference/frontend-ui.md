# Frontend UI, CSS, shared component packages, 3D

Covers which UI stack each app uses, how shared stylesheets are themed and
layered, Tailwind v4 compilation across the monorepo, the contrast rules, the
shared popup (surface) system, hub faces, the rich-text editor, the `/center`
page, forum-ui theming, component duplication, and the three.js package with
the virtual gallery. Last verified: 2026-09-23 (read-only: package.json,
globals.css, package sources, `docker compose config`, one `site_themes` query).

## Current state

### UI stack per app

Mantine is confined to five legacy apps. No other app declares `@mantine/*`
(verified: grep of `apps/*/package.json` and `apps/*/src`).

| Stack | Apps |
|---|---|
| Mantine 8 + `@elkdonis/ui` (legacy) | admin, blog-guru-dharam, blog-tester, elkdonis-arts-collective, inner-gathering |
| `@elkdonis/cms-ui` (+ app-local shadcn copies or `@elkdonis/primitives`) | amrit-canada, art-auction, artdirect, arts-collective, danamccool, elastrocal, forum, fourthwayBookreaders, hidden-enneagram, ifac, innergathering, pigeonshoot, sophia, sunjay |
| `@elkdonis/primitives` imported in source | amrit-canada (26 files), sunjay (25), ifac (4); fourthwayBookreaders imports only its CSS |

Mantine in packages: `packages/ui` (25 Mantine components + a stale shadcn
quarter), `packages/blog-client` (`@mantine/core`), `packages/hooks`
(`@mantine/hooks` declared, not imported in `src`). Their only consumers are
the five legacy apps. `packages/cms-ui/src/gallery/SimpleLightbox.tsx:36`
mentions Mantine in a comment only. blog-guru-dharam, blog-tester and
elkdonis-arts-collective are defined in compose but were not running on
2026-09-23; inner-gathering is being retired (see memory *Ignore inner-gathering*).

### Tailwind compilation per app

All Tailwind is v4 via `@tailwindcss/postcss` in `apps/<app>/postcss.config.mjs`.

| App | Tailwind | Notes |
|---|---|---|
| admin, amrit-canada, art-auction, arts-collective, blog-guru-dharam, elastrocal, fourthwayBookreaders, hidden-enneagram, innergathering, pigeonshoot, sunjay | full (`@import "tailwindcss"`) | preflight included |
| danamccool | full, preflight included, plus daisyUI | declares `@layer theme, base, components, utilities;` first and imports its own `site.css` into `layer(base)` (`apps/danamccool/src/app/globals.css:25,46`) |
| ifac | theme + utilities only, no preflight | `apps/ifac/src/app/globals.css:8-9`; ~2,600 lines of its own plain CSS |
| artdirect | theme + utilities only, no preflight | `apps/artdirect/src/app/globals.css:18-19`; `@theme` maps `--paper/--ink/--line/--gold` to colour names |
| forum, sophia | none | no postcss config, no `tailwindcss` dependency |
| blog-tester, elkdonis-arts-collective, inner-gathering | **assumed not compiled** | `tailwindcss` dependency and an `@import`/`@tailwind` directive, but no postcss config in the app or repo root |

Most Tailwind apps use `@theme inline` to map `--color-*` onto `hsl(var(--x))`,
so utilities read the runtime variable and a `site_themes` override reaches
them. Every app with a shadcn token set stores `--primary` etc. as a bare HSL
triplet (`45 79% 52%`), not a finished colour (verified in 11 globals.css files).

`@source` lines per app, for packages that ship Tailwind classes (verified 2026-09-23):

| Package (Tailwind in source) | Consumers with `@source` | Consumers without |
|---|---|---|
| cms-ui (`center/*`, `ProfileSurface.tsx`, others) | amrit-canada, artdirect, arts-collective, danamccool, elastrocal, fourthwayBookreaders, hidden-enneagram, ifac, innergathering, sunjay | art-auction, pigeonshoot (import only plain-CSS entries), forum, sophia (no Tailwind) |
| pipeline, chat | amrit-canada, ifac, innergathering, sunjay | none |
| sky-ui | arts-collective, elastrocal | none |
| commerce (non-portable parts) | art-auction, artdirect, ifac | amrit-canada, arts-collective, hidden-enneagram, innergathering, sunjay, admin |
| checkout | art-auction | hidden-enneagram (renders `PaymentInstructionsCard`), ifac, innergathering (stripe helpers only) |
| studio-ui | none | art-auction (`MultiImageUploader`) |

`blocks`, `forum-ui`, `lms-ui`, `page-builder`, `live-editor` (inline styles)
and cms-ui's `hub/*` are plain CSS and need no `@source`.

### Shared stylesheets and the token pattern

Each cross-app stylesheet exposes public input hooks (`--eac-<area>-*`) and
computes private output tokens from them at `:root`, with a fallback chain
hook → cms-ui neutral vocabulary (`--paper`, `--ink`, `--ink-soft`, `--line`)
→ hardcoded default.

| Stylesheet | Input hooks | Output tokens |
|---|---|---|
| `@elkdonis/cms-ui/surface.css` (3,252 lines) | `--eac-surface-*`, `--eac-kind-*`, `--eac-kind-<k>-on` | `--sf-*` |
| `@elkdonis/primitives/primitives.css` | `--eac-control-*` | `--pr-*` |
| `@elkdonis/blocks/blocks.css` | `--eac-block-*` | `--blk-*` |
| `@elkdonis/forum-ui/forum.css`, `forum-theme.css` | `--forum-*`, `--eac-forum-*` | `--gf-*`, and redefines `--sf-*` on `.gf-root/.gf-page` |
| `@elkdonis/cms-ui/fields.css`, `compose.css`, `editor.css` | `--eac-field-*`, `--eac-font-*` | `--fld-*`, `--cmp-*`, `--ed-*` |
| `@elkdonis/cms-ui/article.css` | `--eac-color-*`, `--eac-font-*` | `--read-*` |
| `@elkdonis/cms-ui/profile.css`, `files-card.css`, `hub.css`, `center.css` | `--eac-profile-*`, `--eac-files-*`/`--eac-picker-*`, `--eac-hub-*`, `--eac-center-*` | (reads `--sf-*`) |
| `@elkdonis/commerce/commerce.css` | — | `--pc-*` |

A custom property computed at `:root` does not change when its input is
redefined lower in the tree. To theme a subtree differently, redefine the
output tokens on a wrapper, as `packages/forum-ui/src/forum-theme.css` does on
`.gf-root, .gf-page`.

### Cascade layers

Tailwind v4 layer order is `theme → base → components → utilities`; an
unlayered rule beats every layered rule regardless of specificity.

- `primitives.css` and `blocks.css` are imported `layer(components)` in
  amrit-canada, sunjay, fourthwayBookreaders, ifac (e.g.
  `apps/amrit-canada/src/app/globals.css:46,50`), so a caller's utility
  `className` still overrides them. art-auction imports `blocks.css` bare (`:8`).
- Every cms-ui, forum-ui and commerce stylesheet is imported unlayered in every
  app (verified: no `layer(` on those imports), so their rules beat Tailwind
  utilities passed through `className`.
- danamccool pins the order with a leading `@layer` statement, because a
  layer's position is fixed where it first appears.

### `@elkdonis/primitives`

`packages/primitives` (2026-09-15): Button, Badge, Input, Textarea, Label, Card,
Separator, Checkbox, Switch, RadioGroup, Tabs, Select; `Slot`, `cx`
(`packages/primitives/src/index.ts`). Plain CSS keyed on `data-slot` /
`data-variant` / `data-state`; Radix (`radix-ui@^1.4.3`) for behaviour only;
props match the shadcn copies they replace. Tests: `pnpm test` (`scripts/smoke.mts`).

The accent has three roles (`primitives.css:91-131`):
- `--pr-accent` the fill; `--pr-accent-on` the ink on the fill;
- `--pr-accent-ink` the accent used as ink on the page ground (links, focus ring).
  Default `color-mix(in srgb, accent 60%, black)`. Next's minifier emits a
  non-`color-mix` fallback that is the raw accent, so each app pins
  `--eac-control-accent-ink` to a literal: amrit-canada `#8a6d16`
  (`globals.css:82`), sunjay `#c9ae79` (`:89`), fourthwayBookreaders
  `var(--brass)` (`:114`), ifac `var(--gold)` (`:2581`, dark ground — the
  60%-black default would be wrong there).
- `--pr-focus` defaults to `--pr-accent-ink` (needs 3:1 as a non-text indicator).
- Fallbacks never reference `var(--primary)`: the triplet form is an invalid
  colour, the declaration is dropped, and the control renders with no background.

### `@elkdonis/tokens` and `site_themes`

`packages/tokens` parses a DTCG 2025.10 design-token file into the flat
`{"--name": "value"}` bag stored in `site_themes.vars` (migration 090; columns
`org_id, page_key, vars jsonb, updated_by → users, updated_at`). No
dependencies, no DB access. Write path: `saveSiteTheme`, validated by
`sanitizeThemeVars` (`packages/services/src/themes.ts:32-42`): name
`/^--[a-z0-9-]{1,60}$/i`, value `/^[a-z0-9\s.,%#()/_-]{1,120}$/i`, so quoted
font names (`"Source Sans 3"`) are rejected and reported as `unstorable`.
`packages/tokens/scripts/smoke.mts` fails if the rules duplicated in
`src/import.ts` drift from services. UI: `TokenImportPanel` inside
`AppearancePanel` on arts-collective `/hub/organization`
(`apps/arts-collective/src/components/hub/`), saving via `saveSiteThemeAction`.
2026-09-23: `site_themes` holds one row (`ifac`, `page_key ''`, 0 vars).
**Assumed:** the panel has not been exercised in an authenticated render.

### Surface system (`@elkdonis/cms-ui/surface`)

The one popup pattern. A face (card) and a surface (popup) are the same object
at two sizes. All surfaces open in one native `<dialog>` per app
(`SurfaceProvider.tsx:19,307,355`) and stack inside it; the top layer is
mirrored to `?surface=<serialized>` (`url.ts:12`, `serializeDescriptor` at
`:20`). `custom` descriptors serialize to `null` (`url.ts:78`), so they are not
deep-linkable; their data goes through the descriptor's `props`. Descriptor
union: `surface/types.ts:63-260` (thread, profile, centerLayout, identities,
compose, calendar, gallery, board, gather, documents, forum, forumFeed,
boardCard, write, postTo, define, material, custom); routed in
`SurfaceRouter.tsx`. `morphIn()` (`SurfaceProvider.tsx:61`) grows the clicked
face into the surface; disabled under `prefers-reduced-motion`. Faces pass their
element as origin via `faceOf()` (`hub/face-origin.ts:10`). `toSurfaceThread`
(`surface/thread-mapper.ts`) is the shared thread mapper.
`SurfaceProvider` is mounted in amrit-canada, arts-collective, elastrocal,
hidden-enneagram, ifac, innergathering, sunjay. Host contract: `connectors`
(`loadThread`, `listEvents`, `listMedia`, `rsvp`, `saveThread`, `compose`,
`timeZone`, `orgName`, …); amrit-canada's is `src/components/hub/HubSurfaces.tsx`.
cms-ui has no `@elkdonis/services` dependency; hub/center types are structural
re-declarations.

### Hub faces (`@elkdonis/cms-ui/hub`)

Live faces: CalendarFace, GalleryFace (‹ › carousel), ComposeFace, ProfileFace,
IdentitiesFace, DocumentsFace, IdeasFace, PipelineFace, StandingMeetingFace,
KindTilesFace, CloudFace (`hub/index.ts`). `hubCards(caps)` builds the remaining
link tiles from `{files, questionnaires, help, manageHref}` (`hub/cards.ts:19-35`);
availability is a host fact, not a shared constant. `createHubConnectors(opts)`
supplies the common connectors behind capability flags. Consumers: amrit-canada,
arts-collective, ifac, innergathering, sunjay. Constraints:
- IdeasFace needs an `org_feeds` row with slug `ideas` (`ensureIdeasFeed`) and
  an explicit `ideas.href`; there is no default.
- Documents live in `EAC_Network/<orgId>/Media/Documents/`, indexed by
  `site_config` key `living_documents`; `deleteOrgDocument` removes the index
  entry and keeps the file.
- Alerts (`getViewerAlerts`) are counts only; no app serves an inbox route.
- A face is a stretched hit area behind inert content. `.eac-face-live` marks a
  region that takes clicks instead of the card; wrapping a whole preview in it
  stops the card opening its surface (memory *IFAC Hub Front-end*, 2026-09-16).
- IFAC keeps its own richer ProfileCard; its hub palette is scoped on
  `.ifac-hub-scope` on the hub layout (`apps/ifac/src/app/hub/layout.tsx:46`),
  not on `.hub`, because the single `<dialog>` renders outside `.hub`.
- `FirstStepsFace` (docs/open/BRIEF_E_HUB_TOUR_2026-09-18.md) is not built as of 2026-09-23.

### Shared rich-text editor (`@elkdonis/cms-ui/editor`)

`RichTextEditor` (`packages/cms-ui/src/editor/RichTextEditor.tsx:47-69`):
`value`, `onChange`, `placeholder?`, `minHeight?`, `ariaLabel?`, `className?`,
`toolbar?: 'full'|'minimal'|'compact'`, `wikiPages?` (enables `[[` completion,
`wikilink-suggest.ts`), `sourceThreadId?`. Tiptap StarterKit plus Underline,
Placeholder, Link, Highlight, TextAlign, Image, CodeBlockLowlight, Table,
Youtube. Plain CSS in `editor.css` with `eac-ed-*` classes; hosts must import
it. Consumers: amrit-canada, art-auction, arts-collective, forum,
fourthwayBookreaders, hidden-enneagram, ifac, innergathering, sophia, sunjay.
The Mantine editor `packages/ui/src/components/RichTextEditor.tsx` survives for
inner-gathering only and is not to be migrated.

### `/center`

The person's page on an org site (`/hub` is the org's). `CenterPage`
(server component) in `@elkdonis/cms-ui/center`, data from `loadCenter`
(`packages/services/src/center.ts`), layout from `resolveCenterLayout`
(`center-layout.ts`, `site_config` key `center_layout`). Layout is two columns:
`DEFAULT_CENTER_LAYOUT` left `profile, buttons, orgs, promo`, right
`site, org, pinned, feed, featured, network`
(`packages/cms-ui/src/center/layout.ts:35-44`), with `arrangement: "columns" |
"desk"` (`CenterDesk.tsx`: same sections, loose, positions per browser in
localStorage). Hosts: amrit-canada, innergathering, sunjay, fourthwayBookreaders
(`/center`), arts-collective (`sites/[slug]/center`). IFAC has `/api/center`
routes but no `/center` page. `ProfileSurface` has tabs `profile`, `show`
(where you show; absorbed `page` on 2026-09-20), `payouts`, `details`, each shown
only when the host can fill it (`ProfileSurface.tsx:330-340`).
`center/*` and `ProfileSurface.tsx` use Tailwind utilities by owner decision
(`CenterPage.tsx:29`, `ProfileSurface.tsx:40`) with colours from `--sf-*`
(`[color:var(--sf-*)]`); `center.css` holds layout. Quotes (migration 127,
`packages/services/src/quotes.ts`, desk at arts-collective `/hub/quotes`,
`POST /api/center/quotes` on amrit-canada, innergathering, sunjay) are stored
but not read by any page.

### forum-ui theming

`packages/forum-ui` is plain CSS and must stay so: `apps/forum` has no
Tailwind. `forum-theme.css` redefines `--sf-*` on `.gf-root/.gf-page` from
`--forum-*` hooks (light: steel blue `#3b5b7a` on `#eef1f4`, measured in the
file header). Dark mode (`data-forum-mode="dark"`, cookie `forum_mode`) is a
fixed-attachment silver gradient `#14161b → #343841 → #15171c`; inks are
measured at the `#343841` peak. `--sf-bg` must remain a solid colour (it is
used as a `color:` value); the gradient is a separate `background-image`. A
host token set on `.gf-page` needs a `:has([data-forum-mode="dark"])`
counterpart. `forum-modern.css` is an empty stub kept so existing imports build.

### Component duplication

Census: `docs/open/COMPONENT_CENSUS_2026-09-15.md` (454 app component files; 56
exact-duplicate groups, 176 files, 10,816 redundant lines). State on 2026-09-23:
shadcn `button.tsx` copies remain in 7 apps (elastrocal, blog-guru-dharam,
innergathering, pigeonshoot, hidden-enneagram, arts-collective, art-auction);
`popover`, `sheet`, `tooltip` have 3 copies each (innergathering,
arts-collective, pigeonshoot) and 0 import sites. Leave per-org
`site-header`/`site-footer`/`site-nav`/`site-shell` alone: differing headers are
intended. `dialog` is not to be re-extracted (the surface system replaces it).

### three.js (`packages/three`)

Subpath exports `.`, `./endless-runner`, `./inner-temple`, `./gallery`, one
tsup entry each. Peer deps `three >=0.170`, `@react-three/fiber >=9`,
`@react-three/drei >=10`; installed `three@0.184.0`, fiber 9.6.0, drei 10.7.7,
`@types/three` 0.184.1. Consumers: art-auction (`src/components/virtual-gallery.tsx`),
arts-collective (`components/hub/elkdonis/Arcade.tsx`,
`components/sites/CommunityGame.tsx`, `app/inner-temple/page.tsx`).
Conventions (2026-09-09):
- Game/animation logic is plain three.js in a React-free module driven by
  `update(step)`; R3F supplies canvas, camera, lights
  (`endless-runner/world.ts` is the reference).
- `SceneStage` (`canvas/SceneStage.tsx`) hosts a piece in a content page: lazy
  WebGL context on scroll-in, `frameloop` parked off-screen.
- Per-frame step is delta-normalised: `Math.min(delta, 1/30) * 60`
  (`endless-runner/RunnerScene.tsx:96`).
- A world's `dispose()` is idempotent and does not empty its group
  (`world.ts:90,520`): StrictMode mounts, cleans up and remounts without
  re-running `useMemo`.
- Collision is swept per step, not a fixed window.
- Textures are pushed into an existing world, never constructor arguments.
- At 3+ pieces on one page, migrate `SceneStage` to drei `<View>` (one
  renderer, many viewports); not yet needed — no page hosts three.

### Virtual gallery (`@elkdonis/three/gallery`)

First consumer: art-auction `/gallery`. Rooms are data (`gallery/designs.ts`:
`HALL`, `PAVILION`, `ROOM_DESIGNS`); layout maths in `room.ts` is React- and
three-free. `GalleryPiece.display: 'wall'|'plinth'` is chosen by the consuming
app (`STANDING_MEDIUMS`, `virtual-gallery.tsx:17`); `imageFit` defaults to
`contain` (never stretch a photo to a recorded size); `splatUrl` renders a
drei `<Splat>` (untested — no capture exists). The purchase panel is DOM via
`renderDetail` (`GalleryExperience.tsx:35`), so `packages/three` knows nothing
about carts. Texture materials are keyed `key={texture.uuid}` with `color`
always set (`HangingPiece.tsx:127`, `Plinth.tsx:122`); `useMediaTextures`
decodes with `imageOrientation: 'flipY'` (`hooks/useMediaTextures.ts:34`).
Walls are four inward planes, not a box sharing the floor plane (z-fighting).
State derived per room is held as `{designId, layout}` together. Canvas has
`touch-action: none` (`GalleryExperience.tsx:220`). Both rooms were rendered
and checked 2026-09-17; touch controls are unverified on a real phone.

### Reverted work — do not rebuild without asking

| What | Date | Survived |
|---|---|---|
| `/center` bento / Pokédex "console" (four regions, spans, skin, lamps, numbered modules, sections masthead/actions/studio/elkdonis/start/quotes) | 2026-09-15 | quotes (migration 127) |
| Hub GalleryFace drop well (dashed well, thumbnail grid, `wide`, Gallery card added to IFAC, media DELETE plumbing) | 2026-09-15 | living-document delete |
| Gallery edit bar on `ProfileGallery` | 2026-09-07 | lightbox rewrite |
| IFAC Files face made header-led with drive switch and thumbnails in `.eac-face-live` (broke the card's click; memory *IFAC Hub Front-end*) | 2026-09-16 | — |

The lesson recorded with the drop well: a restyle request does not cover adding
a tile or changing a face's width. Notes from the attempts are in
`docs/archive/CENTER_PAGE_BRIEF_2026-09-09.md` (round sixteen).

## Rules and constraints

- Write cross-app components as plain CSS on namespaced custom properties with
  a shipped stylesheet: Tailwind in a package renders unstyled in any host that
  lacks `@source` for it, with no build or type error.
- When a package component uses Tailwind (cms-ui `center/*`, `ProfileSurface`,
  pipeline, chat, checkout, studio-ui, sky-ui), add `@source` for it to every
  consuming app's `globals.css` in the same change.
- Check a host by grepping the served CSS chunk for the selector, not the HTML
  for the class name. Escape forms: `.sm\:grid-cols-2`; Lightning CSS strips
  attribute quotes (`[data-slot=button]`, `:has([data-forum-mode=dark])`).
- Import `primitives.css` and `blocks.css` with `layer(components)` in any
  Tailwind app: unlayered they override every utility a caller passes.
- Map app colours onto `--eac-control-*` / `--eac-surface-*` hooks with
  `hsl(var(--primary))`, never `var(--primary)` directly: the triplet form is an
  invalid colour and the control loses its background.
- Pin `--eac-control-accent-ink` to a literal in every app that imports
  primitives: the minifier's fallback for `color-mix()` is the raw accent.
- Set an explicit `-on` token for every filled accent (`--eac-surface-on-accent`,
  `--eac-kind-<k>-on`, `--eac-control-accent-on`): white on a light accent is
  the recurring failure (white on `#c79a42` 2.58:1, on `#E6B422` 1.71:1).
- Measure every text/ground pair to WCAG 2.1: 4.5:1 body text, 3:1 large text
  and non-text indicators (input borders, focus rings, drop targets). Paste the
  ratios into the CSS comment beside the tokens.
- Measure a gradient ground at its brightest stop; keep text-bearing cards on a
  solid colour.
- Re-measure every ink after changing a ground; swap the whole accent set when
  moving between dark and light grounds.
- Keep accent/device colour out of body text; use it in marks, rules, lamps.
- Prefer light grounds for text-heavy pages; for dark variants avoid pure
  black behind light text (use roughly `#16161a`).
- To theme a subtree, redefine output tokens (`--sf-*`) on a wrapper;
  redefining `--eac-surface-*` below `:root` has no effect.
- Keep `forum-ui` free of Tailwind: `apps/forum` does not compile it.
- For a new popup, add a descriptor to `surface/types.ts`, a surface under
  `surface/surfaces/`, a case in `SurfaceRouter.tsx` and `url.ts`, and a host
  connector; do not add another dialog primitive.
- When adding an optional capability to `SurfaceCard` or another shared
  primitive, grep for every path through it (`onClick` without `surface` is one).
- Use `@elkdonis/cms-ui/editor` for rich text and import `editor.css`; do not
  add app-local editors or migrate `packages/ui`'s Mantine editor.
- Sections on `/center` and hub faces return `null` when empty; no apology rows.
- Test a shared-stylesheet change with a standalone HTML harness in the
  scratchpad before rebuilding: production-mode apps (amrit-canada, art-auction,
  arts-collective, danamccool, hidden-enneagram, ifac, innergathering, sunjay)
  serve the old build until rebuilt.
- If CSS edits have no effect, suspect a stale CSS chunk in the app's `.next`
  volume before the CSS (see CLAUDE.md for the safe rebuild command).
- Use `.eac-face-live` only on a control inside a face, not on a whole
  preview: it removes the card's own click.
- Three.js: logic in React-free modules, `dispose()` idempotent and
  non-destructive, textures pushed not constructed, one material shape keyed by
  `texture.uuid`. Keep carts and prices out of `packages/three`: the consuming
  app renders the purchase panel through `renderDetail`, so there is one checkout.

## Open items

- `primitives.css:51` says ifac, artdirect and danamccool have no Tailwind;
  `surface.css:12` and `blocks.css:6` say utility classes render unstyled in
  ifac/artdirect. All three compile Tailwind utilities (2026-09-23). Comments
  are stale; code change not made (out of scope).
- Possible unstyled components (unverified by render): `PaymentInstructionsCard`
  in hidden-enneagram (no `@source packages/checkout`), `MultiImageUploader`
  in art-auction (no `@source packages/studio-ui`).
- blog-tester, elkdonis-arts-collective, inner-gathering: whether their
  Tailwind directives compile without a postcss config is **unknown**
  (assumed not).
- `popover`/`sheet`/`tooltip` copies (9 files, 0 imports) can be deleted.
- `three` is not pinned in root `pnpm.overrides` (`package.json:30-35`); a
  second copy would break `instanceof`. `@react-three/drei@9.122.0` is pulled
  transitively by `r3f-perf@7.2.3` (devDependency of `packages/three`,
  `pnpm-lock.yaml:16189-16193`). `@types/three@0.170.0` comes from
  elkdonis-arts-collective's `package.json`.
- Canvas is destroyed and recreated when the endless runner toggles between
  inline and overlay (known, not fixed). Super Hopper licence unconfirmed.
- Quotes have no reader; `threads.pinned` has no UI writer; `center_layout`
  arranging face exists, no network-default editor beyond `/api/center/layout`.
- No contrast-check script is committed; each session writes its own.
- IFAC still has local Profile faces alongside the shared ones (by design for
  Profile; recheck Documents/Ideas are fully on shared faces).
- `TokenImportPanel` unverified in an authenticated render.

## Sources

Supersedes these memory files: feedback_contrast_and_readability,
feedback_source_shared_packages, project_primitives_library,
project_dtcg_importer, project_surface_system (UI parts), project_shared_editor,
project_hub_live_faces, project_hub_drop_well, project_center_page (UI parts),
project_center_console, project_component_census, project_threejs_convention,
project_virtual_gallery.

Documents: `docs/archive/CENTER_PAGE_BRIEF_2026-09-09.md` (full `/center`
decision history, rounds 1–16), `docs/archive/COMMUNITY_ARCHITECTURE.md`
(`/community` embed plan, April 2026), read-only context
`docs/open/BRIEF_A_CENTER_UI_2026-09-18.md`,
`docs/open/BRIEF_E_HUB_TOUR_2026-09-18.md`,
`docs/open/COMPONENT_CENSUS_2026-09-15.md`.

## History

- 2026-09-23: rewritten from memory and briefs. Corrections: ifac and artdirect
  compile Tailwind (memory and three package comments said not); arts-collective
  is production mode (memory and Brief A said dev); primitives have three
  consumers (memory said none); arts-collective mounts `SurfaceProvider`;
  Brief E's "no Tailwind in the shared package" holds for `hub/*` only.
