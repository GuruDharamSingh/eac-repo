# Studio: one authoring surface for the network (brief, 2026-09-27)

Design brief for a single content-authoring application ("Studio") that
replaces the five writing flows now spread across the org apps. Written from
four code surveys and one research pass on 2026-09-27; nothing here is built.
Decisions marked **(dev)** were taken by the developer in the design session
that day; the rest are proposals.

## 1. Why

Today the same act — a member writing a piece — has five entry points with
different behaviour (surveyed 2026-09-27, code paths cited):

| Flow | Where | Storage | Gaps |
|---|---|---|---|
| Artist-page desk | `cms-ui/writing/WritingDesk` via `/artists/<slug>/writing/<piece>?edit=1` (ifac, amrit, danamccool, sunjay, innergathering) | `threads.kind='writing'`, homed on `oad`, listed via `thread_orgs` | Desk capped at 63ch (`packages/cms-ui/src/writing/writing.css:228`); split mode halves it; no autosave; innergathering's piece page has no editor so Start → 404 |
| Writing room | `apps/amrit-canada/src/app/write` (untracked, amrit only) | same | no cover image; compact toolbar; opening from drawer checks wrong org (`write/page.tsx:31`); never listed on `/manage` |
| Hub compose page | `apps/ifac/.../hub/compose`, `apps/innergathering/.../hub/compose` | `threads.kind='post'` (org-owned) | Art piece and Blog kinds filtered out (`hasArtworks`/`hasMemberBlogs` unset); filler copy; ifac banner |
| Compose popup | `cms-ui/surface/surfaces/ComposeSurface` | `post` | long-form in a dialog; "Open as a page" only wired in ifac (`HubSurfaces.tsx:181`) |
| `/manage` forms | hidden-enneagram, amrit (`components/manage/content-form.tsx`) | `post`, service | per-app; boxed layout (`max-w-2xl` without `mx-auto`) |

All published pages already render through one component,
`packages/cms-ui/src/article/ArticleView.tsx`. The presentation problem is
therefore small; the authoring problem is the one to solve.

## 2. Decisions taken (dev, 2026-09-27)

1. One kind for long-form writing: `writing`. The author owns the row. Org sites
   show pieces listed on them (`thread_orgs`) in the org's own style. `post`
   is no longer offered for new long-form writing.
2. A piece may carry the org, or one of the author's pen names, as its byline
   ("publish as"). See §3.2.
3. Layout: an org may fix one layout for all writing shown on its site, or
   leave it open; when open, the author's per-piece choice applies. Each
   author has a default layout for their directory (ArtDirect/OAD) profile.
4. Editor: one column that reads like the published page while writing.
   Preview is a toggle, not a split pane. Autosave. Import `.docx` / `.md`
   as a new draft. A "Write in Nextcloud" route for a bare document (§4.3).
5. Route on org sites: `/write`. `/manage` lists every content kind in rows.
6. Popups stay for quick posting and always offer "Open in Studio".
7. Workshops on innergathering get a page, not a dialog — but the workshop
   editor is **deferred**; the Studio ships Writing first (dev, later the
   same day).
8. Studio is the landing surface for a signed-in artist on ArtDirect/OAD and
   is reachable from arts-collective.com by a "Go to Studio" button.
9. Studio is a package mounted in `apps/arts-collective`, not a separate app
   (dev; supersedes the first draft of §4.1).
10. Every kind is available under every acting org, including "Just me".
11. Writing can be filed under a series on the author's page (§3.5).

## 3. Content model

### 3.1 Kinds in the Studio

The Studio has one tab per kind the acting org enables. Storage is unchanged;
the Studio is a new front end over `@elkdonis/services`.

| Tab | Row | Service entry | Notes |
|---|---|---|---|
| Writing | `threads` kind `writing` | `writing.ts` (`createWritingPost`, `updateWritingPost`, `setThreadListing`) | canonical home `oad`; listed per org |
| Artwork | `artwork` | commerce `createArtwork` | object with measurements, images, price |
| Event / Meeting | `threads` kind `event` / `meeting` | `posts.ts` | dated; org-owned |
| Workshop | `threads` kind `workshop` + sessions | workshops service | replaces innergathering dialog |
| Service | `workshop_pages`-backed offering | `upsertServiceOffering` | hidden-enneagram today |
| Questionnaire / Poll | `questionnaires` | existing | org managers only |
| Documents, wiki pages | — | — | out of scope: they live in Nextcloud / the forum wiki |

