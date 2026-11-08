# Smart components kit: proposal (2026-11-08)

Lane D, PM board `docs/open/PM_BOARD_2026-11-08.md`. Owner: session system32-a1 (the hidden-enneagram and
katie-the-potter session). **Proposal only.** No shared package has been edited for it. Stored block ids,
prop names and part names on every live site stay frozen.

## 0. In one paragraph

Two org sites now run "smart" Puck blocks in production: katie-the-potter (whole-site Puck, shop) and
hidden-enneagram (Puck-first, Silex removed 2026-11-07/08). A smart block reads a **record** (a thread,
service, person, artwork, course) at render time and lets the editor change every word around it.

Each app built the same six pieces by hand: route templates, record loaders with an editor JSON route,
placement-driven layout, inert-on-edit islands, popups opened from blocks, and looks. This proposal names
the six as kit primitives in `@elkdonis/blocks/record`, an existing entry. Apps would declare them; they
would not copy them.

It follows `NETWORK_SERVING_ARCHITECTURE_2026-11-08.md`:
- every primitive takes `site`, never app config (§5.1);
- record blocks only read, and writes go through the registry (§0.3);
- the Puck catalogue stays per host, while the kit provides the shared blocks (§4.2, point 2).

## 1. Evidence (where each pattern runs today)

| # | Pattern | hidden-enneagram | katie-the-potter | elktours / sunjay |
|---|---|---|---|---|
| 1 | Route template | `service`, `post`, `person`: `lib/puck/route-props.ts` `withRouteProps` | `piece-detail` (`/pieces/[slug]`) | none (code pages) |
| 2 | Record source + editor JSON | `lib/record-blocks.ts`, `lib/shelf.ts`, `/api/blocks/he-records`, `/api/blocks/he-shelf` | `/api/blocks/artworks`, `lib/site-store.ts` | Featured person, Opens: `direct-edit/src/canvas/records.ts` "From what?" |
| 3 | Placement layout + reason | `he-enneagram` `reader: auto` ("Reader: summary (auto: in a column)") | `ktp-piece` layout by placement | none |
| 4 | Inert on edit | figure, sound, mic: `editingOf(puck).drawn` → `<div inert>` | piece card, popup host | none |
| 5 | Popup from a block | custom surfaces `enneagram-type`, `studio:compose`, `studio:choose` | piece popup (`?piece=`) | Opens `popup:thread:<id>`, `popup:person:<id>` |
| 6 | Looks | Site style "Look" (Quiet / ÆON) + `look-watcher` | `look` prop house / ember / glaze-lab / profile, nearest wins | Site style (elktours) |

Shared already, in `@elkdonis/blocks/record`:
- `placementRules`, `effectiveLayout`, `describeLayout`, `layoutProp`, `editingOf`;
- `RecordFrame` / `RecordEmpty`;
- `stripResolvedKeys`, `defineLooks`;
- in `@elkdonis/blocks/opens`, the Opens grammar.

## 2. The six primitives

### 2.1 `defineRouteTemplate`: one Studio page per record route
```ts
defineRouteTemplate({
  key: "post",                       // Studio page key; stored, frozen
  label: "Article page",             // Studio Pages tab
  block: "he-post",                  // the record block the route feeds
  route: (params) => ({ routeFeed: params.page, routeSlug: params.slug }),
  sample: (site) => Promise<Record<string, unknown>>, // what the editor draws (signed-out view)
  reserved: true,                    // `/post` itself 404s; studio refuses the slug
})
```
- The kit provides `renderRouteTemplate(site, key, params)`. It loads the published document, else the code default, runs `withRouteProps`, then resolves.
- The route file keeps what is only its own: the 404 and visibility rules, plus `generateMetadata`.
- It replaces three hand-wired copies in hidden-enneagram and katie's `piece-detail`.
- Route keys are added to the resolved-keys list automatically (§3).

### 2.2 Record sources and the "From what?" chooser
```ts
defineRecordSource({
  kind: "service",                   // thread | service | person | artwork | course | forum-topics …
  load: (site, ref, viewer) => Promise<Record | null>, // server-only; visibility applied here
  list: (site, query, viewer) => Promise<RecordSummary[]>, // feeds the chooser
  sample: (site) => Promise<Record>,
})
```
- **One editor endpoint per host,** `api/[...kit]` → `/api/blocks/records?kind=&ref=`. It replaces the per-app `/api/blocks/he-records`, `he-shelf` and `artworks` routes.
- **Blocks store only a reference:** `ref: { kind, id }`, or "from the route" for templates. The panel shows the direct-edit **"From what?"** chooser (`canvas/records.ts`) over `list()`.
- **Evolving choices** ("host of the next session", "newest public post") are refs with a rule, not an id. This matches the editor-house decision (2026-11-06 §1).
- **Hub cards.** `load(site, …)` is the same shape as the architect's `defineHubCard.load`, so hub-card faces and page blocks can share sources.

### 2.3 The placement reason line
- **Standard behaviour:** every block with `layoutProp()` shows the resolved layout and why, under the field. Example: "Reader: summary (auto: in a column, 340 px)". The pieces exist (`describeLayout`); the proposal is that `RecordFrame` renders the line in the editor by default.
- **Evidence:** Ario's editor read the figure's behaviour off it without help. Without the line, "auto" reads as broken.

