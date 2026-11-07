# CPO survey: direct-edit and Puck synthesis (2026-11-02)

Read-only scout report for the synthesis team, taken 2026-11-02 between about 19:00 and 19:50 EST (host clock; UTC-5). It covers surface UI, the IFAC series, block monoliths, live controls, the thread model, binding machinery, Puck and GrapesJS upstream, ingest and peripheries. It reports what exists and designs nothing. No file, container or row was changed by this survey.

Labels: **[V:read]** code or doc read, **[V:sql]** read-only SQL on `elkdonis_dev`, **[V:edge]** curl through the edge, **[V:web]** upstream page or npm registry fetched 2026-11-02, **[A]** assumed, **[U]** unknown. A table cell with a `path:line` citation is [V:read] unless marked otherwise.

## 0. Findings that most constrain the design

1. **The canvas and panel cannot run inside a modal dialog as built.** `tree-editor.ts:183`, `edit-shell.ts:75` and `clickthrough.ts:83` append to `document.body`; a surface opens with `showModal()` (`SurfaceProvider.tsx:318`), which makes everything outside the dialog inert (HTML semantics, [A]: not run). See section 1.
2. **Most live controls cannot draw in the current canvas.** `mount.ts:46` uses a separate `createRoot`, so Next's router context is absent and `useRouter()` throws (`next/dist/client/components/navigation.js:134-137`). The generic `rsvp-panel.tsx`, `SeriesRsvp`, `SeriesTop`, `WeekCommentForm` and `TalkRoomView` call it. [V:read for both halves; the combination was not run.]
3. **Clicks are captured**, so no control works while editing (`clickthrough.ts:187-199`). Puck has a `previewMode: "interactive" | "edit"` that is the reference (`dist/actions-DA1J5F56.d.ts`, [V:read]).
4. **A precedent for R3 exists at page level, not group level.** Sunjay's `pt-event-*` blocks all read one `event`, resolved from `metadata.threadId` (`apps/sunjay/src/lib/puck/data-event.ts:31-44`). Puck 0.23 already passes `parent` and `root` to `resolveData` (`dist/rsc.js:1021-1034`), but our adapter drops them (`page-builder/src/config.tsx:179`).
5. **"This event" is not one identifier.** A one-off is a thread id. A series week is `(series thread, occurrence)` with RSVP on a separate `series_session` thread and comments on a topic thread. A plain recurring meeting has no occurrence id at all. See section 5.
6. **Installed base is small: 31 Puck rows across 3 orgs, 172 nodes** (27 on danamccool, 3 on inner_group, 1 on sunjay written during this survey). No `blkStyle` is stored anywhere. Options-model changes carry little stored-data risk; block ids stay frozen. [V:sql]
7. **Puck 0.24.0 is out, 2026-10-29, declared non-breaking.** Field groups and tabs are per-component React inside Puck's own panel, so they do not reach our plain-DOM panel. Slot prop forwarding removes one of our workarounds. See section 7.
8. **No store can hold a pen or a dog-ear today.** `safeDecls` keeps declarations only, with no selectors, `@keyframes` or `url()` (`block/style.ts:88-102`). `page_revisions` and `org_blocks` are proposals; those tables do not exist. [V:sql]
9. **Tokens do not reach the box tree.** `fillTokens` is called only from `apps/arts-collective/src/lib/classifieds/catalog.ts` (grep); `Words` in `puck/blocks.tsx` does not call it. [V:read]
10. **The shared tree is hot.** A session is editing elktours now (`app/tours/[slug]/**`, `app/about/**`, tour popup: "do not plan over"). `packages/direct-edit` and `packages/series-site` are untracked. No production rebuild has run the tree editor. See section 10.

## 1. Surface UI

### What a surface is
- A descriptor is data naming what to open; connectors are what a host supplies once. Surfaces see only connectors (`surface/types.ts:6-15`).
- One native `<dialog>` per provider, surfaces stacked inside it (`SurfaceProvider.tsx:18-36,366-392`). Layers below the top stay mounted with `display: none` (`SurfaceProvider.tsx:451`).
- `open`, `push`, `replace`, `pop`, `close` (`SurfaceProvider.tsx:199-254`). Escape pops one layer (`:374-377`). A click starting and ending on the backdrop closes (`:385-391`). Body scroll is locked while open (`:325-326`).
- The top layer mirrors to `?surface=` when it serialises (`url.ts:23-90`). `custom`, `material` and `forumFeed` return null, so they are not deep-linkable (`url.ts:57,72,88`).
- A face grows into its surface by FLIP (`morphIn`, `SurfaceProvider.tsx:61-90`).
- Anatomy: head, main, optional rail, foot (`SurfaceShell.tsx:10-17`). The rail is what the developer calls a right column: `rail` prop (`:32`), 272px beside main, stacked first at 760px and below (`surface.css:654-673`). `SurfaceFacts` draws label and value rows (`SurfaceShell.tsx:207-224`).
- Sizes: compact 440, standard 640, wide 940, full 1180px, bare (`surface.css:75-78,484-495`). None fills the viewport beyond 1180px.
- Host-registered surfaces: `connectors.custom[key]` through a `custom` descriptor with `props` (`types.ts:291`, `SurfaceRouter.tsx:71-79`).
- Surface precedents for editing inside the popup: `WriteSurface` and `writing-room.tsx` (a post with the finished page previewed beside the words, size `full`), `GatherSurface` (arrange what a thread holds), `CenterLayoutSurface` (arrange sections with knobs).

### Mounted where
`SurfaceProvider` is in amrit-canada, arts-collective (several hosts), elastrocal, elktours, fourthwayBookreaders, hidden-enneagram, ifac, innergathering, sunjay, artdirect (grep, [V:read]). It is not global:
- IFAC mounts it at `/hub` and `/center` only (`apps/ifac/src/app/hub/layout.tsx`, `center/layout.tsx`). [V:edge] `/series/art-for-non-professionals` and `/` carry no `eac-surface` dialog.
- Sunjay mounts it in the root layout. [V:edge] `/series/running-the-script` has `dialog.eac-surface`.

### What the one-dialog rule says
`.claude/rules/areas/css-ui.md:37`: a new popup is a descriptor in `surface/types.ts`, a surface in `surface/surfaces/`, cases in `SurfaceRouter.tsx` and `url.ts`, and a host connector; "do not add a dialog/sheet/modal primitive". Reason given: it replaced four idioms. Line 38: `.eac-face-live` only on a control inside a face.

Compliance is not total. 16 files outside `surface/` and the retired app contain the string `<dialog` (grep, [V:read]; some may be comments, not each inspected), including `series-site/components/series-top.tsx:383,408` (the page named as an example), `apps/sunjay/components/site/banner-editor.tsx` and `apps/danamccool/components/studio/tile-arrange-field.tsx`. `@elkdonis/studio/image` is a full-window dialog of its own (`docs/reference/authoring.md:396-399`).

### Surface or the editor's own chrome: what the evidence says
| Question | As a surface | As the editor's own chrome |
|---|---|---|
| Available on every page being edited | No: needs a provider; IFAC public pages have none [V:edge] | Yes: direct-edit mounts itself |
| Direct-edit chrome works | Not as built: it appends to `document.body`, inert behind `showModal` [A: not run] | Yes |
| Room | 1180px with a 272px rail; direct-edit's panel is a separate component | Free |
| Escape | Pops a layer (`SurfaceProvider.tsx:374`); direct-edit uses Esc for "up a level" (`clickthrough.ts`) | Own |
| URL, Back | Yes for a typed descriptor; none for `custom` | Would need building |
| Rule compliance | Literal | The handover reads the editor's drawer, bar and pills as not surfaces (`docs/sessions/2026-11-02_canvas-direct-edit-layer.md:256`). Whether a popup is covered by that reading is the developer's call [U] |
| Inside a Studio or hub surface already open | Stacks | Would sit under the top layer unless mounted inside the dialog |

