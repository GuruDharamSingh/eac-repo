# Loft scene editor for the Collect Art landing page

2026-10-29. The developer asked that the landing page's virtual gallery (the loft under the hero on
market.arts-collective.com) be edited by the site's owners and admins in the installations editor,
developed further: position and size of each frame, framing and crop, and lighting with variability
(kinds of light, room light, fixed light points now, manual placement later). This brief records what
exists, the proposed design and phases, and the decisions still open. Not started.

## What exists (verified by reading the code, 2026-10-29)

- `@elkdonis/three/hallway` (`packages/three/src/hallway/`): `HallwayExperience` with `editable`:
  drag a work in from a DOM tray (`beginTrayDrag`), pick a hung work up and move it along a wall,
  drop outline with overlap/off-wall validity, snap to the hang line, frame style per placement,
  three views (overview, wall cutaway, first-person walk), `renderDetail` side panel.
- Placement: `{ pieceId, wallId, x, y, frameId }` (`layout.ts:178`). No size: a piece is drawn at
  its recorded cm, or 1.1 m tall when none is recorded (`gallery/room.ts:212 fitPiece`). No crop.
- Lighting: fixed per venue (loft: hemisphere + ambient + one directional, `loft.tsx:152`), plus
  `PieceLights.tsx`: a pool of 8 spotlights handed to the pieces nearest the camera, each placed
  0.45 m off the wall above the piece's top edge, warm (#ffd9a6), intensity 5, angle from width.
  Fixed pool size on purpose: changing the light count recompiles shaders.
- Installations: `art_installation` (store_id, title, hallway, status) and `art_installation_piece`
  (wall_id, offset_x, centre_y, frame_style, sequence). Editor at
  `apps/art-auction/src/app/studio/installations/[id]/installation-editor.tsx`: tray, scene,
  selected-piece card (frame, take down), "On the walls" list, autosave 600 ms after a change,
  venue switch, publish toggle.
- Landing loft today (deployed 10:21): two owner-chosen works + a visitor's free spot on wall `S1`
  at fixed x positions (`home-loft-scene.tsx` `SPOTS`), settings in `site_config` `home_loft`.
  Uncommitted since: white ground for the section, per-spot frame proportion and crop (`LoftSpot`,
  `lib/loft-crop.ts`), an on-page dialog editor (`home-loft-editor.tsx`). Type check passes; not
  rendered or deployed.

## Proposed design

### Where the scene lives
Reuse the installation record rather than a parallel store, so every editor improvement serves
artists' installations too:
- One `art_installation` owned by the market's org store, flagged as the landing scene by
  `site_config` `home_loft = { installationId }`. The home page renders that installation's hang
  (status ignored: the landing scene is always shown; "publish" means "put on the landing page").
- `art_installation_piece` gains `scale real` (1 = recorded/nominal size), `ratio text`,
  `crop_x`, `crop_y`, `crop_zoom real` (defaults as today). `art_installation` gains
  `scene jsonb` for lighting, environment and the initial view. One migration.
- The visitor's free spot stays a client-side piece as now (not stored). Decision 3 below.

### Editor (lightweight game-editor practice, in `packages/three/hallway`)
What small scene editors converge on, and what applies here:
1. Select, then transform with handles and numbers, never only by drag: corner handles to scale
   (uniform; within the hang band and the wall), drag to move (exists), arrow keys nudge 1 cm
   (Shift: 10 cm), and an inspector with x, y, width, height in cm that accepts typed values.
2. Snapping with visible guides: hang line (exists), neighbours' centres and edges, equal gaps.
   Hold Alt to drop snapping.
3. Undo/redo (Ctrl-Z / Ctrl-Shift-Z) over the placement list: a history of placement arrays in
   the host editor, not in the three store (the three store is per-frame state).