### 2.4 Inert on edit
- **Rule:** an interactive island (audio, mic, canvas, popup host, booking button) renders inside `<div inert>` whenever `editingOf(puck).drawn`. So a click selects the block, and nothing plays, records or charges in the editor.
- **Proposal:** `RecordFrame` wraps islands when given `interactive`. Deep links such as `#type-N` and `?piece=` are read only when not editing.
- **Footguns to name:**
  - React `useId` / random ids broke hydration in the figure; use the Puck block id.
  - Under dev StrictMode, a refresh-on-mount fired once and reloaded a framed Studio mid-typing.

### 2.5 Opens to any registered surface: `popup:custom:<key>:<arg>`
- **Today:** Opens resolves `page`, `popup:thread:<id>` and `popup:person:<userId>`, each wired per host. Hidden-enneagram also registers custom surfaces (`enneagram-type`, `studio:compose`, `studio:choose`) in `SurfaceProvider`.
- **Proposal:** extend the grammar with `popup:custom:<key>:<arg>`.
  - The chooser lists the host's registered custom surfaces, each with a label and an arg picker.
  - A Card or Button can then open a type popup, a quick-compose form or a booking sheet without a new block.
  - Surfaces register through the architect's `<NetworkChrome site>` (§5.4 `contentSurfaces(connectors)` + hub card surfaces), so one list serves both Opens and hub cards.
  - A custom key that the host doesn't register resolves to "nothing safe to draw" (existing `opens.ts` behaviour).

### 2.6 Converged Looks: a site preset, then a block override
- **Today there are two systems:**
  - Site style presets (elktours, hidden-enneagram "Look": Quiet / ÆON), stored in `site_themes` + `site_config site-style:*`;
  - katie's per-block `look` prop, which resolves nearest-wins (block → grid → site).
- **Proposal:** one resolution, `block.look ?? container.look ?? site.preset ?? "house"`.
  - `defineLooks` stays the per-catalogue list.
  - Site style's Look control writes `site.preset`.
  - Block `look` options gain "Site default" (= unset). The existing stored values keep their meaning.
  - The architect's brand kit (`content_prefs`: item → org → person → default) is the same cascade for form presets, so the two should share one resolver (`resolvePreset`).

## 3. The fix: derive the resolved keys
- **Today:** each app keeps a hand list (`RESOLVED_KEYS`, e.g. `apps/hidden-enneagram/src/blocks/resolved-keys.ts`) of the props its resolvers fill. A new resolver field that someone forgets to list is **saved into the page document**. Route keys (`routeSlug`, `routeFeed`, `routeQuery`) have the same risk.
- **Proposal:** blocks declare their resolved fields where the resolver is written: `resolved: ["service", "booking"]` on the block config, or implied by `defineRecordSource` and `defineRouteTemplate`. `createCatalogue` derives the map, and `stripResolvedKeys(data, catalogue.resolvedKeys)` runs in the kit's save action.
- **Migration:** zero data change. The derived map must be a superset of today's hand lists. A test asserts that for hidden-enneagram, katie and elktours before the hand lists are deleted.

## 4. Frozen on live sites (the compatibility list I review against)

Block ids, prop names and part names that are stored in published documents and must never be renamed.

| Site | Block ids | Notes |
|---|---|---|
| hidden-enneagram | `he-hero`, `he-passage`, `he-enneagram`, `he-welcome`, `he-orb`, `he-works`, `he-shelf`, `he-type`, `he-contact`, `he-forum`, `he-person`, `he-service`, `he-post`, `he-course`, `he-reading`, `he-music-web` | Prop and part names in `apps/hidden-enneagram/docs/editor.md` "The site blocks". Studio keys `home`, `enneagram`, `readings`, `about`, `music`, `service`, `post`, `person`, `reading-*` |
| katie-the-potter | `ktp-quick-landing` (+ `feature` slot), `ktp-artwork-grid`, `ktp-piece`, `ktp-piece-row`, `ktp-piece-details` | `look` values house, ember, glaze-lab, profile; `cardClick` page or popup; template `piece-detail` |

A kit version must:
- render these ids with today's props;
- keep the parts' names (they key `morph` look data);
- read today's resolved-key lists as a minimum.

## 5. Order (each step is one PR, with no data migrations)
1. **§3 derived resolved keys.** Superset test against the three apps' hand lists.
2. **§2.3 reason line and §2.4 `interactive`** in `RecordFrame`. Additive props.
3. **§2.1 `defineRouteTemplate`.** Move hidden-enneagram's three templates first (the app is Puck-first), then katie's `piece-detail`.
4. **§2.2 record sources plus the chooser.** Start with `service` and `thread`; replace `/api/blocks/he-*` behind the kit route.
5. **§2.5 `popup:custom`** once `<NetworkChrome>` exists (architect §5.4).
6. **§2.6 Looks resolver,** with the forms' `content_prefs` cascade (Lane B / publishing forms).

## 6. Open questions for the PM
- **Package home:** keep it all in `@elkdonis/blocks/record`, or split sources and the chooser into `@elkdonis/content` (new 2026-11-08, it already has `registry.ts`)? I lean `content` for sources and `blocks/record` for rendering.
- **Templates in the shell:** shell orgs (`/sites/[slug]`) get route templates through the kit's host-resolved mount. Is the published document keyed per org in `site_config`, as today, for both planes?
