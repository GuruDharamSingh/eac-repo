# Studio as a pipeline (design, 2026-11-06)

Proposal to reorganise `arts-collective.com/studio` from nine side-by-side
kinds into one pipeline: material comes in, is made into something, lands in
one central channel, and goes out from there. Decisions taken
2026-11-06 (section 0); phase 1 is in source, not deployed. Supersedes nothing yet; relates to
`STUDIO_BRIEF_2026-09-27.md` and the Studio Video, Recordings and Posts notes
in `docs/reference/authoring.md`.

## 0. Decisions (developer, 2026-11-06)

- The central channel is one per person; an org channel may follow later.
- Posts are inverted: a piece first, social copies as its Out step.
- Shows are for every member.
- Phase 1 (lineage) first.
- Back to the four stages, In · Make · Channel · Out (developer, 2026-11-06).
- Routines (daily posting, a series or course obligation) are run by the LMS
  action layer (Sophia task steps over `packages/actions`, also the MCP-style
  assistant), not by a Studio feature. Plays (2.6) become LMS courses/runbooks.
- Main concern: a person who records with a webcam or a phone does not know
  how to continue in the Studio. One video path (2.8).
- Look: brighter, with a strong left column that manages channel, platform,
  socials and site as well as record/upload/create/share, merging with the
  Center (2.9).

## 0a. Phase 1 status (2026-11-06)

- Migration 248 (`studio_items`, `studio_item_links`, RLS, backfill of 19 reel
  projects and their source files) written and applied 2026-11-07 01:53 UTC (was the only
  pending file at the time). Dry-run on production inside BEGIN/ROLLBACK: 19 reel items,
  1 file item, 1 clip link. 2026-11-07 01:53 UTC: applied (by another
  session's migrate run for 249, with the developer's go-ahead for 248 the
  same evening); live rows match the dry run, RLS on.
- `packages/services/src/studio-items.ts` (export `@elkdonis/services/studio-items`):
  ensure/link/archive/move, `listStudioItems`, `getStudioTrail`; every write
  best-effort and a no-op while the table is absent.
- Wired: `reels.ts` create, save (source slots → links), archive, publish
  (reel → piece); `recordings.ts` upload finish (also the booth copy via
  `obs.ts`), rename, delete. Render worker unchanged.
- Verified: functional script against `elkdonis_scratch` (8 checks: slot
  links, slot change, rename, publish idempotent, trail both ways, delete keeps
  history, list by stage, reel archive); test rows and tables removed after.
  `check-types` arts-collective 0 errors; services' own check has 17 errors,
  none in these files (nextcloud, utils DOM lib, social-feeds).
- Not done: no UI reads lineage yet; arts-collective not rebuilt.

## 1. Current state (read 2026-11-06)

Each kind keeps its own store and its own way out. Nothing records that one
thing came from another.

| Kind | Store | Way out | Live rows (2026-11-06 query) |
|---|---|---|---|
| Recordings | Nextcloud files only (`packages/studio/src/recording/`) | link to Video, no hand-over of the file | — |
| Video | `reel_projects` → `reel_renders`, `reel_transcripts` | "Publish to my page": a `writing` thread with `metadata.video` (`packages/services/src/reels.ts:688`) | 19 projects, 0 published |
| Posts | `social_posts` | Post to Meta/Threads; first success mirrors to a thread (`metadata.socialPostId`) | 5 posts, 0 mirrored |
| Writing | `threads` kind `writing` | listings, series name, "Post to" (`share-actions.ts`) | — |
| Meetings | `threads` meeting rows | org feeds | — |
| Live | inside the Video drawer (`LiveCard`, relay, chat) | relay destinations | — |

Overlaps:
- "Series" is two things: a free-text name on writing pieces
  (`listWritingSeries`) and the `series` thread kind (scheduled meetings).
- "Template" is only a reel layout (`REEL_TEMPLATES`: `artwork-reel`, `clip`);
  there is no reusable preset for a recurring format.
- Social distribution exists twice: Writing "Post to" (`threads.metadata.shares`)
  and the Posts kind (`social_posts.shares`). `publish_jobs` already logs both
  (`source_kind` `thread` | `social_post`).
- Live streaming sits in the editing drawer.

## 2. Proposed model

### 2.1 The central channel

The channel is the published `threads` row: the piece. It already carries
org, listings, series, audiences (`min_role`), comments and external comments
(`thread_external_comments`). Every pipeline ends in a piece, and every
outgoing copy hangs off a piece. One person's or one org's channel is the list
of its pieces (ArtDirect page for "Just me", the org feed otherwise).

Inversion this implies: a social post is a distribution of a piece, not a
separate object that is later mirrored into one. The Posts kind becomes the
"Out" step of a short piece (text + pictures).

### 2.2 Stages

