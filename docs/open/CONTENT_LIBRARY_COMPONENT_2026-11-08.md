# Content library and content detail: proposal (2026-11-08)

Asked by the PM board (`docs/open/PM_BOARD_2026-11-08.md`, Lane B card decisions):
"Content = a universal content library viewer, leaning on Channel's Library/piece
view". This doc answers from the code. No code, migrations or builds were touched
to write it; the row counts in section 2 come from read-only queries on `elkdonis_dev`.

**Recommendation in one paragraph.** The owner is right. Build on Channel's
piece view: it is the only place where an item's history across outlets, its plan
and its next moves are already put together. But do not reuse it as it is. Today
it is app-local, gets its data from one 885-line loader built for the whole
channel, and covers only two storage kinds. Lift it into a **new package,
`@elkdonis/content`**. The package has three entries: `./model` (types, browser
safe), `./server` (a per-item loader that returns one normalized model) and
`./ui` (one `ContentDetail` component with three layouts and a panel registry).
Key everything on the `<store>:<id>` string Channel already uses (`thread:<id>`,
`artwork:<id>`). Treat the normalized model as the item's **passport**: the same
JSON drives the UI, the Studio hand-off and the assistant/dock (a registry read
entry). Per-item preferences ("what it likes") get one small table. Do it in six
passes; the first only moves code and changes no behaviour.

---

## 1. What exists

### Channel's piece view and library
| Piece | File | What it does |
|---|---|---|
| Piece pop-up (3a + 3c) | `apps/arts-collective/src/components/channel/PieceSurface.tsx` | Masthead (thumb, meta, New post / Board / Open in Studio / View on site / Switch piece). Tab **Overview**: "Where it has gone" timeline, "Coverage by identity" table (site, IG, FB, market, letter per identity), "Next for this piece" chips. Tab **Plan**: plan.md read/markdown modes, step ticks with conflict check, the board's waiting suggestions with Accept / Adjust / Dismiss. |
| Piece board (2b) | `components/channel/PieceBoard.tsx`, route `app/channel/piece/[kind]/[id]/page.tsx` | The same piece on a 7-week lane grid (dates, site, IG, FB, video, writing, live, newsletter) with a Today line, placed suggestions and "Add N to the queue". |
| Library (3b) | `components/channel/Library.tsx` | Bricks grouped by site, a lightbox preview (meta, excerpt, coverage marks, last 4 timeline rows), "Manage this piece" / "Use this piece" (chooser mode), search and kind filters. **Client-side filtering of the already-loaded model**: no server search, no paging. |
| Quick / Adjust sheets | `components/channel/QuickSheet.tsx`, `AdjustSheet.tsx` | Right-hand 460 px sheets on the same surface stack (`channel:quick`, `channel:adjust`). These show that the side-sheet container already works. |
| Shared atoms | `components/channel/bits.tsx` (`Timeline`, `StateMark`, `StatusTag`, `Thumb`, `OutletMarks`, `NextChip`), `icons.tsx` (lucide outlet/identity marks), `channel.css` (752 lines, `chn-*` classes on `--eac-area-*` tokens) | |
| Context | `components/channel/context.tsx` | `useChannel()` gives the whole `ChannelModel` plus `openPiece`, `openLibrary`, `openQuick` and `openAdjust`, which push `custom` descriptors on the cms-ui surface stack (registered in `ChannelFrame.tsx`). |

### Data it reads (`apps/arts-collective/src/lib/channel/load.ts`)
One loader, `loadChannelModel(user, {org})`, about 15 reads per request. It loads
up to **160 threads and 120 artworks** and then derives every piece. The piece
route loads all of it to show one piece. The dock does the same through
`lib/channel/next-source.ts`. Sources per piece:
- **Core:** `threads` (kinds writing, post, meeting, reading_group, series, workshop, event; status published/draft; next `series_session`); `artwork` through `@elkdonis/commerce/queries` (`listArtworksForPerson`, `listStoreArtworks`), plus the `site_config` `shop:store` pin for the org site.
- **History:** `threads.metadata.shares`; `social_posts.shares`, joined **by `link` = the piece's URL**; `publish_jobs` failed in the last 30 days; `email_sends` kind notification by `thread_id`.
- **Planning (migrations 252/255):** `channel_deliveries`, `channel_plans` + `channel_plan_events`, `channel_todos`, `channel_routines`, `channel_rules`, through `packages/services/src/channel.ts` (`@elkdonis/services/channel`) and the pure `channel-plan-md.ts`.
- **Outlets:** `user_connections` and `org_channels`, for coverage and suggestions.
- **Writes:** `lib/channel/actions.ts`, with `ownerFor`/`mayTouch`. A copy of these auth helpers lives in `packages/actions/src/server/channel.ts`, and the two must change together (handover §6).