Existing gate flags (`packages/cms-ui/src/compose/catalogue.ts:147-229`)
become the org's Studio configuration: which tabs appear. No new gating logic.

### 3.2 Ownership, byline, placement

- **Owner**: `threads.author_id` (NOT NULL). Unchanged.
- **Home**: `threads.org_id`. Writing is homed on `oad`
  (`PERSONAL_ORG_ID`); org kinds are homed on the org.
- **Placement**: one `thread_orgs` row per org site the piece shows on. The
  "Show on" control in the Studio writes these. Per
  `docs/open/PERSON_PAGES_BRIEF_2026-09-26.md`, a listing is a listing, not
  an audience.
- **Byline** ("Publish as"): no new column. The platform already models
  acting identities in `identity_control` (migration 132): a pen name is a
  `users` row with no login, at most two per account
  (`packages/services/src/identities.ts:44`), and an org speaks through
  `organizations.profile_user_id`. `listActingIdentities` returns
  self | pseudonym | organization. The forum write path already uses it
  (`forum-write.ts:253-296`, `authorId: actor.identityId`); writing does not
  (`writing.ts` authorises via `canEditProfile`, self or admin only). The
  Studio resolves the chosen identity with `resolveActor` and writes it to
  `author_id`; ownership for editing is then "account behind the identity",
  which needs `canEditWriting(viewer, post)` to consult `getIdentityIds`.
  The first draft of this brief proposed a `byline_org_id` column; withdrawn
  2026-09-27 in favour of the existing mechanism.

### 3.3 Layout

- New nullable column `threads.layout` (text; values in §5). NULL means
  "author's default".
- New nullable column `user_profiles.writing_layout` (author default; check
  `\d` for the actual profile table before writing the migration).
- New nullable column on the org (`organizations.writing_layout`): when set,
  overrides both for pages served by that org's app. Resolution at render:
  `org.writing_layout ?? thread.layout ?? author.writing_layout ?? 'essay'`.
- `ArticleView` gains a `layout` prop and renders all four presets; each app's
  theme styles them with its own tokens.

### 3.5 Series

No grouping of a person's writing exists today (`threads.section` is NULL
for writing and refers to `org_feeds`; `thread_topics` are forum/wiki tags).
Proposed: table `writing_series (id, author_id, title, slug, description,
sort_order, created_at)` and nullable `threads.series_id`. A series is the
author's, shows on their directory page as a heading with its pieces in
order, and is carried through to org sites that list the piece (shown as a
kicker above the title). Layout presets are per piece, not per series.

### 3.6 Body formats

`threads.body_format` already allows `html | md | mdx`, but nothing renders
`md` (`apps/arts-collective/src/components/ArticleBody.tsx:35-56` prints it
in a `<pre>`; `marked` is a dependency of `cms-ui` and `ui` but never
imported). The Studio needs one renderer: `marked` → `sanitizeRichText`,
used by `ArticleView` for `md` bodies and by Import. This unblocks the
Nextcloud route (§4.3), which produces Markdown.

### 3.4 Canonical URL

Each piece's canonical URL is on the author's directory profile
(`directory.arts-collective.com/<slug>/writing/<piece>`, later the OAD
domain). Org-site copies emit `<link rel="canonical">` to it and show
"Originally on …". Rationale: same network, near-identical markup; Google's
2023 syndication guidance (noindex) is for third-party copies.

## 4. The Studio application

### 4.1 A package, mounted in arts-collective (dev, 2026-09-27)

`packages/studio` (`@elkdonis/studio`): the frame, the per-kind editors, the
drafts drawer, autosave, import and the settings panel, exporting React
components and server-action factories. `apps/arts-collective` mounts it at
`/studio` (arts-collective.com is the network hub and already brokers SSO).
ArtDirect mounts the same package as its signed-in landing. Org sites do not
mount it: their `/write`, `/manage` Edit links and every "Open in Studio"
button redirect through the existing SSO handoff to
`arts-collective.com/studio?org=<org_id>&kind=<kind>&id=<thread id>`.