| Stage | What happens | Built from |
|---|---|---|
| 1 In | Record, upload, phone code, booth recording, pick from files | Recordings, `Capture`, booth copy |
| 2 Make | Turn material into a format: video (reel templates), writing, picture post, meeting | Video, Writing, Post, Meeting editors |
| 3 Shape | Show (series), preset, audience, schedule | writing series name, reel template, `min_role` |
| 4 Channel | Publish as a piece in the person's or org's channel | `threads` |
| 5 Out | Social copies, email, other org listings, live | `publish_jobs`, `share-actions`, relay |
| 6 Back | Comments, replies, plays returning to the piece | `thread_external_comments`, analytics |

### 2.3 Lineage (as built, migration 248)

`studio_items`: one row per thing in a person's pipeline; kind `recording` |
`file` (path) → `reel` (reel_id) → `piece` (thread_id); stage follows from
kind. `studio_item_links(source_id, target_id, role)`: role is the slot
(clip, clip2, extra, artwork) or `published`. A reel has several sources, so
links are a table, not a parent column. Renders are not items (reel_renders
hangs off reel_projects). Superseded draft (2026-11-06): one table with
`parent_id` and `ref_table/ref_id`.

Existing tables keep their roles; `studio_items` only links them. A recording
dropped into Video becomes the reel's parent; the render's child is the piece;
`publish_jobs` rows hang off the piece. The Studio home lists items by stage.

### 2.4 Shows and presets (the "routine")

A show is a named recurring line in a channel ("Studio notes"): a
`studio_shows` row with a preset (reel edit with `{n}`, `{date}`, `{title}`
placeholders, format, brand, music, subtitles on), default audience, default
Out targets. "New episode" creates a reel from the preset and, on publish, a
piece in the show with its episode number. The writing series name becomes
the show's name, so existing series read unchanged. The `series` thread kind
stays what it is (scheduled meetings) and is labelled "Meeting series".

### 2.5 Studio screens

- Top: In · Make · Channel · Out, replacing the nine kind tabs. Formats
  (Video, Writing, Post, Meeting) are choices under Make; unbuilt kinds
  (Artwork, Workshops, Services, Questions) are hidden until built.
- Channel view: the person's or org's pieces with show, status and where each
  went out, and a "Continue" on items still in In or Make.
- One Publish panel shared by all formats: channel, show, audience, Out
  targets (social accounts, other org listings).
- Live (Go live, relay, chat, Broadcast) moves to its own admin screen under Out.

### 2.6 Plays: the Studio's front (developer, 2026-11-06)

Correction (developer, 2026-11-06, later): plays are run by the LMS action
layer as courses or runbooks, not built into the Studio; the Studio shows the
current step in its left column (2.9). The play list below stays as input
for those courses.

The Studio opens on "What are you making?": a choice of goal, a play to run.
A play is an ordered list of steps; each step is an action-registry entry
(`packages/actions`: `status` says done, `run` performs it) or a Studio step
(record, make a reel, publish, post). Progress ticks from platform state and
lineage, as course task steps do; nothing is ticked by hand.

First plays (to confirm):

| Play | Steps |
|---|---|
| Public meeting series | series (series kind) → sessions → recordings → reels per session → pieces → posts |
| New artwork | photos → artwork reel → piece → (optional) 3D: orbit video → splat → piece + loft |
| Daily or weekly show | show preset → episode reel → piece in the show → posts |
| Just a post | text + pictures → piece → posts |

A play run is a row (`studio_runs`: owner, play id, org, started, finished)
whose items are the `studio_items` made inside it (`studio_items.run_id`,
later migration). The Studio home lists runs in progress with the next step;
"Just make something" skips the play and opens Make directly.

3D step: viewing exists (`packages/three/src/gallery/SplatObject.tsx`, drei
`Splat`, `splatUrl` on gallery objects). Making a splat from video does not.
The host has an Intel iGPU and no CUDA (checked 2026-11-06: `/dev/dri/renderD128`,
no `nvidia-smi`). Options: integrate an outside capture service (API, cost
and terms unknown, to research), a training worker on a GPU machine elsewhere,
or, first, upload of a `.splat`/`.ksplat` made in a phone app.

### 2.7 Drafts and deletion

State, 2026-11-06 query: 12 of 27 writing drafts empty (no text, no
`body_doc`); 17 of 19 reel projects with no files; 2 of 5 social posts empty.
Removal today is one open item at a time: Writing two-click "Remove"
(`StudioShell.tsx:1163`), Video/Posts/Meetings/Recordings `window.confirm`.
Writing, Video and Posts already archive rather than delete
(`deleteWritingPost` sets `status = 'archived'`; `reel_projects.archived_at`;
`social_posts.archived_at`); Recordings delete the file.

Proposal:
1. Delete from the list: a remove control on every draft row in every kind,
   no dialog, and an "Undo" bar for 8 seconds. Archive makes undo a restore.
2. "Clear empty drafts" per kind: one click archives every empty draft
   (writing without text or blocks, reel without files, post without text or
   pictures), with Undo for the batch.
