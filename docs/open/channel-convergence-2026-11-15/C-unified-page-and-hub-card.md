# C. One Channel page, and a Channel hub card

Date: 2026-11-15. Read-only design pass for system32-fc. No code was edited.
Paths are from `~/eac`. Format: `path:line`.

Lanes used below: **a2** = Channel (`packages/channel/**`, `apps/*/src/app/channel/**`, `apps/*/src/lib/channel-*`). **fc** = summary/content. **hub** = `packages/hub`. **new** = a new file nobody owns.

---

# Part 1. Today

## 1.1 The site Channel (`packages/channel/src/site/`)

One route, five tabs, set by `?tab=`. The tab list is `TABS` at `page.tsx:83-90`. The tab is parsed at `page.tsx:116`. Default is Home.

| Tab | What it renders | Data | Shared parts |
|---|---|---|---|
| Home | "Next" row of up to 4 move cards (`page.tsx:308-322`), then "Recent": 6 list rows (`page.tsx:324-380`) | `channelNextMoves(model,{limit:4})` (`page.tsx:197-208`); `listContent(..., limit 6)` (`page.tsx:172-186`) | `NextMoves`/`MoveCard` (`runs.tsx:196`, `runs.tsx:153`); `kch-list` rows (`page.tsx:347-370`) |
| Board | Pieces x outlets table, kind chips (`tabs.tsx:270-286`) | `model.pieces` -> `boardGrid` (`grid-data.ts:107`), columns from `BOARD_COLUMNS` (`view.ts:36`) | `ChannelGrid` (`grid.tsx:49`); `KindChips` (`tabs.tsx:62`); `Thumb` (`tabs.tsx:23`) |
| Queue, by week | Pieces x 7 days, routine rows above (`tabs.tsx:118-159`) | `weekGrid` (`grid-data.ts:152`), `routineRows` (`grid-data.ts:186`), `model.week` | Same `ChannelGrid`; `QueueOptions` (`tabs.tsx:87`) |
| Queue, by piece | One piece: outlet types x days, open routine slots, plan steps (`tabs.tsx:161-268`) | `pieceGrid` (`grid-data.ts:170`), `parsePlan(p.plan.bodyMd)` (`tabs.tsx:181`) | `ChannelGrid`; `RunButton`; `PieceSteps` (`runs.tsx:212`) |
| Out | Outlet filter list + "what went where" table, last 30 days (`tabs.tsx:373-470`) | `outRows(model)` (`view.ts:90`), `OUT_OUTLETS` (`view.ts:100`) | `links.network` for Retry (posting stays on arts-collective, `tabs.tsx:467`) |
| Library | Type chips + a **list** (4rem cover, title, meta, Edit here, Open in Studio) + "More" cursor (`page.tsx:329-379`) | `listContent(... limit 40, types, cursor)` (`page.tsx:172-186`) | `.kch-list`, `.kch-row`, `.kch-cover` (`site.css:54-56`) |