Reasons:
- One production build to redeploy per Studio change (arts-collective), with
  ArtDirect second. No new container, port or proxy host.
- The package can later be mounted in an org app if one needs it in-site.
- One place for autosave, import, media upload and the drafts list.

Cost: the writer leaves the org site's chrome while writing. The Studio top
bar shows the acting org's name and a "Back to <site>" link; Preview renders
the target org's layout policy.

The first draft of this section proposed a separate `apps/studio`; withdrawn
the same day.

### 4.2 Screen anatomy (desktop ≥ 1000px)

```
┌ top bar ────────────────────────────────────────────────────────────────┐
│ Studio · [acting org ▾]   Writing  Artwork  Events  Workshops  Services │
│                                          saved 12s ago   Preview  Publish│
├ drawer 280px ┬ editor column (max 68ch, centred) ┬ settings 300px ──────┤
│ + New        │  Title                            │ Publish as  [me ▾]   │
│ ⇪ Import     │  Standfirst                       │ Show on   ☑ IFAC     │
│ Drafts       │  ┌ cover image ┐                  │           ☐ Amrit    │
│  · piece     │  body (TipTap, full toolbar,      │ Layout    [essay ▾]  │
│  · piece     │   floating on selection)          │ Slug, date           │
│ Published    │                                   │ Reading time, words  │
│  · piece     │                                   │ History (versions)   │
└──────────────┴───────────────────────────────────┴──────────────────────┘
```

- Drawer and settings panel collapse independently; the editor column stays
  at its measure and re-centres. Nothing stretches text to the viewport.
- Preview replaces the editor column in place (toggle), using the resolved
  layout for the first org in "Show on", with a switch to compare.
- Mobile (< 1000px): drawer and settings become bottom sheets behind two
  buttons in the top bar; editor fills the width with 16px gutters;
  `overflow-wrap: anywhere` on the body.

### 4.2a Focus mode (dev, 2026-10-03; deployed)

The default view since 2026-10-03; the three-column layout above is "Full
studio". It carries the org sites' writing room
(`apps/amrit-canada/src/components/writing-room/`) into the package:
- One 44px bar: ☰, status (`Draft · Saved 14:02 · 312 words`), New, Preview,
  Publish/Unpublish. It dims to 0.18 while typing and returns on mouse move,
  hover or keyboard focus.
- The page is a title and a body. The compact editor toolbar (or the
  canvas's bar in blocks mode) shows only while the body has focus and dims
  to 0.25 while typing. The canvas hint line was removed and "+ Block" is now "+".
- ☰ opens a panel from the left with Pieces and Settings tabs, "Full studio"
  and "Back to the hub". Settings adds "Writing as", Cover and Standfirst
  (portalled from `WritingEditor`, `packages/studio/src/writing/WritingEditor.tsx`).
- Palette: the writing room's warm dark (`#161513` / `#e9e4da` / `#e6b422`)
  replaces both Studio themes while focused; type stays Newsreader / IBM Plex.
- Same element tree as the full layout, restyled under `.studio--focus`
  (`packages/studio/src/studio.css`), so switching modes does not remount the
  editor. The choice is stored in `localStorage['studio:focus']`.

### 4.3 Per-kind editor pages

Each tab is the same frame (drawer · main · settings) with a kind-specific
main column and settings list.

**Writing** (phase 1; the rest of this section is for later phases).
Title, standfirst (≤ 400 chars), cover, body. Settings: publish as (self,
pen names, the org), channel on the org, show on (one wrapping row of
checkboxes), visibility and network feed, series, layout, slug, history.
Actions: Save (manual, in addition to autosave), Preview, Publish/Unpublish,
Remove (archives).

"New piece" offers three routes:
- *Blank piece*: the editor above.
- *Write in Nextcloud Office* (dev: `.docx`, not the `.md` thread document):
  creates the thread and a `.docx` in the author's
  `EAC_Network/users/<slug>/Documents/`, then opens it in Nextcloud Office.
  **Verified 2026-09-27** (`docker ps`): `nextcloud-aio-collabora` is
  running, so Office is available; nothing in the repo yet creates a `.docx`,
  builds a richdocuments edit URL, or converts one (no `mammoth`, no
  Collabora `convert-to` call). The Studio page for such a piece keeps title,
  cover, series and placement, shows the body read-only, and offers "Pull
  latest": convert `.docx` → HTML (Collabora's `convert-to` endpoint on the
  running container is the first candidate; `mammoth` in Node is the
  fallback), then `sanitizeRichText`, `body_format='html'`. Publish pulls
  first. The existing `attachThreadDocument`/`syncThreadDocument`
  (`packages/services/src/thread-document.ts`) are the `.md` predecessor and
  can be generalised (file kind, converter) rather than replaced. This is the
  "bare document" template; it renders with the `document` layout preset (§5).
