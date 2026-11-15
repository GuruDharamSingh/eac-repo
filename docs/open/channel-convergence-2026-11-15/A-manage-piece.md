# A. The manage-piece, and folding /manage's Content tab into Channel (2026-11-15)

Read-only design pass for system32-fc. No code was edited. Paths are relative to ~/eac. Line numbers were read on 2026-11-15 and move as sessions edit.

Justin's direction today: there should be no /manage page. Content in Channel is the same job as the Content tab on Para Theater. The manage-piece should look like `arts-collective.com/studio?kind=meeting&org=inner_group` (the published piece's summary page with a cover), in the surface UI.

---

## 1. The earlier decision: "no manage page at all"

### Today

- There is no single "no manage page" session note. The decision is in four places.
- **PM board, Lane B survey (2026-11-08).** "/manage is fragmented." The merge target is a hub card. The owner's fundamental hub cards "replace /manage":
  1. Site Builder (pages, Puck, site copy, theme, flags).
  2. Member Management (people, roles, visitors, storage).
  3. **Content: "content list + series".**
  4. Calendar.
  5. App-specific service cards.
  - `docs/open/PM_BOARD_2026-11-08.md:37-45`.
  - This matches Justin's words today: page builder, people, visitors is one thing; content, series is one thing.
- **Survey corrections.** The "Pages" tab in sunjay, elktours and innergathering is content feeds, not Puck pages, so it goes to Content. fourthway's "New reading group" is series create, also Content. `PM_BOARD_2026-11-08.md:49-52`.
- **Designer prompts.** `docs/open/HUB_CARD_PROMPTS_2026-11-08.md:6` says "fold /manage into a handful of fundamental hub cards". Prompt 3 (:76-100) is the **Publish card + /content page**. It "replaces the old Content tables in /manage and the per-app compose pages".
  - The /content page has a library and a shared **content detail**: header with media, title, kind, status; a timeline; actions "Edit in Studio, View on site, Open in Channel, Board" (:88-93).
  - The detail is "one component used everywhere (hub pop-up, this page, Channel, Studio)" (:94).
- **Content library spec.** Pass 3 is the hub Content card (`listContent`, `ContentLibrary`, `ContentFace`), piloted on sunjay "whose /manage Content table is the clearest". It then replaces the five copies of `components/manage/content-row-actions.tsx` with the detail's foot actions through the registry (`thread-publish`, unpublish, archive, set standing). `docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md:300-309`. Detail links include `manage` (:99, :167).
- **Which tabs are retired.** The hub-cards plan covers only Member Management and Site Builder. Its retirement table says `/manage/<tab>` redirects to `/hub/<card>?tab=`. For sunjay it retires People, Visitors, Page builder and Site copy. Content, Pages (feeds) and Series stay. `docs/open/hub-cards-handoff/PLAN.md:153-167`.
  - The rule is that a tab retires only after the card runs on that host, and redirects ship in the same rebuild (:167).
- **Status.** "Retire the old /manage tabs with redirects after the owner's smoke tests." `PM_BOARD_2026-11-08.md:184`; `hub-cards-handoff/PLAN.md:247`.

### What is folded, retired or redirected

- **Nothing is retired in the apps.**
  - sunjay's /manage still has Content, Pages, Site copy, Page builder, People, Series and Visitors (`apps/sunjay/src/app/manage/layout.tsx:11-20`). Routes exist for analytics, builder, compose, content, feeds, pages and people (`ls apps/sunjay/src/app/manage`).
  - sunjay has no `redirects()` in its next.config. Only arts-collective, hidden-enneagram and innergathering have one (`apps/*/next.config.ts`).
  - ifac still has ten tabs (`apps/ifac/src/components/manage/manage-tabs.tsx:11-22`). Its overview links back into /manage (`apps/ifac/src/app/manage/page.tsx:63-71`).
- **Built as hub cards, not yet retiring anything:**
  - Members and Review queue (`packages/hub/src/{members,review}`), Site Builder (`packages/hub/src/site-builder`).
  - sunjay has `/hub/series` and `/hub/site`. ifac has `/hub/members` and `/hub/review` (`ls apps/*/src/app/hub`).
  - **There is no Content or Publish card in `packages/hub/src`** (members, review, server, site-builder, theme, ui). The Content tab has no destination yet.