### Kinds covered
`PieceKind` (`lib/channel/model.ts`): artwork, product, writing, video, series,
meeting, event, workshop. Storage is only **two stores**: `subject.kind` is
`'thread' | 'artwork'`, and migration 252 enforces that with
`CHECK (subject_kind IN ('thread','artwork'))` on `channel_deliveries`,
`channel_plans` and `channel_todos`. "Video" is a thread with `video_url`. Reels
show up only once they are published as a writing thread. Social posts are
history rows, not pieces. Thread kinds Channel ignores: service, tour,
experience, document, wiki_page, idea, pigeon, series_session.

### How tied it is to arts-collective
- **App-local:** every component, the model types, the loader, the suggestion/gap rules, the actions, the URL builders (`ARTDIRECT`, `MARKET`, `OWN_APP_SITES`, `getOrgHomeUrl`), and `next/link`. The components also call app server actions directly (`@/lib/channel/actions`).
- **Already shared:** the surface stack and `SurfaceFrame` (`@elkdonis/cms-ui/surface`), the planning tables' service (`@elkdonis/services/channel`), plan.md parsing (`@elkdonis/services/channel-plan-md`), the registry entries (`packages/actions/src/channel.ts`).
- `packages/studio/src/channel/` is the **superseded** first console (`ChannelConsole`, server-rendered, untouched since 2026-11-07 08:11). Do not build on it. Delete it once the lift lands.

**Verdict:** the *view* is the right one. The *data path* is wrong for a universal
detail, because it is a whole-channel loader with per-app URL logic. The *packaging* is
also wrong, because everything sits in one app that needs a memory bump to build.

---

## 2. What "universal" needs

### Content stores on the platform
Counts from `elkdonis_dev`, 2026-11-08.

| Store (table, id type) | Types inside | Rows | In the library? |
|---|---|---|---|
| `threads` (varchar 21) | post 58, writing 65, meeting 28, series_session 14, tour 11, workshop 7, document 4, wiki_page 4, idea 3, service 3, reading_group 2, series 2, experience 2, pigeon 1 | ~205 | **Yes**: the backbone |
| `artwork` (uuid) via commerce | original, product kinds | 60 | **Yes** |
| `reel_projects` (text) + `studio_items`/`studio_item_links` (mig. 248) | reel, recording, file | 27 reels, 29 items | **As lineage**, not top-level (a published reel *is* a writing thread with `metadata.video.reelId`) |
| `social_posts` (varchar 21) | Studio posts | 7 | **As deliveries/history**; a post with no `link` is listed as its own item later |
| `places` 85, `business_listings` 30, `lms_courses` 8, tour tables | domain records | | **No**: these belong to the Business, elktours and LMS cards |

### Common identity
There is one, informally: Channel's `Piece.key` = `${subject_kind}:${subject_id}`,
the same pair the 252 tables store, and the same key `?piece=` and `/new?about=`
use. Elsewhere it is inconsistent. `action_events.subject_id` (mig. 246) carries
an id **without a kind**. `studio_items` has its own id plus `thread_id`/`reel_id`.
`publish_jobs` has `source_kind`/`source_id` (good).

**Decision:** `ContentRef = { store: "thread" | "artwork"; id: string }`, written
`thread:<id>`. Keep **store** (which table) separate from **type** (how it is shown:
writing, meeting, series...). Reels and recordings join as stores only when one
needs a plan of its own. Then widen the 252 CHECK constraints in a migration.
Until then they appear as lineage of the thread they became.

### Shared core (every item)
title, type (glyph and label from the cms-ui `kindMeta`, not Channel's duplicate
`PIECE_KINDS`), media (cover, images, video poster), excerpt/meta line, status
(draft, published, scheduled, archived; for artwork available, reserved, sold),
owner identity plus "presented by" org, site (name, host, URL), dates (created,
updated, published, next), links (public, Studio, board, manage), viewer
permissions (`can.edit`, `can.plan`, `can.deliver`, `can.publish`, `can.archive`),
and the **history timeline**.