- *Import a file*: §4.3 Import below.

**Settings panel, all kinds:** publish as · channel on the org · show on ·
visibility and network feed · kind-specific group · Connections (related
threads via `thread_gathers`, "open a discussion in the org's forum" with the
board suggested from the channel) · Search and sharing (SEO title,
description, share image, index yes/no; today only `workshop_pages` has SEO
columns, so writing needs `threads.metadata.seo` or three columns) ·
address · history.

**Media:** a Library button in the toolbar and a Library section in the
drawer, built on the shared `MediaPicker`/`MediaBrowser`
(`packages/cms-ui/src/files/`), which already have Upload and Library tabs
over `/api/upload` and `/api/media/library`. Cover images on every kind,
including events and meetings (the shared field list has
`cover_image_url`; the popup forms hide it).

**Editor gaps to close for phase 1** (`packages/cms-ui/src/editor/RichTextEditor.tsx`,
surveyed 2026-09-27): images only by URL prompt (no upload, drop, paste),
no `figure`/`figcaption`, no H4 button though H4 is enabled, embeds YouTube
only (sanitizer also allows Vimeo), no inline code, footnote, horizontal
rule, undo/redo or word count in the toolbar, no slash menu. Captions and
footnotes also need `figure`, `figcaption` and a footnote markup added to
`sanitizeRichText` (`packages/utils/src/sanitize.ts:112`), or they are
stripped on save.

**Artwork.** Main: image strip (drag to reorder, first is the cover), title,
year, medium, dimensions (W × H × D + unit), description. Settings: show on,
availability (for sale / not / sold), price and currency, edition, store
listing. Preview shows the artwork card and detail page.

**Event / Meeting** (later phase). Fields are the shared list in
`packages/cms-ui/src/compose/content-fields.ts:121`: title, body, excerpt;
`scheduled_at`, `time_zone`, `duration_minutes`, `recurrence_pattern`
(DAILY/WEEKLY/MONTHLY), `recurrence_until`, `recurrence_custom_rule`
(display only); `format`, `location`, `meeting_url` or `create_talk_room`,
`create_document`; hosts (`host_user_id`, `co_host_user_id`, otherwise the
rota); RSVP block (`is_rsvp_enabled`, `attendee_limit`, `rsvp_deadline`,
`min_attendees`, `notify_on_min_attendees`); `video_link` (recording);
cover, `feed_slug` (the channel), visibility, `share_to_network`. A weekly
meeting is one row with `recurrence_pattern='WEEKLY'`; occurrences are
expanded at read time and rota/notes/attendance key on `(thread_id,
occurrence_at)`. Known: arts-collective's `createThreadAction` is
insert-only, so editing through the popup may duplicate; and occurrence
expansion drifts across DST (`packages/utils/src/recurrence.ts:120`).

*Plan ahead* (dev: manage it from the Studio too). Exists as the shared
`PlanAheadSurface` (`packages/cms-ui/src/hub/PlanAheadSurface.tsx`), mounted
in the innergathering and ifac hubs, over `packages/services/src/meeting-rota.ts`
and tables `meeting_hosts` (136) and `meeting_occurrence_notes` (136, plan
columns in 159). Per occurrence today: host and co-host, plan text, notes
and attendance afterwards. Not today: cancel or move one occurrence, a
per-occurrence document, per-occurrence RSVPs (`thread_rsvps` keys on
`(thread_id, user_id)`); the "meeting light" marks one occurrence at a time
in `threads.metadata`. The Studio's meeting page embeds `PlanAheadSurface`
as-is in phase 2; cancel/move need a `meeting_occurrence_overrides` table
(thread_id, occurrence_at, status, moved_to, location) and are a later item.