- **Redirect on the network host only.** arts-collective middleware sends `/manage[/*]` on a tenant host to that host's `/hub` (`apps/arts-collective/src/lib/tenant-paths.ts:25`). It is not in the apps' own routes.
- **Content tab already half-replaced by the editors.**
  - `/manage/content/[id]` redirects series to `/hub/series/<id>#settings` (`apps/sunjay/src/app/manage/content/[id]/page.tsx:49-51`).
  - Meetings, events and posts edit in the shared `@elkdonis/site-forms` (:57-62).
  - Services still use the old form (hand-test 3a; `docs/open/EDITING_LANDSCAPE_2026-11-12/HANDTEST_2026-11-14.md:20`; fc handover `HANDOVER_fc_2026-11-14.md:39-45`, not started).
- **Series stays separate.** "Series stays its own thing, managed as series-site manages it today, not folded into the meeting form" (developer, 2026-11-14). `docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md:19`. This overrides the Publish prompt's "Repeat turns a Meeting into a Series" (`HUB_CARD_PROMPTS_2026-11-08.md:113`).

---

## 2. The /manage Content tab today

### Today: sunjay (the reference)

The table is `apps/sunjay/src/app/manage/page.tsx:92-166`. Columns: Title, Page (feed), When, Status plus cycle badge, RSVPs, and a "..." menu. "New" goes to `/manage/content/new` (:75-80). A PayoutsCard sits on top (:57-71).

The row menu is `apps/sunjay/src/components/manage/content-row-actions.tsx`:

| Action | Shows when | Runs through | Component / call |
|---|---|---|---|
| Edit | always | link `/manage/content/<id>` (:151) | `app/manage/content/[id]/page.tsx` mounts `MeetingFormPage` or the old `ContentForm` |
| View on the site | published, has a feed (:153-157) | link `/<feed>/<slug>` | none |
| Publish / Move to draft | always (:158-160) | `setContentStatusAction` (:49-60) | `apps/sunjay/src/lib/cms/actions.ts:360-385`. Raw SQL `UPDATE threads`, `requireOrgEditor`, org check. **Not a registry entry.** |
| Make this the weekly meeting / Stop leading the hub | dated threads (:162-166) | `setStandingMeetingAction` (:111-125) | `lib/cms/actions.ts:311-336`, then services `setStandingMeeting` (`packages/services/src/org-calendar.ts:706`, stored in `site_config`) |
| Confirm this cycle / Cancel this cycle | recurring threads (:168-178) | `fetch POST /api/threads/<id>/cycle` (:62-84) | `app/api/threads/[id]/cycle/route.ts:18-59`. Inserts `thread_cycle_events`. Read side `getCycleStatus` (`lib/data.ts:446`). **Not a registry entry.** The route is copied in amrit-canada, elktours and innergathering. |
| Who's coming | has RSVPs (:180-185) | link `/manage/content/<id>/attendees` | `app/manage/content/[id]/attendees/page.tsx` |
| Email a reminder / a cancellation | has RSVPs (:186-191) | `fetch POST /api/threads/<id>/trigger-email` after `confirm()` (:86-109) | `app/api/threads/[id]/trigger-email/route.ts` (164 lines). Mails every RSVP. **Not a registry entry.** |
| Remove | always, destructive (:195-198) | `deleteContentAction` (:127-138) | `lib/cms/actions.ts:341-358`, then services `removeThreadAs`. Archives, never deletes. RSVPs kept; Publish restores. |
| Series (kind series) | row title link | `/hub/series/<id>` (`page.tsx:109`) | shared series hub |

- "Confirm a cycle" and "make this a weekly meeting" are the two Justin named. Both are in this menu and nowhere in Channel.
- **Registry coverage is thin.** `packages/actions/src/catalogue.ts:58-69` has only `thread-edit`, `thread-publish` and `thread-pin`, for posts. `thread-publish` refuses anything but a draft (`server/run.ts:277-290`) and runs only from a host door.
- **No registry entries exist for:** unpublish, archive, standing meeting, cycle confirm or cancel, email reminder. A grep for standing and cycle in `packages/actions/src` finds nothing.
- A site Channel door can run only the six plan entries: accept, dismiss, slot-fill, plan-step, plan, delivery-save (`packages/actions/src/server/site-channel-door.ts:26-33`; `packages/channel/src/site/view.ts:11-18`).
- **Four copies of the row menu** exist: sunjay, elktours, amrit-canada, innergathering (grep `setStandingMeeting`). hidden-enneagram is the fifth (`CONTENT_LIBRARY_COMPONENT_2026-11-08.md:306-308`).