Facts that shape the design:
- **Board and Queue are already one table.** Comment at `grid-data.ts:3-12` and `grid.tsx:10-17`. The toggle is two tabs, not one view.
- **The manage-piece pop-up is already shared.** `PieceSummary` (`tabs.tsx:296-366`) wraps the shared `@elkdonis/content/summary` component in layout "popup" (`tabs.tsx:350`). It carries Edit, Make into and Open in Studio. It is opened by `?piece=` (`page.tsx:122`, `page.tsx:232-251`) and only on the board/queue tabs (`page.tsx:219`). From Library or Home, a piece cannot open it.
- **Library is a list, not a grid.** That is the gap behind "library should be a grid".
- **The queue "strip" exists as the Home "Next" row.** It is `.kch-moves`, an auto-fill grid of cards (`site.css:65-66`). The week and the routine slots live on the Queue tab.
- **Counts for badges** are `queued` (suggestions) and `failed` (`page.tsx:168-170`).
- **One model read** (`loadModel`, `page.tsx:164`) feeds Home moves, Board, Queue, Out and the pop-up. Library alone adds `listContent`. The model type is at `packages/channel/src/model.ts:226-247`. `Piece` has `imageUrl`, `row`, `timeline`, `suggestions` (`model.ts:127-158`).
- **Writes.** Every move goes through the site's `ChannelDoor` (`runs.tsx:20`). That is a "use server" wrapper over `performSiteChannelAction`. Sunjay's is `apps/sunjay/src/lib/channel-door.ts:18-29`. The allow-list is `SITE_DOOR_ALLOW` (`view.ts:11-18`). Plans only; nothing is sent.
- **Loader.** `siteChannelLoader` (`server.ts:13-35`); sunjay binds it at `apps/sunjay/src/lib/channel-model.ts:39-42`.
- **Phone.** Tables scroll sideways in `.kch-board-wrap` (`site.css:119`). The quick form turns into a bottom sheet at 40rem (`site.css:232`). The pop-up is a bottom sheet below 640px (`packages/content/src/summary/types.ts:86-90`).

## 1.2 arts-collective `/channel` (the network host)

Not the same code. It is a sidebar app, not tabs.
- Route: `apps/arts-collective/src/app/channel/page.tsx:9-25`. Home, with `?view=matrix` for the coverage matrix.
- Sidebar rows: Home, New post, Queue, Routines, Live, then Content kinds, Outlets, Audience (`apps/arts-collective/src/components/channel/ChannelNav.tsx:64-125`).
- Separate routes: `channel/queue`, `channel/routines`, `channel/outlets`, `channel/new`, `channel/piece/[kind]/[id]`.
- Library is a surface, and it is **bricks with a lightbox** (`apps/arts-collective/src/components/channel/Library.tsx:15-45`). The shared `ContentLibrary` (`packages/content/src/ui/ContentLibrary.tsx:1-50`) has `bricks | list` views. So the grid Justin wants already exists on the network host. Only the site copy is a list.
- Home's next row: `NextRow.tsx:21-50`. The site's `NextMoves` says it is "the same moves, from the same reader" (`runs.tsx:195`).
- Posting to Instagram and Facebook lives only here (`tabs.tsx:467`).

## 1.3 Hub cards and the surface UI

**Two card systems live side by side.**

1. **`packages/hub` contract cards** (Industry `hc-*` look): Members, Site Builder, Review.
   - Contract: `packages/hub/src/contract.ts`.
     - A card is a client half, `defineHubCard` (`contract.ts:168-170`), and a server half, `defineHubCardServer` (`contract.ts:172-174`).
     - Card def: `id, title, icon, capability, gate, actions, retires, Face, Popup, Detail, central?` (`contract.ts:130-152`).
     - Server def: `load(site, viewer)` and `loadDetail` (`contract.ts:154-159`).
     - The host supplies `HubCardHost` with `act` (the write door), `navigate`, `refresh`, `hubHref` (`contract.ts:96-122`).
     - `central` ("Channel/Studio-backed cards: Open = an SSO hop", `contract.ts:150-151`) is **not read by any host** (grep of `packages/hub/src` and `apps/*/src` finds no use).
   - Smallest example: Review card, `packages/hub/src/review/card.tsx:13-77`; loader `packages/hub/src/server/review.ts:26-70`. Exports are listed in `packages/hub/package.json:9-29`.
   - Mount, sunjay: `apps/sunjay/src/components/hub/hub-card-host.tsx:19-49` (host), `:52-69` (card, then popup), `:71-87` (detail). Page wiring: `apps/sunjay/src/app/hub/page.tsx:125-132` (load), `:282-291` ("Running things" band). Only Site Builder is mounted there.
   - Mount, IFAC: `apps/ifac/src/components/hub/hub-card-host.tsx:19-60`; page `apps/ifac/src/app/hub/page.tsx:359-360` (Members, Review).