**Workshop — deferred.** The arts-collective `WorkshopForm`
(`apps/arts-collective/src/components/hub/WorkshopForm.tsx`) has eight tabs
(Core, Description, Schedule, Pricing, Registration, Media, SEO, Sections,
Publishing) writing to `threads`, `workshop_pages` and `workshop_sessions`,
with a workshop space behind the published page
(`docs/reference/workshops-and-lms.md:76-101`). The innergathering popup
path (`workshop-adapter.ts`) drops `meeting_url`, `create_talk_room`,
recurrence, `share_to_network` and INVITE_ONLY on save. This needs its own
design pass; the mockup's Workshops tab is a sketch of that form inside the
Studio frame, kept to show the frame holds it.

**Service.** Main: title, summary, body, cover. Settings: price/duration,
booking link, show on. Replaces the hidden-enneagram `/manage` form.

**Questionnaire / Poll.** Main: question list editor (existing component).
Settings: audience, open/close dates. Managers only.

**Import.** Drawer action. Accepts `.docx`, `.md`, `.txt`. Converts to
editor HTML (mammoth for docx, existing markdown parser), runs
`sanitizeRichText`, creates a draft, opens it. Images inside a `.docx` are
uploaded through the existing `/api/upload` path.

### 4.3a The editor column as a viewport (dev, 2026-09-27; later phase)

Designed the same evening: `docs/open/BLOCK_CANVAS_BRIEF_2026-09-27.md`
(the essay canvas: TipTap block document, JSON source + server-rendered
HTML, named-line grid with content/wide/full, ten blocks, ten rules).