### Today: IFAC (for comparison)

- **IFAC has no Content tab.** Its tabs are Overview, Artists and dealers, People, Site copy and events, Submissions, Email, Store, Appearance, Cloud, Visitors (`apps/ifac/src/components/manage/manage-tabs.tsx:11-22`).
- Per-piece work lives elsewhere:
  - Submissions: approve or decline a member's post (`submission-review`, `listing-approve`, `listing-decline`; `packages/actions/src/hub.ts:88-105`; `app/hub/review`).
  - Events: live threads in `/hub/calendar` and `/hub/meetings`. The PM board moved ifac events to the Calendar card (`PM_BOARD_2026-11-08.md:50`).
  - Store: `app/manage/store`.
- So IFAC's piece actions are approve and decline (registry, appOnly, hub door). There is no publish, cycle or standing control to port.
- katie-the-potter has no Content tab either. Its piece row has one control, "Shown as: For sale / Portfolio only / Hidden" (`apps/katie-the-potter/src/components/manage/piece-row-actions.tsx:5-19`, through `lib/manage-actions`), plus `/manage/pieces/[id]` and `pieces/new`.

---

## 3. The site Channel's manage-piece pop-up today

### Today

- **Mount.** `packages/channel/src/site/page.tsx:231-251`.
  - A piece opens when `?piece=<key>` is set on Board or Queue (`planTab && pieceKey`, :219).
  - Edit is the site's quick form in place, only when `editHere.kinds` includes the kind (:236-238). Otherwise Edit links to Studio (:245).
  - sunjay passes `kinds: ["meeting"]` only (`apps/sunjay/src/app/channel/page.tsx:59-65`). **Posts, writing and offerings on sunjay have no quick form; Edit goes to Studio.** katie passes artwork and product (`HANDOVER_a2_2026-11-14.md:68`).
- **The pop-up component.** `packages/channel/src/site/tabs.tsx:296-366` builds a `PieceSummaryView` and renders the shared `PieceSummary` with `layout="popup"`.
  - Facts: When, Details, Status (:317-320).
  - One cover picture (:330-331).
  - `out` rows from `wentWhere(p)` (:334-336).
  - Coverage `marks` (:339).
  - `links.channel` and `links.plan` are null (:338).
  - `nextRows` are the piece's suggestions with Accept / Plan it / X (:341-346).
  - A "Plan it" `RunButton` for `channel-plan` as child (:361-363).
  - Make into comes from `MAKE_INTO[p.kind]` (`view.ts:136-148`). Artwork and product get Post, Clip, Essay. Meeting gets Reminder post and Next session.
- **The shared view.** `packages/content/src/summary/PieceSummary.tsx`.
  - Action row: Edit (:214-223), Make into menu (:224), Plan it (:225-234), Open in Studio (:234-238), View live (:239-243), status text (:249-250).
  - Lists: Where it went, split into Planned and Out (:257-281), then Next for this piece.
  - Popup frame: scrim, right panel at 640px and up, bottom sheet below, Escape closes (`PopupFrame`).
  - Props: `packages/content/src/summary/types.ts:84-118`. `actions` (:113) replaces the whole action row. `children` (:115) draws after the lists.
- **What it lacks that /manage has:** publish and unpublish, schedule, standing, confirm or cancel the cycle, who is coming and reminders, remove. The `Piece` type has no `recurrence`, `rsvp`, `visibility` or `standing` field, and `status` is text (`packages/channel/src/model.ts:127-158`).
- **Studio's published-piece summary.**
  - `PieceSummaryGate` (`packages/studio/src/summary/gate.tsx:48-155`) shows the summary before the form when the item is already published (`isOut`, :38-43; decided once per opened item, :78-82). It draws `PieceSummary layout="page"`, and Edit switches to the form (:144-153).
  - It is on only where the host provides `PieceSummaryHostContext`. arts-collective does (`apps/arts-collective/src/app/studio/page.tsx:337`; `StudioApp.tsx:161`). Without the context it draws only the form (gate.tsx:140).
  - The loader is `apps/arts-collective/src/lib/studio-summary-action.ts:29-80`. It loads Channel's model for the person, takes cover and timeline from `channelPieceToDetail`, and builds `next` from `channelNextMoves`. Facts carry only "When" for dated kinds (:63). The gate adds Places, Hosts and similar from the form (`gate.tsx:46,122-138`).
  - It is read-only, for the signed-in person only, and the piece must be on that person's own Channel (:4-8, :38-39). **A site cannot call it.**