Finding, not a design: the surface system supplies the anatomy (main plus rail, `SurfaceFacts`, `gather`), and direct-edit's mounting assumes no modal. Both options need a change. The team should state which reading of the rule it relies on and ask the developer once.

## 2. IFAC series as the worked example

Mounting: `packages/series-site` was moved out of `apps/ifac` on 2026-11-02 and is untracked (git status, [V:read]). Thin route files in `apps/ifac/src/app/series` and `apps/sunjay/src/app/series` pass a `SeriesSite` config (`config.ts:15-45`, `apps/ifac/src/lib/series-site.ts`, `apps/sunjay/src/lib/series-site.tsx`). Only those two apps mount it (grep of package.json, [V:read]). Series threads in production: IFAC `art-for-non-professionals`, sunjay `running-the-script` [V:sql]. Rendered through the edge, HTTP 200 on IFAC series, IFAC week 1 and sunjay series [V:edge].

### Series page (`pages/SeriesPage.tsx`)
| Piece | Code | Needs | Runs | Data from | Markup seen [V:edge] |
|---|---|---|---|---|---|
| Crumb, eyebrow, title | `SeriesPage.tsx:224-233` | series | server | `getMeetingSeries` | `section.ifs-event-head.ist-head` |
| Cover | `cover-media.tsx`, `CoverMedia` | `series.cover` | server | `metadata.series.cover` | present when set |
| General card: About, facts, hosts | `aboutNode` `:141-190`, passed into `SeriesTop.about` | series, `hostCards` | server, passed as a node to a client component | `threads.body` sanitised; `org_profiles` + `users` | `article.ist-gen` |
| Follow: Subscribe, Talk, Share | `series-top.tsx:312-332` | `seriesId`, `href` | client | POST `/api/series/subscribe` | `aside.ist-act` |
| Sign-in form | `series-signin.tsx` | `seriesId`, `returnTo` | client | `/api/auth/login|signup` | `form.ist-auth` (signed out) |
| Next band | `nextNode` `:194-216` + `series-top.tsx:337-373` | `week {at, number, weekdayLong, calendarUrl}` | server node + client actions | `nextPublicSession` | `section.ist-next` |
| "I'm coming" | `series-top.tsx:341-351` | `seriesId`, `occurrenceAt` | client | POST `/api/series/rsvp` | `button.ifs-btn--primary` |
| Add to calendar | link `:354` | slug, `at` | none | GET `/series/<slug>/calendar.ics?at=` | `a.ist-textlink` |
| Join link and details | `joinSlot` `:118-128`, `join-details.tsx` | viewer role | server, gated | `seriesJoinUrl`, `metadata.joinDetails` | absent signed out |
| Session rows | `session-rows.tsx` server, `SeriesRsvp` island | `seriesId`, `at`, `href`, `viewerStatus` | server + client island | `series.sessions` | `article.ifs-srow`, `details.ifs-earlier` |
| Rota | `:286-325` | series, `site.showRota` | server | `hostCards` | `section.ifs-thisweek` (IFAC only) |
| Subscribe and welcome dialogs | `series-top.tsx:383-416` | none | client | own `<dialog>` | `dialog.ist-dialog` ×2 |
| Countdown or timer | none | | | | **absent**: no `countdown` or `timer` string in any of the three pages |
| Comments on the series page | none: "Talk" links to `/forum` (`SERIES_FORUM_HREF`, `:42`, TODO E5) | | | | `a.ist-pill` |

### Week page (`pages/SeriesWeekPage.tsx`)
| Piece | Code | Needs | Runs | Data from |
|---|---|---|---|---|
| Week editor in place | `week-editor.tsx` (359 lines) | `seriesId`, `at` | client | `saveSeriesSession` (`SeriesWeekPage.tsx:105`); route `/api/hub/series` [A] |
| RSVP side block with count and faces | `:181-224`, `SeriesRsvp` | `seriesId`, `at` | client island | `listSeriesSessionAttendees(topicThreadId)` |
| Host card | `:226-249` | `week.host.userId` | server | `hostCards`, `site.getHostProfile` |
| Prev and next | `:251-268` | series | server | `series.sessions` |
| Conversation | `:272-296` list server, `WeekCommentForm` client | `topicThreadId` for reads; `seriesId`, `at` for writes | both | `listReplies`; POST `/api/series/comment` → `ensureSeriesSessionTopic` + `postReply` |

Landing stage: `EventStage` + `seriesStageSlide` (`event-stage.tsx`, `lib/stage.ts`) is client, rotates every 50s, takes plain slide data, so it is already data-driven [V:read]. It is on the IFAC root [V:edge: `ifs-stage`].

Coherence on these pages comes from one server component loading once and passing props down. The pieces share `seriesId` and `at`, and cross-talk over a window event (`ANSWER_EVENT`, `series-intent.ts`; used in `series-rsvp.tsx:50-57`, `series-top.tsx:140-148`). No piece looks up its own thread. Their routes exist only on hosts that mount `rsvpRoutes` and the rest (`routes/index.ts`).

## 3. Monoliths

Method: `PropDef` arrays parsed from source by a script in the scratchpad (`probes/blocks_quant.py`), then corrected by hand against prop names. Classification is judgement: C content (words, pictures, links, rows), A aesthetic or layout, T show/hide, D data or behaviour binding, O other setting, S slot. Stored nodes from a JSON walk of all `puck:%` rows and `user_pages` [V:sql]. Parts: `R` delegates to a big imported component, `P` per-item editing (`editItem`), `D` canvas drag (`manipulate`), `I` inline text (`inlineEditable`).

### SHARED_BLOCKS (30, `packages/blocks/src/index.ts`)
| Block | C | A | T | D | O | S | Total | Stored | Parts |
|---|---|---|---|---|---|---|---|---|---|
| hero-banner | 4 | 2 | | | | | 6 | 1 | I, resize |
| section-banner | 3 | 2 | | | | | 5 | 5 | I, resize |
| cycle-badge | | | | 1 | | | 1 | 2 | |
| thread-feed | 1 | 1 | 1 | 1 | 1 | | 5 | 2 | resolver; 265-line file |
| split-row | | 5 | | | | 2 | 7 | 4 | slots, resize |
| grid | | 4 | | | | 1 | 5 | 0 | slot |
| flow-column | | 1 | | | | 1 | 2 | 1 | slot |
| card-grid | | 3 | | | | 1 | 4 | 1 | slot |
| divider | | 2 | | | | | 2 | 8 | |
| section-heading | 3 | 2 | | | 1 | | 6 | 35 | I |
| prose | 1 | 3 | | | | | 4 | 15 | |
| figure | 3 | 7 | | | | | 10 | 2 | D, I, resize |
| text-image | 4 | 7 | | | | | 11 | 2 | D, I |
| quote | 3 | 1 | | | | | 4 | 1 | I |
| faq | 1 | 1 | | | 1 | | 3 | 1 | rows |
| video | 3 | 1 | | | | | 4 | 1 | |
| feature-card | 6 | 2 | | 1 | | | 9 | 3 | I, `binds: record` |
| entry-list | 1 | 2 | | | | | 3 | 8 | rows |
| picture-wall | 1 | 11 | | | | | 12 | 3 | P (only block with `editItem`), rows, 375 lines |
| link-button | 2 | 2 | | | 1 | | 5 | 3 | I |
| contact-form | 6 | | | | | | 6 | 4 | interactive client pair |
| profile-feed | 1 | 1 | 1 | 2 | 1 | | 6 | 0 | resolver, cms-ui |
| profile-galleries | 1 | | 1 | 1 | | | 3 | 0 | resolver |
| profile-gallery | | 11 | | 3 | | | 14 | 0 | I, `binds` |
| profile-store | 2 | 1 | | 2 | | | 5 | 2 | R: `StoreShowcase` |
| profile-record | 1 | | | 1 | | | 2 | 0 | cms-ui |
| gallery-grid | 1 | 3 | | 2 | | | 6 | 1 | R: `.client`, `binds` |
| store-frame | 1 | 5 | | | | 1 | 7 | 0 | slot |
| store-header | 3 | 3 | | | | | 6 | 0 | I |
| store-shelf | 4 | 3 | | 3 | | | 10 | 0 | R: `ProductCard`, `ShopCard` |
| **Total** | **56** | **86** | **3** | **17** | **5** | **6** | **173** | **105** | |