2. **`packages/cms-ui/src/surface`** ("Surface UI", `eac-surface` look). Used by most tiles.
   - `SurfaceCard` face: `surface` descriptor, `href`, `onClick`, `preview` (server-rendered, "costs nothing on the client"), `layout`, `wide` (`packages/cms-ui/src/surface/SurfaceCard.tsx:23-110`). `SurfaceCardGrid` lays tiles out.
   - A descriptor is data (`types.ts:41-60`). `custom` descriptors are drawn by `connectors.custom[key]` (`types.ts:229`, `types.ts:1463-1466`; `SurfaceRouter.tsx` `case "custom"`).
   - `SurfaceFrame` is the popup (`SurfaceShell.tsx:54`). `SurfacePage` is the same object at page size, "face -> surface -> page" (`SurfacePage.tsx:1-84`).
   - `ComposeSurface` is a two-pane popup: catalogue, then form (`surfaces/ComposeSurface.tsx:1-60`).
   - Sunjay's hub is all these: `SurfaceCardGrid`, `ComposeFace`, `PipelineFace`, `CalendarFace` (`apps/sunjay/src/app/hub/page.tsx:189-236`). IFAC's too (`apps/ifac/src/app/hub/page.tsx:311-322`).

**Does a "content library" or "Publish" hub card exist? No contract card, and the library is mounted nowhere.**
- `packages/content/src/ui/ContentLibrary.tsx` is **not imported by any app** (grep of `apps` and `packages`: only its own folder; `apps/hidden-enneagram` has its own local `PublishCard`, `apps/hidden-enneagram/src/components/publish/publish-door.tsx:124`).
- `PublishCardFace` and `PublishPopup` exist (`packages/content/src/ui/PublishCard.tsx:1-40`, exported at `packages/content/src/ui/index.ts`) but **no app uses them**. They are not wrapped in `defineHubCard`. The doc says so: "No hub card is wired (`defineHubCard` waits)" (`docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md:411`).
- The Publish card and `/content` page were a design prompt only (`docs/open/HUB_CARD_PROMPTS_2026-11-08.md:76-92`). No `/content` route exists in IFAC or sunjay (`ls apps/ifac/src/app`; sunjay has only `manage/content`).
- What Justin probably remembers: **IFAC's "Publish" tile**. It is a plain `SurfaceCard` that opens `/hub/compose` (`apps/ifac/src/app/hub/page.tsx:74-78` and `:311-322`; page `apps/ifac/src/app/hub/compose/page.tsx:1-104`). It is compose, not a library. Sunjay's hub has the compose popup face (`ComposeFace`, `apps/sunjay/src/app/hub/page.tsx:207`).
- Katie's hub has only a link tile to `/channel` (`apps/katie-the-potter/src/app/hub/page.tsx:34`). IFAC has **no `/channel` route, door or loader** at all.

**The write door matters.**
- `performHubAction` refuses every channel entry. It never sets `siteChannel` (`packages/actions/src/server/hub-door.ts:25-38`; `packages/actions/src/server/run.ts:450`; `site-channel-door.ts:15-17`; `org.ts:52`).
- Sunjay's hub door allows only Site Builder ids (`apps/sunjay/src/app/hub/actions.ts:11-23`).
- So a Channel card's `host.act` must call the site's **channel door** (`performSiteChannelAction`, `site-channel-door.ts:40-64`), not `runHubAction`.

---

# Part 2. Proposal

Justin's words, as the brief: the queue is a strip across the top, like the dock. Library, Home, Board and Queue become one page. Pieces shown like Library, the board matrix on the right. A Channel hub card on the Para Theater hub opens the chart. Clicking a piece opens a surface manage-piece. Library is a grid.

## A. The unified Channel page

Replace the five tabs with **one page**. The route stays `/channel` on each site.

