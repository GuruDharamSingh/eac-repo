# E. Prior work for the one Channel page and the hub card (2026-11-15)

Read-only pass for system32-fc. Paths are from `~/eac/docs/` unless they start with `packages/` or `apps/`.

## Reuse and respect

**For a2 (the page):**
- Nobody ever designed one combined Channel page. Every earlier design kept Home, Queue and board apart, so C is new ground.
- Reuse the earlier names: "next row" (Home), "routines strip", "Board", "Not placed" tray, "Coming up" 7-day strip.
- Respect the old rule: one count, one list, one chip behaviour. A piece's "N waiting" must equal what the matrix draws (open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md:166-212). The new page puts strip, bricks and matrix side by side, so this bites harder.
- a2 objected to one page earlier today (open/channel-convergence-2026-11-15/a2-notes.md:41-47), because Justin had asked for "a toggle of board and queue and queue options by week or piece". Justin has now said yes. Keep that toggle on the matrix (Outlets | Week, with by-piece in the pop-up). a2's middle path is moot.
- Do not copy arts-collective's layout. It is a sidebar app with separate routes (section 1).

**For fc (the hub card):**
- The Calendar pop-up is the best place for the week's queue. It has a right rail that lists the selected day (`packages/cms-ui/src/surface/surfaces/CalendarSurface.tsx:155-176`). Channel's planned and out posts go there.
- Justin wants the surface look, flat. That overrides C's recommendation of the Industry `hc-*` look. It means a `SurfaceCard` face plus a `custom` surface, and C's cost note applies: a descriptor cannot carry the model (`packages/cms-ui/src/surface/url.ts`), so it needs a `/api/hub/channel` read.
- For list-form Home and Library, use `PieceList` / `PieceRow` (section 3).

## 1. Earlier designs

| What | Where | Says |
|---|---|---|
| First console (`/studio/channel`) | open/CHANNEL_CONSOLE_DESIGN_2026-11-07.md:1-130 | Sidebar console with groups Content, Audience, Social media, Site, Network, plus a "Today" block. Some rows render in place, some link out. Superseded the same afternoon by the Claude Design handoff (sessions/2026-11-07_channel.md:109; open/channel.md:11-12). Never a one-page board. |
| The handoff | open/channel-handoff/README.md:28, 44, 98-125; Channel.dc.html (h1s: Channel, Queue, piece, New post) | Home 1a is a 360px "In motion" list with a piece face on the right. 1b is a coverage matrix, a view of Home. 2a Queue is a week with a routines strip above and a "Not placed yet" tray below; its switcher is "Week \| Month \| Matrix". Piece pop-up 3a/3c and library 3b are `custom` surfaces (README:47). |
| Where it landed | open/channel.md:20-21; apps/arts-collective/src/components/channel/ChannelNav.tsx:64-125 | Separate routes (Home, `?view=matrix`, queue, routines, outlets, new, piece). The dock shows the top move on inner pages (open/channel.md:134-135). |
| Next row | open/channel.md:134, 172, 254; open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md:15-19, 217 | Replaced four count bands. "The board's surface on Home. The dock is its surface elsewhere." On `/channel` the dock is a small side widget. Gaps show too (owner decision). |
| Board and its name | open/channel.md:168-169; open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md:166-171, 201-205 | "Board" covers plan, routines and queue as one composite. Renamed Docket, then back to Board. The mast button "Queue" and "Open the board" went to the same page. Recommended: call the per-piece page "Board", keep "Queue" for `/channel/queue`. |
| Rejected or held | open/channel.md:217-223 (ladders not adopted); sessions/2026-11-07_channel.md:67 (no staged LMS courses); open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md:151 (no dock on `/channel*`, overruled by "Gaps too") | None is about layout. The tray is not draggable (out of scope in the handoff). |
| No hits | open/STUDIO_PIPELINE_DESIGN_2026-11-06.md; open/canvas-synthesis-2026-11-02/3-synthesis.md; the studio-create-summary canvas notes | Nothing on one page, matrix or strip for Channel. sessions/2026-11-14_studio-create-summary.md:180 records the site tab order Home, Board, Queue, Out, Library, and "week plus Not placed fits at 1280". |

Conflicts with C:
1. a2's objection (a toggle was asked for), settled by Justin's yes.
2. The "Not placed" tray sits under the week in the old design. C has the strip on top and Out below, so the tray needs a home. Suggest the strip's last group, or under the grid in Week mode.
3. The old Home put the routines strip first, with the next row above it. C's strip order (next moves, failed, day chips, open slots) is consistent with the registry doc, so keep it.
4. Library on the network host is bricks with a lightbox (`apps/arts-collective/src/components/channel/Library.tsx:15-45`). Sites have a list (`packages/channel/src/site/page.tsx:329-379`). C's `LibraryGrid` follows the network host. Fine.

## 2. The hub Calendar card and its pop-up

