# F. The Channel hub card, built

Date: 2026-11-15. By system32-fc. Paths are from `~/eac`. Nothing committed, built or restarted; no migration.
Backups of the three existing files I changed are in `~/eac-backups/2026-11-15-hubcard/`.

## What it is

A **SurfaceCard face** (plain, flat, surface style) on sunjay's hub, in the "Make something" band, for owners and guides only.
Click it and a **custom surface "channel"** opens: header (Channel, org, Board | Week), the chart on the left (a2's `ChannelGrid`
inside `ChannelDoor`, so a square opens the same quick form as `/channel`), a scrolling list of pieces on the right (the shared
`PieceList`). A piece (from the list, or its name in the chart) opens its `PieceSummary` (layout "sheet") in place, with
"← All pieces" and "Open in Channel ↗" (`/channel?piece=<key>&tab=plan`). Footer: "Open the Channel page ↗".

## Files

New, `packages/channel/src/hub/` (React only, no `next/*` imports):
- `data.ts`: `ChannelHubData` and friends, types only (matrix, counts, board and week grids, pieces with a ready `PieceSummaryView`).
- `server.ts`: `channelHubData(model, links, orgName)`, the reducer. Reuses a2's `boardGrid`, `weekGrid`, `routineRows`, `buildPieceSummaryView`, `channelNextMoves`. Pieces capped at 24; the face shows 6.
- `Face.tsx`: `ChannelHubFace`, the mini matrix of state dots and "N waiting · N did not go".
- `Panel.tsx`: `ChannelHubPanel`, the pop-up body (client). Writes only through the `run` prop.
- `index.ts`: exports Face, Panel and the types.
- `hub.css`: `.chp-*` styles on the surface tokens (`--sf-*`, falling back to the site's shadcn tokens). Thin lines, no shadows, no gradients.

Changed, `packages/channel/package.json` (export lines only): `./hub`, `./hub/server`, `./hub.css`.

New, sunjay:
- `apps/sunjay/src/lib/hub-channel.ts`: `loadHubChannel(viewer)`, `siteChannelLoader` (via `lib/channel-model.ts`) then `channelHubData`. Named `hub-channel`, not `channel-*`, to stay out of a2's lane.
- `apps/sunjay/src/app/api/hub/channel/route.ts`: the data route (below).
- `apps/sunjay/src/components/hub/ChannelFace.tsx`: the SurfaceCard face; descriptor `{ type: "custom", key: "channel", size: "full" }`.
- `apps/sunjay/src/components/hub/ChannelSurface.tsx`: the surface; fetches the route, draws the panel, wraps `runChannelAction` to refetch after a write that went.

Changed, sunjay (minimal): `components/hub/HubSurfaces.tsx` (registers `channel` under `connectors.custom`, plus one import);
`app/hub/page.tsx` (four CSS imports, loads `channelData` for `viewer.canEdit` with a `.catch`, renders `<ChannelFace>` after `ComposeFace`).

Harness: `scripts/channel-harness/hub-card/` (`entry.tsx`, `sample.ts`, `build.mjs`, `shot.mjs`, `stubs/`, `README.md`; `out/` and `png/` are git-ignored by `scripts/channel-harness/.gitignore`).

## Data route and gate

`GET /api/hub/channel`: `getApiEditor()` (signed in and owner or guide of `siteConfig.orgId`, the same rule as `/channel`) else 403. The org is never a parameter.
`dynamic = "force-dynamic"`, `Cache-Control: no-store`. GET only. A read failure returns 500 with a plain message. It returns `ChannelHubData` for this site's org only.
Writes do not use it: they go through `runChannelAction` (`lib/channel-door.ts`, `SITE_DOOR_ALLOW`; plans only, nothing sends).

## Two things I found

1. **Nested dialogs.** `ChannelGrid`'s quick form is a `<dialog>` and the surface is a `<dialog>`. The nesting works natively (opens on top, takes focus, Esc and ✕ close only the form). One real bug: React bubbles a dialog's `close` and `cancel` up the React tree, so closing the form fired the surface's own close handler and **took the whole surface down**. `Panel.tsx` stops both events at its root (`keepInside`). Harness result, `window.__nest`: form open, focus inside it, on top, surface still open; after ✕ the form is closed, the surface is open and holds focus. No `cellMode="inline"` is needed from a2. If a2 renders a dialog elsewhere in the hub, the same wrapper applies.
2. **Pieces list** uses `PieceList` from `@elkdonis/content/ui` (compact rows: cover, title, kind, status chip, date), fed a `ContentListItem` built in `server.ts` (same mapping as arts-collective's `content-list.ts`). Needs `@elkdonis/content/content.css`.

Read-only imports from a2's `site/` (relative, inside the package): `runs` (`ChannelDoor`, `RunButton`, `SuggestionActs`, `StepCheck`, `PlanActions`), `grid` (`ChannelGrid`), `grid-data`, `summary-view`, `view`. If a2's refactor renames those, `Panel.tsx` and `server.ts` break; typecheck will say so.

## Mounting on another site (ifac, katie)

Needs the site's own Channel (loader and door), which ifac does not have yet (C, B.6). Then, copying sunjay:
1. `lib/hub-channel.ts`: `channelHubData(await loadSiteChannel(viewer), { channel: "/channel" }, siteConfig.orgName)`.
2. `app/api/hub/channel/route.ts`: same gate (that site's editor check), `no-store`.
3. `ChannelFace.tsx` and `ChannelSurface.tsx` copied (the surface imports that site's `runChannelAction`).
4. Register `channel: () => <ChannelSurface />` in that site's `connectors.custom` (its `HubSurfaces`).
5. Hub page: load for editors, render the face in a `SurfaceCardGrid`, import `@elkdonis/channel/site.css`, `hub.css`, `@elkdonis/content/content.css`, `summary.css`.
Katie's hub has only a link tile to `/channel` today; it can take the same five steps. The face and panel need no per-site code; the sites' fonts go on `.kch` as for `/channel`.

## Screenshots

`~/eac/scripts/channel-harness/hub-card/png/` (sample model from katie's harness, sunjay palette, real `SurfaceProvider`):
- `hubcard-face-1280.png`, `hubcard-face-phone-390.png`: the tile among others.
- `hubcard-panel-1280.png`, `hubcard-panel-phone-390.png`: pop-up, Board.
- `hubcard-panel-week-1280.png`: Week.
- `hubcard-panel-piece-1280.png`, `hubcard-panel-piece-phone-390.png`: a piece open (plan, checks).
- `hubcard-panel-cell-1280.png`, `hubcard-panel-cell-phone-390.png`: a square's quick form over the surface.
- `hubcard-panel-cell-closed-1280.png`: form closed, surface still open.
Recipe and the page list: `scripts/channel-harness/hub-card/README.md`.

## Typecheck

`packages/channel`: 0 errors. `apps/sunjay`: 0 errors. (Run after the last edit.) Typecheck does not run the Next build; the route and the page were not exercised on a live server, only in the harness.

## Left

- **Calendar card tie-in** (E): the hub calendar card and this one do not know each other. The week mode here is Channel's week; a day click does not open the calendar.
- **Manage groups inside the piece view**: the piece view is the shared summary with Next, Plan and Where it went. No Edit, no Make into, no Open in Studio (they need the network hand-off URLs and the quick form's kind map from `page.tsx`). "Open in Channel ↗" is the way to them.
- The pop-up shows no kind chips or Out table; "Open the Channel page" is the way to those.
- ifac needs its own `/channel` before it can mount the card.
- The panel's own "Channel" heading repeats the surface masthead; kept to match the brief's header.
- No live test: needs a build and a signed-in editor session, which the rules forbid me to do.

## Round 2 (2026-11-15, fc's review)

Done:
- **Face headers** are the outlet icons (`OutletIcon` from `@elkdonis/content/ui`), each with `title` and `aria-label` set to the full name. `ChannelHubMatrix.cols` gained `outlet`.
- **Panel heading:** the inner "Channel" h2 is gone; the org name (muted) and Board | Week sit on one row. Surface kind is now `board` (grid glyph, in the header and on the face); eyebrow "Out, planned and waiting".
- **Phone (<640px):** the pieces list is above the board.
- **Piece view actions:** Edit, Make into and Open in Studio now show. `ChannelHubPiece` gained `editHref`, `studioHref`, `makeInto`. The reducer takes `HubLinks.studio`, `HubLinks.makeInto` and `HubLinks.quickKinds`; sunjay's `lib/hub-channel.ts` builds them exactly as `ChannelSitePage` does (`handoffUrl`, `setStudioBackParams`, org, back to `/channel`). Edit opens `/channel?piece=<key>&edit=1` for the site's quick-form kinds (sunjay: meeting), else Studio. "Next for this piece" rows were already in (from `channelNextMoves`).
- **Byline:** the live path is `Piece.siteName` from the model (the site group's name), so it is the org's name there; only the harness fixture said Katie. The fixture now sets `siteName` to "Para Theater".
- Typecheck after these edits: `packages/channel` 0, `apps/sunjay` 0. All ten shots re-taken (1280 and 390).

Update: a2 landed `density="compact"`; the panel passes it (Board and Week). Left: calendar tie-in; "Manage groups" beyond Edit, Make into and Studio; ifac needs its own `/channel`.