- **Surface UI (cms-ui).**
  - `packages/cms-ui/src/surface/SurfaceRouter.tsx` maps a descriptor (kind, id) to a surface: ThreadSurface, ComposeSurface, ArtworkSurface and others. A site registers its shared form as `connectors.custom["compose:<id>"]` (:29-37).
  - `ThreadSurface` already shows a cover (`ThreadView.tsx:146-148`; `ThreadSurface.tsx:78`).
  - **No surface renders `PieceSummaryView`.** `SurfaceKind` has no `piece` kind (`surface/types.ts:19-38`). sunjay mounts `SurfaceProvider` for its hub (`apps/sunjay/src/components/hub/HubSurfaces.tsx`; `app/hub/site-view.tsx`).

---

## 4. Proposal

### 4.1 One component, three mounts

The manage-piece is the shared `PieceSummary` (packages/content). Keep one body and add a **Manage** section driven by a host-supplied `manage` prop of grouped actions. It mounts in:

1. Channel's pop-up on a site (exists; add the groups).
2. Studio's published summary (exists; add the groups through the host's loader).
3. **A cms-ui surface**, `piece` (new). Any site's hub, Library, calendar or page can open the same panel. It draws `PieceSummary layout="popup"` inside `SurfaceFrame`.

This is the "nice page with cover" Justin pointed to. On the `inner_group` Studio URL the cover is `.ps-cover` and `.ps-card` (`PieceSummary.tsx:152-195`). No new cover design is needed. The new part is the action groups.

### 4.2 Action groups, by kind

Groups, in order: **Publish**, **Schedule**, **Share**, **People**, **Edit and make**, **Remove**. A group hides when it has no entries for the kind.

| Group | Meeting (incl. recurring) | Writing / post | Video | Artwork | Product / offering |
|---|---|---|---|---|---|
| Publish | Publish / Move to draft | Publish / Move to draft; Lead the site (pin) | Publish / Move to draft | Show / Hide | Shown as: For sale / Portfolio / Hidden |
| Schedule | **Confirm / Cancel this cycle** (recurring); Lead the hub with this meeting | Schedule | Schedule | n/a | n/a |
| Share | Plan a post, Next for this piece, Coverage (exist) | same | same | same | same |
| People | Who's coming; Email a reminder; Email a cancellation | n/a | n/a | n/a (orders are Commerce) | Orders |
| Edit and make | Edit (quick form), Make into, Open in Studio | Edit, Make into, Open in Studio | Open in Studio | Edit, Make into, Open in Studio | Edit, Open in Studio |
| Remove | Remove (archive; RSVPs kept) | Remove | Remove | Retire | Retire |

- "Weekly" is two different things on sunjay today:
  - **Repeat** is a field of the meeting form (`recurrence_pattern`, `packages/studio-forms/src/meeting/convert.ts:60-74`). Turning it on is an edit, not a pop-up action.
  - **Make this the weekly meeting** is the hub's standing flag (`setStandingMeeting`). It only decides what leads the hub.
  - In the UI: "Repeat weekly" in the form; "Lead the hub with this meeting" in the pop-up.
- A series keeps its own hub (`/hub/series/<id>`). The pop-up links there instead of showing these groups (`STUDIO_FORMS_SPLIT_2026-11-14.md:19`).

### 4.3 Which door each action runs through

Rule: a site's pop-up runs only registry entries, through the site's own door. Per-app SQL actions and fetch routes go away.