Person blocks outside SHARED_BLOCKS (11, all `cms-ui/profile` markup, 0 stored): offering-spotlight 8 (C6 D1 O1), person-card T4, person-columns S2 A1, person-store C2 A1, person-threads C1 D1, person-writing C1 D1, person-galleries, person-header, person-memberships, person-portfolio (1 each). Total in the package: 40 definitions in 45 files [V:read].

### Reading the table
- A count exceeds C, so "hardly any aesthetic editing" is not a count of props. It is about what they reach. [V:read]
- 22 of the 86 A props are `WALL_PROPS` counted twice: 8 caption settings plus `min`, `shape`, `gap` (`picture-wall.tsx:57`), on `picture-wall` and `profile-gallery`. Most others are layout enums: align, gap, ratio, width, size. `picture-wall` alone has `format: "color"` (2 props) and a font choice (`captionFont`, `:99`). Other colour controls: `section-banner.accent` (free string, `:43`), `store-frame.palette` (select, `:29`), `blkStyle`. No shared block offers a typeface for a title or body. Type size appears as an enum on `prose` and `store-header` only.
- Inner elements are out of reach. In `hero-banner.tsx` the title, subtitle and wash are fixed elements with fixed classes; only `align` and `height` are set. `blocks.css` has 148 `.blk-*` classes and 1145 declarations: 377 token-using, 768 literal, of which 169 are literal type or surface values (font-size 62, line-height 37, font-weight 23, letter-spacing 9, radius 8). Measured by script, [V:read].
- Tokens are defined on `:root` (`blocks.css:41`) so a wrapper can redefine output tokens for one instance; `style/schema.ts:296-298` already does so for `--blk-fg`, `--blk-muted`, `--blk-line`.
- Generic Style exists on every block: spacing, size, background, border, radius, shadow, opacity, visibility, hover, anchor, class, fenced CSS (`page-builder/src/style/schema.ts:64-90`). It wraps the block in one `div` (`style/wrap.tsx`), so it cannot reach inside. It appears only in Puck's panel. **0 stored uses** [V:sql]. Unverified on most hosts (`docs/open/SILEX_PUCK_SURVEY_2026-10-04.md:32-37`).
- `PropDef` has no group, section or part concept (`blocks/src/types.ts:132-231`). It does have `binds` (`:222`), `format: "color"` (`:230`), `inlineEditable`, `manipulate` (`:326`), `resize` (`:345`). `binds` is honoured by danamccool, sunjay and artdirect pickers (`prop.binds === "service"`, `apps/sunjay/src/lib/puck/config.client.ts`), with no `thread` value yet.
- `toPuckFields` maps kinds to Puck fields; `boolean` to radio, `list` to array (`blocks/src/editor.ts`). The direct-edit panel does not read any of this (handover section 10).

### Sunjay (Para Theater) site blocks: 26, `apps/sunjay/src/blocks`, all `styling: "tailwind"`
| Block | C | A | T | D | O | S | Notes |
|---|---|---|---|---|---|---|---|
| pt-band | | 4 | | | | 1 | `GROUND`, `PADDING`, `WIDTH` lookup tables of Tailwind classes (`layout-blocks.tsx`) |
| pt-banner | 7 | 7 | | | | | scrim, scrimColor, inkColor, accentColor, align, size, height: the most-exposed block in the repo |
| pt-heading | 1 | 2 | | | 1 | | |
| pt-link | 2 | 1 | | | | | |
| pt-standing | | 1 | | | | | client, surface faces |
| pt-calendar | | | | | | | zero props |
| pt-profile | 2 | | 1 | | | | |
| pt-threads | 4 | 2 | | 3 | | | |
| pt-member | | | 1 | | | | |
| pt-forum | 1 | | | | | | |
| pt-writing | 3 | | | 1 | | | |
| pt-gallery | 1 | | | 1 | 1 | | |
| pt-event-header | | | 3 | | | | one `event` |
| pt-event-about | 1 | | | | | | one `event` |
| pt-talk-room | 2 | 1 | | 2 | | | one `event`; `useRouter`, server action |
| pt-event-rsvp | | | 1 | | | | one `event`; wraps `RsvpPanel` |
| pt-event-materials | 1 | | | | | | one `event` |
| pt-offering-card | 2 | | 3 | | | | one `event`; ported from `OfferingsBand`, 272-line client + 331-line CSS |
| pt-services | 4 | 1 | 1 | 1 | | | |
| pt-service | | | 2 | 1 | | | `binds: service` |
| pt-booking | 2 | | | 1 | | | not member-safe; `ServiceBookingForm` |
| pt-steps | 2 | | | | 1 | | |
| pt-notice | 2 | 1 | | | | | |
| pt-journal | 3 | | | 2 | 1 | | |
| pt-article | | | 2 | 1 | 1 | | |
| pt-series-nav | 1 | | | | | | |
| **Total** | **41** | **20** | **14** | **13** | **5** | **1** | 94 props |

State of use: `/` is coded since 2026-11-02 with `data-edit-section` on panels (`apps/sunjay/src/app/page.tsx:25`, 4 markers) and `puck:home` deleted. `@elkdonis/direct-edit` is not a sunjay dependency (grep). One row: `puck:event-detail`, 1723 bytes, written 2026-11-03 00:41:53 UTC during this survey by another session or the developer [V:sql]; holds `pt-band` ×3, the five `pt-event-*`, `pt-steps`, `pt-notice`, `split-row`.

### Elktours: 11 blocks, `apps/elktours/src/blocks/{tour,experience}`
These are not `defineBlock` blocks. Each config is a hand-written Puck `Config` with its own narrower `Field` union (`tour/config.tsx:29-39`). Blocks hold settings and read data from a context provider (`tour/context.tsx:16`), so the props exclude content entirely.