3. Select several rows (checkboxes in a "Select" mode) and remove them together.
4. "Recently removed" per kind: archived in the last 30 days, Restore each.
   Writing restores to draft; published pieces are never removed from the
   list by these controls (unpublish first).
5. Fewer empties made: a reel project is created on the first file added,
   not on the template click; a blank writing piece is created only once it
   has a title or text (check what the current autosave writes before changing).
6. Recordings (real file deletes): row delete keeps the confirm, since there
   is no archive; or move to `Private/Video/.Removed/` for the same undo.
7. Lineage: removing a reel or recording archives its item; a reel that was
   published says so in the row ("published as …") and is not removed by
   "Clear empty".

Server side: one `removeDrafts(kind, ids)` / `restoreDrafts(kind, ids)` pair
per kind in arts-collective's actions, each checking ownership per id and
filtering by owner; no hard deletes.

### 2.8 One video path (2026-11-06)

Places that record, monitor, edit or broadcast video today:

| Job | Places |
|---|---|
| Record | reel slot recorder (`editor/Recorder.tsx`, capped 8-15 s per slot); Recordings `Capture` (camera, screen, phone, long takes); phone page `/c/<code>`; broadcast Camera panel (webcam into OBS and/or to `Private/Video/Camera`); OBS record → booth copy to `Broadcasts`; guest camera (WHIP) |
| Overlays | clip template overlays, post-production (Remotion, 11 kinds, FX incl. 5 matte transitions, `templates/fx-catalog.ts`); OBS OGraf graphics, live (`broadcast/GraphicsPanel.tsx`, `docker/obs/overlay/`) |
| Monitor / live | `/studio/broadcast` console; `/studio/broadcast/desktop` booth; Go live card in the Video drawer; relay panel, feeds, chat |

The OBS paths are admin-only and there is one OBS instance with a lease: one
person at a time.

Proposal:
- Record is one screen with sources: This camera · Phone · Screen · Upload ·
  Studio booth (OBS, when the lease is free; admins first). Every source
  lands in In (Recordings) with a lineage row. The slot recorder in the reel
  editor is replaced by "Pick from In / Record now", which opens the same Capture.
- After a take, one next step: "Make a clip" opens the clip editor on that
  recording (handoff `?new=clip&clip=` exists). Phone takes show a
  notification on the desktop Studio when they arrive.
- Overlays and transitions are applied in the clip editor for everyone.
  Live overlays come through OBS for booth takes. One overlay catalogue for
  both: a lower third, title or bug chosen in the booth is the same design
  as in the clip editor (OGraf manifests drawn by the Remotion overlays, or
  the reverse; to decide).
- Live (console, booth, Go live, relay) moves to Out → Live.

### 2.9 Layout: left column (2026-11-06)

Brighter ground (the Studio's own light identity), and a wide left column
that is the navigation for everything a person runs:

- Today: the current LMS routine step, if any ("Day 4: record today's clip").
- Create: Record · Upload · Write · Post.
- In · Make · Channel · Out (counts; Make shows drafts with Clear empty).
- Socials: connections and channels (from the Center's Connections).
- Site: pages, site style, org details (Center's org section) for owners and guides.
- Platform: profile, directory listing, store (the Center journeys).

The main area shows the chosen item; editors are unchanged at first.

## 3. Rules and constraints

- Keep `threads` as the only published object: feeds, search, comments and
  tenancy already work on it. Add a new `threads.kind` only with an
  `OFF_FEED_KINDS` decision.
- Do not delete `social_posts` or `metadata.video`: existing rows must read
  unchanged; migrate by linking, not rewriting.
- `studio_items` carries `org_id` and gets the `eac_tenant` RLS policy like the
  21 tables in migration 227.
- Files stay in Nextcloud; a media path without `Private/` is public, so In
  material is stored under `Private/` until it reaches the channel.

## 4. Phases

1. Lineage: done 2026-11-06 (migration 248 applied, hooks in source).
2. Drafts and deletion (2.7): list delete with Undo, Clear empty, Select,
   Recently removed, lazy creation. No migration.
3. Plays (2.6): play catalogue, `studio_runs`, Studio home on "What are you
   making?"; migration for `studio_runs` and `studio_items.run_id`.
4. Shared Publish panel; Posts publish a piece first, then Out.
5. Channel view; Live moved out of Video.
6. Shows and presets; "New episode".
7. Back: external comments and plays on the Channel view.
8. 3D: splat upload first; generation after the integrate/build decision.

Each phase is one arts-collective rebuild. Other sessions have uncommitted
work in `packages/reels`, `packages/studio` and arts-collective; check
`git diff` per file before editing.

## 5. Open questions (developer)

1. The first plays: the four in 2.6, or others?
2. 3D: integrate an outside service, build a worker on another machine, or
   upload-only for now?
3. Recordings deletion: keep the confirm, or a hidden removed folder for Undo?