### Kind-specific panels
| Panel | For | Source |
|---|---|---|
| **Coverage** (outlet × identity) | all publishable | Channel's coverage logic, lifted |
| **Plan** (plan.md + waiting suggestions) | thread, artwork | `channel_plans`, suggestions |
| **Board** (7-week lanes) | thread, artwork; page layout only | `PieceBoard` |
| **Schedule** (sessions, occurrences, cycle) | series, meeting, workshop, event, reading_group, tour | `series_sessions` (mig. 203), `threads.scheduled_at`/recurrence, `thread_cycle_events` |
| **People** (RSVPs, attendance) | meeting, event, workshop | `thread_rsvps`/`rsvp_responses`, as sunjay's `getAttendanceCount` does |
| **Market** (price, variants, status, store/site pin, provenance, auction) | artwork, product | commerce `Artwork`, `artwork_provenance` (mig. 209), `auction_lot` |
| **Made from / made into** | video, reel-born writing, artwork used in reels | `studio_items` + `studio_item_links` |
| **Conversation** | thread | `thread_external_comments` (mig. 225; 0 rows, Meta webhook), forum replies later |
| **Revisions** | wiki_page (full snapshots), any thread (kind changes) | `wiki_revisions` (mig. 118), `thread_revisions` (mig. 031, 4 rows) |
| **What it likes** (passport prefs) | all | new, see section 4 |

---

## 3. The detail component