### A.1 Desktop wireframe (>= 60rem)

```
+--------------------------------------------------------------------------------+
| Channel                                         [+ New v]  [Open Studio ^]     |
+--------------------------------------------------------------------------------+
| QUEUE  < scroll >                                                              |
| [Accept: "Bud vase" on IG  Wed ] [Fill slot: Sunday post] [Plan: "Mug set"]    |
| [Did not go . 2 ] | Week: Mo Tu We* Th Fr Sa Su  (counts)  | Routines: 1 open   |
+--------------------------------------------------------+------------------------+
| PIECES  [All|Artwork|Writing|Meeting..]                | BOARD  [Outlets|Week]  |
|                                                        |                        |
| +------+ +------+ +------+                             |        Site IG FB Vid  |
| |cover | |cover | |cover |                             | Vase    o   o  .  .    |
| |Vase  | |Mug   | |Bowl  |                             | Mug     o   s  p  .    |
| |o o s | |o . . | |s p . |   <- mini outlet dots       | Bowl    s   p  .  .    |
| +------+ +------+ +------+                             | Tea set .   .  .  .    |
| +------+ +------+ +------+                             |  (sticky; row = piece, |
| ...scrolls                                             |   cell = quick form)   |
+--------------------------------------------------------+------------------------+
| OUT  Last 30 days  [Everything | Did not go 2]  table (Piece, Outlet, When, ...) |
+--------------------------------------------------------------------------------+
   a piece (grid brick, matrix name, strip card) opens the manage-piece pop-up from the right
```

- **Queue strip (top).** One scrolling row, dock-like. It holds, in order:
  - The Next moves: `channelNextMoves(model)` as compact cards, same `SiteMove` shape (`page.tsx:197-208`, `runs.tsx:153`).
  - Failed count (`page.tsx:169`), which jumps to Out.
  - Seven day chips from `model.week.days` (`model.ts:180-186`). A chip filters the matrix to "Week" and that day.
  - Open routine slots (`todaySlots`, `view.ts:110`).
  The arts-collective dock uses the same reader, so the strip and the dock stay one concept.
- **Pieces (left).** Cover bricks, like `ContentLibrary` bricks. Each brick has the piece's mini outlet marks (from `p.row`, `model.ts:152`). Kind chips stay. Click = pop-up.
- **Board (right).** The existing `ChannelGrid` (`grid.tsx:49`), narrowed. A segmented control switches columns: **Outlets** (`boardGrid`) or **Week** (`weekGrid`). Hover on a piece highlights it in both panes. Sticky below the strip.
- **Out (below).** The existing `OutTab` table, as a section that expands. The strip's "Did not go" chip opens it.

### A.2 Phone wireframe

```
+------------------------+
| Channel     [+ New v]  |
+------------------------+
| QUEUE  <- swipe ->     |
| [Accept Vase IG][Fill] |
| [Did not go 2][Week]   |
+------------------------+
| [Pieces | Board | Out] |   segmented, URL-backed
+------------------------+
| +------+  +------+     |   Pieces: 2-col covers
| |cover |  |cover |     |
| |Vase  |  |Mug   |     |
| +------+  +------+     |
| ...                    |
+------------------------+
  Board: table scrolls sideways, first column sticky
  Pop-up: bottom sheet
```

### A.3 What `tabs.tsx` becomes