The developer's direction for the centre column: a canvas where pictures
and text are placed and moved by drag and drop, rather than images embedded
through the rich-text editor's toolbar. That is a block editor with a layout
model (blocks with position, width and flow; Puck already exists in the tree
for pages; Gutenberg and Ghost's Koenig are the reference for posts). The
TipTap column shipped in phase 1 is a stand-in: its HTML body stays the
storage format, so a block editor can be introduced later by serialising
blocks to the same sanitised HTML (figures, columns, pull quotes) without a
migration. Open: whether `body_format='blocks'` with a JSON body is wanted
instead, which would need a renderer on every org site.

Also decided the same day (built in build 9): opening the Studio lands on a
blank piece, created on first save; "New ▾" in the top bar lists every kind
plus Gallery and Document library; the cover is a thin row above the title.

### 4.4 Draft safety

Three layers, in order of cost:
1. Local copy in `localStorage` keyed `studio:<userId>:<threadId>`, written
   1s after the last keystroke. On open, if newer than the server copy, offer
   Restore / Discard.
2. Server autosave 2s after typing stops and on blur (the amrit room's
   cadence, `writing-room.tsx:98-103`). Autosave never changes `status`.
3. A revision row on every explicit Save and on Publish. Needs a
   `thread_revisions` table (migration); the History list in settings reads
   it. Autosaves overwrite each other and do not create revisions.
`beforeunload` is registered only while the local copy is ahead of the server.

### 4.5 Entry points

| From | Action |
|---|---|
| Org site `/write` | redirect to Studio with `org` preset |
| Org site `/manage` row "Edit" | redirect with `org`, `kind`, `id` |
| Compose popup (any kind, any org) | "Open in Studio" button in the header, next to close; catalogue pane also offers it per kind |
| Artist page writing shelf "Start a piece" | creates the draft, then redirects to Studio |
| `/hub` "Writing" door | redirect |
| arts-collective.com hub | "Go to Studio" button |
| ArtDirect/OAD, signed in | Studio is the landing page; the public profile is one click away |

### 4.6 Reading side (`/manage`)

Every org app's `/manage` becomes a list of rows across all kinds the org
enables, filtered by `org_id = ORG OR listed on ORG` (today it excludes
`writing`; `OFF_FEED_KINDS` is for feeds, not for management). Each row's
Edit opens the Studio. No editing on `/manage` itself.

## 5. Layout presets

Rendered by `ArticleView`, chosen per §3.3. Names are working titles.

| Preset | Column | Cover | Title | Extras |
|---|---|---|---|---|
| Essay | 63ch | above title, inside column | large serif | standfirst, reading time (today's look) |
| Feature | 68ch text | full-bleed, title over image | display size | images and pull quotes break out of the column |
| Note | 56ch | none | small | date only; suits short pieces |
| Announcement | 63ch | optional, small | medium | coloured band from the org accent; date/place block; one action button |
| Document | 74ch, sans | none | small | the bare template: a Nextcloud-authored `.md` body rendered plainly |

An org fixing a layout picks one of these; the author's profile default is
one of these; NULL resolves to Essay.

## 6. Rollout

**Phase 0 — quick fixes in the existing apps (no Studio yet).**
- innergathering blog banner: half height, "Blog" left, tagline inline
  (`components/feed-banner.tsx`, `[feed]/page.tsx:87-89`).
- innergathering: remove "Make something / Pick what it is…" copy
  (`hub/compose/page.tsx:37-40`); set `pageHref` in `HubSurfaces.tsx` so the
  popup shows "Open as a page"; fix the Start → 404 on the writing shelf by
  routing `?edit=1` to `WritingDesk` as ifac does.
- ifac: remove the compose banner and "Back to the hub"
  (`hub/compose/page.tsx:48-54`); widen `.eac-desk` on ≥1000px and give the
  body `overflow-wrap: anywhere` (`writing.css`).
- amrit: fix `write/page.tsx:31` to use `isListedOn`.

**Phase 1 — `@elkdonis/studio` with the Writing tab, mounted in
arts-collective.** 2026-09-27: first slice deployed (built three times the
same day: the first build passed a function prop to the client shell and
returned 500 signed in; the second fixed that; the third fixed a 400px
top-bar overflow). Verified by signed-in render through the edge and
screenshots. `packages/studio` (shell, kinds registry, writing editor with 2s
autosave, Ctrl-S, unload guard, cover upload, Preview via `ArticleView`,
Show on, Publish/Unpublish, Remove), `apps/arts-collective/src/app/studio`,
`src/lib/studio-actions.ts`, landing masthead link, `CenterLinks.studioHref`
set by the org Center. Not in the slice: layout, series, pen-name byline,
`.docx` route, SEO, revisions, Markdown renderer. Decision recorded the same
day: the compose surface's "Open as page" should go to the org site's
writing desk for post-like kinds, not to a hub compose page. Remaining
phase-1 items (2026-09-27 evening: layout presets, series, Publish as,
Search and sharing and the Library shipped in builds 19–24 as
`metadata.layout`, `metadata.series`, `metadata.byline` and `metadata.seo`
rather than columns; still open: `thread_revisions` and History, the
`.docx` Nextcloud Office route, the `writing_series` table, the author-
default layout, and wiring `layout`/`series`/`byline`/`seo` into each org
site's piece page — IFAC done, ArtDirect with the other session): Migrations for `threads.layout`, `writing_series` +
`threads.series_id`, `thread_revisions`, author default layout. Writing
write path accepts an acting identity (§3.2). Markdown renderer (§3.6).
Editor gaps (§4.3). `ArticleView` presets. `/write` redirects from ifac,
amrit, innergathering, hidden-enneagram, danamccool. ArtDirect: Studio as
signed-in landing. Import and the Nextcloud route.

**Phase 2 — Artwork, Events/Meetings, Services, Questionnaires.** Retire
the hidden-enneagram `/manage` form.

**Phase 2b — Workshops.** Own design pass first (§4.3). Retire the
innergathering dialog.

**Phase 3 — retire.** Remove `WritingDesk` edit mode, the amrit room, the
hub compose pages and `/manage` forms. Popups keep quick post only.

## 7. Foundation: the Studio as the network's CMS

The developer's framing (2026-09-27): each app carries its own small CMS,
but the Studio is the main one and will grow (audio and video posts,
webcam recording, photo editing, a map for in-person meetings, cross-posting
to YouTube/Instagram/Facebook, workshop-space preview). This section sets
the foundation so those are additions, not rewrites. Research summary from
the same day is in §7.3.

### 7.1 Extension registry

The shell renders from one registry and never imports an extension by
name. Shape, following Sanity `definePlugin`, Payload plugins and Gutenberg
block registration:

```ts
type StudioExtension = {
  id: string;
  tabs?: TabDef[];            // a kind: editor component, settings groups, list query
  blocks?: BlockDef[];        // editor blocks: image, gallery, audio, video, map, embed
  settingsPanels?: PanelDef[];// e.g. SEO, Connections, Syndication
  documentActions?: ActionDef[]; // e.g. "Open in Nextcloud Office", "Record video"
  assetSources?: SourceDef[]; // Nextcloud library, upload, camera
  hooks?: { beforeSave?; afterPublish? }; // e.g. push to Postiz after publish
};
```

Writing is extension #1. Artwork, events, meetings, services, questions and
workshops each register a tab later. A video editor or webcam recorder is a
`block` + `assetSource` + `documentAction`; a map is a `block` that stores
lat/lng on the row; syndication is a `settingsPanel` + `afterPublish` hook.

### 7.2 Shared primitives every extension relies on

- **Asset row.** Media becomes a first-class record (Nextcloud path, mime,
  width/height, alt text, focal point, blurhash, owner, org), served through
  one `/media` route with Sharp transforms. Today uploads write straight to
  Nextcloud and store a URL in `metadata.coverImageUrl`; the Library needs
  the row to search and reuse.
- **Drafts, revisions, scheduled publish.** `thread_revisions` (§4.4) plus a
  `publish_at` column and a job runner (a cron container or `pg_cron`);
  scheduled publishing is standard in every CMS and cheap to add before the
  second kind exists.
- **Preview.** Draft mode first: a cookie flips the org site's queries to
  include the viewer's drafts, so Preview can open the real site page.
  Iframe live preview later. The workshop-space preview the developer asked
  for is this same mechanism pointed at the workshop route.
- **Placement and policy** stay on `thread_orgs` (many-to-many); per-org
  layout policy belongs on that row or on the org, never a single tenant
  column.
- **Connections** (per-user credentials for YouTube, Meta, etc.) are a
  Studio concern, stored encrypted per user, not per app. Postiz
  (self-hosted, AGPL, REST API) can hold the OAuth tokens and schedule, with
  the Studio pushing to it on publish; the `postiz` skill is already
  installed on this machine. Meta requires App Review for page/Instagram
  publishing and YouTube uploads from an unaudited project stay private, so
  those channels are promised only after review.
- **Recording.** `MediaRecorder` → chunked upload → ffmpeg transcode job →
  asset row. Browser WebM lacks a duration header and must not be served raw.
- **Maps.** Leaflet + OpenStreetMap tiles; geocode with Nominatim at
  authoring time only, store lat/lng on the event, no third-party script for
  visitors.
- **Photo editing.** Cropper.js for crop/rotate in the browser; filters
  server-side with Sharp; focal point on the asset row.

### 7.3 Build vs adopt (research 2026-09-27, recommendation: build)

- **Contentful, Strapi:** each owns its storage; the sites would read a
  second system of record over API and the existing `threads`/`thread_orgs`
  schema would need a sync layer. Contentful's paid tier starts near
  $300/month with a content-type ceiling. Not recommended.
- **Payload 3:** closest in stack (Next.js admin, Postgres via Drizzle) but
  its collections are Payload-shaped tables; existing tables can only be
  attached as unmanaged (no admin, no access control, no versions). Adopting
  it means migrating content into its shape and treating the current schema
  as legacy. Its multi-tenant plugin assumes one tenant column per row, not
  `thread_orgs`. Not recommended now.
- **Directus:** database-first and could sit over selected tables, but
  ignores any table without a single-column primary key (`thread_orgs`,
  `meeting_hosts`), does not enforce policies on the apps' direct Postgres
  reads, and has a Vue admin outside the sites. Possible later as an
  operator admin, not as the authoring path.
- **Borrow the shapes:** typed kinds with reusable field groups, one asset
  collection, draft/version/schedule, SEO group, hooks, and a config-object
  plugin API (§7.1).

## 8. Open questions

- Co-authorship (two people on one piece) is not covered by acting
  identities; revisit if wanted.
- Nextcloud Office route: which converter — Collabora `convert-to` on the
  running container (needs its internal URL and CORS/auth settings checked)
  or `mammoth` in Node. Decide by trying `convert-to` first.
- Whether an `assets` table should also index media already in Nextcloud
  (backfill by WebDAV listing) or only what passes through the Studio.
- Where the Studio sits relative to the Center (`/hub` network tab): the
  developer expects them to converge; not designed here.
- Where org sites should show a series (kicker only, or a series page).
- Should Studio sessions be long-lived (stay signed in for weeks) given the
  SSO handoff? Depends on the `getServerSession()` token fix noted in
  `CLAUDE.md`.
- Which tabs does `oad` itself enable for an artist with no org membership?
  Proposed: Writing and Artwork only.
- Domain for OAD: not yet registered; the Studio should not hard-code it.
- Whether `post` rows already published should be migrated to `writing`
  with `byline_org_id` set, or left as-is and only hidden from the composer.

## History

- 2026-10-04 (claude): §7.1 started. `packages/studio/src/frame.tsx`
  (`@elkdonis/studio/frame`): `StudioExtension`, `StudioColumns`,
  `StudioTopActions`/`StudioTopStatus`, `useStudioFrame`. `StudioShell` takes
  `extensions` + `initialKind`; with any registered it shows a Writing | … kind
  switch, "Making as", and renders the extension into its three columns (Focus
  mode stays writing's). Host registration is a client module
  (`apps/arts-collective/src/components/studio/StudioApp.tsx`). Video is the
  first extension (`videoExtension`, packages/reels); `/studio/video` redirects
  to `/studio?kind=video`. Publishing (§ later): a reel publishes as a
  `writing` piece with `metadata.video` (writing.ts `WritingVideo`; reels.ts
  `publishReel`), public copy in `users/<f>/Media/Videos/reel-<id>.mp4`;
  `ArticleView` has an optional `video`; ArtDirect's piece page passes it.
  Verified signed in (headless Chrome): kind switch, Video in the frame, dark
  theme, phone sheet; publish → anonymous ArtDirect piece 200 with playable
  video, unpublish → 404, republish → same address. Org sites' piece pages
  (amrit-canada, danamccool, ifac, innergathering) pass `video` in source since
  2026-10-04 (tsc clean); it shows after each site's next rebuild. sunjay's
  journal does not use ArticleView and shows the poster only. Still: the
  writing shelf does not mark video pieces; the Library is still per kind.
  Note: `.studio-drawer`/`.studio-settings` have `overflow: hidden`, so a
  sticky panel inside them never sticks and its `top` shows as a gap; the
  Video kind makes the columns themselves sticky scrollers (video-studio.css).

- 2026-10-03 (claude): Video kind live at `/studio/video` (own route, linked
  from "New ▾"; `packages/reels`), Broadcast at `/studio/broadcast` (admins,
  server OBS). Library: "My files" folder navigation and search fixed
  (`/api/my-files`), `kind` filter and video tiles added to `MediaBrowser`;
  Video slots reuse it ("From my files"). Still no asset row (§7.2) and no
  extension registry (§7.1): `STUDIO_KINDS` is a fixed list with an `href`.

- 2026-10-03: focus mode (§4.2a) deployed to arts-collective `/studio` in two
  builds. Verified by signed-in render (throwaway account, deleted afterwards)
  and screenshots at 1280px and 390px, in plain and blocks mode, including the
  side menu, the typing dim (computed opacity 0.18 bar, 0.25 toolbar) and the
  switch to Full studio and back.
- 2026-09-27 (deploy): phase-1 Writing slice deployed to arts-collective
  `/studio` across eight builds; the last three gave the Studio the mockup's
  own palette and type (dev: the host-themed first deploy "looked
  substantially different from the mockup"). Verified by signed-in render,
  screenshots in light, dark, Preview and 400px, and a computed-font probe
  (Newsreader / IBM Plex Sans).
- 2026-09-27 (third pass): Office `.docx` route replaces the `.md` one
  (Collabora verified running); Plan ahead, media library and SEO/Connections
  recorded against existing code; §7 Foundation added (extension registry,
  shared primitives, build-vs-adopt) from a headless-CMS research pass.
- 2026-09-27 (later): revised after developer review and two more surveys
  (workshop/meeting fields; identities, series, Nextcloud documents, editor).
  Studio becomes a package in arts-collective; byline uses
  `identity_control`; series and Markdown rendering added; workshops
  deferred; all kinds available under every org.
- 2026-09-27: brief written after surveys of ifac, amrit-canada,
  hidden-enneagram, innergathering, artdirect and a research pass on
  composer placement, draft safety, editor mode, syndication and layout
  presets. Mockup of the Studio screens published alongside.