### Where it lives: a new package `@elkdonis/content`
The dependency graph decides this. `@elkdonis/commerce` depends on
`@elkdonis/services`, so a loader that reads artwork **cannot live in services**.
`cms-ui` has no data access by design (its surface types say "this package does not
depend on services"). The superseded `packages/studio/src/channel` is the wrong base.
So the package is one level above services and commerce, like `packages/actions`:

```
packages/content/
  src/model.ts       ContentRef, ContentDetailModel, ContentEvent, panel ids, parse/format (browser-safe)
  src/registry.ts    type → panels, threads.kind → type, glyphs via cms-ui kindMeta
  src/server/        loadContentDetail, listContent, adapters/thread.ts, adapters/artwork.ts,
                     sources/*.ts (one file per timeline source), access.ts (mayView/mayTouch)
  src/ui/            ContentDetail, ContentLibrary, panels/*, atoms (Timeline, StateMark, Thumb, OutletIcon)
  src/content.css    lifted from channel.css (prefix eac-content-*, area tokens kept)
exports: "./model", "./server", "./ui", "./content.css"
deps: @elkdonis/db, services, commerce, cms-ui (SurfaceFrame/SurfacePage), lucide-react
```

The UI does **not** import `next/*` or app actions. Like every cms-ui surface, it
talks only to **connectors** the host supplies.

### Contract
```ts
// model.ts
export type ContentStore = "thread" | "artwork";
export interface ContentRef { store: ContentStore; id: string }          // "thread:abc"
export interface ContentEvent {
  id: string; at: string;
  lane: "site" | "social" | "email" | "video" | "writing" | "live" | "market" | "dates" | "plan" | "edit" | "comment";
  source: "thread" | "share" | "delivery" | "publish_job" | "email" | "plan_event" | "action_event"
        | "revision" | "content_event" | "comment" | "session" | "provenance" | "lineage" | "suggestion";
  verb: string;                       // published | shared | scheduled | failed | edited | step_checked | ...
  label: string; sub: string;
  state: "published" | "scheduled" | "live" | "draft" | "failed" | "suggested" | "info";
  actor?: { kind: "person" | "agent" | "system"; name?: string };
  identityId?: string | null; href?: string | null;
  refs?: { deliveryId?: string; planEventId?: number; jobId?: number };
}
export interface ContentDetailModel {
  ref: ContentRef; key: string; type: ContentType;
  title: string; meta: string; excerpt: string;
  media: { cover: string | null; images?: string[]; video?: string | null };
  status: { value: string; label: string };
  owner: ContentIdentity; presentedBy: ContentIdentity | null; site: { name: string; host: string | null; url: string | null };
  dates: { created: string; updated: string; published: string | null; next: string | null };
  links: { public: string | null; studio: string | null; board: string | null; manage: string | null };
  can: { edit: boolean; plan: boolean; deliver: boolean; publish: boolean; archive: boolean };
  timeline: ContentEvent[];            // one list, past and ahead, sorted; the UI splits on "now"
  panels: ContentPanelData[];          // discriminated union { id: "coverage" | "plan" | "schedule" | ... , data }
  identities: ContentIdentity[];
  missing: string[];                   // sources that failed or tables absent: shown, never silently dropped
  timeZone: string; now: string;
}

// server
loadContentDetail(viewer: { userId: string }, ref: ContentRef, host: ContentHost): Promise<ContentDetailModel | null>
listContent(viewer, scope: { org?: string; person?: boolean }, q: { text?: string; types?: ContentType[]; cursor?: string; limit?: number }, host): Promise<{ items: ContentSummary[]; next: string | null }>
// ContentHost: the per-app URL facts that load.ts hard-codes today
interface ContentHost { siteUrlFor(orgId: string): string | null; personalPageUrl(slug: string): string; marketUrl(artworkId: string): string; studioUrl: string; manageUrl?(ref: ContentRef): string | null }

// ui
<ContentDetail model={m} layout="popup" | "page" | "sheet" panels={["coverage","plan",...]?} connectors={c} />
contentSurfaces(c: ContentConnectors): Record<string, CustomSurfaceRenderer>   // registers "content:detail", "content:library"
interface ContentConnectors {
  load(ref: ContentRef): Promise<ContentDetailModel | null>;          // host server action → loadContentDetail
  list(q): Promise<{ items: ContentSummary[]; next: string | null }>;
  act(entry: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }>; // registry runner
  openStudio(ref: ContentRef, ctx?: StudioContext): void;
  onMutated?(): void;
}
```

`ContentSummary` is the core fields plus the latest 3 events and a coverage strip.
It is what the library bricks and the hub face draw.

### The history timeline
One list, built server-side from per-source functions (`server/sources/*.ts`).
Each source is wrapped in `safe()` and reports itself in `missing` when absent:
1. **Lifecycle:** `threads.created_at`/`published_at`/`updated_at`; artwork `created_at`/status.
2. **Went out:** `threads.metadata.shares`; `social_posts.shares` by link; `publish_jobs` (done and failed); `email_sends` (letters).
3. **Planned:** `channel_deliveries` (draft, scheduled, published, failed); unplaced suggestions as `state: "suggested"` (ahead of now only); linked `channel_todos`.
4. **Plan edits:** `channel_plan_events` (created, edited, step_added, step_checked), with actor user or agent. This is the attribution the owner wants for agent edits.
5. **Edits:** `action_events` where `subject_id` = the id (registry edits/publishes, actor human/ai/system); `thread_revisions` (kind changes); `wiki_revisions`; then the new `content_events` (section 5).
6. **Dates:** `series_sessions`, `scheduled_at`, `thread_cycle_events` (confirmed/cancelled).
7. **Conversation:** `thread_external_comments`.
8. **Lineage:** `studio_item_links` ("made from recording X", "cut into reel Y").
9. **Market:** `artwork_provenance`, sold/reserved.

"Studio versions" do not exist. The Studio writes straight to `threads`, so there is
nothing to show beyond `updated_at` until `content_events` is written. Reel
renders (`reel_renders`) are the one real version list; show them in Made from.

The UI groups the list into **Ahead / Now / Past** with a Today rule, the same idea
as PieceBoard. Filter chips by lane (Out, Plan, Edits, Talk) keep it readable.

### One component, three containers
| Container | How | Layout |
|---|---|---|
| **Hub pop-up** (Content card) | `surface.open({ type: "custom", key: "content:detail", size: "full", props: { ref } })`. The renderer calls `connectors.load(ref)` and paints the masthead at once from the face's `ContentSummary`, as `ThreadSurface` does with `ThreadPreview` | `popup`: PieceSurface's two columns (timeline left; coverage + next right), tabs Overview / Plan / panels |
| **Full page** | Server component calls `loadContentDetail` and renders `<ContentDetail layout="page">` inside `SurfacePage` (`cms-ui/surface/SurfacePage.tsx`: "face → surface → page", the same object at three sizes) | `page`: the masthead, the Board lanes, all panels as sections, panels in the rail |
| **Side sheet** (Channel, Studio) | Same `content:detail` key, `size: "standard"` (the Quick/Adjust sheet width) | `sheet`: one column, the timeline compacted to the last 5, Plan as a disclosure |

The containers come from the surface stack the apps already run. The component
only picks a layout. Channel keeps its own frame and registers
`contentSurfaces(...)` next to its other `custom` keys.

### Hand-off to the Studio
Today the link is `studioHref: /studio?id=<thread>&org=<org>` (`load.ts`), and
`app/studio/page.tsx` accepts only `org`, `id` and `kind`. There is no step or preset
context, and the Studio never closes the Channel delivery it fulfils. The contract:

```
/studio?kind=<post|video|writing|meeting>&about=thread:<id>&delivery=<deliveryId>&preset=<presetId>&org=<org>
```
- **The `delivery` id is the work order.** Every accepted or adjusted suggestion already writes a `channel_deliveries` row whose payload holds the outlet, time, idea, star and text (`acceptAdjustedAction`). The Studio loads it **server-side**, checks `mayTouch(..., "deliver")` and pre-fills from it. The URL carries no text.
- Plan steps have no stable id (ticks match by index plus text). So the hand-off keys on the delivery, not on the step. When the Studio publishes, it sets the delivery to `published` with `permalink`/`external_id` (the columns exist; nothing writes them yet), and that also ticks the matching plan step.
- `preset` is resolved the same way, from the passport prefs or the org/user preset store (Lane A2).
- Apps without the Studio (sunjay and the rest) link to the network Studio on arts-collective with `org=`. SSO arrivals already cover the crossing.
- `ContentConnectors.openStudio(ref, ctx)` builds this URL, so no panel hard-codes it.

---

## 4. Better than "a library plus a detail": the passport

Make the normalized model a **content passport**, not just a view model. It is one
JSON per item that every central service reads:
- **UI:** the detail and library render it (above).
- **Assistant and dock:** a registry status entry `content-passport` (scope `thread`/`artwork`, read-only) returns it, trimmed. The LMS/MCP assistant then has one call that answers "what has this piece done, what is next, what does it like". Today it would need Channel's whole loader, which the dock already runs too often (`next-source.ts`: "about fifteen reads").
- **Studio:** opens with the passport's prefs applied (preset, caption style, outlets to skip).
- **Channel:** suggestions read the passport's prefs before the global `channel_rules`.

**"What it likes"** (the owner's presets on a thread or artwork; Lane A2 ownership
tier "thread or artwork") goes in **one small table**, not in `threads.metadata`.
Artwork has no matching column, and the prefs must be queryable by the suggestion
generator:

```sql
content_prefs (subject_kind, subject_id, org_id, owner_kind, owner_id,
               ladder text, tuner jsonb, presets jsonb,   -- [{type:"caption"|"clip"|"music"|..., ref:"nc:/path" | "preset:<id>"}]
               never jsonb,                                -- outlets this item must not go to
               updated_by, updated_at, PRIMARY KEY (subject_kind, subject_id))
```
Preset bodies stay in Nextcloud with a DB index, as Lane A2 already plans. The
passport holds references only. The cascade is resolved in the loader: **item →
org → person → platform default**. The "What it likes" panel shows the resolved
value and where it came from ("from Katie the Potter's brand kit"). That is also
where the brand kit (Lane A) appears, without a separate UI.

This adds two things to "library + detail": the item explains itself to agents,
and its settings travel with it into the Studio and Channel. It costs one table and
one registry entry.

---

## 5. Implementation plan

Each pass is small, type-checked, and rendered in `scripts/channel-harness/`
before anything is built.

**Pass 1: lift the view with an adapter (no behaviour change).**
Create `packages/content` with `model.ts`, `ui/` (PieceSurface becomes `ContentDetail`
popup layout, plus the Timeline/Coverage/Plan panels and the atoms) and `content.css`.
Add `channelPieceToDetail(piece, model)` in `apps/arts-collective/src/lib/channel/`,
so Channel feeds the new component from the model it already loads. Plan writes go
through `connectors.act` to the existing app actions. Swap `channel:piece` to render
it. Delete `packages/studio/src/channel/`. This touches Lane A's files, so do it in
a slot agreed with the owner.

**Pass 2: the normalized loader.**
`@elkdonis/content/server`: `loadContentDetail` for `thread` and `artwork`, with
sources 1-4 and 6 from section 3 and the `ContentHost` adapter. Move
`ownerFor`/`mayTouch` (plus a new `mayView`) into `server/access.ts`. Then
`lib/channel/actions.ts` and `packages/actions/src/server/channel.ts` both import
it, which ends the duplicated helpers. Point the piece route
(`app/channel/piece/[kind]/[id]`) at it: one item, about 8 indexed reads instead of
the whole channel. Add the passport registry entry. Lift the gap rules to a pure
`@elkdonis/services/channel-suggest` so both loaders share them; Lane A's
`channel-ladders.ts` plugs in there.

**Pass 3: the hub Content card.**
`listContent` (server search, cursor paging; it replaces the Library's 160/120
client filter), the `ContentLibrary` surface (bricks plus a list mode for the /manage
table) and a `ContentFace` for the hub. Wait for the Claude Design pass on the
card (none is in `HUB_CARD_PROMPTS_2026-11-08.md` yet). Pilot in **one** app (sunjay,
whose `/manage` Content table is the clearest), then replace the five copies of
`components/manage/content-row-actions.tsx` (sunjay, elktours, amrit-canada,
hidden-enneagram, innergathering) with the detail's foot actions through the
registry (`thread-publish`, unpublish, archive, set standing).

**Pass 4: edit history.**
Migration `content_events` (append-only, same shape as `action_events` with
`subject_kind`, `subject_id`, actor_type, verb, `fields text[]`, summary). It is
written by the shared write paths: services thread updates, commerce
`updateArtwork`/`publishArtwork`, and `performAction`. Per-app `lib/cms/actions.ts`
writes that bypass the shared paths will not log until they move. Say so in the
panel (`missing`).

**Pass 5: the other panels and types.**
Schedule (series_sessions, cycle), People (RSVPs), Market (provenance, auction),
Made from (studio_items), Conversation, Revisions. Extend the type registry to
service, tour, experience, document, wiki_page and idea, which Channel skips.

**Pass 6: passport prefs and the Studio hand-off.**
Migration `content_prefs`; the "What it likes" panel; the
`/studio?about=&delivery=&preset=` contract in `app/studio/page.tsx`; the Studio
marks the delivery published.

### Backend gaps
- **No general edit history.** `thread_revisions` logs only kind changes (4 rows), `wiki_revisions` covers only wiki pages, and artwork has none. `content_events` is needed (pass 4).
- **The 252 CHECKs** (`subject_kind IN ('thread','artwork')`) block plans for reels or posts. Widen them only when a third store is real.
- **Deliveries never close.** `channel_deliveries.published_at`/`permalink`/`external_id` are never written by the Studio send path (`post-actions.ts` `publishSocialPost`). There is also no send worker for scheduled rows.
- **Shares are matched by URL.** `social_posts` joins a piece by `link`, so a post whose link differs is invisible. A `subject_kind`/`subject_id` pair on `social_posts` would fix it.
- **Missing indexes** for per-item reads: `publish_jobs (source_kind, source_id)`, `social_posts (link)`, `email_sends (thread_id)`. All tables are tiny today, so this is cheap.
- **Two series mechanisms:** `series_sessions` (mig. 203) and `threads.metadata.seriesId` (what `load.ts` reads). Pick `series_sessions` in the Schedule panel.
- `OWN_APP_SITES` in `load.ts` must become `org_domains` before `ContentHost` is shared.
- Letters assume `email_sends` kind `notification` = "about this thread" (Channel brief). Keep the caveat in the UI.

### Risks
- **Build memory:** arts-collective's build needs the 9g bump (`docs/reference/ops.md`). A new package adds to every importing app's transpile set. Keep `./ui` free of tiptap/three, and keep `./server` out of client bundles (`import "server-only"`).
- **Many importers:** once cms-ui or a shared package changes, every app that imports it must type-check. Keep the package additive, pilot in one app, and add it to `transpilePackages` per app as each adopts it. No cms-ui type unions change, because registration goes through `custom` keys.
- **Lane collisions:** Lane A (owner, active) owns the Channel files and `services/channel.ts`, so passes 1-2 need a handover slot. Lane B owns the hub design, so pass 3's face waits for it. The `next dev` bind mount makes edits live.
- **React 19 types:** use `React.ReactNode` (the namespace), not a named import (EAC gotcha).
- **Authorization:** `mayView` is new surface area. Org managers may *plan* pinned artists' artwork but not *deliver* it (`mayTouch` rule, Channel brief). The detail must show `can.*` from the server and never infer it client-side.
- **Never verified signed in:** Channel itself is not verified on real data. Do that check before pass 1, so the lift does not carry hidden loader bugs into a shared package.

---

## Pass 1 done (2026-11-08)

**What moved.** The piece pop-up (`PieceSurface` with its Coverage table and
Plan tab) now lives in the new package **`packages/content`**
(`@elkdonis/content`), with entries `./model`, `./registry`, `./server` and `./ui`:
- `src/model.ts`: `ContentRef`, `ContentEvent`, `ContentIdentity`, `ContentSuggestion`, the coverage and plan panel data, `ContentDetailModel`, and the helpers `contentKey`, `parseContentKey`, `panelOf` and `fmtDay`. It has two fields that section 3's contract does not: `ContentEvent.outlet` (the timeline draws the outlet mark) and `links.compose` (the "New post" button).
- `src/registry.ts`: maps each type to a label, a glyph, a surface frame kind and its panels. It keeps Channel's own glyphs (not cms-ui `kindMeta`), so nothing changes on screen.
- `src/ui/`: `ContentDetail` (popup layout only), `panels/coverage.tsx`, `panels/plan.tsx`, `atoms.tsx` (OutletIcon, IdentityMark, StateMark, StatusTag, Thumb, NextChip, Timeline) and `connectors.tsx`.
- `src/server/index.ts`: a placeholder that re-exports the model types. It has no data access yet.

**The adapter.** `apps/arts-collective/src/lib/channel/content-detail.ts`
exports `channelPieceToDetail(piece, model, { href, base })`. It is pure: it maps
the already-loaded `Piece` and `ChannelModel` onto `ContentDetailModel`.
`components/channel/PieceSurface.tsx` is now a thin host. It builds the model and
passes `ContentDetailConnectors`:
- `act("plan.start" | "plan.save" | "plan.step" | "suggestion.accept" | "suggestion.dismiss")` calls the existing server actions in `lib/channel/actions.ts`.
- `openSuggestion` opens the quick sheet, `adjustSuggestion` the adjust sheet and `switchItem` the library.
- `Link` is `next/link`.

The `channel:piece` key and `ChannelFrame` are unchanged.

**Verified.**
- `tsc --noEmit` is clean for the package (strict) and for arts-collective.
- In the channel harness, the screenshots of piece, plan, piece-phone, dark, home and library are byte-identical before and after.
- The dialog DOM is also identical after these interactions: the Plan tab, a step tick, Markdown mode, back to Overview, Adjust, a coverage chip (the quick sheet) and Switch piece.

**What was left alone, on purpose.**
- **CSS.** The UI keeps the `chn-*` class names and renders on the host's `channel.css`. That stylesheet is one token system under `.chn`, shared with the rest of Channel, so splitting it now would mean editing Lane A's file or duplicating rules. `content.css` (with the `eac-content-*` rename) moves to pass 3, when a second host adopts the detail.
- **Duplicated atoms.** `components/channel/bits.tsx` and `icons.tsx` still hold their own copies of these atoms for the rest of Channel. Pointing them at `@elkdonis/content/ui` is a later edit that needs Lane A's agreement.
- **`packages/studio/src/channel/` was not deleted.** It is still in use: `app/studio/channel/page.tsx` imports `ChannelConsole` and `@elkdonis/studio/channel.css`, through `lib/channel-data.ts` and `lib/channel-actions.ts`. Retire that route first, then delete the folder.
- **`can.*`.** The adapter fills it client-side, and no UI reads it yet.

**Where pass 2 starts.** Implement `loadContentDetail` in `src/server/`. It
returns the same `ContentDetailModel` that `channelPieceToDetail` builds today,
so `ContentDetail` and its connectors do not change. Replace the adapter with a
`connectors.load(ref)` call (or a server prop on the piece route), then delete
`content-detail.ts`.