| Today | After | Notes |
|---|---|---|
| `TABS` + `?tab=` (`page.tsx:83-90`, `:116`) | Removed. `?pane=` (phone only), `?mode=outlets\|week`, `?out=1` | Old `?tab=` links redirect (home -> `/channel`; library -> grid; board -> outlets; queue -> week; out -> `?out=1`). Katie and sunjay links keep working. |
| `BoardTab` (`tabs.tsx:270`) | `BoardPane`, column mode `outlets` | Same `boardGrid`. |
| `QueueTab` by week (`tabs.tsx:118`) | `BoardPane`, column mode `week` | Same `weekGrid` and routine rows. |
| `QueueByPiece` (`tabs.tsx:161`) | Moves into the manage-piece pop-up as a "Plan" section | Uses `pieceGrid`, slots and `PieceSteps`. The `?view=piece&focus=` URLs go away. |
| `OutTab` (`tabs.tsx:373`) | Kept; becomes a section | Rename `OutPane`. |
| `PieceSummary` wrapper (`tabs.tsx:296`) | Kept; opens from any pane | Drop the `planTab` condition at `page.tsx:219`. |
| Home "Recent" list + Library list (`page.tsx:324-380`) | `LibraryGrid` (new) | Server component, `kch-bricks`. |

**What `grid.tsx` becomes.** It stays. `ChannelGrid` is reused unchanged, with two additions:
1. A `selected` key (from `?piece=`) to highlight a row.
2. A narrow style (smaller piece column, 28px thumbs).
The `QueueOptions` bar (`tabs.tsx:87`) shrinks to the Outlets/Week toggle plus the week arrows.

**New files (all in `packages/channel/src/site/`):** `strip.tsx` (QueueStrip), `library-grid.tsx` (LibraryGrid), plus CSS in `site.css`.

### A.4 Data the page needs
- `ChannelModel` (one read): pieces, week, routines, outlets (`model.ts:226-247`). Unchanged.
- **Covers for the grid come from `model.pieces[].imageUrl`.** No `listContent` call for the first screen. This gives the grid, the matrix and the pop-up the same keys (`thread:`/`artwork:`), so every brick can open the pop-up.
- `listContent` (`page.tsx:172`) is kept only for "More" past the model's pieces, and for types the model lacks (see question 3). `ContentListItem` has `cover` and `marks` (`packages/content/src/model.ts:193-220`) if it is needed.
- Do not reuse `ContentLibrary` on sites as-is. Its styles use `--eac-area-*` tokens (`packages/content/src/content.css`), not the sites' shadcn tokens (`site.css:1-10`). A small `kch-bricks` grid is lighter than a token bridge.

### A.5 Effort and lane (Part A)

