# Handover: loft scene editor, phases 3–4 (2026-11-01)

Covers the Collect Art landing loft on art-auction (market.arts-collective.com),
brief `docs/open/LOFT_SCENE_EDITOR_BRIEF_2026-10-29.md`. Phase 3 (lighting
presets, room sliders, picture-lamp points) was found already live in another
session's build of 2026-11-01 04:52 UTC and was verified and documented. Phase 4
(`/admin/loft`: the landing loft as an org-owned installation edited in the
installations editor, published as a snapshot) was built, deployed and verified
on 2026-11-01. Phase 5 is open. Nothing is committed.

## Current state
- Migration 230 (`art_installation.store_id` nullable, `org_id` added, owner
  check `store_id IS NOT NULL OR org_id IS NOT NULL`) applied 2026-11-01 19:59 UTC.
- art-auction rebuilt 2026-11-01 (`BUILD_ID` 20:00:48 UTC) and restarted.
  Backup of the previous `.next`: `~/eac-backups/next/art-auction-20261101-1500.tgz`.
  The build also shipped other sessions' uncommitted edits in `packages/services`
  (obs, recordings, relay, stream-chat, media-convert, social-feeds, reels, index)
  and `packages/page-builder` `editor.tsx`; the type check was clean.
- Data model:
  - Scene document `art_installation.scene` = `{ lighting, view, openSpot }`,
    bounded by `normalizeScene` in `packages/three/src/hallway/scene.ts`.
  - `site_config` row (org `market`, key `home_loft`) =
    `{ installationId, published: { at, hallway, scene, pieces } | null }`.
    2026-11-01: the row does not exist yet; it is created on the first signed-in
    visit to `/admin/loft` (`ensureLandingInstallation`).
  - The home page draws only `published`. With nothing published it draws the
    seed (two newest pictured works plus the visitors' free spot;
    `SEED_SPOTS`, `SEED_OPEN_SPOT` in `apps/art-auction/src/lib/landing-loft.ts`).
- Free spot: a placement with id `OPEN_SPOT_ID` in the editor, saved in
  `scene.openSpot`, not in the layout. Visitors' picks stay in `localStorage`.
- Opening view: "Look from here" in the editor saves `scene.view`
  (`{mode, side, s}`); the home scene and the public walk pass it to
  `HallwayExperience` as `initialView` / `initialWall`.

## Verified (2026-11-01)
- Dev harness (removed): seed render; spot listed third in the editor; typed
  width saved scale 1.395; "Look from here" saved `{mode: wall, side: L, s: 4.2}`;
  spot card shows only position and size; take down sets `openSpot` null, undo
  restores it; still image and 3D view follow the saved state; no console errors.
- Edge after deploy: `/` 200 with `hl-hang` and the free spot; `.hl-hang` rule in
  the served CSS; `/admin/loft`, `/admin/pages`, `/studio/installations` 307 to
  login; draft installation 404; no log errors.

## Not verified
- `/admin/loft` signed in, including creation of the landing installation and the
  `home_loft` row, "Put on the landing page" and "Go back to what visitors see"
  against the database.

## Files
- New: `packages/db/migrations/230_landing_installation.sql`,
  `packages/three/src/hallway/scene.ts`, `apps/art-auction/src/app/admin/loft/`
  (`page.tsx`, `actions.ts`, `landing-loft-editor.tsx`),
  `apps/art-auction/src/lib/{landing-loft,installation-input,open-spot}.ts`.
- Changed: `packages/three/src/hallway/{HallwayExperience.tsx,index.ts,lighting.ts,model.ts}`,
  `apps/art-auction/src/lib/{installations,home-sections}.ts`,
  `apps/art-auction/src/app/{page.tsx,home-actions.ts,admin/pages/page.tsx}`,
  `apps/art-auction/src/app/studio/installations/{actions.ts,[id]/page.tsx,[id]/installation-editor.tsx}`,
  `apps/art-auction/src/app/installations/[id]/{page.tsx,installation-walk.tsx}`,
  `apps/art-auction/src/components/{home-loft.tsx,home-loft-scene.tsx,home-hero.css}`.
- Deleted (working tree only, not staged): `apps/art-auction/src/app/admin/pages/loft-form.tsx`,
  `apps/art-auction/src/lib/loft-crop.ts`.
- Docs: brief "Phase 4 status", `.claude/rules/areas/three.md` (scene-wide
  settings go in `hallway/scene.ts`), CLAUDE.md current-work line.

## Rules and constraints
- Import server-side from `@elkdonis/three/hallway/model` (built to `dist-plain/`):
  the client entries carry a `'use client'` banner.
- Build `packages/three` before the app:
  `docker exec eac-art-auction sh -c 'cd /app/packages/three && pnpm build && cd /app/apps/art-auction && NEXT_BUILD_CPUS=4 pnpm build'`,
  then `docker compose restart art-auction`.
- Keep the landing editor's save callbacks memoised (`useCallback`): the
  editor's save effects depend on them and inline functions re-save every render.
- The org-scope layout save accepts only public-status works of that org
  (`saveInstallationLayout`, `hangScope`).

## Open items
- Signed-in check of `/admin/loft`: make one change, publish, check `/`, then
  "Go back". Owner: developer or next session.
- Phase 5 (brief): free picture-lamp placement, one shadow-casting light if
  performance allows, reflections. Lower priority than the November silent auction.
- Deferred: bare-bulb point lights.
- Commit phases 3–4 when asked; commit only the files listed above.
- Leftovers: volume `aa-preview-next` (dev harness cache) can be removed;
  `eac-admin` is running (CLAUDE.md lists it as stopped since 2026-10-19; it was
  started for migrations).