4. Inspector panel for the selection, in sections: Transform, Frame (style, proportion, crop with
   the still's `cropStyles` preview), Light (per-piece lamp: auto, off, or a fixed point).
5. Lighting is a scene setting with presets first and manual placement later:
   - Room: preset (Daylight, Overcast, Evening, Gallery night, Studio), then sliders the preset
     sets: brightness (renderer exposure), warmth (colour temperature of ambient + hemisphere),
     key light direction (eight compass points + elevation) and strength, background colour.
   - Picture lamps: on/off, strength, warmth, spread, and the fixed-point set each piece may use:
     above-centre (today), above-left, above-right, pair (two lamps), uplight from the floor,
     wall wash (a wide low-intensity spot off the piece). Position is a named offset from the
     piece's top edge; the pool mechanism stays (`PieceLights`), reading the chosen offset.
   - Kinds: spot (lamps), point (a bare bulb at a fixed room point from a venue list), directional
     (sun/key), hemisphere + ambient (room). Rect-area lights are left out (no shadows, costly).
   - Later: dragging a lamp gizmo to a free position; the data model takes `{ x, y, z }` from the
     start so no migration is needed then.
6. Camera: an "initial view" bookmark (which wall and where along it, or a piece) saved with the
   scene; the landing loft opens there. "Look from here" button in the editor sets it.
7. Save: autosave to the draft as now, and an explicit "Put on the landing page" that stamps the
   installation as the landing scene; "Revert to what visitors see" reloads the saved copy.

### Landing page
- `/admin/pages` → "Edit the loft scene" opens `/admin/loft`: the installations editor hosting the
  landing installation, with the inspector and lighting panels above, and the market's whole
  catalogue as its tray (not one store's works).
- The home page still (`home-loft.tsx`) renders the saved hang as a CSS still (frames at their
  placements' relative x and size on a white wall); the 3D scene renders the installation with
  its lighting and initial view.

## Phases
1. Transform: scale on placements, handles, inspector numerics, keyboard nudge, snapping guides,
   undo/redo. Migration for `scale`. Artists' installations get this at once.
2. Framing: ratio and crop move from today's `LoftSpot` into placements (pieces cropped on a
   canvas as `loft-crop.ts` does); inspector Frame section.
3. Lighting: `scene.lighting` model, presets, room sliders, picture-lamp fixed points, per-piece
   lamp setting; `PieceLights` reads the model.
4. Landing: `/admin/loft`, `site_config` pointer, still and scene rendered from the installation,
   initial view bookmark; remove `SPOTS`.
5. Later: manual light placement, shadows (one shadow-casting key light, cost permitting),
   reflections.

Each phase is a build of art-auction; phases 1 and 3 also change `packages/three` (source-exported
to art-auction only).

## Open decisions (developer)
1. Store the scene as an installation (proposed) or as its own `site_config` document.
2. The uncommitted interim work: ship the white ground and the dialog editor (works, proportion,
   crop) now as the stop-gap, or hold everything for the scene editor. The white ground can ship
   alone.
3. Keep the visitor's free spot in the scene editor model (a placement marked `visitorSpot`) or
   drop it.
4. Lighting first cut: room presets + picture-lamp fixed points (proposed), or room light only.

## Phase 1 status (2026-10-29, source only)
Decided by the developer: the scene is an installation record; the white ground shipped alone
(deployed 12:12); the dialog editor was dropped (`home-loft-editor.tsx` deleted; the `LoftSpot`
proportion/crop model stays in `lib/loft-crop.ts` for phase 2).

Built, in `packages/three/src/hallway/` and the installations editor:
- `Placement.scale` (`layout.ts`; `placementScale`, bounds 0.25–4); migration 214 adds
  `art_installation_piece.scale` (written, **not applied**: the apply was refused by the
  permission classifier). `lib/installations.ts`, the save action and the public walk carry it.
- Corner handles on the selected piece (`HungPiece.tsx` `ScaleHandles`): uniform scale about the
  centre following the pointer's distance on the wall plane; live through `store.resize`; bounded by
  `maxScaleAt` (hang band, wall length, neighbours on the face); commits through `onPlace`.
- Snapping with guides (`DropTarget.tsx`): hang line, beside each neighbour at 0.35 m, and the
  neighbour's centre and edges when the carried piece is clear of it; blue guide lines on the wall;
  Alt held turns snapping off (`store.snapOff`).
- Keyboard: arrows nudge 1 cm (Shift 10 cm) within the band and wall; Delete/Backspace calls
  `onRemove`. Ignored while a form field has focus.
- Editor (`installation-editor.tsx`): undo/redo (Ctrl-Z, Ctrl-Shift-Z / Ctrl-Y, buttons; 100
  steps), "Position and size" inspector in cm (along the wall, centre height, width, height; width
  or height set the scale uniformly), "Reset to its recorded size".
- Verified in a dev-only harness page over the loft venue (SwiftShader screenshots): handles drawn
  on the selected piece; inspector numbers; Shift+arrow nudge; typed width scaling the piece
  uniformly; undo/redo; Delete and its undo; a tray drag snapping to the beside-guide with the line
  drawn; Alt disabling the snap; corner-handle pointer drag (see shot8 in the session). Type checks
  pass for `packages/three` (apart from pre-existing unused-import errors in other scenes) and
  art-auction.
- Deployed 2026-10-29 ~15:00: migration 214 applied by the developer (the permission classifier
  refused the runner from the session); art-auction built and restarted; `/` 200 with the loft
  markup, `/studio/installations` 307 to login, `/installations/<draft id>` 404 (drafts are not
  public) through the edge. Not verified: the editor itself with a signed-in owner on the live
  site (verified only in the harness). Note: the `.next` backups before 14:59 in
  `~/eac-backups/next/` are empty archives (taken from a named volume that is not the
  container's); follow the `docker exec … tar` recipe in `docs/reference/ops.md` instead.

## Phase 2 status (2026-10-29, deployed)
Framing moved from the landing page's `LoftSpot` onto placements:
- `Placement.ratio` ('auto' or a `FrameRatio`) and `Placement.crop` ({x, y, zoom}) in
  `packages/three/src/hallway/framing.ts` (vocabulary, `placementRatio`, `placementCrop`,
  `framedPiece`, `cropUv`). Migration 215 adds `ratio`, `crop_x`, `crop_y`, `crop_zoom` to
  `art_installation_piece` (written, **not applied**: the classifier refuses migrations from the
  session).
- Rendering (`HungPiece.tsx`): a fixed ratio keeps the recorded height and takes the width from the
  ratio (`pieceSize(…, ratio)` → `framedPiece`), so the inspector's cm and the handles' bounds
  follow; the crop is a texture repeat/offset (`cropUv`: cover fit at the zoom, the chosen point kept
  where object-position would put it), not a canvas, so it is live and costs nothing. 'auto' at zoom 1
  keeps `fitPiece`'s letterbox as before. The drop outline carries the ratio (`HallwayDrag.ratio`).
- Editor: "Framing" section in the selected-piece card (`FramingFields`): proportion select, Zoom /
  Across / Down sliders, a CSS preview drawn with the same rule, "Show it whole, as shot". A slider
  drag is one undo step (`beginStroke` marks the hang on pointerdown/focus; moves bypass the history).
- Data: `InstallationPiece.ratio` and `.crop`; the save action bounds them (ratio against
  `LOFT_RATIOS` in `lib/loft-crop.ts`, which stays the server-side copy of the vocabulary because the
  hallway dist carries a `'use client'` banner; phase 4 retires `loft-crop.ts`'s spot model but the
  ratio list should then move to a plain shared module).
- Verified in the harness (loft, one piece): 'As shot' 147×110 cm → Square 110×110 with the texture
  cropped; zoom 1.6 at 20 % across rendered in the scene as in the preview (screenshot); the save
  payload carried `["1:1", {x: 20, y: 50, zoom: 1.6}]`; three Ctrl-Z steps undid the across stroke,
  the zoom stroke and the ratio. Type checks pass (three hallway, art-auction).
- Deployed 2026-10-29 ~23:50: migration 215 applied by the developer (with 216 and 217 from other
  sessions); hallway package and art-auction rebuilt (no build errors), container restarted;
  `/` 200 with the loft markup, `/studio/installations` 307 to login, `/installations/<draft id>`
  404, no errors in the log; the draft's piece rows read back with the four framing columns at
  their defaults. Not verified: the Framing section with a signed-in owner on the live site
  (harness only). `.next` backup: `~/eac-backups/next/art-auction-20261029-2343.tgz` (52 MB).

## Phase 3 status (2026-10-30; deployed by 2026-11-01)
First cut as proposed in decision 4 (room presets and sliders plus picture-lamp fixed points); the
decision was not answered, so the proposal was taken as the default. Bare-bulb point lights from a
venue list were left out of this cut.
- Model: `packages/three/src/hallway/lighting.ts` (no React or three). `SceneLighting` = room
  brightness, warmth, key light direction (the venue's own or a compass point, north = −Z) with
  height and strength, background, and `lamps` {on, strength, warmth, spread}. Presets: Daylight
  (the venues as built), Overcast, Evening, Gallery night, Studio. `normalizeLighting` /
  `normalizeScene` bound every field; `presetOf` names the preset a setting matches ("Custom" when
  none). Per piece, `Placement.lamp` = {at: above | above-left | above-right | pair | uplight |
  wash | off, offset reserved for a freely placed lamp}; `lampRigs` gives each point's lamps.
- Room lights moved out of the shells into `Venue.lights` (background, hemisphere, ambient, key);
  `SceneLights` draws them with the settings applied, so the defaults draw each room as before.
  The morning room has a background only (a scan drawn as captured): the panel says so and shows
  only the background there; picture lamps do not apply where a room keeps its own frames.
- `PieceLights` keeps its pool of 8 spotlights; a pair takes two pool entries; colour, strength,
  angle and distance come from the settings and the piece's point each frame (no shader recompile).
- New build entry `@elkdonis/three/hallway/model` (`src/hallway/model.ts`), built by a second tsup
  config into `dist-plain/` without the `'use client'` banner, so server actions can import the
  vocabulary and bounds. The save action now checks ratios with `isFrameRatio` from it instead of
  `LOFT_RATIOS`.
- Migration 218 (written, **not applied**): `art_installation.scene jsonb` default `{}`,
  `art_installation_piece.lamp jsonb` default `{"at": "above"}`. `lib/installations.ts` reads and
  writes both; `saveSceneAction` stores the bounded scene. The public walk passes the lighting and
  each piece's lamp.
- Editor: "Lighting" panel (presets, room sliders, light-from select, background colour, picture
  lamps) and a "Lamp" select on the selected piece. Undo covers the hang and the lighting together;
  the scene saves on its own 600 ms timer. The history push was moved out of React state updaters,
  which React may call twice (in development each step had been recorded twice, so consecutive
  undos stalled; present since phase 1).
- Verified in the harness (loft, three works, SwiftShader screenshots): defaults look as before;
  Gallery night and Evening applied and saved with the preset's values; a Brightness stroke showed
  "Custom" and saved 1.6; three undos returned Evening, Gallery night, Daylight, and redo/undo
  stepped once each; lamp points uplight, pair and wash drew distinct pools; the lamp switch and a
  piece's lamp undid in one step each; no console errors. Type checks: hallway sources 0 errors,
  art-auction 0 errors.
- Deployed by 2026-11-01: migration 218 applied by the developer; art-auction was rebuilt by another
  session (`BUILD_ID` 2026-11-01 04:52 UTC) and the source is in commit `61835a3`. Checked 2026-11-01
  through the edge: `/` 200 with the loft markup, `/studio/installations` 307, a draft installation
  404; the live client chunks contain the Lighting panel; a draft's rows read back `scene = {}` and
  `lamp = {"at": "above"}`; no column errors in the log. Not verified: the Lighting panel with a
  signed-in owner on the live site (harness only).

## Phase 4 status (2026-11-01, deployed)
Decision 3 was not answered; the visitors' free spot was kept, as a placement in the editor that is
stored in the scene (not in the hang).
- Model: `packages/three/src/hallway/scene.ts` (plain; exported from `/hallway` and `/hallway/model`).
  The scene document is `{ lighting, view, openSpot }`: `view` = opening view {mode, side, s along the
  route} or null; `openSpot` = {wallId, x, y, scale} or null; `OPEN_SPOT_ID` names its placeholder
  piece. `normalizeScene` moved here from `lighting.ts`. `HallwayExperience` takes `initialWall`
  (used when no `focusPieceId` is given).
- Migration 230 (written, **not applied**): `art_installation.store_id` nullable, new `org_id`
  (organisations), check that one of the two is set. `lib/installations.ts`: `Installation.storeId`
  is nullable, `orgId` added, `createOrgInstallation`, `listOrgHangableArtworks` (every pictured work
  on show in the marketplace), `listArtworksByIds`, and `saveInstallationLayout(id, scope, …)` with
  scope `{storeId}` or `{orgId}` (org scope accepts only works on show in that org). Studio routes
  now refuse an installation with no store. Payload bounding moved to `lib/installation-input.ts`
  (`cleanPieces`).
- Landing (`lib/landing-loft.ts`): `site_config` (org market) `home_loft = { installationId,
  published: { at, hallway, scene, pieces } | null }`. The editor autosaves to the installation;
  "Put on the landing page" copies it into `published`, which is what the home page draws, so work in
  progress never shows; "Go back to what visitors see" writes the copy back. With nothing published
  (the state on 2026-11-01: no `home_loft` row) the home page shows the starting hang: the two newest
  pictured works at the old spot positions and the free spot on wall `S1`. The first visit to
  `/admin/loft` creates the installation from what visitors see, so opening the editor changes nothing.
- `/admin/loft` (pages editors; inside the admin layout): `InstallationEditor` with
  `studioControls={false}` (no rename, space or publish toggle), `openSpot`, the market's catalogue
  as the tray, and a toolbar ("Put on the landing page", "Go back to what visitors see", publish
  time). Actions in `app/admin/loft/actions.ts` check the caller and that the id is the landing
  installation. `/admin/pages` links to it in place of the two-work form.
- Editor (all installations): "Opening view" panel ("Look from here" stores the current mode and
  cutaway position; Clear); undo covers it. With `openSpot`, the free spot is a tray item and a
  placement that can be moved, resized and taken down; its card shows position and size only.
- Home page: `home-loft.tsx` draws the still from the published hang (the wall with the most on it;
  frames at their positions and sizes in metres, scaled into a 3.2 m band on the floor line, with
  each frame's ratio and crop); `home-loft-scene.tsx` renders the installation with its framing,
  lamps, lighting and opening view, and the visitor's pick in the free spot. `SPOTS`, the canvas
  crop (`lib/loft-crop.ts`) and the two-work form (`admin/pages/loft-form.tsx`, `saveHomeLoftAction`)
  are deleted, with the dialog editor's leftover CSS.
- Public walk (`/installations/<id>`) opens on the saved view.
- Verified in a dev-only harness (deleted) over the live catalogue (read-only), SwiftShader
  screenshots: the starting hang drew two works and the free spot; in the editor the free spot
  listed third on the walls, a typed width saved scale 1.395, "Look from here" saved
  `{mode: wall, side: L, s: 4.2}`, the free spot's card had no framing fields, taking it down set
  `openSpot` null and returned it to the tray, and undo restored it; the home still drawn from the
  saved state showed the first work 1.4× larger and the 3D loft opened at s = 4.2; no console errors.
  `/` 200 with the placed still in a dev preview; `/admin/loft` 307 to login. Type checks: hallway
  sources 0 errors, art-auction 0 errors. Not verified: `/admin/loft` signed in (needs migration 230;
  its first visit writes the installation and the `home_loft` row), publish and revert against the
  database.
- Deployed 2026-11-01 ~20:01 UTC: migration 230 applied by the developer (with 231 from another
  session); three package and art-auction rebuilt (the build also carried other sessions' service and
  page-builder edits; type check clean first), container restarted. Through the edge: `/` 200 with the
  placed still (`hl-hang`, frames at the starting positions, the free spot), the `.hl-hang` rule in the
  served CSS chunk, `/admin/loft` and `/admin/pages` 307 to login, `/studio/installations` 307, a draft
  installation 404, no errors in the log. No `home_loft` row yet: it is written on the first signed-in
  visit to `/admin/loft`. `.next` backup: `~/eac-backups/next/art-auction-20261101-1500.tgz` (52 MB).

## History
- 2026-10-29: brief written after the developer's scope change; phase 1 built and deployed the same
  day; phase 2 built and deployed the same evening (migration 215).
- 2026-10-30: phase 3 (lighting) built in source; migration 218 pending.
- 2026-11-01: migration 218 applied; phase 3 found live in another session's rebuild and checked.
- 2026-11-01: phase 4 (landing from an installation, `/admin/loft`) built, migration 230 applied, deployed.