| Block | Props | C | A | T | D | What it draws |
|---|---|---|---|---|---|---|
| TourFilm | size, interactive | | 1 | 1 | | film, poster, 3D preview launcher, editing controls |
| TourIntro | showFacts | | | 1 | | title, facts row |
| TourMain | showHighlights, showRoute, routeHeading, showBooking | 1 | | 3 | | description, highlights, includes, stop-by-stop route with map, booking box: 95-line function, 23 classNames, `<TourStory>`, `<BookingForm>`, `<RichTextEditor>` |
| TourMore | heading, count | 1 | | | 1 | tour cards |
| TourText | heading, text | 2 | | | | text |
| ExperienceHero | size | | 1 | | | cover |
| ExperienceIntro | showFacts | | | 1 | | title, facts |
| ExperienceMain | showHighlights, showPeople, showInquiry, inquiryHeading | 1 | | 3 | | description, people, inquiry |
| ExperienceGallery | heading | 1 | | | | pictures |
| ExperienceMore | heading, count | 1 | | | 1 | cards |
| ExperienceText | heading, text | 2 | | | | text |
| **Total** | 22 | **9** | **2** | **9** | **2** | |

`tour/blocks.tsx` is 351 lines with 63 className lines, Tailwind literal, no tokens [V:read]. `/studio/{tour-detail,experience-detail,experience/[id]}` open `PuckEditor` under a "Work in progress" banner (`components/studio/layout-studio.tsx`). 0 stored rows for `puck:tour-detail` or `puck:experience-detail` [V:sql]; `experience.metadata.page` is a per-thread layout (`apps/elktours/src/lib/experience-layout.ts:24`), row count not queried [U].

A separate idiom sits here: `useTourEdit` with `TourDraft` and `tour/edit-bar.tsx` turn the page into fields in place and save through `patchTourAction`, outside Puck and outside direct-edit (`tour/context.tsx`, `tour/blocks.tsx:14-19`).

### Other site blocks (heuristic counts from the script, not hand-corrected)
| App | Blocks | Props | C | A | T | D | O | S | Stored |
|---|---|---|---|---|---|---|---|---|---|
| danamccool | 14 | 85 | 44 | 17 | 4 | 9 | 11 | 0 | 60 nodes, the largest user |
| art-auction | 15 | 65 | 40 | 3 | 7 | 8 | 7 | 0 | 0 |
| arts-collective | 2 | 9 | 5 | 0 | 4 | 0 | 0 | 0 | 0 |

### Stored block use overall [V:sql]
31 rows, 172 nodes, 40 types on `site_config`; 3 rows, 3 nodes on `user_pages` (IFAC). Top: section-heading 35, dm-plate 26, dm-image-set 16, prose 15, entry-list 8, divider 8. Block ids stay frozen: `<Render>` drops unknown types silently (`authoring.md:165`).

## 4. Live-control inventory

| Control | Where | Props or input | In a client canvas | API route |
|---|---|---|---|---|
| RSVP, generic | `apps/{amrit-canada,elktours,sunjay}/src/components/rsvp-panel.tsx` (byte-identical, md5), `innergathering` (277 lines, differs) | `threadId, title, signedIn, alreadyAttending, attendanceCount, attendeeLimit, cancelled` | No: `useRouter` at `:35` | `/api/threads/:id/rsvp`, guest `/api/rsvp` |
| RSVP, hub | `apps/ifac/components/hub/RsvpPanel.tsx`, `apps/arts-collective/components/sites/RsvpPanel.tsx` | differs per app | [U] not read past fetch | `/api/hub/rsvp`; `/api/threads/:id/rsvp` |
| RSVP, button | `apps/fourthwayBookreaders/components/rsvp-button.tsx` | | [U] | `withBase(/api/threads/:id/rsvp)` |
| RSVP, series | `series-site/components/series-rsvp.tsx` | `seriesId, occurrenceAt, signedIn, initialStatus, initialCount, label, small, returnTo, resumeIntent` | No: `useRouter` | `/api/series/rsvp` |
| RSVP, surface | `ThreadSurface.tsx:114-132,240`, `connectors.rsvp` | `SurfaceThread` | Yes inside a provider | host connector |
| RSVP, block | `pt-event-rsvp`, `pt-offering-card` (sunjay only) | `event` from resolver | No: wraps `RsvpPanel` | as generic |
| RSVP, Silex | `silex-render/src/embeds.tsx:1111` `rsvp` embed | attributes | server | |
| Offering band | `apps/innergathering/components/landing/OfferingsBand.tsx` (220 lines): one app; sunjay holds a port | `items, signedIn, nextcloudUrl` | No: server component using `RsvpPanel` | |
| Countdown, plain | `apps/art-auction/src/app/series/[slug]/countdown.tsx` | `to` (ISO), `className` | Yes: no router or data | none |
| Countdown, block | `au-countdown` (`art-auction/src/blocks/auction-blocks.tsx:223,251`) | `label, source (fixed|next-close|last-close), until`, server clock from `useNow` | `useLive` polls | `/api/auction/live` |
| Countdown, Silex | `embeds.tsx:1120` | attributes | server | |
| Countdown, retired | `apps/inner-gathering/components/countdown-widget.tsx` | | do not use | |
| Countdown in shared blocks or series | none | | | |
| Discussion, series | `SeriesWeekPage.tsx:272-296`, `WeekCommentForm` | list needs server `listReplies`; form `seriesId, occurrenceAt` | Form no: `useRouter` | `/api/series/comment` |
| Discussion, block | `au-discussion` (`article-blocks.tsx`, art-auction only): polled | `heading, limit, refresh, joinLabel, emptyMessage` + resolved `discussion` | client [A] | art-auction block data |
| Discussion, forum | `forum-ui/src/thread.tsx` `ReplyItem`, `ReplyBox`; `pages.tsx:642` `ThreadPage` | `ctx`, server rendered route | No: server pages | forum actions |
| Subscribe | `series-top.tsx:188-225`, inline only; no standalone component | `seriesId` | No: inside `SeriesTop` | `/api/series/subscribe` |
| Follow | `cms-ui/src/center/FollowButton.tsx`, `arts-collective/components/sites/FollowButton.tsx` | | [U] | `/api/center/follow`, `/api/org/:slug/follow` |
| Map | `apps/elktours/components/tours/tour-map.tsx` (MapLibre, OpenFreeMap tiles), `places-map`, `pin-map`, `route-preview`; `apps/pigeonshoot/.../leaflet-map.tsx`. No shared map package | `stops, meetingPoint, activeIndex, onSelect` | Yes for `TourMap` itself | none; route preview needs `googleMapsKey` |
| Booking | `checkout/src/components/ServiceBookingForm.tsx`, `BookingScheduler`, `ProposeTimes` (shared, plain CSS) | `action` (server action), `listPrice, slidingFloor, currency, ...` | Yes given an `action` | host action → `startThreadCheckout` |
| Booking, tour | `apps/elktours/components/tours/booking-form.tsx` | app-local | [U] | elktours; Stripe keys live |
| Talk room | `TalkRoomView` (`sunjay/blocks/event.client.tsx:121`), `OfferingCall`, `cms-ui/hubsite/NextcloudFrame`, circle client | `event.talkUrl` | No: `useRouter`, server action | `createEventRoomAction`; iframe allowed by `eac_embed` per origin |
| Standing meeting, calendar | `cms-ui/hub/StandingMeetingFace`, `CalendarFace`, `surface/CalendarSurface` | connectors, data | Yes inside a provider | host routes |
| Join link | `series-site/components/join-details.tsx`, `join-frame.tsx` | gated server side | HTML must not reach unauthorised viewers | |
| Gathered | `surface/GatherSurface.tsx` | `threadId` | inside a provider | `connectors.gather` |

Patterns [V:read]: six RSVP implementations against two write paths and two data models (`thread_rsvps`, `guest_submissions`). `thread-rsvp.ts` is kind-agnostic and shared; the UI is not. A shared RSVP block does not exist (`SHARED_BLOCKS` has none; category comment `types.ts` lists RSVP under `actions`). Silex's embed catalogue has `rsvp`, `countdown`, `live`, `poll`, `inquiry`, `directory`, and 8 more (`components.data.json`, 14 entries); it is a second vocabulary for the same controls.