**How it opens.**
- Sunjay mounts `<CalendarFace initialEvents={events} canEdit>` in its "This week" band (`apps/sunjay/src/app/hub/page.tsx:195`). IFAC mounts it at `apps/ifac/src/app/hub/page.tsx:357`. Events are this month's, read at sunjay `page.tsx:71, 89` (`listOrgEventsInRange`).
- The face is `packages/cms-ui/src/hub/CalendarFace.tsx:32-120`. It calls `surfaces.open({ type: "calendar", month, day, events })` (`:52-53`). The descriptor is `packages/cms-ui/src/surface/types.ts:122-129`.
- The router maps it (`SurfaceRouter.tsx:55-56`) to `surfaces/CalendarSurface.tsx:45`, which wraps `SurfaceFrame` (`:179`) around a `MonthGrid` body and a rail.
- Data: `connectors.listEvents(from, to)` (`types.ts:1363`; `CalendarSurface.tsx:67-92`), bound to `/api/hub/calendar` (see `apps/ifac/src/app/hub/calendar/page.tsx:15`). Events are `SurfaceEvent` (`types.ts:323-343`): threads only (kind, scheduledAt, rsvpCount). No Channel data.

**Hook points.**
1. **Rail, selected day** (`CalendarSurface.tsx:156-165`). Add a "Channel" section under the `OccurrenceList`: that day's posts and open slots. Best place. A day click already sets `selected` (`:195`).
2. **Rail, "Coming up"** (`:167-174`). Show the next posts and open slots.
3. **Day pips** (`MonthGrid`, `:346-365`). Channel posts would need to arrive as extra occurrences. Skip for v1; show counts in the rail.
4. **Face blurb** (`CalendarFace.tsx:73`). A cheap line such as "2 posts planned this week".
5. **How to add it without Channel words in shared code.** `CalendarSurface` is used by five apps. Use a generic slot, such as a connector `connectors.dayExtras?(day) => ReactNode`, or a host-supplied rail section. Or put a "See the queue" button in the rail that opens a `custom` surface (`connectors.custom["channel"]`, `types.ts:1463-1466`). `apps/arts-collective/src/components/hub/console/OrgConsoleHost.tsx:107-134` does this; sunjay's `custom` map is `apps/sunjay/src/components/hub/HubSurfaces.tsx:217-241`.

**Data shape needed from `@elkdonis/channel`.**
- Per day: `model.week.days[]` is `DayView { date, label, isToday, items: DayItem[] }`, with `DayItem` = post, slot, event, todo or suggestion (`packages/channel/src/model.ts:173-186`). That gives planned and out posts per day and open routine slots (`type: "slot"`) with no new reader.
- Reduce it on the server to a small list: `{ date, posts: { title, outlets, state, pieceKey }[], openSlots: number }[]`. `model.week` covers one week only, so a month needs a fetch per week.
- A piece pop-up: `buildPieceSummaryView(piece, model, { planHref })` (`packages/channel/src/site/summary-view.ts:15`).
- A matrix in a pop-up: `boardGrid`, `weekGrid`, `routineRows`, `ChannelGrid` inside `<ChannelDoor run=...>` (`packages/channel/src/site/board.ts:4-8`). The door must be the site's `performSiteChannelAction`, not the hub door (C Part 1.3).
- Fetch it, do not carry it in the descriptor: add `/api/hub/channel` (guide or owner only).
- IFAC has no `/channel` yet (C 1.3), so there the calendar extra would be link-only until it gets one.

## 3. List form in a surface pop-up

- **`PieceList` / `PieceRow`** (`packages/content/src/ui/PieceRow.tsx:9-80`). Cover, title, status and marks per row, with `onOpen`. `ContentLibrary` has `view: bricks | list` (`packages/content/src/ui/ContentLibrary.tsx:12`). `PublishPopup` already renders a `PieceList` in a popup (`packages/content/src/ui/PublishCard.tsx:211`), but no app mounts it (C 1.3). It takes `ContentListItem[]` (`packages/content/src/model.ts:193-220`), the same shape `listContent` returns. Best fit for Home and Library in list form.
  - Catch: its styles use `--eac-area-*` tokens (`content.css`), not the sites' shadcn tokens. Inside an `eac-surface` pop-up they may need a check.
- **`PublishedSurface`** (`apps/arts-collective/src/components/hub/console/ConsoleSurfaces.tsx:336`). A published list with pin, as a `custom` surface (`AttentionBands.tsx:127`). The working example of a list in a pop-up, but network-only.
- **`ThreadSurface`** (`packages/cms-ui/src/surface/surfaces/ThreadSurface.tsx`). What a thread row opens; the calendar's `openThread` uses it.
- **Site Channel's rows** (`.kch-list`, `packages/channel/src/site/page.tsx:347-370`; `site.css:54`). Page-only, not surface code.
- Warning: `PipelineFace` goes to a page rather than a pop-up for anything with drag or dropdowns, because a surface is a native `<dialog>` in the top layer (`packages/cms-ui/src/hub/PipelineFace.tsx:14-20`). A piece list that opens `PieceSummary` (popup layout) on top of a surface has the same risk. Test it before promising it.