| Piece | Effort | Lane |
|---|---|---|
| `LibraryGrid` (covers, mini marks, kind chips, opens pop-up) | S | a2 channel |
| `QueueStrip` (moves + day chips + failed chip + open slots) | S | a2 channel |
| One page: remove tabs, URL redirects, split layout, Outlets/Week toggle, selection sync | M | a2 channel |
| Fold Out in as a section | S | a2 channel |
| Fold "By piece" into the pop-up | M | a2 channel, with fc (the pop-up children slot, `types.ts:116-117`) |
| Phone segmented panes and sticky first column | S | a2 channel |
| **Whole Part A** | **M-L** | **a2 channel** (all of it lives in a2's files) |

---

## B. A "Channel" hub card for sunjay (and IFAC)

### B.1 What it does
- **Face.** A mini board matrix: top 6 pieces x the 5 outlet columns of `BOARD_COLUMNS` (`view.ts:36`), as tiny state dots (out, scheduled, planned, none). A line under it: "3 waiting . 2 did not go".
- **Pop-up (Open).** Two panes:
  - Left: the chart. Mini matrix, with a Queue/Out toggle. Every cell is clickable. It opens the quick form (the same `Cell` from `grid.tsx`, going through the door).
  - Right: the pieces list, scrolling, with covers.
  - A piece click on either side opens the manage-piece surface (below).
- **Open page.** Goes to `/channel`, the unified page from Part A. This is "page opens to the chart, queue, change, out". No second page is built.
- **Manage-piece surface.** Reuse `PieceSummary` (`packages/content/src/summary/PieceSummary.tsx:106`; `'use client'` at line 1) in layout "popup". It takes plain data (`types.ts:47-82`), so the card's data can carry a `PieceSummaryView` for each piece (cap 24).

### B.2 Which card system
Recommended: **a `packages/hub` contract card.** The brief says "via packages/hub", sunjay already mounts one (`hub-card-host.tsx:52-69`), IFAC mounts two, and the contract gives a gate, a capability and an allow-list. Justin said "surface UI"; the hub popup (`PopupShell`) is the same face -> popup -> page idea but in the Industry look. See question 1.

Alternative: a `SurfaceCard` face plus a `custom` surface (`connectors.custom["channel"]`). It matches the other sunjay faces' look, but the data must come from a new `/api/hub/channel` route, because a descriptor cannot carry the model (it is serialised into the URL, `packages/cms-ui/src/surface/url.ts`). More moving parts.

### B.3 Files

New, in `packages/hub/src/channel/` (lane **hub**):
- `model.ts`: `ChannelCardData` (plain data) and `CHANNEL_CARD_ACTIONS`.
- `card.tsx`: `defineHubCard({ id:'channel', ... })`, Face, Popup, and a Detail that only navigates to `/channel`.
- `Matrix.tsx`: the mini matrix, shared by Face and Popup.
- `index.ts`.

New, `packages/hub/src/server/channel.ts` (lane **hub**): `channelCardServer = defineHubCardServer(...)`. Its `load` calls `siteChannelLoader(...).load` (`server.ts:21`) and reduces the model to `ChannelCardData`. The reducer reuses `boardGrid` (`grid-data.ts:107`) and the `PieceSummaryView` building (`tabs.tsx:317-340`).

Edited: `packages/hub/package.json` (exports `./channel`, `./channel/model`, `./server/channel`, and a dependency on `@elkdonis/channel`). No cycle: `@elkdonis/channel` depends on neither hub nor cms-ui (`packages/channel/package.json:19-26`).

Asked of **a2** (their files, two small exports): in `packages/channel/package.json:9-18`, add `./site/board` exporting `boardGrid`, `BOARD_COLUMNS`, `ChannelGrid`, and `buildPieceSummaryView` (lifted out of `tabs.tsx:317-340` so the page and the card share it).

### B.4 The contract

```
id: 'channel'      title: 'Channel'     icon: 'layout-grid'  (contract.ts:68-71)
capability: 'channel'   // site.features.channel; absent = on (contract.ts:43)
gate: 'guide'           // resolveChannelOrg admits owners and guides only
actions: CHANNEL_CARD_ACTIONS   // = SITE_DOOR_ALLOW (view.ts:11-18)
retires: []
central: not used; Detail only calls host.navigate('/channel')
```

- `load(site, viewer)` returns `ChannelCardData`: `matrix` (rows and 5 cols), `counts` (queued, failed), `pieces` (cap 24, each with cover, title, kind, status, `PieceSummaryView`, `suggestions`), `timeZone`.
- `loadDetail` is unused.
- Face and Popup are client components. They do not import `next/*` (the contract rule, `contract.ts:9-14`). Piece clicks call `host.navigate` or open `PieceSummary` in place.

### B.5 Writes
- Card calls `host.act(id, input)` (`contract.ts:114`) with ids from `SITE_DOOR_ALLOW`: accept, dismiss, slot-fill, plan, plan-step, delivery-save.
- **The host must wire `act` to the channel door, not `runHubAction`.**
  - Sunjay: `act: runChannelAction` wrapped to return `HubActionResult`. It already exists at `apps/sunjay/src/lib/channel-door.ts:18-29`.
  - Why not `runHubAction`: `performHubAction` refuses channel ids (`run.ts:450`), and sunjay's allow-list is Site Builder only (`apps/sunjay/src/app/hub/actions.ts:11`).
- `act` returns `{ok, value}` or `{ok:false,error}` (`contract.ts:89`). The door returns `ActionResult` (`site-channel-door.ts:40`). The wrapper maps one to the other, as `hub-card-host.tsx:42` does.
- After a write: `host.refresh()` (`router.refresh`), and the door already revalidates `/channel` (`channel-door.ts:27`).
- Nothing in the card schedules or sends. Plans only, like the page.

### B.6 Host mounts

**Sunjay (S):**
- `apps/sunjay/src/components/hub/hub-card-host.tsx`: add `ChannelCardMount`, copied from `SiteBuilderCardMount` (`:52-69`). Its `openDetail` navigates to `/channel`. Its `act` is the channel door.
- `apps/sunjay/src/app/hub/page.tsx`: load beside Site Builder (`:125-132`), only for `viewer.canEdit`. Render in the "Make something" band (`:201-237`) as a tile, not in the errands band, because it is a working tile.
- The "site" layout (`HubSiteView`, `page.tsx:67`) has no card list for this; leave it.
- Lane note: `apps/sunjay/src/lib/channel-*` are a2's; the card reuses `channel-door.ts` and `channel-model.ts`, and edits neither.

**IFAC (M):**
- IFAC has no Channel at all. It needs `app/channel/page.tsx`, `lib/channel-door.ts`, `lib/channel-model.ts` and a `channel.css`, copied from sunjay's pattern. These are a2-lane file names. Then a `ChannelCardMount` in `apps/ifac/src/components/hub/hub-card-host.tsx:19-60`, and a tile in `apps/ifac/src/app/hub/page.tsx` near `:359-360`.
- IFAC's hub also has a "cards 2" layout (`apps/ifac/src/app/hub/cards-view.tsx`) that takes link tiles, not these mounts (`docs/open/EDITING_LANDSCAPE_2026-11-12/HANDTEST_2026-11-14.md` item 7a). Add a `HubLinkCard href="/channel"` there (S).
- IFAC's Publish tile stays (`apps/ifac/src/app/hub/page.tsx:311-322`).

### B.7 Content library hub card
Do not build a separate one. The unified page's grid is the library, and the Channel card is its hub door. `PublishCardFace`/`PublishPopup` stay unused until someone wants a "start something new" tile; sunjay's `ComposeFace` already does that.

### B.8 Effort and lane (Part B)

| Piece | Effort | Lane |
|---|---|---|
| `model.ts`, loader (`server/channel.ts`), reducer | S | hub |
| Face (mini matrix) | S | hub |
| Popup: chart, clickable cells, scrolling pieces | M | hub |
| Manage-piece layer using `PieceSummary` + door-backed buttons | M | fc (summary/content) with hub |
| Two exports from `@elkdonis/channel` (`./site/board`, `buildPieceSummaryView`) | S | a2 channel |
| Sunjay mount | S | hub (page edit) |
| IFAC: Channel route + door + loader + mount + link tile | M | a2 (route files), hub (mount) |
| **Whole Part B** | **M-L** | **hub**, needs a2 for the exports |

### B.9 Order
1. a2: the exports for the card, then the unified page (A), since the card's "Open page" lands there.
2. hub: Face + Popup with piece click -> `/channel?piece=`. This ships a working card without the in-popup summary.
3. fc + hub: the in-popup manage-piece.
4. IFAC mount last.

---

## Open questions for Justin

1. **Which "surface" look for the card?** The Industry hub look (as Members and Site Builder) or the `eac-surface` look (as Compose, Calendar, Pipeline on sunjay)? I recommend the hub-contract card; the other costs a new `/api/hub/channel` route.
2. **Manage-piece: in the card, or on the page?** Should a piece click in the hub pop-up open the summary in place (more work), or jump to `/channel?piece=` (ships first)?
3. **Which pieces does the grid show?** `model.pieces` has 8 kinds. Library today also shows what `listContent` returns. Is "the model's pieces" the right set, with covers from the model?
4. **IFAC.** It has no Channel yet. Do you want the card on IFAC now, which means adding a full `/channel` there, or sunjay only for this round?
