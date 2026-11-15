# Editing landscape: component inventory (Lane 1, "detail") — 2026-11-12

Read-only survey by system32-fc (sunjay read directly; hidden-enneagram and danamccool via one Sonnet reader, spot-checked). Paths are relative to `~/eac`. Nothing edited, built or committed.

**Classes**
- **a (surface).** A Puck block whose BlockDef declares `parts`. direct-edit morphs the parts on the page; a part with `prop:` gives inline words.
- **b (sealed).** A Puck block with no `parts` (generic root only). It can be moved; its settings open in the Puck one-block popup (`tree-editor.ts` `editSettings`).
- **c (plain).** React drawn by a route outside Puck `<Render>`.

**Binding labels:** `From what?` (a `binds:` prop, picked in the chooser), `route` (URL → metadata/route props), `proximity` (placement or page slug), `hand-wired` (an id or slug typed in a plain field, or a constant), `org` (implicit: this org, this viewer), `static`.

## 1. Para Theater (`apps/sunjay`)

Catalogue: `src/lib/puck/catalogue.ts` = `SITE_BLOCKS` (`src/blocks/index.ts`) + 20 shared ids + `featured-person`. Server config adds direct-edit `BOX_BLOCKS` (box/words/picture, the editor's own types). The home page has its own config, `src/lib/puck/config.landing.ts` = `BOX_BLOCKS` + `HOME_BLOCKS`. One loader per id, `src/lib/puck/block-data.ts`, serves both the server resolvers and the editor's `/api/blocks/[id]`. Resolved keys are listed in `src/blocks/resolved-keys.ts`.

### Site blocks

| id | label | class | parts with `prop` | binding | file |
|---|---|---|---|---|---|
| pt-band | Band | b (slot container) | — | static | blocks/layout-blocks.tsx:108 |
| pt-banner | Banner | a | image(imageUrl), title, subtitle, body, button(ctaLabel) | static | layout-blocks.tsx:306 |
| pt-heading | Heading | b | — | static | layout-blocks.tsx:389 |
| pt-link | Link | b | — | static | layout-blocks.tsx:~440 |
| **pt-standing** | **Next gathering** | **a**, interactive | none (data words locked) | **org + viewer**: `getStandingMeeting(orgId, viewer)` → `standingForViewer` | data-blocks.tsx:40; parts `shared-parts.ts` STANDING_PARTS |
| pt-calendar | Calendar | a, interactive | none | org + viewer: `listOrgEventsInRange` this month | data-blocks.tsx:60 |
| pt-profile | Profile card | a | none | hand-wired: `siteConfig.guideSlug` → `getGuideBySlug` + network profile links | data-blocks.tsx:133 |
| pt-threads | Posts | a, interactive | heading, intro, kicker(cardLabel) | org: `feed` select (default "materials") or author = guide | data-blocks.tsx:209 |
| pt-member | Sign up / membership | **b**, interactive | — | viewer | data-blocks.tsx:267 |
| **pt-forum** | **Forum** | **a**, interactive | heading | **org + viewer**: `getForumSnapshot()` | data-blocks.tsx:288; FORUM_PARTS |
| pt-writing | Writing shelf | a | heading | org: `listWritingShelf(limit)` | data-blocks.tsx:337 |
| pt-gallery | Gallery | a, interactive | heading | org: `listGalleryImages(limit)` | data-blocks.tsx:390 |
| pt-event-header / -about / pt-talk-room / pt-event-rsvp / pt-event-materials | Event blocks | **b** ×5 | — | **route**: `metadata.threadId` (event-detail template); else the next upcoming gathering | event-blocks.tsx:38-130, lib/puck/data-event.ts |
| pt-offering-card | Offering card | b | — | route/next event, as above | offering-card.tsx:38 |
| pt-services | Services list | b | — | org | service-blocks.tsx:129 |
| pt-service | One service | b | — | **From what?-ish**: `binds:"service"` → `ServicePickerField` (Puck only, not direct-edit's chooser); empty = `?service=` (route) else newest | service-blocks.tsx:192, lib/puck/data-service.ts |
| pt-booking | Booking | b | — | same as pt-service | service-blocks.tsx:227 |
| pt-journal | Journal | b | — | org (pieces shown on this org) | writing-blocks.tsx:63 |
| pt-article | Article | b | — | route `metadata.piece` (`/journal/[piece]`), else **hand-wired** `piece` text, else newest | writing-blocks.tsx:136, data-writing.ts:47 |
| pt-series-nav | Series nav | b | — | follows pt-article's piece | writing-blocks.tsx:186 |
| pt-steps | Steps | a | heading, steps.title, steps.text (rows) | static | small-blocks.tsx:66 |
| pt-notice | Notice | b | — | static | small-blocks.tsx:133 |

### Home live pieces (`/` once saved as a tree; `src/blocks/home-blocks.tsx`)

| id | class | parts | binding |
|---|---|---|---|
| home-stage | a (empty parts map) | — | org: `currentSeries()` → `EventStage` |
| **home-standing** | a | STANDING_PARTS | org + viewer, drawn by `app/page.tsx` |
| **home-forum** | a | FORUM_PARTS minus heading | org + viewer, drawn by `app/page.tsx` |
| home-join | a | root, join, note | viewer |
| `part` "banner" | direct-edit `PART_TYPE` | — | `site_images` hero |

### Shared blocks offered

| ids | class | binding |
|---|---|---|
| section-heading, text-image, quote | a, with `prop` parts | static |
| prose, faq, picture-wall, sticky-split, tab-set, accordion-set | a, no `prop` | static |
| feature-card | a (6 `prop` parts) | From what? `record` + `opens` (`lib/opens-server.ts` cardRecord: meeting/series/post) |
| featured-person | a | From what? `person` + `opens` (`lib/featured-person.ts`) |
| link-button | b | From what? `opens` |
| thread-feed | b | org: `loadThreadFeed(orgId, upcomingOnly)` |
| split-row, grid, flow-column, card-grid, divider, figure, video, entry-list | b | static |

From what? on sunjay handles only `person | opens | record` (`components/landing/person-records.ts:14`). `service` has its own Puck field.

### Plain (c) visitor pages

| route | draws | file |
|---|---|---|
| `/[feed]/[slug]` (post, or event without a detail page) | cms-ui `SurfacePage` + `EditThreadButton`, `EventPageToggle` | app/[feed]/[slug]/page.tsx:190-273 |
| `/[feed]` (feed listing) | `SectionBanner` + `ThreadCard` | app/[feed]/page.tsx |
| `/community` | the same faces as `/` (StandingMeetingFace, ForumFace, HubCalendar, EventStage), `data-edit-section` ×4, no tree | app/community/page.tsx |
| `/about` | hand-written; `data-edit-section` ×3 | app/about/page.tsx |
| `/about/[slug]` | cms-ui `PersonPage`, `StoreShowcase` | app/about/[slug]/page.tsx |
| `/series`, `/series/[slug]`, `/series/[slug]/[n]` | `@elkdonis/series-site/pages` | app/series/** |
| `/forum/**` | `@elkdonis/forum-ui` `renderForumRoute` | app/forum/** |
| `/publications`, `/center`, `/account`, `/hub/**`, `/manage/**` | plain | app/** |

Puck-drawn: `/` (live-piece tree), `/[slug]` pages (fallthrough in `[feed]/page.tsx:58`, `metadata.service`), event-detail template (`[feed]/[slug]/page.tsx:128`, `metadata.threadId`, when `threads.metadata.detailPage`), journal-piece template (`journal/[piece]/page.tsx:57`, `metadata.piece`). Templates and reserved slugs: `src/lib/puck/reserved.ts`.

## 2. hidden-enneagram (`apps/hidden-enneagram`)

Catalogue `src/lib/puck/catalogue.ts:35` = site blocks + shared record blocks + 20 shared ids. Every site block except `he-sigil` declares parts. No site block sets `interactive`. Studio keys: `src/lib/puck/store.ts:22-36`.

| id | class | parts with `prop` | binding | file |
|---|---|---|---|---|
| he-welcome | a | heading, subline, body, link | static | blocks/house.tsx:56 |
| he-hero | a | eyebrow, title, lede, primaryLabel | static | blocks/hero.tsx:136 |
| he-passage | a | eyebrow, heading, body | static | blocks/passage.tsx:79 |
| he-enneagram | a | eyebrow, heading, intro | **proximity** (`placementRules`, reader by placement) | blocks/enneagram-block.tsx:140 |
| he-type | a | name, epithets | static (type number select) | blocks/type-chapter.tsx:72 |
| he-shelf | a | eyebrow, heading | org: services, or **hand-wired** `feed` (default "writing") | blocks/shelf.tsx:87, lib/shelf.ts |
| he-service | a | bookLabel | **route** `/services/[slug]` (routeSlug/routeQuery); **hand-wired** `serviceSlug` override | blocks/service.tsx:187, lib/record-blocks.ts:71 |
| he-post | a | backLabel | **route** `/[page]/[slug]` via `withRouteProps`; **hand-wired** `postFeed`/`postSlug` | blocks/post.tsx:138, lib/puck/route-props.ts |
| he-person | a | heading, statement (bio), page heading | card: **hand-wired** `slug` (default "aeon"); page: **route** `/about/[slug]` | blocks/records.tsx:324 |
| he-contact | a | eyebrow, heading | org: `/api/org/<org>/contact` | blocks/records.tsx:65 |
| he-forum | a | heading | org: `loadForumTopics` | blocks/records.tsx:136 |
| he-works | a | eyebrow, heading | static (typed media rows) | blocks/house.tsx:202 |
| he-orb | a (no `prop`) | — | static | blocks/house.tsx:106 |
| he-sigil | **b** (`parts: {}`) | — | static | blocks/sigil.tsx:18 |
| he-reading | a | eyebrow, title | static (steps typed) | blocks/reading-block.tsx:145 |
| he-music-web | a | heading | static | blocks/music-web-block.tsx:60 |
| he-course | a | eyebrow, heading, intro, buttonLabel | **hand-wired constant**: `loadCourse()` with no id; the editor shows STATIC_COURSE | blocks/course-card.tsx:90 |
| record-header / record-body / record-facts / checkout (shared) | a | checkout: buttonLabel only | **From what?** `record` (`binds:"record"`: `service:<slug>` / `post:<feed>/<slug>`), else `routeRecord`, else sample | packages/blocks/src/blocks/record-parts.tsx:187-386; lib/record-parts.ts |
| shared: hero-banner, section-banner, section-heading, text-image, quote | a, with `prop` | — | static | packages/blocks |
| shared: prose, faq, accordion/tab/sticky, picture-wall | a, no `prop` | — | static | |
| shared: split-row, grid, flow-column, divider, figure, video, entry-list, link-button, thread-feed | b | — | thread-feed: org | |

Routes: Puck at `/`, `/[page]`, `/about`, `/enneagram`, `/music`, `/readings`. Route templates at `/[page]/[slug]` (`post`), `/about/[slug]` (`person`), `/services/[slug]` (`service`). Plain: header/footer (`components/site-header.tsx`, `site-footer.tsx`), `/forum/**`, `/services/[slug]/book`, `/services/orders/[id]`, `/hub/**`, `/manage/**`, `/center`, `/account`, `/publish`. The `/publish` Studio is the popup surfaces `studio:compose`/`studio:choose`.

## 3. danamccool (`apps/danamccool`)

Catalogue: **all** of `SHARED_BLOCKS` + `SITE_BLOCKS`, unfiltered (`src/lib/puck/config.client.ts:127`, `config.server.ts:91`). **No DM site block declares `parts`.** Every route outside the plain ones goes through `src/app/[[...path]]/page.tsx` (key = path, metadata `{orgId, slug, canEdit}`).

| id | class | binding | file |
|---|---|---|---|
| dm-plate, dm-circle-text | b | **From what?** `binds:"artwork"` (`artwork-data.ts:77`); a typed value wins | blocks/plate.tsx:185, circle-text.tsx:144 |
| dm-image-set | b | From what? artwork per row + `binds:"opens-gallery"` | blocks/image-set.tsx:371 |
| dm-artwork-wall | b | source select: collection (org) / gallery (`binds:"gallery"`, **proximity** fallback = page slug) / chosen rows (artwork) | blocks/artwork-wall.tsx:229 |
| dm-gallery-grid | b, interactive | From what? `binds:"gallery"`, else **proximity** (gallery whose `pagePath` = page slug); edits in place when `metadata.canEdit` | blocks/gallery-grid.tsx:129 |
| dm-collection-nav | b | From what? `binds:"page-link"` tiles (stored in block) | blocks/collection-nav.tsx:253 |
| dm-writing-shelf | b | **org owner**: `getSiteOwnerUserId()` → `listWriting` | blocks/writing-shelf.tsx:42, config.server.ts:81 |
| dm-star-diamond, banner, opening, feature-grid, invitation, press-quotes, career-timeline | b | static | blocks/*.tsx |
| shared feature-card | a | From what? `record` → `lib/card-records.ts` (artwork, owner's gallery; no posts/events) | |
| shared profile-store, profile-gallery | b | `binds:"user"` ("empty = whoever the page is about"), **but DM registers no resolver** and has no user picker → draws nothing/sample | packages/blocks/src/server/store-panel.server.tsx:33,43 |
| shared profile-feed/-galleries/-record, store-* | b | no DM resolver → empty | packages/blocks/src/server/profile.server.tsx |
| other shared | as in §2 | | |

**The artist profile's user.** DM does not read the person from a block: `getSiteOwnerUserId()` (`src/lib/auth.ts:72-91`) = `user_organizations` row with `role='owner'` for `siteConfig.orgId`, else `users.email = siteConfig.ownerEmail`, cached in module memory. It feeds the writing shelf, `/api/blocks/writing`, card-record gallery ownership, gallery/artwork actions, media, `/gallery`, `/blog`. The `person-*` blocks (`packages/blocks/src/person-context.ts`, `metadata.person` from `loadPersonBlockContext`) are not in SHARED_BLOCKS and are not offered. Plain: `/about`, `/blog/**`, `/gallery/**` (redirects to a page when the gallery has one), `/hub`, `/vimeo`, `/credits`, `/manage/**`, header/footer (`loadNav`).

## 4. What Forum and Next gathering do that the others don't: the surface-treatment recipe

| # | Ingredient | Forum / Next gathering | Who else has it |
|---|---|---|---|
| 1 | **A shared face.** The visual is a cms-ui `*Face` (`ForumFace` `packages/cms-ui/src/surface/surfaces/ForumSurface.tsx`, `StandingMeetingFace` `cms-ui/src/hub/StandingMeetingFace.tsx`) on the `eac-face` markup grammar (card, kicker, title, blurb, glyph, cover). The same component is the hub card, the `/community` section and the page block. | yes | pt-gallery (`GalleryFace`), pt-calendar (`HubCalendar`), pt-threads (partly) |
| 2 | **The face opens its own Surface popup** (`useSurface().open({kind:"meeting"…})`, forum layers), registered once by `components/hub/HubSurfaces.tsx` in the root layout. In the editor `EnsureSurface` (`blocks/views.client.tsx:43`) supplies an empty provider so a click can't crash. | yes | gallery, calendar. HE uses custom surfaces instead (`enneagram-type`, `studio:*`). DM: none |
| 3 | **Parts as selectors over today's markup**, in a data-only file (`blocks/shared-parts.ts`), with no `data-part` attrs (visitor HTML unchanged). One root element so a look reaches inside. | yes | pt-banner, pt-threads etc. have parts, but not shared |
| 4 | **One parts list, two hosts.** STANDING_PARTS/FORUM_PARTS are used by the catalogue block (`pt-*`) **and** the home live piece (`home-*`), so a `morph` look means the same thing in Studio, on `/`, and in the popup. | yes (only these two) | — |
| 5 | **Live piece in the tree.** `app/page.tsx` renders the face server-side for the current viewer and passes it in `metadata.parts`. The stored block draws it inside `LiveRoot data-landing-block` (`home-blocks.tsx:21`). The editor gets the visitor's HTML, sealed for data and open for look. | yes (with home-stage, home-join) | nobody outside sunjay `/` |
| 6 | **No stored record: an implicit, evolving one.** The resolver picks "this org's next meeting" / "this org's forum now" per request and per viewer; nothing to choose, nothing to go stale. `RESOLVED_KEYS` strips the snapshot on save. | yes | pt-calendar, he-forum, dm-writing-shelf (org implicit) |
| 7 | **Words split cleanly.** Only the block's own label (Forum `heading`) is `prop`-editable; data words (topic titles, meeting time) are locked. | yes | pt-threads, he-* labels |

**The recipe to repeat (for any record block):**
1. Draw it with a shared cms-ui face (`eac-face` grammar), not app markup.
2. The face opens a registered Surface on click (thread / meeting / gallery / custom).
3. Declare `parts` over the face's real classes in a data-only `*-parts.ts`. Mark own-label parts with `prop`; never mark data words.
4. Use the same parts for the catalogue block and any live-piece twin.
5. Bind implicitly ("next", "latest", "this route's") where possible, else via `binds:` + From what?. Strip the resolved keys.
6. `interactive: true` + an EnsureSurface wrapper, so the editor is safe.

**Where the others fall short**
- **sunjay:** the event blocks (5), services/booking, journal/article/series-nav, member and notice are **b** (no parts), so the event-detail template, the gathering's own page, is the least surface-editable page on the site. `pt-service` binds through a Puck-only picker that direct-edit's From what? doesn't handle (`person-records.ts:14`). `pt-profile` and `pt-article` use hand-wired slugs.
- **hidden-enneagram:** almost everything is **a**, but it uses app markup, not shared faces. Its record blocks bind by hand-wired slugs (`he-person.slug`, `he-service.serviceSlug`, `he-post.postFeed/postSlug`, `he-shelf.feed`, `he-course` constant) instead of `binds:`. Only the shared record-* blocks use From what?. Popups are custom surfaces, not face-opened ones.
- **danamccool:** the opposite. Bindings are good (From what? for artwork/gallery/page-link, proximity by page slug), but **zero parts**, so every site block is sealed. It also offers unfiltered profile-*/store-* blocks with no resolver (they render empty), and the artist is implicit (org owner) with no person binding.

## 5. Gaps worth a ticket (detail level)
1. Give sunjay's event blocks, services/booking and writing blocks `parts` over their current markup (no visitor HTML change) → event-detail becomes surface-editable.
2. Teach `person-records.ts` (direct-edit From what?) the `service` bind, or move `pt-service`/`pt-booking` to `binds:"record"` with `service:<slug>` as HE's record-* do.
3. HE: convert the hand-wired slugs to `binds:` (the kit doc's `defineRecordSource` §2.2 covers this).
4. DM: add `parts` to the 14 site blocks. Filter SHARED_BLOCKS (as sunjay/HE do) or wire the profile/store resolvers to `getSiteOwnerUserId`.
5. Promote "face + shared parts + live-piece twin" into the kit (`@elkdonis/blocks/record` or a `cms-ui` faces entry), so sunjay's `shared-parts.ts` is not a one-app pattern.