Secrets in a canvas: `data-event.ts:57` onward omits `talkUrl` and `meetingUrl` for disallowed viewers, and the series pages omit join details (`SeriesPage.tsx:115-116`). A preview must not widen this. A write from a preview lands on production: there is no staging copy (`CLAUDE.md`), and `elkdonis_scratch` lacks grants for rendering (handover section 6).

## 5. Thread data model

`\d threads` [V:sql]: `id varchar(21)`, `org_id`, `kind varchar(20)` (no CHECK), `title`, `slug`, `body`, `body_doc`, `status`, `visibility`, `section`, `scheduled_at`, `duration_minutes`, `location`, `format`, `meeting_url`, `attendee_limit`, `recurrence_pattern`, `recurrence_until`, `is_rsvp_enabled`, `rsvp_deadline`, `is_meeting`, `price`, `currency`, `sessions jsonb`, `nextcloud_talk_token`, `min_role`, `metadata jsonb`. Unique `(org_id, slug)`. `threads.min_role` is applied (column present), though CLAUDE.md still says migration 188 is unapplied.

Row counts [V:sql]: post 40 published; writing 6 published, 27 draft; series_session 12; tour 8; meeting 8 published (5 recurring); series 2; workshop 1 draft; reading_group 2; service 2; experience 1 draft.

`OFF_FEED_KINDS`: wiki_page, writing, document, series_session, tour, experience (`services/src/thread-kinds.ts:40`). `SCHEDULED_KINDS`: event, meeting, series, workshop, reading_group (`surface/types.ts:1465`). Tenant policies on `threads`: `tenant_read` includes `thread_orgs`; `tenant_write` own org only [V:sql].

### What "this event" resolves to today
| Shape | Identifier | RSVP target | Comments target | Time | Notes |
|---|---|---|---|---|---|
| One-off `event`, `meeting`, `workshop` | `threads.id` | `thread_rsvps(thread_id, user_id)` | replies on the thread | `scheduled_at` | `is_rsvp_enabled`, `attendee_limit` |
| Recurring `meeting` | `(thread_id, occurrence_at)` computed in JS: no occurrence id (`.claude/rules/areas/threads.md`) | the thread | `meeting_occurrence_notes.topic_thread_id` per occurrence | `nextOccurrenceAt` | `getCycleStatus` for cancelled |
| `series` thread | `threads.id`, or `(org, slug)` | none on the series itself; `subscribed` status lives on it (migration 202) | "Talk" links to `/forum` (TODO E5) | rule; `series_sessions` | |
| Series week | `series_sessions.session_thread_id`; also `(series_id, number)` unique; also `at` | per week on its `series_session` thread, materialised on first use (`ensureSeriesSession`, `meeting-series.ts:1288`) | `SeriesSession.topicThreadId`, made on first use (`ensureSeriesSessionTopic`, `:1398`) | `starts_at`; `slot_at` if moved | `/series/<slug>/<n>` keeps naming the same week after a move |
| `tour` | thread id + `tour_departures` | `tour_bookings`, party size | none found | departures | not RSVP |
| `workshop` | thread id; `threads.sessions` jsonb or `workshop_sessions`, two models (`authoring.md:472`) | `workshop_join_requests`, RSVP | | | |
| "Next upcoming" (no id) | `getUpcomingThreads(1)` (`data-event.ts:43`), or `getStandingMeetingId`, `getPresentedSeriesId` (`site_config presented_series`) | | | | moving target |

So a held reference needs at least `{ threadId }` or `{ threadId, occurrence: at | number | "next" }`, plus a "follow the next" option. RSVP and comments resolve through `ensure*` functions that write on first use, so resolving must not call them on a read or preview. Reads must stay org-scoped: `getMeetingSeries(orgId, ref)` takes the org; `getThreadById` in sunjay's data layer is app-local [V:read]. Block routes take the org from the deployment, not the request (`authoring.md:443-444`).

Relations available: `thread_gathers` with `relation` in gathers, produced, talk, cites; `target_type` thread, document, deck_card, deck_label, file, quote (truncated; `\d`, [V:sql]); 4 rows. `thread_orgs`, `thread_lines`, `thread_references` (rewritten by `syncWikiLinks`, so not for deliberate links, `threads.md`). `SurfaceGatherConnectors` has `list`, `candidates(threadId, q)`, `attach`, `detach`, `reorder` (`surface/types.ts:429-442`), the only existing thread-candidate picker (`hub/connectors.ts`, `GatherSurface.tsx`). No `ThreadPicker` component exists (grep).

## 6. Existing binding and part machinery

### Three things on a page [V:read]
| Kind | File | Editable | Data |
|---|---|---|---|
| Own: `box`, `words`, `picture` | `puck/blocks.tsx`; `OWN_TYPES` `block/puck-tree.ts:25` | Fully, `look` prop, cleaned every render | None: no token fill |
| Sealed: any other block | `tree-editor.ts:303-309`, `TreeCanvas.tsx:91` (`sealed: slots.length === 0`) | Moves as one; panel offers "Detach" and "Edit its settings" (`blockEditorHref`); fields not shown | `resolved[id]` |
| `part`: named live page piece | `puck/blocks.tsx` `Part`; `open-page.ts:32` snapshot `outerHTML` | Not detachable; not hydrated in the canvas | `metadata.parts` on publish |

### How a block gets data
| Path | Mechanism | Citation |
|---|---|---|
| Published | `resolveAllData(data, serverConfig, metadata)` then `<Render>`; resolvers read the DB directly | `apps/sunjay/src/lib/puck/render.tsx:55-64`, `config.server.ts:17-32` |
| Puck's editor | `resolveData` in browser → HTTP `/api/blocks/<id>`, with `orSample` fallback to samples | `apps/sunjay/src/lib/puck/config.client.ts` |
| Tree editor | `mountTreePage({ resolved })`: `resolveAllData` on the client, kept apart from the doc, never saved; only innergathering fills it | `apps/innergathering/src/components/studio/CanvasEditor.tsx:44-46`, `puck/mount.ts:23` |
| Test page | none: data blocks draw empty | handover section 10 |
| Sample | `Block.sample()`, required for `dataDriven` (`registry.ts`); not used by the canvas; must stay out of `defaultProps` (`authoring.md:440`) | |
| Interactive | adapter strips `puck` before a client component (`config.tsx:437`) | |
| Context channel | `metadata`: `orgId, slug, threadId, service, piece, person, parts` | `render.tsx:55-60`, `open-page.ts:51` |
| Page template | `puck:event-detail`, drawn per thread with `metadata.threadId`; gated by `metadata.detailPage` | `apps/sunjay/src/app/[feed]/[slug]/page.tsx:128`, `lib/puck/event-flag.ts` |

### Puck's parent and root
`resolveAllData` walks slots and passes the direct `parent` node and `root` (`dist/rsc.js:1021-1034,1062-1063`); the `resolveData` type includes `parent: ComponentData | null` (`dist/actions-DA1J5F56.d.ts:429-449`), [V:read]. Component-level `metadata` merges over global metadata [V:web]. Our adapter uses only `ctx.metadata` and `ctx.trigger`, and `BlockResolvers` is `(props, metadata)` (`config.tsx:68-73,179`), so a resolver cannot see a parent. `parent` is one level up: a grandchild needs a walk or a context provider [V:read]. A plain component reading from a React context would also work in `<Render>`, as elktours' providers do, but a provider in a slot or a server component needs care [A].