| Action | Today | Proposed |
|---|---|---|
| Accept, Plan it, slot-fill, plan step, save delivery | `channel-*` through `performSiteChannelAction` (`site-channel-door.ts:40-66`) | unchanged |
| Publish / Move to draft | sunjay SQL action; registry `thread-publish` is post-only | **Extend** `thread-publish` to meetings and **add** `thread-unpublish`. Scope `thread`, `appOnly`. Run through the hub door `performHubAction` (`hub-door.ts:25-39`), since the site Channel door is plans only (`site-channel-door.ts:11`). |
| Pin (post) | `thread-pin` in registry | add to the hub-door allow list |
| Lead the hub | per-app `setStandingMeetingAction` | **new** `thread-standing`, hub door; the runner calls `setStandingMeeting` (`org-calendar.ts:706`) |
| Confirm / Cancel cycle | per-app fetch route, 4 copies | **new** `thread-cycle` (`confirm` or `cancel`), hub door; same insert into `thread_cycle_events` |
| Email reminder / cancellation | per-app fetch route | **new** `thread-email-attendees`, hub door. The browser confirm stays. `appOnly` means HTTP routes and agents cannot run it (`hub.ts:3-6`). |
| Remove | per-app SQL plus `removeThreadAs` | **new** `thread-archive`, hub door |
| Who's coming | per-app page | link, until the hub Calendar card hosts attendees |
| Edit, Make into, Open in Studio | links (`tabs.tsx:357-358`) | unchanged |
| Artwork "shown as" | katie `setShownAsAction` | stays on katie; surfaced through the same `manage` prop |

Notes:

- A site mounts a second 'use server' action `runHubAction` beside `runChannelAction`, with its allow list. `apps/sunjay/src/lib/channel-door.ts` is the template. (That file is a2's, so a2 mounts it.)
- Do not widen `SITE_CHANNEL_ACTIONS`. It is "plans only: nothing here schedules or sends" (`site-channel-door.ts:11`). Publish and email would break that promise.
- Each entry needs a row in `ACTION_CATALOGUE` with `appOnly`, and a pass of `check:registry`.
- These are the same entries `CONTENT_LIBRARY_COMPONENT_2026-11-08.md:306-308` planned for the hub Content card's foot actions. Build them once; the Channel pop-up and the later hub card both use them.
- Gate: owners and guides, org bound to the site (`hub-door.ts:36`).

### 4.4 The data the pop-up needs

- `Piece` (`model.ts:127-158`) lacks recurrence, cycle status, standing, RSVP count, visibility and a machine-readable draft or published state. Add one optional `manage` block:
  `{ canPublish, status, recurring, cycle, standing, rsvps, visibility, archived }`.
- The model loaders are a2's (`packages/channel/src/*`, `apps/*/src/lib/channel-model.ts`). The data comes from sunjay's `getCycleStatus` and the services `getStandingMeetingId`. Prefer the services versions over per-app copies.
- Studio's loader (`studio-summary-action.ts:54-79`) gets the same block from `channelPieceToDetail`. This is the content detail model the library spec already calls for (`can.edit, can.plan, can.deliver, can.publish, can.archive`; `CONTENT_LIBRARY_COMPONENT_2026-11-08.md:99-100`). The UI shows `can.*` from the server and never infers it (:344).

### 4.5 How it looks

- Same panel as today: cover, title, facts, then the action row.
- Replace the single action row with **grouped rows**, primary first. For a published meeting: **Edit** primary, then one line each for Publish state, Schedule, People, Make and Remove.
- Keep "Where it went" and "Next for this piece" below.
- In the cms-ui surface the React tree is the same. `SurfaceFrame` supplies the backdrop. New: a descriptor `{kind: "piece", key}` and a connector `loadPiece`. This also gives the later hub Content card its detail.
- On sunjay the `ContentRowActions` dropdown is replaced by the pop-up. The table's job moves to Channel's Library tab (`ChannelGrid` and Library exist).

### 4.6 Retiring /manage's Content tab

What it takes, in order:

1. Library tab becomes the content list. It has search and kind filters already (`CONTENT_LIBRARY_COMPONENT_2026-11-08.md:31`). Add a status chip and a Draft filter, so drafts can be found. The Board shows what is placed; a draft meeting needs to show somewhere.
2. Add the grouped actions and entries (4.2, 4.3).
3. Repoint the links, then redirect.

Links that change on sunjay:

| Link | Where | Becomes |
|---|---|---|
| `/manage` (content table) | layout tab; hub errand (`app/hub/page.tsx:294`) | `/channel?tab=library` |
| `/manage/content/new` | table "New" (`manage/page.tsx:76,86`) | Studio New, or Channel "New" menu (`site/page.tsx:262-271`) |
| `/manage/content/new?kind=meeting` | `components/hub/CalendarPageView.tsx:120` | `links.studio({kind:"meeting"})` |
| `/manage/content/<id>` | row Edit (`content-row-actions.tsx:151`); `components/edit-thread-button.tsx:25` fallback | pop-up `?piece=thread:<id>`, or Studio `?kind&id` |
| `/manage/content/<id>/attendees` | row menu | keep until the hub Calendar card hosts it |
| `/manage/feeds` (Pages) | `components/channel/meeting-sheet.tsx:18` | stays (Pages = feeds) until the Content card |
| other tabs | layout | retire per the hub-cards table (`PLAN.md:153-167`), a separate lane |

- Redirects: `/manage` and `/manage/content/*` (not `new`, not `attendees` yet) to `/channel`, in the same rebuild that ships the pop-up groups. sunjay has no `redirects()` today, so add one. Tenant hosts already hop to `/hub` in middleware (`tenant-paths.ts:25`).
- Layout: drop the Content tab; the rest stays until the hub cards retire them (`layout.tsx:11-20`).
- Order: do not redirect before the entries exist. Cycle confirm, standing and reminders are things the site relies on. The cycle route says why: the Amrit Vela audience needs "is it on this month" answered (`cycle/route.ts:7-14`).
- Other apps: elktours, amrit-canada, innergathering and hidden-enneagram have the same table and menu copy. Only sunjay and katie have Channel on site. Retire the others last, per app, once Channel and the entries are there.
- ifac: nothing to retire for Content. Its review and events are already in hub cards.

### 4.7 Effort and lane

| # | Work | Effort | Lane |
|---|---|---|---|
| 1 | Registry entries: `thread-publish` (meeting), `thread-unpublish`, `thread-standing`, `thread-cycle`, `thread-email-attendees`, `thread-archive`; catalogue rows, runners, registry check | M | fc (packages/actions is shared) |
| 2 | `PieceSummaryView.manage` plus grouped action rows in `PieceSummary` (harness shots at 1280 and 390) | S-M | fc (content/summary) |
| 3 | Site Channel: loader adds the `manage` block; `runHubAction` mounted on sunjay; pop-up passes the groups | M | **a2** (`packages/channel/**`, `app/channel/**`, `lib/channel-*`) |
| 4 | Studio: loader returns the `manage` block; gate passes it; a Studio-side door for the same entries | S | fc (studio, arts-collective `studio-summary-action.ts`) |
| 5 | cms-ui `piece` surface kind plus `loadPiece` connector | M | fc (cms-ui) |
| 6 | Library: status chip and Draft filter | S | a2 |
| 7 | sunjay: link changes, `redirects()`, drop the Content tab | S | fc (sunjay outside channel paths), after 1-3 are live |
| 8 | Other apps: repeat 7 per app once Channel is mounted | M each | new (per app) |
| 9 | Hub Content / Publish card on the same detail | L | new (needs the Claude Design pass; none exists, `CONTENT_LIBRARY_COMPONENT_2026-11-08.md:303-305`) |

Suggested first slice: items 1, 2, 3 and 4 for **meetings only** on sunjay. That covers publish, confirm cycle, lead the hub and remove, the things Justin named.

---

## 5. Open questions for Justin

1. **Where do the actions run?** A hub-door `runHubAction` on each site (beside the channel one), or a widened Channel door? The hub door keeps Channel "plans only". Recommend the hub door.
2. **"Weekly meeting".** Is "make this the weekly meeting" the hub's lead flag (today's behaviour: only what the hub leads with), or should it set Repeat weekly on the meeting? Today they are separate. Recommend two labels: "Repeat weekly" in the form, "Lead the hub with this" in the pop-up.
3. **Email reminders from Channel.** Should "Email a reminder to everyone who said they're coming" be in the pop-up at all? It sends real mail. Recommend yes, with the confirm step.
4. **Order of retirement.** Redirect sunjay's `/manage` content tab as soon as the pop-up groups are live, or wait for the hub Content card so every app retires together? Recommend sunjay first: it has Channel and the clearest table.