### Tokens and cards
`block/bind.ts`: `FieldSpec {key, label, type, sample}`, `fillTokens`, `tokensIn`, `soleToken`, `safeSrc`, `safeLink`. Values are escaped when rich. `apps/arts-collective/src/lib/cards/catalog.ts:40-50` declares 10 `FEED_FIELDS` with samples, and `store.ts` writes `site_config cards:feed` through `withOrg`; the row count is 0 [V:sql]. Callers of `fillTokens`: `classifieds/catalog.ts` only among apps (grep), with cards building on it [A]. `puck/blocks.tsx` imports `safeLink, safeSrc` only. `cms-bindings` is a third binding system for Silex templates (`authoring.md:296-314`).

### Editing machinery
- `canvas/adopt.ts`: rendered HTML into nodes, keeping tag, class, inline style. Data is frozen by it (`tree-editor.ts:480-493`).
- `canvas/clickthrough.ts`: takes a `LayerSource`, so it runs on DOM or tree. Capture-phase handlers.
- `panel/panel.ts`: plain DOM, `Properties`, `Code`; `Tweaks` not built (the screenshot `reference/rowlayer4.png` shows tabs Properties, Code, Tweaks; the tree above; declarations; "From `<div>`" groups, read 2026-11-02).
- `block/puck-tree.ts`: pure, `MAX_DEPTH 12`, `MAX_NODES 2000`, `cleanBoxDoc` cleans own types and recurses through sealed blocks' node arrays without cleaning their props (`:177-200`).
- `page-builder/src/drag/item-focus.tsx`: a click on a marked row opens that row in Puck's panel, the nearest existing "one level below the block" in Puck's editor. Only `picture-wall` marks rows.
- `apps/innergathering/src/lib/puck/`: both configs add `BOX_BLOCKS` and `BOX_ROOT`; `savePageAction` runs `cleanBoxDoc`; gate is `getApiEditor`; store through `withOrg` (grep).

### Hosts that opt in
`@elkdonis/direct-edit` is a dependency of arts-collective and innergathering only (grep). Puck configs on 8 apps. No two hosts share a client-config module.

## 7. Puck upstream

Installed: `@puckeditor/core` 0.23.0, exact pin in 9 `package.json` files: page-builder, danamccool, arts-collective, sunjay, artdirect, elktours, innergathering, art-auction, ifac [V:read]. Latest: 0.24.0, published 2026-10-29T09:39Z, MIT; canary tag exists; 0.23.0 was 2026-08-07 [V:web, npm registry].

### 0.24.0 [V:web: releases page, blog, field-grouping doc]
| Change | API | Relevance here |
|---|---|---|
| Field layout | `renderFields: ({ fields }) => ...` per component; fields are keyed React nodes | Options model in Puck's panel only. No root-level equivalent stated; host-panel use not stated [U] |
| Groups, tabs | `FieldGroup {label, collapsible, defaultExpanded, variant}`, `FieldTab {label}` | R6; a block could declare groups in `PropDef` and map them. Nested tabs unsupported |
| Fields override | now also receives `fields` prop; `children` keeps the layout but no longer exposes direct children | `FocusedFields` passes `children` through, so unaffected per the guide |
| Checkbox field | `{ type: "checkbox", options }` | maps to `list` of known values |
| Object field | `variant: "card"|"flush"`, `collapsible` | no PropKind for object today |
| Hide by type | `overrides.fieldTypes: { text: null }` | |
| Drag handle | `<Puck dnd={{ enableDragHandle: true }} />` | |
| Inline | `InlineTextField {value, componentId, propPath, isReadOnly}`; placeholders shown in canvas | R2 reference; Puck-tree only |
| Slot forwarding | `<Content as="details" open />`: props forwarded to `as` | removes `tagWith` workaround (`puck/blocks.tsx`, handover section 7 trap) |
| Render transforms | `<Render fieldTransforms={...} />`: transform at render without changing stored data | candidate seam for bound values on publish |
| Fixes | `resolveAllData` resolves each node once; transformed fields; interactive-mode backspace | |

Upgrade guide: "Puck 0.24 doesn't introduce any breaking changes"; no deprecations; `React.Children` rearrangers must change [V:web]. Earlier: 0.22 added theming via CSS variables, `iframe.syncHostStyles`, root access in `resolveData`; 0.23 added draggable outline and static drag-and-drop (installed) [V:web]. `renderDropZone` is deprecated in favour of `slot` [V:web]; `TreeCanvas.tsx:87` stubs it.

### What an upgrade touches [V:read for files; effect unverified, not built]
- Exact pins in 9 files; `docker compose run --rm install` (shared `node_modules`, coordinate with other sessions); then a rebuild of every production host, since `@puckeditor/core/rsc` is on the published path; each build deploys all uncommitted work.
- `drag/item-focus.tsx`: uses `AutoField`, `FieldLabel`, `useGetPuck`, `createUsePuck`, `dispatch setUi`, `getSelectorForId`, `resolveDataById`, and writes Puck's internal `ui.arrayState` key shape `<id>_array_<prop>` (`:131-142`): not documented API, so the riskiest line [A].
- Other importers: `canvas-drag`, `canvas-menu`, `empty-block`, `height-handle`, `size-field`, `image-field`, `color-field`, `style/field`, `templates-plugin`, `editor.tsx`; danamccool studio (8 files: `page-editor`, `record-picker`, `tile-arrange-field`, etc.); artdirect `PersonPageDesigner`, `DesignerRoute`, `OfferingPickerField`; art-auction `panel-editor`, `page-editor`; sunjay `page-editor`, `service-picker`; innergathering `PuckEditor`, `CanvasEditor`; elktours `layout-studio`, `tour/config`; ifac `person-view`.
- Dependencies: `happy-dom` ^20 → ^21; Tiptap ^3.11 → ^3.30.4 (installed 3.31.3 satisfies); dnd-kit stays 0.4.0 (npm vs installed `package.json`). Studio is on Tiptap 2 (`packages/studio/package.json`) and root `pnpm.overrides` pin `prosemirror-*` (CLAUDE.md).
- Stored data: format unchanged [A from the guide; not tested]. Puck ships no data version (`authoring.md:478`).
- `docs/open/ELKTOURS_CONVERGENCE_2026-11-02.md` says keep elktours on 0.23.0 until the repo moves.

Unknown: whether `AutoField` runs outside `<Puck>` [V:web: docs do not say; `item-focus.tsx` uses it inside]. `PuckApi` members beyond `appState` are not on the fetched pages; our code uses them [V:read].

## 8. GrapesJS concepts as reference

Here: `grapesjs` 0.23.6 installed (`^0.23.2`), latest 0.23.8, BSD-3-Clause [V:web]. Used only in `packages/newsletter/src/editor.tsx` with `grapesjs-preset-newsletter`, dynamic import because it touches `document` (`:200`), storing project JSON and inlined HTML; consumers ifac, hidden-enneagram, innergathering. Silex 3.9 contains its own copy. Silex's data source was rejected 2026-09-05 (`authoring.md:266`).

| Concept | What it is [V:web] | Answers | Nearest here |
|---|---|---|---|
| Traits | A component's settings; bound to attribute by default or a property with `changeProp`; types text, number, checkbox, select, color, button, custom; `traitManager.custom` for own UI | R2, R6 | `PropDef`; `toSilexTraits` has no caller; pen manifest `traits` |
| Style Manager | Sectors of typed properties; composite and stack; `stylable`/`unstylable` per component ([V:web via `EDITING_NICHE_RESEARCH_2026-11-01.md:109-117`]) | R6 | `box-panel.ts`, `block/style.ts`, `page-builder/style/schema.ts`: two style vocabularies |
| Block Manager | A block is a drop template: `content` is a component definition; `blockManager.custom` | R7 | `catalogue` Add menu, `SHARED_BLOCKS` |
| Component types | `isComponent` recognises from parsed DOM; `model.defaults` (`tagName`, `draggable`, `droppable`, `traits`, `styles`); `view` is canvas only, separate from export | R2, R6 | Own blocks + `mayPlace`; `view` is the analogue of a sample or edit-time stand-in for a live control |
| Symbols | Main and instances; updates to main propagate; `setSymbolOverride` excludes properties; `detachSymbol`; removing main detaches all | R5 | `Detach` (`adopt.ts`); override-by-id in classifieds; patterns prototype |
| Layer Manager | Tree of components; `root` shows a subtree; `layerManager` custom UI | R2 (a popup's tree is a subtree) | `layers.ts`, `rows()` in `tree-editor.ts` |
| Data Sources | Registered sources with records; `data-variable` with `path`, style and trait binding; `onRecordSetValue`; in project JSON unless `skipFromStorage` | R3 | `{{tokens}}`, `metadata` + resolvers. Client model; server side not stated [U] |
| Storage | Project JSON (`assets`, `styles`, `pages`); autosave, `stepsBeforeSave`, custom storage. No versions described | R5 | `site_config`; `PuckEditor` stash |

The canvas layer's design note against adopting GrapesJS as engine: `CANVAS_FRAMEWORK_2026-11-02.md:302` (not re-evaluated here).

## 9. Ingest peripheries

### CodePen [V:web]
- Public pens are MIT by default; private pens carry no licence; the notice must travel with copies, including name and URL.
- Read path: URL extensions `.html`, `.css`, `.js` and preprocessor sources on any pen; the page says "These URLs should not be used in production outside of CodePen". So an author-time fetch and copy, not a runtime dependency.
- Write path: POST prefill to `https://codepen.io/pen/define/` with a JSON `data` field; one-way out.
- oEmbed exists (link on the docs page, not read) [U].

### What exists here
- Pens: `packages/silex-nextcloud-connector/src/pens/{fold-card,feed-list,moon-phase,spotlight-grid}` with `manifest.json` (`credit`, `root`, `html`, `css`, `react`, `traits`), `pen.html`, `pen.css`. README rules: no JS (the sanitiser removes it), allow-listed markup, tokens not colours, reduced motion, class prefix. `credit` shows the shape for a CodePen source (`fold-card/manifest.json`: shshaw / keyframers URL).
- React twins: `cms-ui/src/pens` exports `FoldCard`, `FeedList`, `MoonPhase`, sharing CSS; the manifest `react` pointer is read by nothing; `SpotlightGrid` twin absent (`authoring.md:459`).
- Pens do not enter Puck: no block wraps them.
- Licence gate for intake: MIT, Apache-2.0, CC0, CC-BY (`authoring.md:199-212`). Server-renderable with no JS is the stated criterion.

### What a stored page can hold
| Mechanism | Accepts | Refuses |
|---|---|---|
| `look.css` via `safeDecls` (`block/style.ts:88-102`) | one declaration per property, allow-listed, custom properties | selectors, `@keyframes`, `url(`, `position` other than relative or static |
| `blkStyle.custom` via `cleanCustomCss` (`style/schema.ts:156-165`) | allow-listed properties | `position`, `z-index`, `inset`, `display`, `pointer-events` |
| `Words` via `sanitizeRich` | b, i, u, a, ul, li, br | everything else |
| `sanitizeRichText` (`utils/src/sanitize.ts`) | YouTube and Vimeo iframes only (`:71,88-90`) | |
| `sanitizeSilexHtml` (`sanitize-silex.ts`) | `<style>`, `eac-*`, svg | script, object, embed, handlers |
| `Box cls` (`CLASS_RE`) | class names only | |

A pen's stylesheet has no home in a document. `<iframe srcdoc>` is used for email previews (`cms-ui/email/EmailSurface.tsx`, `apps/ifac/.../email/[key]/page.tsx`). No CSP or `X-Frame-Options` on IFAC through the edge [V:edge]; only `apps/forum/next.config.ts` sets one (grep). So an iframe sandbox is unobstructed on the hosts checked; other hosts unchecked [U].

### Custom React
No in-browser or server compiler: no `@babel/standalone`, `esbuild-wasm`, `sucrase`, `react-live`, Sandpack or Monaco in any `package.json`; `new Function` appears once, for a dynamic import (`reels/src/broadcast/BroadcastDesk.tsx:35`) [V:read, grep]. A React component enters only as a source file compiled by Next (`transpilePackages`) in a workspace package or app. Production apps serve a prebuilt `.next`, so a new block reaches visitors only through a rebuild, per host, which deploys every uncommitted file. `next dev` compiles on save (elktours and admin now). Immutable per-app images were rejected (`02-preferences.md`). A block must be in both client and server configs or it renders nothing (`apps/sunjay/src/blocks/index.ts` comment).

Developer space: `DEV_SPACE_PROPOSAL_2026-11-02.md` recommends LAN-only `apps/lab` on 3022 in dev mode with `defineEntry`, `fromBlock(def)`, fixtures, `DATABASE_URL` at `elkdonis_scratch`; **not started** (no directory, [V:read]). Harness moved to `packages/direct-edit/harness` (bundles not kept); private test page is the developer's main signal (`claude.ai/artifact/WzHAvvUd4tPGMqsvpfeaev`, not read in this pass). `elkdonis_scratch` has stale schema and no `eac_tenant` grants (proposal `:31`, handover section 6). `react-live`-class compilation for developers only would be a new dependency to review against the "integrate vs build" rule (`00-working-style.md`).

`eac_embed` (`docker/nextcloud-apps/eac_embed`): adds origins to Nextcloud's `frame-ancestors`, value `https://elkdonis-arts.org` as of 2026-09-26 (`docs/reference/nextcloud.md:1432-1439`); other uses listed there. It is about embedding Nextcloud, not ingest.

## 10. Peripheries and collisions

### Who is active [V:read, mtimes at 19:45 EST]
| Path | Edits in 24h | Newest | Note |
|---|---|---|---|
| `apps/elktours/src` | 117 files | 19:41 | Active now. Web Engineer holds `app/tours/[slug]/**`, tour popup, `app/about/**` (`ELKTOURS_CONVERGENCE_2026-11-02.md:6-7`). Migrations 233-240 applied |
| `packages/direct-edit` | 90 | 18:55 (harness) | Untracked; handover written 19:19 |
| `packages/series-site` | 36 | 17:51 | Untracked; IFAC build 23:23 UTC, sunjay 22:52 UTC |
| `apps/innergathering/src` | 17 | 18:23 | Holds the tree editor wiring |
| `apps/arts-collective/src` | 18 | 16:47 | `lib/classifieds/editor-engine.ts` |
| `packages/services/src` | 6 | 17:14 | one broken file fails all type checks |
| `packages/page-builder`, `packages/blocks`, `cms-ui/src/surface`, `packages/studio` | 0 | Nov 1 or earlier | Currently unclaimed |
| `docs/open` | | ELKTOURS_EXPERIENCES_SPEC 19:42, CANVAS_FRAMEWORK 18:48 | |

HEAD is `61835a3`, 2026-10-31 20:46 EDT; everything since is uncommitted (git, [V:read]). 240 is the highest migration file; `/new-migration` must re-check.

### Live vs source for the canvas layer
| Item | State | How known |
|---|---|---|
| `elkdonis-arts.org` | Small bar build: 9 `data-edit-section`, 0 `data-landing-part` | [V:edge] |
| innergathering `.next` | BUILD_ID 19:36 UTC 2026-11-02; `data-tree-node` in 0 chunks, `data-edit-section` in 3 | [V:read, container] |
| Tree editor, thin bar, right panel, Detach, parts | Source only; never run signed in on the real app | handover section 5; above |
| `puck:landing` | no row | [V:sql] |
| `page-edits:home` | 1 row, 120 bytes (developer's red hero) | [V:sql] |
| arts-collective classifieds and cards | live, build 17:07 UTC; no rows for `classifieds%` or `cards:%` | [V:sql, container] |
| Rebuilds | Refused to a previous session by the permission system ("[Production Deploy]"); the developer runs them (handover section 6) | |

### Tenancy
`withOrg` callers: arts-collective `lib/cards/store`, `lib/classifieds/store`; innergathering `lib/page-edits`, `lib/puck/store`; sunjay `lib/banner-actions` (grep). `page-builder/src/store.ts` itself uses the global `db`. `site_config` has a `tenant_isolation` policy; 31 `eac_tenant` policies in all [V:sql]. New org-owned tables follow migration 227. `withOrg` is a transaction: note for resolvers on a page path.

### One-app direction
`SOCIALS_DEBATE_2026-10-31.md:178`: one app picking the org from the Host header, "DEFEND, but phase it". Phase 1 tenancy floor done on arts-collective (`CLAUDE.md`). Site-local blocks (`pt-*`, tour, `dm-*`, `au-*`) do not travel to that host today: arts-collective's catalogue is `SHARED_BLOCKS` + `ac-offering` + `ac-people`, and it skips a `puck:home` whose blocks it does not know (`authoring.md:50`). `css-ui` and working-style rules say capabilities for more than one org go in shared packages or `/hub`.

### Studio as context 2
`packages/studio`: `StudioShell` owns the frame, top bar, three columns; kinds plug in as `StudioExtension {id, label, listLabel, render}` registered by the host (`frame.tsx:26-33`), reading `useStudioFrame()` (`orgId`, `orgs`, `viewer`, slots). `STUDIO_KINDS` is writing, video, post, recording, artwork, meeting, workshop, service, question (`kinds.ts`); **no pages kind**. Mounted on arts-collective `/studio` only. Separate things share the path: `apps/{innergathering,sunjay,danamccool}/.../studio/[slug]` are Puck editors, not this package; `/hub/sites/<slug>/design` is the arts-collective org-page editor (`OrgPageEditor.tsx`). The essay canvas (`threads.body_doc`) is unrelated to Puck.

### Versions
| Item | State |
|---|---|
| `page_revisions`, `page_publish_log`, `org_blocks`, `block_submissions`, `network_templates` | Proposed (`PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md`, `DIRECT_EDITING_PANEL_PLAN_2026-11-01.md:226-240`); not created [V:sql] |
| Existing patterns | `lms_course_versions` + `published_version_id`; `thread_revisions` (kind changes only, 4 rows, written only from `apps/inner-gathering`); `wiki_revisions` |
| Puck save | overwrites one row, public at once; 512 KB cap (`page-builder/src/store.ts:76`) |
| Drafts | `user_pages` `<kind>draft` on artdirect; `PuckEditor` `onSaveDraft`; browser stash on failed save (`editor.tsx`) |
| Per-page changes today | block props; `blkStyle`; `look`; `page-edits:<page>`; `Detach`; `experience.metadata.page` |
| Per-instance override model | classifieds only (`Ad.o.parts`, `effective()`), keyed by a closed `PartName` enum (prototype doc `:124-127`) |

Standing guardrails that bear on this: no platform catalogue; freedom levels are classifieds only; one stone at a time, testable on the private page; compare to screenshots literally (`packages/direct-edit/harness/reference/`).

## 11. Doc corrections noticed (not applied)

- `CLAUDE.md` Apps table says elktours is stopped and admin stopped; `docker compose ps` shows both running (elktours up 37 minutes, dev mode; admin up 4 days); sophia up an hour; artdirect up 29 hours, while Current work says artdirect is down. `eac-forum` is not in the list. [V:read]
- `CLAUDE.md` says migration 188 unapplied; `threads.min_role` exists [V:sql]. Tracker row not checked.
- `authoring.md:47` says `puck:home` on sunjay renders; the row was deleted 2026-11-02 (`CLAUDE.md`, [V:sql]).
- `authoring.md:99` cites `config.tsx:353-355` for the interactive strip; now `:437`.
- `DEV_SPACE_PROPOSAL` "45 block files" is files; 40 definitions [V:read].
- `SILEX_PUCK_SURVEY` "six hosts": 8 apps now import Puck [V:read].

## 12. Open questions for the team (facts missing, not design)

1. Does `TreeCanvas` under a React portal, instead of `createRoot`, keep Next and surface context for live blocks? [U: not run]
2. Do Puck `AutoField`s render without `<Puck>` context? [U]
3. Does `resolveAllData` on the client in `CanvasEditor` work with sunjay's `viaApi` routes, which are editors-only? [A yes; not run]
4. What did the developer intend by "timer": `Countdown` to a date, or to the next occurrence? [U]
5. Does the developer read the one-dialog rule as covering the popup canvas? [U]
6. Who may dog-ear or convert: owners and guides today; other roles? (handover open question) [U]

## Sources

Upstream fetched 2026-11-02:
- [Puck releases](https://github.com/puckeditor/puck/releases), [Puck 0.24 post](https://puckeditor.com/blog/puck-024), [upgrading to 0.24](https://puckeditor.com/blog/upgrading-to-puck-024), [field grouping](https://puckeditor.com/docs/integrating-puck/field-grouping), [FieldTab](https://puckeditor.com/docs/api-reference/components/field-tab), [component config](https://puckeditor.com/docs/api-reference/configuration/component-config), [overrides](https://puckeditor.com/docs/api-reference/overrides), [usePuck](https://puckeditor.com/docs/api-reference/functions/use-puck), [AutoField](https://puckeditor.com/docs/api-reference/components/auto-field), [useGetPuck](https://puckeditor.com/docs/api-reference/functions/use-get-puck); npm registry `@puckeditor/core`, `grapesjs`.
- [GrapesJS Traits](https://grapesjs.com/docs/modules/Traits.html), [Components](https://grapesjs.com/docs/modules/Components.html), [Symbols](https://grapesjs.com/docs/guides/Symbols.html), [Components API](https://grapesjs.com/docs/api/components.html), [Data Sources](https://grapesjs.com/docs/modules/DataSources.html), [Storage](https://grapesjs.com/docs/modules/Storage.html), [Blocks](https://grapesjs.com/docs/modules/Blocks.html), [Layers](https://grapesjs.com/docs/modules/Layers.html).
- [CodePen licensing](https://blog.codepen.io/documentation/licensing/), [prefill](https://blog.codepen.io/documentation/prefill/), [URL extensions](https://blog.codepen.io/documentation/url-extensions/).

Probes: `/tmp/claude-3003/-mnt-pool1-home-guru-eac/7236b31a-7646-4e28-8b29-be60fa6c575f/scratchpad/probes/` (`blocks_quant.py`, `blocks.json`, `pages.json`, rendered series HTML).
